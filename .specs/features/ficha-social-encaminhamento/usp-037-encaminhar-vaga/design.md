# USP-037 — Encaminhar Pessoa para vaga — Design (agregado `Referral`)

**Spec**: `./spec.md`
**Status**: Draft
**Escopo do design**: Este documento descreve o **agregado `Referral` inteiro** (schema,
módulo, contratos), coerente para USP-037 **e** USP-038. `../usp-038-registrar-resultado/design.md`
**referencia** este documento e só detalha a fatia de registro de resultado. As colunas de
resultado nascem **nesta** migração (nullable), então a USP-038 **não re-migra** nada.

---

## Constraints do projeto (STATE.md `## Decisions` — conformidade)

- **AD-017** (source of truth do agregado `Application`): `Application` é do módulo `jobs`;
  `viaEncaminhamento Boolean` já existe (sempre `false` hoje); "**a USP-037 adiciona a FK
  `viaReferralId`**" e passa a setar o boolean sem re-migrar. `referrals` importa `applyToJob`/
  helpers via barrel `@/modules/jobs`. Índice `uq_application_active` é a garantia de unicidade
  ativa. → **Conformado.**
- **AD-007** (Outbox): e-mail só **enfileirado** (`tx.outbox.create`), dispatcher = USP-044. → **Conformado.**
- **AD-012 / AD-009** (status-na-entidade; `applications` real supersede TD §4.5): reusamos o
  `Application` real (boolean + índice parcial), **não** o `@@unique` do TD §4.5. → **Conformado.**
- **CLAUDE.md** — sequência de Server Action sensível (Zod → `requirePermission` →
  `requireActiveConsent` quando aplicável → pré-condições → `withAudit`), `ActionResult<T>`
  nunca `throw`, barrel imports, audit append-only, Prisma `select`/`take`, TZ `America/Sao_Paulo`,
  PT-BR. → **Conformado.**
- **technical-design §2.7 / §3.5** (Referral model, `ReferralResult`, `viaReferralId`, sequência
  `createReferral`): adotado, reconciliado às convenções do schema real (`@db.Timestamptz(6)`,
  `@map`, manter o boolean legado). **Nenhuma decisão do TD é re-decidida** — só concretizada.

**Nenhum AD é superseeded.** Todas as decisões abaixo conformam aos ADs ativos.

---

## Decisão de módulo: `Referral` mora em um **novo módulo `referrals`**

**Escolha:** criar `src/modules/referrals/` (novo módulo sob `src/modules/`).

**Justificativa:**
1. `referrals` está na **lista canônica de 11 módulos** (CLAUDE.md) e é **scope válido** de
   Conventional Commit. `src/` root fechado restringe **novas pastas top-level** (exigiriam RFC);
   um módulo já-abençoado sob `modules/` **não** exige RFC.
2. **AD-017 antecipa explicitamente** um módulo `referrals` que "importará `applyToJob` via barrel
   `@/modules/jobs`" — a própria pré-decisão do projeto aponta para módulo distinto.
3. **Coesão de domínio:** o `Referral` é um agregado raiz próprio (ciclo create→resultado), com RBAC
   próprio (`REFER_PERSON_TO_JOB`/`REGISTER_REFERRAL_RESULT`), métricas próprias (MP8/MP9) e
   orquestração cross-módulo (ativação de papel em `persons` + candidatura em `jobs`). Colocá-lo em
   `jobs` sobrecarregaria `jobs` com a fronteira social/AS.
4. **Fronteira respeitada:** `referrals` **orquestra** (chama `createReferralApplication` de `jobs` e
   `ensureCandidateRole` de `persons` **dentro da sua tx**) mas **só é dono da tabela `referrals`**.
   A `Application` continua owned por `jobs`. O schema Prisma é um arquivo único (o FK cruzado
   `Application.viaReferralId → Referral` é físico-único, mas a **posse lógica** é por módulo).

> Contraste com AD-017 (que pôs `Application` em `jobs`): lá **não havia** módulo `candidaturas` na
> lista canônica; aqui `referrals` **existe** na lista e é o dono natural.

---

## Architecture Overview

```mermaid
graph TD
    AS[AS / coordenador / voluntário delegado] --> UI[ReferralForm - app/(app)/encaminhamentos/novo]
    UI --> SA["createReferral() — @/modules/referrals"]
    SA --> ZOD[Zod: createReferralSchema]
    SA --> PERM["requirePermission(REFER_PERSON_TO_JOB) — @/modules/identity"]
    SA --> PRE["Pré-condições: profile.cvStoragePath? + resumo; job pré-check ACTIVE"]
    SA --> TERM["loadTerm(SOCIAL_REFERRAL_TO_JOB) — @/modules/consents"]
    SA --> TX["withAudit(REFERRAL_CREATED) — @/modules/audit"]
    TX --> RC["ensureCandidateRole(tx,…) — @/modules/persons (tácito)"]
    TX --> REV["revalida job ACTIVE @persist — isJobOpenForApplication @/modules/jobs"]
    TX --> RINS["INSERT referrals (+ professionalSummary, justification?)"]
    TX --> APP["createReferralApplication(tx,…) — @/modules/jobs → INSERT applications (viaReferralId, viaEncaminhamento=true)"]
    TX --> A2["recordAuditEvent(APPLICATION_CREATED)"]
    TX --> OBX["tx.outbox.create(topic=email, template=referral-notification) — guard emailLogin"]
    RC --> RCC["consent SOCIAL_REFERRAL_TO_JOB + CANDIDATE_ROLE_ACTIVATED + CONSENT_GRANTED"]
```

Sequência (fiel ao technical-design §3.5, reconciliada):
`createReferral({personId, jobId, professionalSummary?, justification?})` → `requirePermission` →
pré-checks (CV/resumo; vaga ACTIVE) → `loadTerm` → **TX**: `ensureCandidateRole` (se ausente) →
revalida vaga ACTIVE → `INSERT referral` → `createReferralApplication` (viaReferralId) →
`recordAuditEvent(APPLICATION_CREATED)` → enqueue e-mail (guard) → **COMMIT** → `ActionResult.ok`.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
|---|---|---|
| `requirePermission(id)` | `src/modules/identity/server/require-permission.ts` | Gate RBAC (passo 2 da sequência). `REFER_PERSON_TO_JOB` **já existe** (intrínseco COORDINATOR/SOCIAL_ASSISTANT + delegável). |
| `PermissionId` enum | `prisma/schema.prisma` + `identity/domain/permissions.ts` | Já contém `REFER_PERSON_TO_JOB` e `REGISTER_REFERRAL_RESULT` — **nenhum add**. |
| `ensureClientRole(tx, {personId, term, ip, userAgent})` | `src/modules/persons/actions/ensure-client-role.ts` | **Padrão a espelhar** para `ensureCandidateRole` (consent tácito + role ACTIVE + idempotente, dentro da tx do chamador). |
| `loadTerm(purpose)` | `src/modules/consents/adapters/term-loader.ts` | Carrega `{version, hash}` do termo `SOCIAL_REFERRAL_TO_JOB` (recomputa SHA-256 vs `TERMS_REGISTRY`). |
| `requireActiveConsent(personId, purpose, tx?)` | `src/modules/consents/server/require-active-consent.ts` | Idempotência do consent tácito dentro da tx (nunca `throw`). |
| `isJobOpenForApplication(job, today)` | `src/modules/jobs/domain/application-rules.ts` (barrel) | **Reuso do "vaga ativa"** (status ACTIVE + validUntil + company.isVerified). Usado no pré-check **e** na revalidação @persist. |
| `hojeSaoPaulo()` | `src/shared/lib` (time utils) | `today` para `isJobOpenForApplication` (TZ America/Sao_Paulo). |
| `applyToJob` internals (`tx.application.create` + P2002→`ApplyConflictError`) | `src/modules/jobs/actions/apply-to-job.ts` | Modelo para o novo `createReferralApplication` (mesma criação, sem gates de sessão/consent do candidato). |
| `withAudit` / `recordAuditEvent` | `src/modules/audit/withAudit.ts` (barrel `@/modules/audit`) | `REFERRAL_CREATED` primário + `APPLICATION_CREATED` secundário (precedente `PROVIDER_CONTACT_REVEALED` após `INTEREST_MANIFESTED`). |
| `AuditEvent` catálogo | `src/modules/audit/events.ts` | `REFERRAL_CREATED`, `REFERRAL_RESULT_REGISTERED`, `CANDIDATE_ROLE_ACTIVATED`, `CONSENT_GRANTED`, `APPLICATION_CREATED` **já existem**. |
| Outbox enqueue (`application-confirmation`) | `apply-to-job.ts:112-123` | Padrão do e-mail no `Outbox` + **guard `if (emailLogin)`** (EC-2). |
| `EmailMessage` union | `src/shared/lib/email/email-sender.port.ts` | Adicionar arm `referral-notification` + renderer. |
| `ActionResult<T>` / `fail`/`ok` | `src/shared/errors.ts` | Retorno; nunca `throw`. |

### Integration Points

| System | Integration Method |
|---|---|
| `@/modules/jobs` | `referrals` importa `createReferralApplication` + `isJobOpenForApplication` via barrel. `jobs` ganha o helper tx-participante + o FK inverso `Referral?` em `Application`. |
| `@/modules/persons` | `referrals` importa `ensureCandidateRole` (novo) via barrel. `persons` ganha o helper tácito. |
| `@/modules/consents` | `loadTerm`/`requireActiveConsent` para o consent `SOCIAL_REFERRAL_TO_JOB`. |
| Prisma (`referrals`, `applications`) | 1 migração `usp037_referral`: cria `referrals` + enum `referral_result` + FK `via_referral_id` em `applications` + relações. |
| `Outbox` (`topic=email`) | Enqueue `referral-notification` na tx; dispatcher = USP-044. |

---

## Data Models

### Novo: `Referral` (+ enum `ReferralResult`) — colunas de resultado **nullable** já aqui

```prisma
model Referral {
  id                  String          @id @default(uuid()) @db.Uuid
  personId            String          @map("person_id") @db.Uuid            // Pessoa encaminhada
  jobId               String          @map("job_id") @db.Uuid
  referrerPersonId    String          @map("referrer_person_id") @db.Uuid   // AS/coord/voluntário que encaminhou
  justification       String?                                                // AC-037-4 (motivo opcional)
  professionalSummary String?         @map("professional_summary") @db.Text  // AC-037-3 (obrigatório se sem CV — validado na action)
  // ── Colunas de RESULTADO (USP-038) — nascem NULLABLE nesta migração ──────
  result              ReferralResult? // USP-038
  resultObservation   String?         @map("result_observation")            // USP-038
  resultRegisteredBy  String?         @map("result_registered_by") @db.Uuid // USP-038 (id do ator; sem relação Prisma, resolvido via lookup — segue TD)
  resultRegisteredAt  DateTime?       @map("result_registered_at") @db.Timestamptz(6) // USP-038
  createdAt           DateTime        @default(now()) @map("created_at") @db.Timestamptz(6)

  person      Person       @relation("ReferredPerson", fields: [personId], references: [id])
  job         Job          @relation(fields: [jobId], references: [id])
  referrer    Person       @relation("Referrer", fields: [referrerPersonId], references: [id])
  application Application?  // back-relation de Application.viaReferralId (1:1)

  @@index([personId])
  @@index([jobId])
  @@index([referrerPersonId])
  @@map("referrals")
}

enum ReferralResult {
  HIRED
  NOT_SELECTED
  UNDER_REVIEW
  NO_RESPONSE

  @@map("referral_result")
}
```

### Alteração: `Application` — adicionar FK `viaReferralId` (manter `viaEncaminhamento`)

```prisma
model Application {
  // …campos existentes (candidatePersonId, jobId, cancelledAt, appliedAt)…
  viaEncaminhamento Boolean   @default(false) @map("via_encaminhamento") // MANTIDO (badge USP-027)
  viaReferralId     String?   @unique @map("via_referral_id") @db.Uuid   // NOVO — vínculo 1:1 autoritativo
  referral          Referral? @relation(fields: [viaReferralId], references: [id]) // NOVO
  // …relações existentes…
}
```

**Invariante:** `viaReferralId != null ⟺ viaEncaminhamento = true`. `@unique` garante 1 `Application`
por `Referral`. Unicidade "uma candidatura ativa" continua em `uq_application_active` (sem índice novo).

### Alterações de back-relation (Person / Job)

```prisma
// model Person { … }
referralsReceived Referral[] @relation("ReferredPerson")
referralsCreated  Referral[] @relation("Referrer")
// model Job { … }
referrals         Referral[]
```

### Migração `usp037_referral` (SQL bruto onde necessário)

`prisma/migrations/<ts>_usp037_referral/migration.sql` — `CREATE TYPE referral_result`,
`CREATE TABLE referrals`, `ALTER TABLE applications ADD COLUMN via_referral_id uuid` +
`CREATE UNIQUE INDEX ... (via_referral_id)` + FKs. **Sem** re-migração de `viaEncaminhamento`
nem de `uq_application_active` (já existem). USP-038 não adiciona migração.

---

## Components

### `createReferral` (Server Action) — USP-037
- **Purpose**: orquestra o encaminhamento institucional numa transação auditada.
- **Location**: `src/modules/referrals/actions/create-referral.ts` (`'use server'`)
- **Interface**: `createReferral(input: CreateReferralInput): Promise<ActionResult<{ referralId: string; applicationId: string }>>`
- **Sequência** (sensível — CLAUDE.md):
  1. **Zod** `createReferralSchema.safeParse` → `VALIDATION`.
  2. **RBAC** `requirePermission('REFER_PERSON_TO_JOB')` → `UNAUTHENTICATED`/`FORBIDDEN` (REF-MN-04).
  3. **Pré-condições (fora da tx):** carrega `person` (`emailLogin`, `fullName`, `status`) + `CandidateProfile.cvStoragePath`; `hasCv = cvStoragePath != null`; se `!hasCv && !professionalSummary?.trim()` → `VALIDATION` (REF-MN-03). Carrega job (`title, status, validUntil, company{isVerified, nomeFantasia}`) → não achou → `NOT_FOUND`; `!isJobOpenForApplication(...)` → `PRECONDITION_FAILED` (AC-037-7). Pré-check duplicata ativa (`application.findFirst cancelledAt:null`) → `CONFLICT` (UX de REF-MN-01).
  4. **Consent term** `loadTerm('SOCIAL_REFERRAL_TO_JOB')` → `{version, hash}`.
  5. **`withAudit(REFERRAL_CREATED)`** tx:
     - `ensureCandidateRole(tx, {personId, term, ip, userAgent})` (idempotente; AC-037-2).
     - **Revalida** job ACTIVE lendo dentro da tx + `isJobOpenForApplication` → não-ativo → `throw ReferralPreconditionError` → rollback (REF-MN-02, EC-3).
     - `INSERT referral` (`personId, jobId, referrerPersonId=actor.id, justification?, professionalSummary?`); set `audit.entityType='REFERRAL'`, `audit.entityId`, `audit.after`.
     - `createReferralApplication(tx, {jobId, candidatePersonId: personId, referralId})` → set `viaReferralId` + `viaEncaminhamento=true`; P2002 → `ApplyConflictError` → `CONFLICT` (REF-MN-01, garantia real).
     - `recordAuditEvent(tx, APPLICATION_CREATED, {entityType:'APPLICATION', entityId})`.
     - Enqueue `referral-notification` no Outbox **se `person.emailLogin`** (EC-2).
  6. **Map de erro**: `ApplyConflictError`/P2002 → `CONFLICT`; `ReferralPreconditionError` → `PRECONDITION_FAILED`; senão `INTERNAL`. **Nunca `throw`.**
- **Reuses**: `requirePermission`, `ensureCandidateRole`, `createReferralApplication`, `isJobOpenForApplication`, `loadTerm`, `withAudit`/`recordAuditEvent`, Outbox pattern.

### `ensureCandidateRole` (tx-participant helper) — em `persons`
- **Purpose**: ativa o papel CANDIDATE com **aceite tácito** `SOCIAL_REFERRAL_TO_JOB`, idempotente, dentro da tx do chamador (AC-037-2).
- **Location**: `src/modules/persons/actions/ensure-candidate-role.ts` (não `'use server'` — participante de tx, precedente `ensureClientRole`)
- **Interface**: `ensureCandidateRole(tx: Prisma.TransactionClient, args: { personId: string; term: { version: string; hash: string }; ip: string | null; userAgent: string | null }): Promise<{ activated: boolean; grantId: string }>`
- **Comportamento** (espelha `ensureClientRole`, com 2 divergências documentadas):
  - Se papel CANDIDATE já ATIVO → `{ activated: false }`, no-op (idempotência).
  - Grant lifecycle `AWAITING_CONSENT → ACTIVE`; consent tácito `SOCIAL_REFERRAL_TO_JOB` gravado **na mesma tx antes de ACTIVE** (`tx.consent.create` se ausente) + `CONSENT_GRANTED` (`via: 'referral'`) + `CANDIDATE_ROLE_ACTIVATED`.
  - Upsert leve de `CandidateProfile` (DRAFT) se ausente — presença mínima de candidato (espelha o `ClientProfile` leve).
  - **Divergência 1 (documentada):** **não** exige `PORTAL_ACCESS` (Pessoa sem credencial pode ser encaminhada — EC-2). **Divergência 2:** base legal do papel = `SOCIAL_REFERRAL_TO_JOB`, não `JOB_APPLICATION`.
- **Reuses**: padrão inteiro de `ensure-client-role.ts` (grant + consent + audit).

### `createReferralApplication` (tx-participant helper) — em `jobs`
- **Purpose**: cria a `Application` vinculada ao `Referral`, dentro da tx do encaminhamento.
- **Location**: `src/modules/jobs/actions/create-referral-application.ts` (não `'use server'`; exportado via barrel)
- **Interface**: `createReferralApplication(tx: Prisma.TransactionClient, args: { jobId: string; candidatePersonId: string; referralId: string }): Promise<{ applicationId: string }>`
- **Corpo**: `tx.application.create({ data: { jobId, candidatePersonId, viaReferralId: referralId, viaEncaminhamento: true }, select: { id: true } })`; P2002 → `throw ApplyConflictError` (reusa o erro tipado de `apply-to-job`). **Sem** gates de sessão/consent/profile (são responsabilidade da action de encaminhamento).
- **Reuses**: `ApplyConflictError` de `jobs`.

### `isProfessionalSummaryRequired` (regra pura) — domínio de `referrals`
- **Purpose**: regra pura de REF-MN-03 (testável 1:1).
- **Location**: `src/modules/referrals/domain/referral-rules.ts`
- **Interface**: `isProfessionalSummaryRequired(hasCvAttachment: boolean, professionalSummary: string | null | undefined): boolean` → `!hasCvAttachment && (professionalSummary?.trim() ?? '') === ''`.

### `referral-notification` (e-mail template) — em `shared/lib/email`
- **Purpose**: arm novo do `EmailMessage` + renderer.
- **Location**: `src/shared/lib/email/email-sender.port.ts` (union) + `resend-email-sender.ts` (switch) + `templates/referral-notification.ts`
- **Interface**: `{ to: string; template: 'referral-notification'; data: { pessoaNome: string; vagaTitulo: string; empresaNome: string } }`.

### `ReferralForm` + página — UI (fatia vertical fina)
- **Purpose**: entrada do encaminhamento pela AS.
- **Location**: `src/modules/referrals/components/referral-form.tsx` + `src/app/(app)/encaminhamentos/novo/page.tsx`
- **Comportamento**: RHF + Zod adapter; campo **resumo profissional** exibido/obrigatório condicional a "Pessoa sem CV"; motivo opcional; submit → `createReferral`; erros PT-BR. Página em `(app)` (`force-dynamic`), guardada por sessão + `REFER_PERSON_TO_JOB` (server-side).
- **Reuses**: primitivas `@/shared/ui` (Design System AD-014: `FormCard`, `Input`, `Textarea`, `Button`, `LgpdBox`).

### Zod schemas — em `referrals`
- **Location**: `src/modules/referrals/schemas/referral.schema.ts`
- `createReferralSchema = z.object({ personId: z.string().uuid(), jobId: z.string().uuid(), professionalSummary: z.string().trim().min(1).max(2000).optional(), justification: z.string().trim().max(1000).optional() })` (a obrigatoriedade condicional do resumo é validada na action, pois depende do DB).

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact (PT-BR) |
|---|---|---|
| Input Zod inválido | `fail('VALIDATION', …)` | "Dados do encaminhamento inválidos." |
| Sem permissão | `requirePermission` → `FORBIDDEN`/`UNAUTHENTICATED` | "Você não tem permissão para encaminhar." |
| Pessoa/vaga inexistente | `fail('NOT_FOUND', …)` | "Pessoa ou vaga não encontrada." |
| Vaga não ativa (pré-check e @persist) | `PRECONDITION_FAILED` / rollback | "A vaga não está mais ativa e não pode receber encaminhamentos." |
| Sem CV e sem resumo | `fail('VALIDATION', …)` | "Informe o resumo profissional: a Pessoa não possui CV anexo." |
| Duplicata candidatura ativa | pré-check `CONFLICT`; P2002 na tx → `CONFLICT` (rollback) | "Esta Pessoa já possui uma candidatura ativa para esta vaga." |
| Pessoa sem e-mail | e-mail não enfileirado (no-op), encaminhamento OK | Sucesso; sem e-mail. |
| Falha inesperada | `fail('INTERNAL', …)`; tx rollback; nunca `throw` | "Erro ao processar o encaminhamento." |

---

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
|---|---|---|---|
| Sensor de concorrência mascarado por pré-check da app (lição **L-010**) | `create-referral.int.test.ts` (REF-MN-01) | Teste "passa" sem exercitar a garantia real | Teste negativo **exercita o índice `uq_application_active`** (P2002) direto, não só o pré-check; provar discriminação com índice removido. |
| `ensureCandidateRole` sem gate `PORTAL_ACCESS` | `persons/actions/ensure-candidate-role.ts` | Ativa papel para Pessoa sem consent base — divergência de `ensureClientRole` | Justificado (ação institucional, EC-2). Documentado como assumption; consent `SOCIAL_REFERRAL_TO_JOB` gravado é a base legal. **Sinalizado ao orquestrador.** |
| Deadlock `40P01` de role-activation sob concorrência (visto na USP-033) | `ensure-candidate-role.ts` | Falha intermitente sob corrida | Espelhar a correção test-only da USP-033/`ensureClientRole`; ordem de escrita consistente. |
| Enum cruzado `Application.viaReferralId` ↔ `Referral` (schema único) | `prisma/schema.prisma` | FK cross-módulo | Aceito: posse lógica por módulo; migração única. Precedente `Application.job`↔`jobs`. |
| E-mail real não sai até USP-044 | Outbox | Pessoa não recebe o aviso no MVP | Aceito (AD-007). Só enfileiramos; teste valida a linha no Outbox. |

> Concerns de código pré-existente nas áreas tocadas: nenhum novo além dos acima.

---

## Tech Decisions (não-óbvias)

| Decision | Choice | Rationale |
|---|---|---|
| Colunas de resultado no `Referral` | Nascem **nesta** migração (USP-037), nullable | USP-038 vira **puramente comportamental** (ação/UI) sem re-migração; agregado coerente numa migração. |
| `viaEncaminhamento` vs `viaReferralId` | Manter ambos | AD-017: USP-027 lê o boolean; FK é o vínculo 1:1 autoritativo. Invariante documentada. |
| Módulo dono do `Referral` | novo `referrals` | Canônico, AD-017 antecipa, coeso, fronteira respeitada (orquestra jobs+persons, possui só `referrals`). |
| Escrita da `Application` | helper `createReferralApplication` em `jobs` | `applyToJob` tem gates incompatíveis (sessão/consent/profile do candidato). Application permanece owned por `jobs`. |
| Base legal do papel candidato via encaminhamento | consent tácito `SOCIAL_REFERRAL_TO_JOB` | AC-037-2. `PURPOSE_ROLE_MAP[SOCIAL_REFERRAL_TO_JOB]=null` mantido (sem cascade de revogação para o papel). |
| Sem gate `PORTAL_ACCESS` na ativação por encaminhamento | Não exigir | EC-2: Pessoa sem credencial precisa ser encaminhável. ⚠️ Divergência de `ensureClientRole`. |

> **Project-level:** As decisões de agregado (módulo `referrals`, `viaReferralId` + boolean, colunas
> de resultado nullable já na USP-037, `ensureCandidateRole` sem `PORTAL_ACCESS`) devem virar um
> **AD-NNN** em `.specs/STATE.md` quando o pipeline consolidar a fase (feito pelo orquestrador/execução),
> pois vinculam USP-038 e USP-039.
