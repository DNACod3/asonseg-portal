# ASONSEG — Project Guideline

**Projeto:** Portal Empregabilidade e Serviços (Release 1 — MVP) + fundação compartilhada
**Versão:** 2.0
**Audiência:** Tech Lead, desenvolvedores plenos, QA, DevOps da Bravi

Este guia operacionaliza os ADRs técnicos para o time. Convenções marcadas como ✅ são padrão; ❌ são anti-padrões a evitar; 💡 são dicas práticas; 🚨 são regras críticas que falham CI; ⚠️ exigem atenção.

---

## 1. Stack canônica

✅ **TypeScript 5.x strict** — `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess` habilitados
✅ **Node.js 20 LTS** (runtime Vercel)
✅ **Next.js 15.x App Router** — Server Components first, Server Actions para mutations
✅ **Prisma 5.x** + **Postgres 15+** (Supabase, região sa-east-1)
✅ **Zod 3.x** para validação de entrada de TODA Server Action e Route Handler
✅ **shadcn/ui + Tailwind + Radix** para UI
✅ **React Hook Form** para formulários (integra com Zod)
✅ **TanStack Query** apenas se houver necessidade real client-side (raramente — preferir Server Actions + `revalidatePath`)
✅ **date-fns + date-fns-tz** com timezone `America/Sao_Paulo` em todas as operações de data visíveis
✅ **pino** para logging estruturado server-side
✅ **Resend** para e-mail transacional
✅ **Sentry** para captura de erros + logs em produção
✅ **next-pwa** para PWA (manifest + service worker)
✅ **Vitest** para unitários e integração
✅ **Playwright** para E2E críticos
✅ **`@anthropic-ai/sdk`** para LLM (encapsulado no adapter — código consumidor não importa)
✅ **`@marsidev/react-turnstile`** para CAPTCHA (encapsulado no widget)

❌ **Não usar:** Redux, MobX, Zustand global, Jotai (estado de UI vive em React); ORMs alternativos; bibliotecas de CSS-in-JS além do Tailwind; date utilities além de date-fns; bibliotecas de máquina de estados para o fluxo de moderação (usamos enum + função canônica — ADR-T-0011).

---

## 2. Estrutura de pastas

```
src/
├── app/
│   ├── (public)/                          # ISR + on-demand revalidation
│   │   ├── page.tsx                       # home com indicadores
│   │   ├── vagas/page.tsx
│   │   ├── vagas/[id]/page.tsx
│   │   ├── servicos/page.tsx
│   │   ├── servicos/[id]/page.tsx
│   │   └── prestadores/[id]/page.tsx
│   ├── (auth)/                            # rotas de login/cadastro (sem cache)
│   │   ├── cadastro/page.tsx
│   │   ├── login/page.tsx
│   │   ├── recuperar-senha/page.tsx
│   │   └── reivindicar-credencial/page.tsx
│   ├── (app)/                             # autenticado — sem cache (force-dynamic)
│   │   ├── layout.tsx                     # exporta dynamic = 'force-dynamic'
│   │   ├── perfil/...
│   │   ├── empresa/...                    # gestão como Empresa-responsável
│   │   ├── candidato/...
│   │   ├── prestador/...
│   │   ├── moderacao/...
│   │   ├── social/...                     # AS
│   │   ├── coordenacao/...                # Coordenador
│   │   ├── direcao/...                    # Diretoria
│   │   └── relatorios/...
│   ├── api/                                # Route Handlers (uso restrito)
│   └── layout.tsx
├── modules/
│   ├── identity/
│   │   ├── actions/
│   │   ├── queries/
│   │   ├── domain/
│   │   ├── schemas/                        # Zod schemas
│   │   ├── components/
│   │   ├── ports/                          # interfaces
│   │   ├── adapters/                       # implementações concretas
│   │   ├── __tests__/
│   │   └── index.ts                        # barrel: o que o módulo expõe
│   ├── persons/
│   │   ├── ...
│   │   └── views/                          # View Models por papel-consultante (ADR-T-0010)
│   ├── companies/
│   ├── consents/
│   ├── moderation/
│   ├── jobs/
│   ├── services/
│   ├── referrals/
│   ├── cv-extraction/
│   │   ├── ports/
│   │   │   └── cv-extractor.ts            # interface CVExtractor
│   │   ├── adapters/
│   │   │   └── anthropic-claude-extractor.ts
│   │   ├── prompts/
│   │   │   └── extract-cv-pt-br.ts
│   │   └── actions/
│   ├── audit/
│   │   ├── withAudit.ts
│   │   └── events.ts                       # catálogo de event types
│   └── reporting/
├── shared/
│   ├── ui/                                 # componentes genéricos (Button, Card, ...)
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── supabase-server.ts
│   │   ├── supabase-storage.ts
│   │   ├── time.ts                         # date-fns + timezone
│   │   └── logger.ts                       # pino
│   ├── env.ts                              # Zod-validated env vars
│   ├── errors.ts                           # ActionError tipados
│   └── container.ts                        # binding de ports → adapters
└── ...

legal/
└── consent-terms/                          # ADR-T-0009
    ├── portal-access/v1.0.md
    ├── job-application/v1.0.md
    ├── cv-ai-extraction/v1.0.md           # cita Anthropic Claude
    └── ...

prisma/
├── schema.prisma
├── migrations/
└── seeds/

.github/
└── workflows/
    ├── ci.yml                              # lint + typecheck + test
    ├── backup-db.yml                       # ADR-T-0006
    ├── backup-storage.yml
    └── expire-jobs.yml                     # ADR-T-0011 (cron diário)
```

### Código compartilhado e estrutura raiz

🚨 **Código compartilhado entre módulos mora em `src/shared/` — nunca em `src/utils/` ou `src/lib/` no nível raiz.**

**Razão:** pastas com nome genérico no topo (`utils`, `lib`, `helpers`, `common`) têm padrão de degradação conhecido em projetos TS de longa duração — viram depósito sem dono, perdem coesão, criam acoplamento invisível entre módulos e não revelam intenção arquitetural. A palavra `shared` força a pergunta "shared do quê?" e suas subpastas declaram responsabilidade explícita (`ui/`, `lib/`, `errors`, `container`, `env`).

**Onde encaixar cada coisa:**

| Tipo de código | Onde vai | Exemplo |
|---|---|---|
| Infra transversal (banco, e-mail, logger, env, tempo) | `src/shared/lib/` | `prisma.ts`, `logger.ts`, `time.ts` |
| Componentes de UI genéricos (Button, Card, Skeleton) | `src/shared/ui/` | aliados ao shadcn/ui |
| Tipos e contratos transversais | `src/shared/{errors,env,container}.ts` | `ActionResult<T>`, env validado, container DI |
| Lógica de domínio específica de um módulo | `src/modules/<nome>/domain/` | formatador de salário em `jobs/domain/` |
| Helper que só interessa a 1 módulo | dentro do próprio módulo | NÃO em `shared/` |

✅ **Regra prática de promoção:** função usada por **2+ módulos** vai para `shared/`. Função usada por **1 módulo** fica no módulo. *"Vai um dia ser usada por outros"* não conta — promove quando o segundo consumidor aparece.

🚨 **Estrutura raiz de `src/` é fechada:** apenas `app/`, `modules/`, `shared/`. Criar pasta nova nesse nível (ex.: `src/workers/` para background jobs em V2) exige RFC leve — abrir issue/PR com justificativa, 10 minutos de discussão com o time, aprovação registrada. Não é burocracia; é fricção deliberada para que a estrutura raiz não cresça silenciosamente.

---

## 3. Estrutura de módulo

Cada módulo segue o mesmo template:

```
modules/<nome>/
├── actions/                                # Server Actions ('use server')
├── queries/                                # consultas read-only
├── domain/                                 # tipos, enums, regras de negócio puras (sem IO)
├── schemas/                                # Zod schemas + tipos derivados
├── components/                             # React components do módulo
├── views/                                  # View Models por papel-consultante (quando aplica)
├── ports/                                  # interfaces que o módulo consome (DI)
├── adapters/                               # implementações concretas das ports
├── __tests__/
└── index.ts                                # exporta APIs públicas; nada importa caminhos profundos
```

✅ **Import via barrel:** `import { activateRole } from '@/modules/persons'`
❌ **Import direto de subpasta:** `import { activateRole } from '@/modules/persons/actions/activate-role'`

---

## 4. Padrão de Server Action canônica

🚨 **Toda Server Action sensível segue este formato:**

```typescript
// src/modules/jobs/actions/createJobDraft.ts
'use server'

import { z } from 'zod'
import { withAudit } from '@/modules/audit'
import { requirePermission } from '@/modules/identity'
import { getCurrentUser } from '@/modules/identity'

const createJobDraftSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(50),
  areaId: z.string().uuid(),
  // ...
})

export async function createJobDraft(input: unknown) {
  // 1. Validar input
  const parsed = createJobDraftSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: { code: 'VALIDATION', issues: parsed.error.issues } }

  // 2. Verificar permissão
  await requirePermission('CREATE_JOB')
  const user = await getCurrentUser()

  // 3. Verificar consentimento de finalidade se aplicável (ADR-T-0009)
  await requireActiveConsent(user.personId, 'COMPANY_REPRESENTATION')

  // 4. Verificar pré-condições de negócio (atuar como, etc.)
  if (!user.actingAsCompany) {
    return { ok: false, error: { code: 'MUST_ACT_AS_COMPANY' } }
  }

  // 5. Executar com audit — assinatura `withAudit(event, fn, ctx?)`.
  //    O callback recebe `(tx, audit)`: `tx` é o client transacional e `audit`
  //    é um recorder mutável onde se anota entityType/entityId/before/after/
  //    justification (before/after só existem DEPOIS da operação rodar).
  return withAudit(
    'JOB_DRAFT_CREATED',
    async (tx, audit) => {
      const job = await tx.job.create({
        data: {
          ...parsed.data,
          companyId: user.actingAsCompany!.companyId,
          createdByPersonId: user.personId,
          status: 'DRAFT',
        },
      })
      audit.entityType = 'job'
      audit.entityId = job.id
      audit.after = job // PII é minimizada automaticamente (ver nota abaixo)
      return { ok: true, data: { jobId: job.id } }
    },
    // ctx (3º arg): ator + origem da request, preenchido na Server Action a
    // partir de getCurrentUser() + headers (x-forwarded-for, user-agent).
    { actorUserId: user.id, actorPersonId: user.personId, ip, userAgent },
  )
}
```

> **Minimização de PII (USP-044-P-008):** `before`/`after`/`context` passam por
> `normalizeJson`, que mascara como `[REDACTED]` as chaves sensíveis do baseline
> LGPD do logger (`SENSITIVE_FIELDS`: senha, token, cpf, e-mail, telefone…) em
> qualquer profundidade, além de normalizar `Date`→ISO e `BigInt`→string. É uma
> rede de segurança — ainda assim, atribua ao recorder apenas o necessário.
>
> **Justificativa obrigatória:** eventos de revogação/rejeição/inativação/edição
> retroativa (`JUSTIFICATION_REQUIRED_EVENTS`) exigem `audit.justification` não
> vazia; sem ela o `withAudit` lança e **toda a transação sofre rollback**.

### Regras desse padrão

- ✅ **Sempre** `'use server'` no topo
- ✅ **Sempre** Zod schema para input — não confiar em `unknown` sem validar
- ✅ **Sempre** `requirePermission` no início (ou justificar explicitamente quando não — ex.: ação pública)
- ✅ **Sempre** `withAudit` envolvendo escritas — tipo do evento vem do catálogo `@/modules/audit/events`
- ✅ Retorno padronizado `{ ok: true, data } | { ok: false, error }` — tipo `ActionResult<T>` em `@/shared/errors`
- ❌ **Nunca** `throw` em Server Action — sempre `return { ok: false, error }`
- ❌ **Nunca** `prisma.$transaction` fora de `withAudit` se a operação merece audit
- ❌ **Nunca** retornar Prisma model direto — retornar View Model ou tipo de domínio

---

## 5. Visibilidade conservadora — convenções

🚨 **Server Actions e Server Components NUNCA consultam Prisma diretamente para retornar dados de uma Pessoa para outra.**

✅ **Sempre via View Models** (`viewCandidateForEmployer`, `viewProviderForClient`, etc.) em `src/modules/<source>/views/`. Estes:
1. Verificam papel do consultante
2. Verificam ação afirmativa quando aplicável
3. Buscam apenas campos necessários
4. Retornam tipo TypeScript específico que não expõe campos sensíveis
5. Registram `SENSITIVE_FIELD_VIEWED` quando aplicável

```typescript
// ❌ Errado — vaza CPF para empresa
const candidate = await prisma.person.findUnique({ where: { id }, include: { candidateProfile: true } })
return <CandidateCard data={candidate} />

// ✅ Certo — View Model controla o que sai
const view = await viewCandidateForEmployer(candidateId, viewerContext)
if (!view) return notFound()
return <CandidateCard data={view} />
```

✅ Quando Pessoa vê dados próprios (`/perfil`), aceita-se Prisma direto desde que limitado ao próprio `personId`.

💡 **Lint custom planejado:** PR que importa Prisma model em componente React falha CI. Até implementação, é regra de revisão.

---

## 6. Máquina de estados de moderação

🚨 **Status de conteúdo (vaga/CV/serviço) NUNCA é atualizado por UPDATE direto.** Sempre via `transitionContent()` em `@/modules/moderation`.

```typescript
// ❌ Errado
await prisma.job.update({ where: { id }, data: { status: 'ACTIVE' } })

// ✅ Certo
await transitionContent({
  contentKind: 'JOB',
  contentId: id,
  to: ContentStatus.ACTIVE,
  trigger: 'MODERATOR_ACTION',
  justification: undefined,    // não exigida para aprovação
})
```

A função canônica:
- Valida transição contra `TRANSITIONS[kind]`
- Exige justificativa quando configurado
- Executa em transação + audit log
- Dispara side effects (e-mail, revalidation, flag de Empresa verificada)

Detalhes no ADR-T-0011.

---

## 7. Integração com LLM (CV extraction)

🚨 **Código consumidor depende APENAS da porta `CVExtractor`** — nunca do SDK do provedor.

```typescript
// ❌ Errado — acopla a Anthropic
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })
const response = await client.messages.create(...)

// ✅ Certo — depende da porta
import { cvExtractor } from '@/shared/container'
const result = await cvExtractor.extract({ personId, fileBuffer, mimeType, fileName })
```

Trocar de vendor = escrever novo adapter em `modules/cv-extraction/adapters/` + atualizar binding em `shared/container.ts`. Nenhuma outra linha de código muda.

Detalhes no ADR-T-0012.

---

## 8. Consentimentos LGPD por finalidade

🚨 **Sempre verificar consentimento ativo antes de operações vinculadas à finalidade:**

```typescript
// Em Server Action que envia CV ao LLM (USP-040)
await requireActiveConsent(user.personId, 'CV_AI_EXTRACTION')

// Em Server Action de candidatura
await requireActiveConsent(user.personId, 'JOB_APPLICATION')
```

`requireActiveConsent` retorna `ActionError` se ausente, sinalizando à UI para mostrar termo da finalidade e pedir aceite.

Catálogo de finalidades em `@/modules/consents/domain/purposes.ts`. Termos textuais em `legal/consent-terms/`.

---

## 9. Auditoria

🚨 **`withAudit('EVENT_TYPE', async (tx) => {...})`** — toda escrita sensível.

Catálogo de event types em `@/modules/audit/events.ts`. Não usar string solta — usar constante exportada (lint pega).

✅ Contexto rico:
```typescript
await withAudit('JOB_PUBLISHED', async (tx) => {
  // ...
}, {
  entityType: 'job', entityId: jobId,
  context: {
    companyId: user.actingAsCompany!.companyId,
    actingAsCompanyName: user.actingAsCompany!.legalName,
  },
})
```

Audit log é append-only por GRANT (ADR-T-0004) — nem mesmo um superusuário do app pode editar/deletar via Prisma.

Retenção: **1 ano** para audit_log operacional.

---

## 10. Estilo de UI

- ✅ shadcn/ui base + Tailwind config
- ✅ Cores: paleta corporativa da ASONSEG (carregar Brand guidelines na Fase 0)
- ✅ Tipografia padrão Inter (Google Fonts) — boa legibilidade
- ✅ Componentes de formulário: React Hook Form + Zod adapter
- ✅ Toasts via `sonner`
- ✅ Loading skeletons com `<Skeleton />` do shadcn (CV extraction tem skeleton específico durante 5-30s)
- ✅ Mensagens de erro em PT-BR amigável, nunca mostrar stack trace
- ❌ Nunca renderizar Prisma model direto — sempre View Model ou tipo de domínio

---

## 11. Internacionalização e timezone

- Idioma único: PT-BR. Não preparar i18n no MVP.
- Timezone: `America/Sao_Paulo` — usar `formatInTimezone` de `date-fns-tz` em todas as datas visíveis.
- Banco armazena `timestamptz` (UTC interno). Conversão na borda apenas.

---

## 12. Testes

| Tipo | Framework | Cobertura mínima |
|---|---|---|
| Unitário (domain) | Vitest | 90% nas funções de regra de negócio |
| Integração (Server Action + Prisma) | Vitest com banco efêmero | 80% em Server Actions sensíveis |
| Component | Vitest + Testing Library | UI dos fluxos críticos |
| E2E crítico | Playwright | Top 8 fluxos (Seção 6 do `architecture-document.md`) |

🚨 **Casos obrigatórios em testes de Server Action:**
- Happy path
- Validação Zod falha
- Permissão recusada (`requirePermission` throw)
- Consentimento ausente
- Concorrência (quando aplicável — ex.: aprovação dupla de mesma vaga)

Cobertura geral alvo: **70%**. Falhas no CI se < 65%.

---

## 13. Performance defensiva

- ✅ Índices em colunas usadas em WHERE (`status`, `personId`, `companyId`, `regionId`, `areaId`, `cnpj`, `email_login`)
- ✅ `Prisma.findMany` sempre com `take` (paginação obrigatória)
- ✅ `select`/`include` explícito em queries quentes (não retornar tudo)
- ✅ `unstable_cache` com tags para queries de conteúdo público (ADR-T-0013)
- ❌ N+1 — usar `include` ou `findMany` agrupado

---

## 14. Segurança operacional

- 🚨 **Secrets apenas em Vercel env (Production/Preview/Development separados).** Nada em `.env.example` além de placeholders.
- 🚨 **Validação de env vars com Zod em `@/shared/env.ts`** na bootstrap — falha rápido se chave faltando.
- ✅ Rate limiting em endpoints públicos (CAPTCHA cobre auto-cadastro; rate-limit by IP em recuperação senha, busca de candidato, etc.)
- ✅ CSRF: Next.js Server Actions têm proteção embutida; manter
- ✅ XSS: React escapa por padrão; cuidado com `dangerouslySetInnerHTML`
- ✅ Validação MIME real em uploads via lib `file-type` (não confiar em Content-Type)

---

## 15. Conventional Commits

Escopos válidos no MVP (alinhados aos módulos):

`identity`, `persons`, `companies`, `consents`, `moderation`, `jobs`, `services`, `referrals`, `cv-extraction`, `audit`, `reporting`, `infra`, `docs`, `tests`, `ci`

Exemplos:
- `feat(jobs): publicar vaga com validação de Empresa-responsável`
- `fix(consents): corrigir cascata na revogação de finalidade 7`
- `chore(infra): provisionar staging Supabase`
- `test(moderation): cobrir transição inválida JOB`

---

## 16. CI/CD

| Workflow | Trigger | Função |
|---|---|---|
| `ci.yml` | push/PR | lint + typecheck + test |
| `backup-db.yml` | cron 04:00 UTC | dump Postgres → B2 |
| `backup-storage.yml` | cron 04:30 UTC | rclone sync buckets → B2 |
| `expire-jobs.yml` | cron 06:00 UTC | rodar `expireOverdueJobs` |
| Vercel auto-deploy | push master | deploy production |
| Vercel auto-deploy | push em PR | deploy preview |

🚨 **Migrations Prisma:** `prisma migrate deploy` no build do Vercel (não `migrate dev`). Cada migration precisa ser revisada em PR — quebras de schema bloqueiam merge.

---

## 17. Workflow de PR

- Branch a partir de `master`
- **Tamanho de PR não é limitado.** O processo de desenvolvimento da Bravi é assistido por IA — PRs serão tipicamente maiores que o tradicional ~400 linhas porque uma única tarefa de feature pode entregar a Server Action completa, o View Model, o componente, os testes e a migration em um único fluxo. O critério não é tamanho, é **coesão**: o PR resolve um problema único e bem delimitado.
- CI verde obrigatório
- **Revisão dupla obrigatória:**
  - **Agente de PR review** (IA) — primeira camada; cobre lint estendido, aderência a convenções deste guideline (padrão de Server Action, View Models, máquina de estados, abstração de LLM, audit log, consentimentos), detecção de bypass de regras críticas (🚨), cobertura de testes mínima por arquivo tocado, e verificação de Definition of Done (Seção 18)
  - **Tech Lead (humano)** — segunda camada; cobre decisões de design não-óbvias, trade-offs, alinhamento com ADRs, mudanças de schema, integrações externas e qualquer PR sensível (auth, audit, moderação, LLM, consents, storage, máquina de estados)
- ✅ PRs grandes funcionam **se** vierem com descrição estruturada: contexto, mudanças por módulo, decisões tomadas, testes adicionados, screenshots/diagramas quando aplicável. PR sem descrição é devolvido pelo agente.
- 💡 PRs muito grandes (> 1500 linhas) e que cruzam múltiplos módulos são candidatos a serem divididos em PRs encadeados — não por regra fixa, mas porque revisão humana fica menos eficaz. Decisão fica com o Tech Lead.
- **Squash merge** para histórico limpo
- Conventional commit no título do PR (gera CHANGELOG depois)

---

## 18. Definition of Done (DoD)

- [ ] Critérios de aceitação da US implementados
- [ ] Server Action segue padrão canônico (Seção 4)
- [ ] View Models usados quando atravessa fronteira de papel (Seção 5)
- [ ] Audit log capturado para operações sensíveis
- [ ] Consentimentos verificados quando aplicável
- [ ] Testes (unitário + integração) cobrindo critérios
- [ ] Logs estruturados em pontos relevantes
- [ ] Erros tratados com `ActionResult` (sem stack trace pro user)
- [ ] Aprovação no PR
- [ ] Deploy em homologação validado
- [ ] Documentação atualizada (`README`, ADR, ou inline)

---

## 19. Runbooks (vivem em `runbooks/`)

Operações recorrentes/raras vão em `runbooks/<nome>.md`:

- `runbooks/restore-from-backup.md`
- `runbooks/inspect-empresa-fantasma.md` (checklist para coordenador na 1ª vaga)
- `runbooks/reivindicacao-credencial.md`
- `runbooks/atendimento-direito-de-acesso-lgpd.md`
- `runbooks/troca-de-provedor-llm.md`
- `runbooks/troca-de-captcha.md`

A partir de Fase 0.

---

## 20. Sobre dores futuras (V2)

Quando estes sinais aparecerem, considere:

- **Carga de moderação alta:** introduzir triagem por LLM como pré-filtro
- **Volume de busca pública alto:** introduzir busca full-text + relevância (USP V2)
- **Múltiplas ASONSEGs no mesmo sistema:** considerar RLS no Postgres
- **E-mail crescendo:** Resend Pro ou SendGrid
- **Custo Vercel/Supabase crescendo:** considerar move-out (mas reversão é cara — só por número, não por princípio)

Mantenha as ports/adapters limpas; mudanças nessas dimensões são localizadas.

---

**Última palavra:** a meta é que um desenvolvedor novo do time consiga produzir um PR alinhado às convenções em 2 dias, lendo este documento + um exemplo canônico em cada módulo. Se isso não estiver acontecendo, este documento está incompleto — abra uma issue.
