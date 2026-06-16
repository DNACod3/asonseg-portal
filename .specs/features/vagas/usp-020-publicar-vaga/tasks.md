# USP-020 — Publicar vaga — Tasks

> Deriva de [`design.md`](./design.md). 1 task = 1 PR (squash). Estimate total = **22h** (= 5+3+7+7, bate com o board #161).
> Status do board (2026-06-16): #161 **In progress** (kickoff) · #162–#165 **Backlog**.
> **Padrões de referência:** `companies/actions/edit-company.ts` (gate de responsável ativo + `withAudit`),
> `persons/adapters/prisma-candidate-profile-status.ts` (adapter de status p/ a FSM), USP-011 (migration + domain).

## Grafo de dependências

```
#162 (model Job + migration) ──▶ #163 (zod + validade futura, domain) ──▶ #164 (actions + adapter FSM + container) ──▶ #165 (UI form)
```

Cadeia linear; cada subtask destrava a próxima ao fechar (cascade OpenWolf regra 5).
**Já existem (não recriar):** `JobArea`, `Region`, enum `ContentStatus`, `ContentKind.JOB`, `TRANSITIONS[JOB]`
(inclui `DRAFT→IN_MODERATION`), `transitionContent`, `withAudit`, `getCurrentPerson`, `personCompanyGrant`,
`CONTENT_SUBMITTED_TO_MODERATION` (catálogo de audit).

---

## T1 — #162 · feat(jobs): schema Job + migration · 5h · Backlog

- **What:** model Prisma `Job` (contrato **verbatim** de `design.md §1`) + relações reversas + índice parcial de dedup + migration.
- **Where:** `prisma/schema.prisma`; migration `prisma/migrations/20260616XXXXXX_usp020_job/`.
- **Depends on:** `Company` (USP-012), `JobArea`/`Region`/`ContentStatus` (já existem).
- **Reuses:** padrão de `CandidateProfile` (coluna `status ContentStatus`, sem supertipo — ver `design.md §0`); padrão de migration `..._usp011_client_profile`.
- **Done when:**
  - [ ] Model `Job` com `id` PK uuid, `companyId`/`authorPersonId`/`areaId` FKs, `title`, `description`/`requirements` `@db.Text`, `benefits?`/`salary?`, `workRegime`, `location`, `validUntil @db.Date`, `status ContentStatus @default(DRAFT)`, `publishedAt?`, `lastStatusChangeAt`, timestamps, `@@map("jobs")`.
  - [ ] Relações reversas `Company.jobs`, `JobArea.jobs`, `Person.authoredJobs`.
  - [ ] **NÃO** criar `content_items`/`content_transitions`/`City`; **NÃO** recriar `JobArea`/`Region`/`ContentStatus`.
  - [ ] Índice **parcial** de dedup (P-003/ADR-0021) via SQL bruto na migration: `CREATE UNIQUE INDEX job_dedup_alive ON jobs (company_id, area_id, title) WHERE status IN ('DRAFT','IN_MODERATION','AWAITING_ADJUSTMENTS','ACTIVE','PAUSED')`.
  - [ ] Migration aplica em DB limpo (`supabase db reset`); `prisma generate` sem erro.
  - [ ] `npm run typecheck` ✓.
- **Tests:** validação por migration + typecheck; smoke `supabase db reset`. (sem teste unitário direto)
- **Gate:** `npm run typecheck` ✓ · migration aplica em DB limpo ✓ · índice parcial criado.
- **Commit:** `feat(jobs): schema Job + migration (USP-020)`

## T2 — #163 · feat(jobs): zod schema + validade futura (domain) · 3h · Backlog

- **What:** regra pura de validade (timezone SP, teto 180d) + Zod `publishJobSchema` (+ derivado de rascunho).
- **Where:** `src/modules/jobs/domain/validade.ts`, `src/modules/jobs/schemas/publish-job.schema.ts`, `src/modules/jobs/__tests__/validade.spec.ts`, barrel `src/modules/jobs/index.ts`.
- **Depends on:** #162 (tipos do Prisma). Externo: helper de tempo `shared/lib` (date-fns-tz, America/Sao_Paulo).
- **Reuses:** padrão de schema de `companies/schemas/create-company.schema.ts`; constante tunável.
- **Done when:**
  - [ ] `MAX_VALIDADE_DIAS = 180` exportado (tunável; E-005/P-005/L-002).
  - [ ] `validadeStatus(validUntil, hojeSP): 'ok'|'passado'|'excede_teto'` puro, comparando **datas** em America/Sao_Paulo (E-004: ≤ hoje = `passado`).
  - [ ] `publishJobSchema` (Zod): obrigatórios título/área(uuid)/descrição/requisitos/regime/local/validade (L-003); `validUntil` refine `> hoje` (E-004) e `<= hoje+180d` (E-005); `benefits?`/`salary?` opcionais.
  - [ ] Schema de **rascunho** (campos parciais, só `title` obrigatório) p/ E-003.
  - [ ] Gancho de sanitização (ADR-0028) aplicado ou marcado (`design.md §2`).
  - [ ] Exports via barrel `jobs/index.ts`; `npm run typecheck` + `lint` ✓.
- **Tests:** facts do skill-tdad (abaixo). Unit (domain): validade ok / data passada (E-004) / excede 180d (E-005) / borda hoje em SP.
- **Gate:** `npm run typecheck` ✓ · `lint` ✓ · `vitest` dos novos specs verdes.
- **Commit:** `feat(jobs): zod schema + validade futura (USP-020)`

## T3 — #164 · feat(jobs): createJobDraft + submitForModeration (actions) · 7h · Backlog

- **What:** Server Actions `createJobDraft` + `submitJobForModeration` + adapter de status `PrismaJobStatusRepository` + registro no container + evento `JOB_DRAFT_SAVED`.
- **Where:** `src/modules/jobs/actions/create-job-draft.ts`, `src/modules/jobs/actions/submit-job-for-moderation.ts`, `src/modules/jobs/adapters/prisma-job-status.ts`, `src/modules/jobs/__tests__/*.int.test.ts`, barrel `jobs/index.ts`; edita `src/shared/container.ts`, `src/modules/audit/events.ts`.
- **Depends on:** #163 (schemas). Externos (existem): `@/modules/moderation` (`transitionContent`, `ContentKind`, `ContentStatusRepository`), `@/modules/audit` (`withAudit`), `@/modules/identity` (`getCurrentPerson`), `prisma.personCompanyGrant`.
- **Reuses:** sequência **verbatim** do runbook-server-action; gate de responsável ativo de `edit-company.ts:77-90`; adapter espelha `prisma-candidate-profile-status.ts` (concorrência otimista `updateMany where status=from`).
- **Done when:**
  - [ ] `createJobDraft`: Zod(rascunho) → `getCurrentPerson` → **gate P-006** (responsável `ACTIVE` da `companyId`, senão `FORBIDDEN`) → `withAudit('JOB_DRAFT_SAVED', tx.job.create status DRAFT)` → `ok({jobId,status})`; P2002 → `CONFLICT` (P-003).
  - [ ] `submitJobForModeration`: Zod(completo, E-004/E-005) → `getCurrentPerson` → gate P-006 sobre `job.companyId` → persiste campos → `transitionContent(JOB, jobId, IN_MODERATION, 'AUTHOR_ACTION', actorPersonId)`; propaga `INVALID_TRANSITION`/`CONFLICT` (E-001).
  - [ ] `PrismaJobStatusRepository implements ContentStatusRepository` (`loadStatus` lê `job.status`; `updateStatus` `updateMany where {id,status:from}` → `count===1`).
  - [ ] Container: `[ContentKind.JOB]: new PrismaJobStatusRepository()` adicionado ao `byKind` do dispatcher.
  - [ ] `JOB_DRAFT_SAVED` no catálogo `audit/events.ts`; **`CONTENT_SUBMITTED_TO_MODERATION` reusado** (não duplicar).
  - [ ] **Decisões AD-2 / AD-3** (`design.md`) confirmadas com Tech Lead no PR.
  - [ ] Exports via barrel; `npm run typecheck` + `lint` ✓.
- **Tests:** facts do skill-tdad. Integração (`*.int.test.ts`): rascunho persiste DRAFT; submit válido → IN_MODERATION + audit `CONTENT_SUBMITTED_TO_MODERATION` (E-001); validade passada/excede → VALIDATION (E-004/E-005); não-responsável → FORBIDDEN (P-006/D-005); 2ª vaga idêntica → CONFLICT (P-003); submit concorrente → INVALID_TRANSITION.
- **Gate:** `npm run typecheck` ✓ · `lint` ✓ · `vitest` (unit+int) dos novos testes verdes.
- **Commit:** `feat(jobs): createJobDraft + submitForModeration (USP-020)`

## T4 — #165 · feat(jobs): UI publicar vaga (form RHF+Zod) · 7h · Backlog

- **What:** rota + form de publicação de vaga (RHF + zodResolver), com "Salvar rascunho" e "Enviar para moderação".
- **Where:** `src/app/(app)/empresa/[id]/vagas/nova/page.tsx`, `src/modules/jobs/components/job-form.tsx`, `src/modules/jobs/queries/list-job-areas.ts` (+ Empresas do responsável), barrel.
- **Depends on:** #164 (actions). Externos: shadcn/ui, RHF, `@hookform/resolvers/zod`, query de `JobArea` aprovadas.
- **Reuses:** padrão de form das features anteriores; `publishJobSchema` (#163); mapeamento de `ActionResult` → mensagens PT-BR.
- **Done when:**
  - [ ] Form com todos os campos (select de área via `JobArea` aprovadas; date picker validade min=amanhã/max=+180d).
  - [ ] Botão "Salvar rascunho" chama `createJobDraft` (E-003); "Enviar para moderação" chama `submitJobForModeration` (E-001).
  - [ ] Server Component lista só Empresas das quais a Pessoa é responsável ativa (P-006); página protegida por sessão.
  - [ ] Erros (validade passada/excede, CONFLICT, FORBIDDEN) exibidos em PT-BR claro (E-004/E-005).
  - [ ] `npm run typecheck` + `lint` ✓.
- **Tests:** facts do skill-tdad. E2E (Playwright, top-flow #3 publicar): preencher form com validade futura → submit → vaga em moderação; validade passada → bloqueio; salvar rascunho → persiste sem submeter.
- **Gate:** `npm run typecheck` ✓ · `lint` ✓ · E2E do fluxo de publicação verde.
- **Commit:** `feat(jobs): UI publicar vaga (form RHF+Zod) (USP-020)`

---

## Execução (2026-06-16) — ✅ T1–T4 implementadas (branch `feat/usp-020-publicar-vaga`)

- **T1 #162:** model `Job` + migration + índice parcial `job_dedup_alive`. ✅ typecheck + `supabase db reset`.
  - **Desvio de design (aceito):** colunas de conteúdo (`areaId/description/requirements/workRegime/location/validUntil`)
    ficaram **nullable** (não NOT NULL como em design §1) — E-003 exige salvar rascunho só com título; completude
    (L-003) é exigida no submit pelo Zod. Mesmo padrão de `CandidateProfile`. `area JobArea?` (relação opcional).
- **T2 #163:** `validadeStatus` (SP, teto 180d) + `publishJobSchema`/`draftJobSchema`. ✅ unit 5/5.
  - `validUntil` é **string `yyyy-MM-dd`** validada (input=output) — evita duplo-parse RHF→Server Action; converte p/ Date na persistência.
- **T3 #164:** `createJobDraft` + `submitJobForModeration` + `PrismaJobStatusRepository` + container + `JOB_DRAFT_SAVED`. ✅ integração 19/19.
  - `submitJobSchema` = union(`{jobId}` | `publishJobSchema`): submete rascunho existente ou cria+submete do form direto (AD-2).
- **T4 #165:** rota `(app)/empresa/[empresaId]/vagas/nova` + `JobForm` (rascunho + enviar) + `listApprovedJobAreas`. ✅ E2E gate de rota; typecheck/lint.
- **Regressão:** suíte unit completa 656/656 verde; lint limpo.
- **A confirmar no PR (Tech Lead):** AD-1 (estados vivos do índice parcial), AD-2 (2 transações curtas), AD-3 (`workRegime` string livre), e o **desvio nullable** do T1.

## Facts (skill-tdad) — ✅ gerados (Red) em 2026-06-16

Fonte da verdade em `tests/` desta feature (mover/conectar para `src/`+`e2e/` na fase Execute):
- `tests/bdd/usp-020-publicar-vaga.feature` — Gherkin PT-BR (tags `@ac-020-N`/`@e-001`/`@e-003`/`@e-004`/`@e-005`/`@p-006`/`@p-003`/`@l-003`/`@l-004`).
- `tests/unit/usp-020-publicar-vaga.spec.ts` — Vitest Red (domínio de validade + integração das actions).
- `tests/e2e/usp-020-publicar-vaga.e2e.ts` — Playwright Red (top-flow #3, 1ª perna: publicar→moderação; `test.fixme`).
- `tests/traceability.md` — matriz AC→fact (**8/8 IDs em escopo cobertos**) + Lacunas.

Cobertura: **E-001, E-003, E-004, E-005/P-005, P-006, P-003, L-003, L-004**.
Fora desta US (verificam em USP-016/017/021/024): E-002/P-001 (verificação atômica), P-002/P-007 (on-read), P-004 (checklist legal).

**✅ Lacuna resolvida (2026-06-16):** E-001 "snapshot" = **vínculo via FK `companyId` + on-read** (opção B confirmada pelo dono do intent). Sem coluna de snapshot no model `Job`. Coerente com F2/P-002/USP-021.
