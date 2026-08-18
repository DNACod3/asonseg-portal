# ASONSEG — Project Guideline

**Projeto:** Portal Empregabilidade e Serviços (Release 1 — MVP) + fundação compartilhada
**Versão:** 3.0
**Audiência:** Tech Lead, desenvolvedores plenos, QA, DevOps da Bravi

Este guia operacionaliza os ADRs técnicos para o time. Convenções marcadas como ✅ são padrão; ❌ são anti-padrões a evitar; 💡 são dicas práticas; 🚨 são regras críticas que falham CI; ⚠️ exigem atenção.

> **Princípio orientador (v3.0):** a fonte da verdade não é o documento, é o artefato verificável. Specs descrevem intenção; só viram contrato quando existem em forma executável (teste, schema Zod, eval suite, property-based test). Ver **Seção 20 — Princípios Fact-Driven** para o detalhamento dos cinco princípios (P1–P5) que sustentam as práticas deste guia, especialmente as Seções 21 (Eval Suite LLM), 22 (Kickoff Gate) e 23 (EARS → Fact).

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

🚨 **Eval suite, versionamento de prompts e upgrade de modelo: ver Seção 21.** Não fazer mudança em `prompts/`, trocar modelo Claude, ou alterar binding do extractor sem passar pelo protocolo lá descrito.

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

### Rastreabilidade EARS → Fact

🚨 **Todo critério de aceitação em EARS tem fact correspondente** (teste, schema, eval, property). Detalhamento e formato no issue: ver **Seção 23**.

### Property-based testing (quando aplicável)

✅ **Recomendado para invariantes**, com `fast-check` integrado ao Vitest. Casos típicos no portal:

- **Máquina de estados de moderação** (Seção 6): propriedade "nenhuma sequência de transições válidas resulta em status inválido"
- **Visibilidade conservadora** (Seção 5): propriedade "nenhum campo sensível vaza para papel não autorizado, em nenhuma combinação de papéis/ações afirmativas"
- **Expiração de vagas** (`expireOverdueJobs`, ADR-T-0011): propriedade "após o cron, nenhuma vaga `ACTIVE` tem `expiresAt < now()`"

💡 Property-based **não substitui** testes de exemplo (happy path, edge cases nomeados); complementa.

---

## 13. Performance defensiva

- ✅ Índices em colunas usadas em WHERE (`status`, `personId`, `companyId`, `regionId`, `areaId`, `cnpj`, `email_login`)
- ✅ `Prisma.findMany` sempre com `take` (paginação obrigatória)
- ✅ `select`/`include` explícito em queries quentes (não retornar tudo)
- ✅ `unstable_cache` com tags para queries de conteúdo público (ADR-T-0013)
- ❌ N+1 — usar `include` ou `findMany` agrupado
- 💡 I/O **independente e read-only** → `Promise.all` (latência = max das chamadas, não a soma)
- ❌ `Promise.all` de queries no mesmo `tx` dentro de `$transaction`/`withAudit` — a transação interativa do Prisma não é concurrency-safe na mesma conexão; manter sequencial
- 💡 Quando precisar de todos os resultados mesmo com falha parcial → `Promise.allSettled` (não `Promise.all`, que é fail-fast e descarta as demais promises)

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
| `eval-cv-extraction.yml` | PR que toca `modules/cv-extraction/prompts/`, `modules/cv-extraction/adapters/anthropic-*`, ou `shared/container.ts` | rodar eval suite + comparar com `baseline.json` (Seção 21) |
| `backup-db.yml` | cron 04:00 UTC | dump Postgres → B2 |
| `backup-storage.yml` | cron 04:30 UTC | rclone sync buckets → B2 |
| `expire-jobs.yml` | cron 06:00 UTC | rodar `expireOverdueJobs` |
| Vercel auto-deploy | push master | deploy production |
| Vercel auto-deploy | push em PR | deploy preview |

🚨 **Migrations Prisma:** cada migration precisa ser revisada em PR — quebras de schema bloqueiam merge. Ver **§16.1** para como (e quando) elas de fato chegam a produção.

### 16.1 Migrations Prisma em produção — passo manual, não o build do Vercel

🚨 **`prisma migrate deploy` NÃO roda no build do Vercel nem em nenhum outro passo automatizado.** `package.json` define `build` como `next build` puro; `vercel.json` só declara um cron (`expire-jobs`). Não existe pipeline de CI/CD que aplique migration contra produção — isso é **sempre uma ação humana manual**, com as credenciais reais de produção, executada por quem tem acesso.

Essa crença errada (documentada aqui até 2026-08-18) é a causa provável de o hotfix `20260722140000_fix_immutable_unaccent_schema_qualify` (commitado em 27/07) ter ficado sem aplicar em produção por semanas — quem lia esta seção concluía que o próximo deploy resolveria por conta própria. Não resolve.

**Checklist para aplicar migration pendente em produção:**
1. Confirmar quais migrations estão pendentes: `DATABASE_URL=<prod> npx prisma migrate status`.
2. Rodar `npx prisma migrate deploy` manualmente com `DATABASE_URL`/`DIRECT_URL` de produção (não há `.env.production` nem script `db:deploy:production` no repo hoje — só `db:deploy` para `.env.local` e `db:deploy:staging` para `.env.staging`; produção usa as credenciais reais passadas na hora, nunca a partir de um pipeline automatizado).
3. Se alguma migration pendente foi **editada in-place** depois de já aplicada em outro ambiente (checksum mudou — ver AD-029/`.specs/project/STATE.md`), `migrate deploy` avisa drift e **continua avisando a cada execução seguinte**, permanentemente, até reconciliar: `UPDATE _prisma_migrations SET checksum = '<novo>' WHERE migration_name = '<nome>';` para cada migration editada (a checksum nova é a que `migrate deploy` reporta no próprio aviso). `prisma migrate resolve` marca uma migration como aplicada, mas **não** recalcula checksum — não serve para este caso.
4. Confirmar manualmente o efeito esperado (ex.: rodar a query afetada) — não há teste automatizado contra produção.
5. Registrar a execução em `.specs/project/STATE.md` (fecha o blocker correspondente, se houver).

**Regra vinculante para migration de índice funcional (AD-029, 2026-08-18):** o Postgres avalia a expressão de um índice funcional (`CREATE INDEX ... USING gin/gist/btree (expressão)`) sob um `search_path` **sanitizado** no parse (mitigação do CVE-2018-1058) — `pg_catalog, pg_temp`, nada mais. Qualquer função, operator class ou dicionário de text search referenciado nessa expressão precisa ser **totalmente qualificado por schema** (`public.minha_funcao(...)`, `extensions.gin_trgm_ops`, `extensions.unaccent::regdictionary`). `SET search_path`, `ALTER DATABASE ... SET search_path` e `ALTER ROLE ... SET search_path` **não** substituem isso em nenhuma combinação — e um `SET` de sessão sem `LOCAL` ainda vaza (silenciosamente) para as migrations seguintes na mesma conexão, mascarando o problema até uma reconexão ou aplicação individual (`psql -f`, runbook de DR) expô-lo com `42883`/`42704`. Ver `prisma/migrations/20260620110000_ensure_unaccent_extension_schema/migration.sql` (comentário de cabeçalho) para o exemplo canônico.

---

## 17. Workflow de PR

🚨 **Pré-condição: Kickoff Thread Gate aprovado** — issue de origem precisa ter label `kickoff-approved` (PO + Tech Lead) antes de PR sair de "Draft" para revisão. Ver **Seção 22**.

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
- [ ] Mapeamento EARS → Fact atualizado no issue (Seção 23) — todo critério tem fact correspondente identificado por path/test name
- [ ] Server Action segue padrão canônico (Seção 4)
- [ ] View Models usados quando atravessa fronteira de papel (Seção 5)
- [ ] Audit log capturado para operações sensíveis
- [ ] Consentimentos verificados quando aplicável
- [ ] Testes (unitário + integração) cobrindo critérios
- [ ] Eval suite passa se PR toca `cv-extraction` (Seção 21); `baseline.json` atualizado se modelo foi trocado
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
- `runbooks/atualizar-eval-suite-cv-extraction.md` (Seção 21)
- `runbooks/promover-prompt-nova-versao.md` (Seção 21)
- `runbooks/upgrade-modelo-claude.md` (Seção 21)

A partir de Fase 0.

---

## 20. Princípios Fact-Driven

Esta seção é a **fundação conceitual** do guia. As Seções 21, 22 e 23 são a operacionalização concreta destes princípios para o portal ASONSEG. As demais seções já incorporam estes princípios na prática (Server Action canônica com Zod = P2; máquina de estados centralizada = P1; ports/adapters do LLM = P5).

🚨 **Cinco princípios não-negociáveis:**

- **P1 — Critério tem fact.** Todo critério de aceitação tem um artefato máquina-verificável correspondente (teste, schema, eval, property) versionado no mesmo PR ou em PR predecessor referenciado. Critério em prosa **sem fact não está pronto** e não passa no Kickoff Gate (Seção 22).

- **P2 — Fronteira tem schema.** Toda fronteira de sistema tem schema versionado e validado em runtime:
  - Server Actions e Route Handlers → schema Zod (já é parte do padrão canônico — Seção 4)
  - Dados que cruzam papéis → View Models tipados (Seção 5)
  - Migrations Prisma → schema versionado em PR (Seção 16)
  - LLM → JSON Schema de saída validado no adapter (Seção 7 + ADR-T-0012)

- **P3 — LLM tem eval suite.** Toda feature que depende de LLM em runtime tem eval suite fixa que roda em CI. No MVP, aplica-se a `cv-extraction` (Seção 21). Aplicar-se-á a qualquer integração LLM futura (triagem de moderação por IA na V2, etc.).

- **P4 — Fact muda com PR explícito.** Mudança de fact (teste, schema, eval, baseline) é mudança de contrato. Justificativa obrigatória na descrição do PR; quebra de schema público exige bump de versão e ADR; mudança de `baseline.json` exige relatório de comparação.

- **P5 — Código é regenerável, fact é mantido à mão.** O squad pode regenerar a implementação assistido por agente, refatorar, trocar lib. A suite de facts é o que define que o produto continua sendo o mesmo produto. Por isso o agente de PR review (Seção 17) tem foco especial em **detectar facts removidos ou enfraquecidos sem justificativa**.

**Por que isso importa, na prática:** modelos de IA mudam (Sonnet 3.5 → 4 → 4.5 → 4.7 → ...); cada upgrade reinterpreta linguagem natural de forma sutilmente diferente. Um teste executável passa ou falha — não interpreta. Quanto mais comportamento estiver codificado em facts, menos esforço o squad gasta perseguindo regressões silenciosas a cada release de modelo ou refactor assistido por IA.

---

## 21. Avaliação de modelo LLM e versionamento de prompts

🚨 **Princípio P3 materializado para `cv-extraction`**. Aplica-se a qualquer integração LLM futura.

### 21.1 Estrutura de pastas

```
modules/cv-extraction/
├── ports/
│   └── cv-extractor.ts
├── adapters/
│   └── anthropic-claude-extractor.ts      # constante MODEL exportada
├── prompts/
│   ├── extract-cv-pt-br.v1.ts             # versão atualmente em produção
│   └── extract-cv-pt-br.v2.ts             # nova versão coexiste durante migração
├── evals/
│   ├── dataset.jsonl                       # casos fixos, congelados
│   ├── rubric.md                           # critério de avaliação por campo
│   ├── baseline.json                       # métrica do modelo aprovado em prod
│   ├── run-eval.ts                         # script CLI
│   └── results/                            # histórico de runs (gitignored, salvo no artifact do CI)
└── actions/
```

### 21.2 Eval suite — dataset e métricas

✅ **Dataset:**

- Mínimo **30 CVs anonimizados** representativos: variedade de formato (PDF gerado, PDF escaneado, DOCX exportado), qualidade (texto limpo, texto com OCR ruim), área (operacional, técnico, administrativo, saúde)
- LGPD: usar **dados sintéticos** preferencialmente; se reais, com consentimento específico de uso para QA + anonimização (CPF, e-mail, telefone, nome alterados)
- Versionado em `modules/cv-extraction/evals/dataset.jsonl`
- 🚨 **Dataset é congelado.** Alterar dataset = alterar baseline = PR explícito com justificativa. Não modificar para "fazer o teste passar"

✅ **Métricas mínimas (registradas em `baseline.json`):**

| Métrica | Definição | Threshold de falha |
|---|---|---|
| `precision_per_field` | precisão por campo estruturado (nome, e-mail, telefone, área, anos exp.) | queda > 5% em qualquer campo |
| `recall_per_field` | recall por campo (% extraído quando presente no CV) | queda > 5% em qualquer campo |
| `extraction_completeness` | % média de campos extraídos com sucesso | queda > 5% absoluta |
| `hallucination_rate` | % de campos extraídos que **não existem** no CV (golden test) | > 2% absoluto |
| `latency_p95` | p95 de tempo de resposta end-to-end (s) | aumento > 30% relativo |

💡 Métricas adicionais opcionais conforme aprendizado: erro estruturado de validação Zod no output, taxa de retry, custo médio por extração (tokens × preço).

### 21.3 Versionamento de prompts

🚨 **Prompt é código.** Toda mudança em prompt é PR e dispara eval suite.

✅ **Convenção:**

- Arquivos seguem `<nome>.v<N>.ts` (semver simples: incrementa em qualquer mudança comportamental)
- Versão ativa selecionada via constante exportada no adapter:
  ```typescript
  // modules/cv-extraction/adapters/anthropic-claude-extractor.ts
  import { extractCvPtBrV1 } from '../prompts/extract-cv-pt-br.v1'
  // import { extractCvPtBrV2 } from '../prompts/extract-cv-pt-br.v2'

  const ACTIVE_PROMPT = extractCvPtBrV1   // troca explícita em PR de migração
  const MODEL = 'claude-sonnet-4-5'       // troca explícita em PR de upgrade
  ```
- v1 e v2 **coexistem no repo** durante a migração; remoção de v1 = PR separado após v2 estar em produção por **7 dias sem incidente**

❌ **Anti-padrão:** alterar string de prompt in-place no v1. Lint custom planejado para detectar mudança em arquivo `prompts/*.v*.ts` sem renomeação para nova versão.

### 21.4 Protocolo de upgrade de modelo

🚨 **Trocar modelo Claude (ex.: `claude-sonnet-4-5` → `claude-sonnet-4-7`) NUNCA via variável de ambiente direto em produção. Sempre via PR.**

✅ **Fluxo de upgrade:**

1. PR muda a constante `MODEL` em `modules/cv-extraction/adapters/anthropic-claude-extractor.ts`
2. CI dispara `eval-cv-extraction.yml` (Seção 16) contra o novo modelo
3. Comparação automática contra `baseline.json` — relatório anexado como comentário no PR
4. **Se passar** (sem regressão acima dos thresholds da tabela 21.2): merge aprovado, `baseline.json` é atualizado **no mesmo PR** com nova métrica, commit anterior, data
5. **Se reprovar:** PR fica bloqueado. Caminhos possíveis: ajustar prompt (nova versão — Seção 21.3), enriquecer dataset com casos do novo modelo, ou rejeitar upgrade
6. ADR opcional se o upgrade exigir mudança de prompt — torna-se obrigatório se o upgrade muda comportamento percebido pelo usuário (ex.: estrutura de output)

⚠️ **Em incidente de produção** (custo, latência, qualidade): rollback de modelo via env var é permitido como medida emergencial **de até 24h**. PR de correção e re-evaluation obrigatório dentro deste prazo, ou o rollback vira definitivo via PR.

Runbook: `runbooks/upgrade-modelo-claude.md`.

### 21.5 Quando estender este protocolo

Aplicar o protocolo desta seção a **qualquer nova feature que dependa de LLM em runtime**:

- Triagem de moderação por IA (provável V2)
- Sugestão de descrição de vaga (provável V2)
- Busca semântica em catálogo de serviços (provável V2)

Cada feature LLM nova adiciona sua própria pasta `evals/`, seu `baseline.json`, e seu workflow de eval no CI. ADR registra a decisão.

---

## 22. Kickoff Thread Gate

🚨 **Toda US entra em sprint apenas após passar pelo Kickoff Thread Gate** — momento explícito de validação técnico-funcional entre PO e Tech Lead, registrado no issue.

### 22.1 Artefatos obrigatórios no issue

| Artefato | Onde mora | Obrigatório quando |
|---|---|---|
| US escrita em EARS (WHEN/IF/SHALL) | corpo do issue no GitHub Projects | sempre |
| Mapeamento EARS → Fact (Seção 23) | seção `## Facts` no corpo do issue | sempre |
| ADR(s) novo(s) | `docs/adr/NNNN-<titulo>.md` | há decisão arquitetural |
| Schema Zod novo/alterado | `modules/<m>/schemas/` | US toca Server Action ou Route Handler |
| Eval suite atualizada/revisada | `modules/cv-extraction/evals/` | US toca `cv-extraction` ou integração LLM futura |
| View Model novo | `modules/<m>/views/` | US atravessa fronteira entre papéis |

### 22.2 Critérios de rejeição (PO ou Tech Lead vetam)

❌ Critério EARS sem fact identificado (mesmo que stub)
❌ Comportamento descrito no PRD/US sem fact correspondente
❌ Nova Route Handler em `app/api/` sem schema Zod definido
❌ Mudança que toca `cv-extraction` sem revisão explícita da eval suite
❌ US que muda visibilidade entre papéis sem View Model novo ou alteração registrada
❌ Schema sem versionamento quando aplicável a contrato público (raríssimo no MVP — predominam Server Actions internas)

### 22.3 Aprovação e movimentação

✅ **Aprovação registrada via label:**

- Tech Lead aprova → label `kickoff-tech-approved`
- PO aprova → label `kickoff-po-approved`
- Quando ambas existem → automação adiciona label `kickoff-approved` (GitHub Actions)

✅ **Coluna "In Progress" do board só aceita cards com `kickoff-approved`** — workflow `gate-in-progress.yml` (planejado) bloqueia movimentação caso contrário; até a automação existir, é regra de revisão para o Tech Lead.

💡 **Espírito do gate:** não é burocracia. É o momento em que "tá pronto pra dev?" deixa de ser opinião e vira critério verificável. Sem fact, não há contrato; sem contrato, qualquer regeneração de código assistida por IA é apostar no escuro.

### 22.4 Spike e exceção

Branch nomeado `spike/<nome>` está dispensado do Kickoff Gate, **desde que**:
- Não vá para produção
- Seja deletado após conclusão
- Gere ADR ou nota de aprendizado em `docs/adr/`

Hotfix crítico em produção (impacto financeiro/legal imediato) pode pular o gate em PR de correção, **com obrigação de PR de follow-up criando o fact de regressão em até 24h**. Sem follow-up = hotfix bloqueia próximas releases.

---

## 23. EARS → Fact (rastreabilidade de critérios)

🚨 **Todo critério de aceitação em EARS tem fact correspondente identificado no issue.** A rastreabilidade é parte do issue, não documento externo.

### 23.1 Formato no issue

Cada US contém duas seções claramente separadas:

```markdown
## Critérios de Aceitação (EARS)

AC1 — WHEN um candidato submete CV PDF até 5MB
      IF consentimento CV_AI_EXTRACTION está ativo
      THE SYSTEM SHALL extrair os campos estruturados em até 30s

AC2 — WHEN consentimento CV_AI_EXTRACTION está inativo ou ausente
      THE SYSTEM SHALL retornar erro `CONSENT_REQUIRED` e UI exibe termo da finalidade

AC3 — WHEN extração falha por timeout do provedor LLM
      THE SYSTEM SHALL retornar erro amigável e registrar incidente no Sentry

## Facts

- AC1 (happy path) → `modules/cv-extraction/__tests__/extractCV.integration.test.ts::happy-path-pdf`
- AC1 (latência p95) → `modules/cv-extraction/evals/baseline.json::latency_p95` (threshold em Seção 21.2)
- AC2 → `modules/cv-extraction/__tests__/extractCV.integration.test.ts::consent-missing-returns-error`
- AC3 → `modules/cv-extraction/__tests__/extractCV.integration.test.ts::timeout-fallback`
- Schema de input → `modules/cv-extraction/schemas/extractCVInput.ts` (Zod)
```

### 23.2 Tipos de fact aceitáveis

| Tipo | Quando usar | Onde mora |
|---|---|---|
| Teste unit/integration (Vitest) | regra de negócio, Server Action, fluxo entre módulos | `modules/<m>/__tests__/` |
| Teste E2E (Playwright) | fluxo crítico de usuário ponta-a-ponta | `e2e/` |
| Schema Zod | validação de fronteira (input/output de Action) | `modules/<m>/schemas/` |
| Métrica de eval suite | comportamento LLM, qualidade probabilística | `modules/<m>/evals/baseline.json` |
| Property-based test (`fast-check` + Vitest) | invariante sobre conjunto de entradas | `modules/<m>/__tests__/properties/` |
| View Model tipado | regra de visibilidade entre papéis | `modules/<m>/views/` |

❌ **Não são facts aceitáveis:**

- "Será coberto por teste manual"
- "Validação visual em homologação"
- "Garantido pelo TypeScript" (só vale se o tipo é gerado de schema versionado)
- "Comportamento padrão do framework" (precisa de teste que ancora a expectativa)

### 23.3 Regra de promoção e enfraquecimento

✅ **Promoção:** AC novo precisa de fact novo (mesmo que seja stub que falha) **antes** de a US sair do gate.

🚨 **Enfraquecimento de fact** (remover teste, afrouxar assertion, baixar threshold de eval): **PR explícito com justificativa**, aprovado por Tech Lead. Agente de PR review marca como "atenção crítica" qualquer remoção/relaxamento de fact que não venha acompanhada de fact equivalente ou superior.

💡 **Refactor que muda código mas mantém facts passando** é situação ideal — exatamente o cenário em que código regenerável + facts mantidos à mão (P5) entrega valor.

---

## 24. Sobre dores futuras (V2)

Quando estes sinais aparecerem, considere:

- **Carga de moderação alta:** introduzir triagem por LLM como pré-filtro
- **Volume de busca pública alto:** introduzir busca full-text + relevância (USP V2)
- **Múltiplas ASONSEGs no mesmo sistema:** considerar RLS no Postgres
- **E-mail crescendo:** Resend Pro ou SendGrid
- **Custo Vercel/Supabase crescendo:** considerar move-out (mas reversão é cara — só por número, não por princípio)

Mantenha as ports/adapters limpas; mudanças nessas dimensões são localizadas.

---

**Última palavra:** a meta é que um desenvolvedor novo do time consiga produzir um PR alinhado às convenções em 2 dias, lendo este documento + um exemplo canônico em cada módulo. Se isso não estiver acontecendo, este documento está incompleto — abra uma issue.
