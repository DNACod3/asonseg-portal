# ADR-0010 (Técnico) — Visibilidade conservadora entre papéis via View Models tipados

- **Status:** Aceito
- **Data:** 2026-05-22
- **Decisores:** Bravi Arquiteto/Tech Lead, Bravi PO
- **Tags:** seguranca | autorizacao | lgpd | privacidade | dx

## Contexto e Problema

ADR-0017 de negócio estabelece uma **matriz de visibilidade complexa** entre papéis no Portal:

- Visitante anônimo vê vaga com empresa anonimizada
- Pessoa autenticada vê vaga com nome da Empresa
- Empresa-responsável vê candidato com primeiro nome + cidade + área + escolaridade + qualificações resumidas, mas **sem** CPF/e-mail/telefone/CV completo
- Após candidatura, empresa vê dados completos do candidato
- Serviço público mostra nome do prestador (público), mas **sem contato** até cliente manifestar interesse
- Ficha socioeconômica visível apenas a AS e diretoria

O desafio é traduzir essa matriz em código:

- Sem espalhar `if currentUser.role === ...` por todas as Server Actions e queries
- Sem expor acidentalmente um campo sensível por descuido (`SELECT *`)
- Com testabilidade (cobrir cada combinação papel-consultante × papel-consultado × ação afirmativa em testes)
- Com type safety — TypeScript deveria impedir compilação se código tenta acessar `.cpf` num retorno que não devia ter `cpf`

Decisão deliberada do ADR-0003 técnico: **não usamos RLS**. Toda visibilidade é mediada pela aplicação. Este ADR define **como**.

## Drivers de Decisão

- LGPD (princípio da minimização — art. 6º, III)
- Não-uso de RLS — autorização inteiramente em código de aplicação (ADR-0003 técnico)
- Auditabilidade do controle de acesso — revisor de PR consegue ver, no PR, o que cada papel pode acessar
- Type safety com TypeScript estrito — drift entre intenção e implementação é caro
- Performance — não pode ser tão verboso que crie atrito; helpers centralizam

## Opções Consideradas

### Opção A — Filtros em queries (`SELECT only certain columns`)

**Descrição:** cada query do Prisma usa `select: { ... }` específico por papel-consultante.

- **Prós:** simples
- **Contras:** `select` espalhado por todo o código; alterar a matriz exige caçar todas as ocorrências; sem checagem central

### Opção B — View Models tipados por papel-consultante (escolhida)

**Descrição:** funções dedicadas (`viewCandidateForEmployer`, `viewProviderForClient`, etc.) que retornam tipos TypeScript específicos com **apenas os campos visíveis** ao consultante. Cada função carrega a permissão e a verificação de ação afirmativa (ex.: "empresa só vê CV completo se candidato tiver candidatura ativa"). Compilador impede acessar campos não incluídos no View Model.

- **Prós:** matriz vive em um lugar (módulo de visibilidade); type safety força conformidade; revisão de PR vê facilmente; testes unitários cobrem cada combinação
- **Contras:** mais código; precisa convenção rígida para usar os helpers em vez de queries diretas

### Opção C — RLS no Postgres com policies por papel

**Descrição:** policies SQL no Postgres que filtram colunas/linhas por papel.

- **Prós:** defesa em profundidade no banco
- **Contras:** descartada no ADR-0003 técnico por motivos elaborados lá

### Opção D — Decorator/middleware "scrubber" que remove campos sensíveis após query

**Descrição:** queries retornam tudo; middleware filtra antes de mandar pra UI.

- **Prós:** menos invasivo
- **Contras:** dados sensíveis trafegam dentro do servidor mesmo quando não deveriam; risco de log incidentalmente registrar; sem type safety

## Decisão

Adotamos a **Opção B — View Models tipados por papel-consultante**, organizados em `src/modules/<source-module>/views/`.

### Padrão de implementação

**Tipos canônicos por View Model** (em `src/modules/persons/views/candidate-views.ts`):

```typescript
// View para visitante anônimo (não usado direto para candidato — listado por completude)
export type CandidateAnonymousView = never  // candidatos nunca expostos a anônimos

// View para Pessoa autenticada navegando perfis públicos
export type CandidatePublicAuthenticatedView = {
  personId: string
  firstName: string
  cityName: string
  primaryAreaOfInterest: string
  // Sem CPF, sem e-mail, sem telefone, sem CV, sem endereço
}

// View para empresa que vê candidato na lista de busca/candidatura
export type CandidateForEmployerView = CandidatePublicAuthenticatedView & {
  educationLevel: string
  educationArea: string | null
  qualificationsSummary: string
  cvPreviewExcerpt: string | null      // primeiras N palavras se CV existir
  // Ainda sem CPF, e-mail, telefone, CV completo
}

// View para empresa após candidato candidatar-se a vaga sua
export type CandidateForEmployerAfterApplicationView = CandidateForEmployerView & {
  email: string
  phone: string
  cvDownloadUrl: string                 // URL assinada com TTL 5min (ADR-0005 técnico)
  fullName: string
}

// View para AS/diretoria (acesso pleno)
export type CandidateForSocialAssistantView = CandidateForEmployerAfterApplicationView & {
  cpf: string
  birthDate: Date | null
  fullAddress: string | null
  socioeconomicRecord: SocioeconomicRecordView | null  // visível só para AS/diretoria
  referrals: ReferralView[]
  applications: ApplicationView[]
}
```

**Funções de acesso** (em `src/modules/persons/views/candidate-views.ts`):

```typescript
export async function viewCandidateForEmployer(
  candidatePersonId: string,
  viewerContext: ViewerContext,  // contém companyId, currentUser, etc.
): Promise<CandidateForEmployerView | null> {
  // 1. Verificar permissão básica
  if (!viewerContext.hasRole('COMPANY_RESPONSIBLE')) return null

  // 2. Buscar dados estritamente necessários
  const candidate = await prisma.person.findUnique({
    where: { id: candidatePersonId },
    select: {
      id: true,
      fullName: true,
      candidateProfile: {
        select: {
          primaryAreaOfInterest: true,
          educationLevel: true,
          educationArea: true,
          skillsText: true,
          cvStoragePath: true,
        },
      },
      // ... apenas o que vai compor o View Model
    },
  })

  if (!candidate?.candidateProfile) return null

  // 3. Verificar ação afirmativa para upgrade da view (candidatura ativa)
  const hasActiveApplication = await prisma.application.findFirst({
    where: {
      candidatePersonId,
      job: { companyId: viewerContext.companyId },
      cancelledAt: null,
    },
    select: { id: true },
  })

  // 4. Montar View Model na forma exata
  return {
    personId: candidate.id,
    firstName: extractFirstName(candidate.fullName),
    cityName: ...,
    primaryAreaOfInterest: candidate.candidateProfile.primaryAreaOfInterest!,
    educationLevel: candidate.candidateProfile.educationLevel!,
    educationArea: candidate.candidateProfile.educationArea,
    qualificationsSummary: summarize(candidate.candidateProfile.skillsText),
    cvPreviewExcerpt: hasActiveApplication
      ? null  // depois de candidatura, vai para a view "After Application"
      : extractFirstWords(candidate.candidateProfile.skillsText, 80),
  }
}

export async function viewCandidateForEmployerAfterApplication(
  candidatePersonId: string,
  applicationId: string,
  viewerContext: ViewerContext,
): Promise<CandidateForEmployerAfterApplicationView | null> {
  // verifica que applicationId pertence a empresa do viewer, etc.
  // ... constrói view com campos sensíveis revelados
  // registra audit log SENSITIVE_FIELD_VIEWED
}
```

### Convenções obrigatórias (project-guideline §X.Y)

1. **Server Actions e Server Components NUNCA consultam Prisma diretamente para retornar dados de uma Pessoa para outra.** Sempre via `viewXForY()`.
2. **Acesso direto via Prisma** é permitido apenas para "ver seus próprios dados" ou para operações internas (job de expiração, etc.).
3. **Toda função de view assíncrona registra audit log** quando reveladora de campos sensíveis (`SENSITIVE_FIELD_VIEWED`).
4. **Tipos das views são exportados** e usados como contrato — UI consome o tipo, não Prisma model.
5. **Lint custom planejado:** detectar imports de `@prisma/client` types em componentes React (forçar uso das views).

### Catálogo de views no MVP

| View Model | Localização |
|---|---|
| `CandidateForEmployerView` / `AfterApplicationView` | `src/modules/persons/views/candidate-views.ts` |
| `ProviderForClientView` / `AfterInterestView` | `src/modules/persons/views/provider-views.ts` |
| `ClientForProviderView` (após manifestação) | `src/modules/persons/views/client-views.ts` |
| `PersonForSocialAssistantView` (visão consolidada — USP-039) | `src/modules/persons/views/social-assistant-views.ts` |
| `JobAnonymousView` / `JobAuthenticatedView` | `src/modules/jobs/views/job-public-views.ts` |
| `ServiceAnonymousView` / `ServiceAuthenticatedView` / `AfterInterestView` | `src/modules/services/views/service-views.ts` |
| `CompanyForCandidateView` (após candidatura) | `src/modules/companies/views/company-views.ts` |

### Testes obrigatórios

Para cada View Model:
- Caso happy path (papel certo + condições afirmativas)
- Caso bloqueado (papel sem permissão → retorna `null`)
- Caso revogado (papel revogado → retorna `null`)
- Caso intermediário (papel certo mas sem ação afirmativa → view restrita)

## Consequências

**Positivas:**
- Matriz de visibilidade do ADR-0017 de negócio fica explícita em código TypeScript revisável
- Bypass acidental é difícil — tipo do retorno é forte; tentar acessar `.cpf` sem ele estar na view falha em compile time
- LGPD com minimização aplicada por design, não por boa intenção
- Testes cobrem combinatória — drift entre intenção e implementação é detectado cedo
- Sensitive access fica naturalmente registrado no audit log

**Negativas (trade-offs aceitos):**
- Mais código (10-15 view models no MVP) — mas cada um é pequeno e focado
- Desenvolvedor precisa aprender o padrão antes de produzir telas de visualização entre papéis — mitigado pelo project-guideline e por exemplos canônicos

**Neutras / a monitorar:**
- Se a matriz crescer (mais papéis no Release 2), considerar gerador de código (codegen) para reduzir boilerplate

## Riscos e Mitigações

**Risco 1 — Desenvolvedor faz `prisma.person.findUnique` direto numa Server Action e devolve para UI.** **Mitigação:** convenção rígida; revisão de PR; lint custom planejado que bloqueia imports de Prisma models em camada de componentes React.

**Risco 2 — Cache de Server Component vaza dados de uma Pessoa para outra.** **Mitigação:** Server Components que renderizam dado de outra Pessoa usam View Models (que verificam visibilidade a cada chamada); nunca cachear globalmente um View Model com dados de outro user (`React.cache` é per-request, não per-session).

**Risco 3 — Performance** de fazer múltiplas queries (Prisma + permission check + audit log) por view. **Mitigação:** volume baixo do MVP não justifica otimização prematura; se virar problema, agrupar em `prisma.$transaction([...])` ou usar `include` mais agressivo.

## Referências

- ADR-0017 de negócio (Visibilidade conservadora)
- ADR-0003 técnico (RBAC aplicacional sem RLS)
- ADR-T-0008 (Pessoa unificada — perfis usados pelas views)
- ADR-T-0009 (Consentimentos — view pode retornar `null` se consentimento revogado)
- PRD MVP Portal §2.2 (visibilidade), USP-021 a USP-035
- LGPD art. 6º (princípios), art. 7º, art. 18
- Lentes do arquiteto: Acoplamento & Coesão, Observability by Design, Compliance by Design
