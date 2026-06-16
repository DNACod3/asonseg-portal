# USP-020 — Publicar vaga — Design

> **Modo ICE (thin adapter).** Resolve TD §4.4/§4.5/§4.6 + ADRs + runbooks para o concreto do código.
> Padrão de referência: módulo `companies` (`actions/edit-company.ts`, `actions/create-company.ts`) e
> `persons` (`adapters/prisma-candidate-profile-status.ts`, USP-009 — 1º conteúdo real na FSM).

## 0. Reconciliação importante (TD doc × schema implementado)

O TD §4.5 descreve `content_items` + `content_transitions` + `jobs` como tabelas separadas. **O schema
realmente implementado divergiu** (USP-009): **não há** `content_items`/`content_transitions`. O `status`
mora **na própria entidade** (coluna `ContentStatus`), e o histórico vive em `audit_log` (append-only, ADR-0023).
→ **Job segue o padrão de `CandidateProfile`**: model próprio com coluna `status ContentStatus`, sem supertipo.

A FSM (`@/modules/moderation`) **já suporta JOB** — `ContentKind.JOB` existe e `TRANSITIONS[JOB]` inclui
`DRAFT → IN_MODERATION (AUTHOR_ACTION)`. O que falta é só **um adapter de status para Job** + registro no container.

## 1. Modelo de dados (#162)

Novo model `Job` em `prisma/schema.prisma` (1:1 lógico com a FSM via coluna `status`):

```prisma
/// Vaga publicada por uma Empresa (USP-020). Conteúdo moderável: nasce em DRAFT
/// e transiciona via `transitionContent()` (ContentKind.JOB). Visibilidade pública
/// (status ACTIVE + validade >= hoje + Empresa verificada) é filtrada on-read na USP-021.
model Job {
  id                 String        @id @default(uuid()) @db.Uuid
  companyId          String        @map("company_id") @db.Uuid
  authorPersonId     String        @map("author_person_id") @db.Uuid
  title              String
  areaId             String        @map("area_id") @db.Uuid
  description        String        @db.Text
  requirements       String        @db.Text
  benefits           String?       @db.Text
  salary             String?
  workRegime         String        @map("work_regime")            // CLT, PJ, estágio… (string livre no MVP)
  location           String
  validUntil         DateTime      @map("valid_until") @db.Date   // validade (date); on-read >= hoje (USP-024)
  status             ContentStatus @default(DRAFT)
  publishedAt        DateTime?     @map("published_at") @db.Timestamptz(6)  // preenchido na 1ª ativação (USP-016)
  lastStatusChangeAt DateTime      @default(now()) @map("last_status_change_at") @db.Timestamptz(6)
  createdAt          DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt          DateTime      @updatedAt @map("updated_at") @db.Timestamptz(6)

  company Company @relation(fields: [companyId], references: [id])
  area    JobArea @relation(fields: [areaId], references: [id])
  author  Person  @relation(fields: [authorPersonId], references: [id])

  // Dedup EXATA (P-003 / ADR-0021): impede 2 vagas idênticas vivas da mesma Empresa.
  // Índice parcial — só estados "vivos" contam (rascunho/moderação/ativo); arquivada/rejeitada não bloqueiam.
  @@unique([companyId, areaId, title], name: "job_dedup_alive")
  @@index([status])
  @@index([companyId])
  @@map("jobs")
}
```

**Relações reversas a adicionar:** `Company.jobs Job[]`, `JobArea.jobs Job[]`, `Person.authoredJobs Job[]`.

**Decisão (AD-4, resolvida 2026-06-16 — dono do intent):** a vaga liga-se à Empresa **só por FK `companyId`** + leitura **on-read** — **sem snapshot** dos campos da Empresa. "Snapshot" em E-001 era linguagem solta (= registrar o vínculo, não congelar dados). Coerente com F2/P-002 (vaga some quando a Empresa é rebaixada) e USP-021/022/024.

**Já existem (NÃO recriar):** `JobArea` (taxonomia US #111), `Region`, enum `ContentStatus`.

**Decisão de design (AD-1) — dedup parcial:** a UNIQUE deve valer só para status "vivos"
(`DRAFT, IN_MODERATION, AWAITING_ADJUSTMENTS, ACTIVE, PAUSED`). Prisma não suporta `@@unique` com `WHERE`
declarativo → criar o índice parcial **na migration via SQL bruto** (`CREATE UNIQUE INDEX ... WHERE status IN (...)`),
seguindo o padrão dos índices parciais já usados no projeto (cf. `company_responsibles` / ADR-0021).

## 2. Domínio + validação (#163)

`src/modules/jobs/domain/validade.ts` + `src/modules/jobs/schemas/publish-job.schema.ts`.

- **Constante** `MAX_VALIDADE_DIAS = 180` (tunável; E-005/P-005/L-002).
- Regra pura `validadeStatus(validUntil, hojeSP): 'ok' | 'passado' | 'excede_teto'` — **timezone America/Sao_Paulo**
  via `date-fns-tz` (helper de `shared/lib` time utils). Comparar **datas** (não timestamps): vence ≤ hoje → bloqueia (E-004).
- Zod `publishJobSchema`: `title` (≥2), `areaId` (uuid), `description`/`requirements` (não vazios),
  `workRegime`, `location`, `validUntil` (coerce date, refine `> hoje` e `<= hoje+180d`), `benefits?`/`salary?` opcionais (L-003).
- **ADR-0028 (sanitização):** aplicar o helper de sanitização de PII óbvia (regex) no conteúdo textual antes de persistir,
  se já existir no projeto; senão deixar o gancho marcado (defesa em profundidade — a moderação humana é a barreira final).
- **Dois schemas/derivados:** rascunho aceita campos parciais (só `title` obrigatório); submit exige tudo (L-003).

## 3. Server Actions (#164)

Padrão **verbatim** do runbook-server-action + `companies/actions/edit-company.ts`. Retorno `ActionResult<T>` (nunca `throw`).

### `createJobDraft(input)` — `src/modules/jobs/actions/create-job-draft.ts`
1. `safeParse` (schema de rascunho) → `VALIDATION`.
2. `getCurrentPerson()` → `UNAUTHENTICATED`.
3. **Gate P-006:** `prisma.personCompanyGrant.findFirst({ personId, companyId, grantType:'RESPONSIBLE', status:'ACTIVE', revokedAt:null })` → ausente ⇒ `FORBIDDEN`. (mesmo padrão de `edit-company.ts`.)
4. `withAudit('JOB_DRAFT_SAVED', tx => tx.job.create({ data: { …, status: 'DRAFT', authorPersonId, companyId } }))`.
5. `ok({ jobId, status })`. Trata P2002 → `CONFLICT` (dedup, P-003).

### `submitJobForModeration(input)` — `src/modules/jobs/actions/submit-job-for-moderation.ts`
1. `safeParse` (schema completo, com validade) → `VALIDATION` (cobre E-004/E-005).
2. `getCurrentPerson()` → `UNAUTHENTICATED`.
3. Carrega o Job; **gate P-006** (responsável ativo da `job.companyId`); autor só submete vaga própria Empresa.
4. **Upsert dos campos** da vaga (se veio do form direto, cria em DRAFT primeiro) numa tx; depois:
5. `transitionContent({ contentKind: ContentKind.JOB, contentId: jobId, to: IN_MODERATION, trigger: 'AUTHOR_ACTION', actorPersonId })`
   — a FSM já valida `DRAFT → IN_MODERATION` e grava `CONTENT_SUBMITTED_TO_MODERATION` no audit (TD §4.6, E-001).
6. P2002 (dedup) → `CONFLICT`; resultado da transição propagado (`INVALID_TRANSITION` se status mudou).

> **Atomicidade (ADR-0020):** persistência da vaga + transição + audit numa única transação Prisma.
> Como `transitionContent` abre seu próprio `withAudit`, a action pode (a) persistir o draft, então (b) chamar
> `transitionContent`; ou (c) — preferível p/ submit direto do form — persistir+transicionar dentro de UMA tx
> reusando o repo. **Decisão AD-2 (confirmar com Tech Lead):** para o MVP, criar/atualizar o Job em DRAFT e em
> seguida `transitionContent` (2 transações curtas) é aceitável — o draft órfão (sem submit) é um estado válido (E-003).

### Wiring da FSM para JOB — `src/modules/jobs/adapters/prisma-job-status.ts` + container
- `PrismaJobStatusRepository implements ContentStatusRepository` — espelha `PrismaCandidateProfileStatusRepository`
  (`loadStatus` lê `job.status`; `updateStatus` faz `tx.job.updateMany({ where:{id, status: from}, data:{ status: to, lastStatusChangeAt } })` com concorrência otimista, ADR-0011 R3).
- Registrar no `shared/container.ts`: adicionar `[ContentKind.JOB]: new PrismaJobStatusRepository()` ao mapa `byKind` do `DispatchingContentStatusRepository`.

### Eventos de auditoria (TD §4.6)
- `CONTENT_SUBMITTED_TO_MODERATION` **já existe** no catálogo (usado por `transitionContent` para `IN_MODERATION`).
- `JOB_DRAFT_SAVED` — **novo**, adicionar a `src/modules/audit/events.ts` (rascunho não passa pela FSM).

## 4. UI (#165) — `src/app/(app)/empresa/[id]/vagas/nova` + `src/modules/jobs/components/`

- Form **React Hook Form + `@hookform/resolvers/zod`** com `publishJobSchema` (padrão das outras features).
- Campos: título, **select de área** (carrega `JobArea` aprovadas via query do módulo), descrição, requisitos,
  benefícios (opt), salário (opt), regime, local, **validade** (date picker; min=amanhã, max=hoje+180d).
- Dois botões: **"Salvar rascunho"** (`createJobDraft`, E-003) e **"Enviar para moderação"** (`submitJobForModeration`).
- Server Component carrega Empresas das quais a Pessoa é responsável ativa (escolher "publicar em nome de Empresa X", P-006).
- Erros do `ActionResult` mapeados para mensagens PT-BR claras (E-004/E-005/CONFLICT).

## 5. Fora de escopo (downstream — não implementar aqui)

- Verificação atômica da 1ª vaga (P-001/E-002) → hook `COMPANY_VERIFY_HOOK` (stub hoje) ativa na **aprovação** (USP-017).
- Filtro on-read de visibilidade pública (P-002/P-007) → USP-021. Expiração automática (USP-024). Checklist legal (P-004) → USP-016.

## Decisões abertas (confirmar com Tech Lead no PR)

- **AD-1:** índice parcial de dedup via SQL na migration (estados vivos). ✔ recomendado.
- **AD-2:** submit = draft + `transitionContent` em 2 transações curtas (vs. 1 tx única). ✔ recomendado p/ MVP.
- **AD-3:** `workRegime` como string livre no MVP (enum fechado fica p/ quando o catálogo D-007 definir regimes).
