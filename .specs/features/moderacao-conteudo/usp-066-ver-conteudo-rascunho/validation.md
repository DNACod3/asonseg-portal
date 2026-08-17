# USP-066 — Ver conteúdo integral do rascunho na fila de moderação — Validation

## Correction round (PR #294 findings A1..B8) — 2026-08-17

**Diff range**: `ef749d6..f3fab99` (9 commits, 27 files, +675/-226) — the fix round for the
multi-agent PR review of the range validated below. See PR #294 review body/comments for the
original findings; this section validates the fixes against them, evidence-or-zero, with no
regression of the P-001..P-005/E-001..E-006 coverage already Verified below.

**Verifier**: independent sub-agent (author ≠ verifier), fresh read of the diff — did not inherit
the original validation's mental model, only its requirement list.

### 🚩 A2 / P-001 — priority verdict

**PASS, with one non-blocking follow-up.** `ContentKind.CV` can now be approved without any
content ever loading. This is a legitimate, narrowly-scoped exception, not a new hole:

- `ContentKind` is a closed 4-member enum (`JOB`, `CV`, `SERVICE`, `CANDIDATE_PROFILE`;
  `src/modules/moderation/domain/content-status.ts:28-34`). `CONTENT_KINDS_WITH_READER`
  (`moderation/domain/content-moderation-reader-kinds.ts`) lists exactly the other 3 — `CV` is
  the sole, exhaustive exception, not a class of kinds.
- `CV`'s backing store (`ModerationFixtureContent`/`_moderation_fixture`,
  `prisma/schema.prisma:807-817`) has no content columns beyond `id/kind/status/title/authorPersonId`.
  There is structurally nothing to load beyond the `title`, already shown on the queue card. P-001
  prohibits approving over content "não carregado **e exibido**" — for `CV` there is no undisplayed
  content, so the must-not is vacuously satisfied, not bypassed.
- No production code path writes to `_moderation_fixture` (`grep` for `.create`/`.createMany` on
  `moderationFixtureContent` hits only `moderation-queue.int.test.ts` and
  `transition-content.int.test.ts`) — the branch is unreachable outside tests today.
- **No path for a non-`CV` item to fall into the ungated branch.** The enum is closed and 3/4
  values are exhaustively covered by `CONTENT_KINDS_WITH_READER`. The one latent opening —
  `moderation-queue.ts:115`'s `contentKind: r.kind as ContentKind` (an unchecked cast from a raw
  `String` DB column) — predates this correction round and is orthogonal to A2.
- **Honestly documented.** `spec.md` §6 labels the row "REVISADA (A2/PR#294)" and states the old
  premise's blind spot in the same breath as the fix; `design.md`'s Risks table adds a paired row
  naming the exact mechanism. Disclosure, not rationalization.
- **Real trade-off, correctly flagged as the one follow-up:** before A2, *any* kind without a
  reader failed closed (permanently stuck, never wrongly approved); after A2, any kind absent from
  `CONTENT_KINDS_WITH_READER` fails open. Today only `CV` is affected, inertly — but the sync
  between `shared/container.ts`'s reader registrations and `CONTENT_KINDS_WITH_READER` is enforced
  only by a comment ("DEVEM coincidir", `container.ts:130-138`), not a test (`grep` for
  `CONTENT_KINDS_WITH_READER` finds no test file). **Recommended fix task (non-blocking):** add a
  unit test asserting the two lists stay in sync, so a future kind added to one and not the other
  fails loud instead of silently degrading to fail-open.

### A1 — security fix (readers scoped to `IN_MODERATION`)

**Confirmed with real DB, not mocked Prisma.** `src/modules/moderation/actions/__tests__/open-content.int.test.ts`
imports `{ prisma }` from `@/shared/lib/prisma` unmocked and runs against local Postgres
(`skipIfNoDb`). Three dedicated cases prove the NOT_FOUND/E-006 path for content outside the queue's
scope, each seeding the row with Prisma directly then flipping status/publicationStatus to `ACTIVE`:
- `open-content.int.test.ts:275` — CANDIDATE_PROFILE `ACTIVE` → `NOT_FOUND`, no `data` key
- `open-content.int.test.ts:292` — JOB `ACTIVE` → `NOT_FOUND`, no `data` key
- `open-content.int.test.ts:302` — SERVICE `ACTIVE` → `NOT_FOUND`, no `data` key

Source confirmed: all 3 readers (`prisma-job-moderation-reader.ts`,
`prisma-service-moderation-reader.ts`, `prisma-candidate-profile-moderation-reader.ts`) switched
`findUnique({ where: { id } })` → `findFirst({ where: { id, status/publicationStatus: IN_MODERATION } })`.
Re-ran the full integration suite clean (see Gate Check) — all pass.

### A3 — gate sensors, mutations re-run independently (not the Implementer's claims)

Injected each violation myself into the real working tree, confirmed red, reverted, confirmed
`git status` clean before continuing:

| # | Mutation | File | Result |
|---|---|---|---|
| 1 | Removed the `needsChecklist` term from the Aprovar `disabled` expression | `moderation-queue.tsx:254` | ✅ Killed — "conteúdo carregado + checklist incompleta" test went red |
| 2 | Collapsed per-item `contentState: Record<string,...>` to a shared key | `moderation-queue.tsx:75-76,255,258` | ✅ Killed — achado #9 multi-item test went red |
| 3 | Reverted `openContentFor` test helper to ignore its `row` arg (restoring the pre-fix bug) | `moderation-queue.test.tsx:73-76` | ❌ **Survived** — all 21 tests stayed green |

Mutation 3 is a genuine, reportable gap (non-blocking): every call site of `openContentFor` passes
`screen.getByRole('listitem')`, which itself throws unless exactly one `listitem` is on screen — so
every existing call is already implicitly single-item, and the `within(row)` scoping never gets
exercised against 2+ items through this helper. The real multi-item protection (mutation 2's target)
is independently proven by a separate, inline-scoped test (`within(cardB)...`, achado #9), so the
underlying P-001 invariant is not actually at risk — but the Implementer's claim of "3/3 mutations
killed" is not supported by evidence; it is 2/3. The helper's own regression-test comment ("corrige...
quebra com 2+ itens na fila") is currently untested. **Fix task (non-blocking):** exercise
`openContentFor` in a genuine multi-item scenario, or remove the unproven claim from its comment.

### A4 — audit ip/userAgent, fail-closed intact

`open-content.ts:75-78` captures `headers()`/`clientIp` before `withAudit`; ctx now carries
`{ actorPersonId, ip, userAgent }` (`open-content.ts:88`). Confirmed non-null in practice:
`open-content.int.test.ts:206-208` asserts `ip: '10.0.0.6', userAgent: 'vitest/int'` on the real
`audit_log` row (Postgres, not mocked). The `try/catch` around `withAudit` is unchanged in shape —
`catch` still returns `fail('INTERNAL', ...)` before any `ok(view)` — so fail-closed (E-005) was not
weakened into best-effort during the refactor; read the full current file at
`src/modules/moderation/actions/open-content.ts:80-94` to confirm the return sequencing.

### B1 — `resolveSignedCvUrl` promotion

No duplicate remains. `jobs/queries/list-job-applicants.ts` and
`persons/adapters/prisma-candidate-profile-moderation-reader.ts` both import the single
`resolveSignedCvUrl` from `shared/lib/supabase/supabase-storage.ts`; `jobs/index.ts` no longer
exports `resolveCvUrl` (removed from the barrel). TTL confirmed unchanged: `SIGNED_URL_TTL_SECONDS`
still resolves to 300 (re-exported from `storage-buckets.ts`), and the degrade-to-null branches
(no path / Storage error / thrown exception) are all covered in the new
`shared/lib/supabase/__tests__/supabase-storage.test.ts`.

### B5 — `drift()`/`bucketOptions()` promoted, now testable

Both moved to `shared/lib/supabase/storage-buckets.ts` (pure, no IO); `scripts/ensure-buckets.ts`
now imports them instead of defining local copies. 6 new unit cases in
`storage-buckets.test.ts` cover all branches (no drift, MIME reordering, each field diverging,
multiple fields diverging) plus `bucketOptions`' defensive array copy.

### B6 — SERVICE reader dispatch, sensored

`open-content.int.test.ts:266` opens a real `SERVICE` `IN_MODERATION` row through
`openModerationContent` end-to-end (container → dispatcher → `PrismaServiceModerationReader` → DB),
closing the gap the review flagged (only CANDIDATE_PROFILE/JOB had a live-container sensor before).

### B4 — loosened assertions tightened

`prisma-job-moderation-reader.test.ts` and `prisma-service-moderation-reader.test.ts`:
`toMatch(/100|200/)` (passed if *either* number appeared) replaced with exact-string assertions
(`toBe('R$ 100 – R$ 200 (por hora)')` / `toBe('R$ 3.000 – R$ 4.000')`).

### B7/B8 — doc drift

B7 (validation.md test-count correction) and B8 (matriz-conexoes.md endpoint name
`viewContentForModeration` → `openModerationContent`) verified correct against
`src/modules/moderation/index.ts`'s actual barrel export.

### Off-list fix: AD-030 → PF-001 relabel

`scripts/ensure-buckets.ts` and `storage-buckets.ts` cited `AD-030` for the bucket-provisioning
decision; confirmed via `.specs/project/STATE.md:44` that AD-030 is actually the USP-066 "on-demand
via Server Action" decision, unrelated to Storage. The bucket-provisioning finding is `PF-001`
(`docs/qualidade/pontos-falhos-processo.md:20`). Relabel is correct.

### design.md — Component-3/4 "sem filtro de status" claim

Checked the literal text at both `ef749d6` and `f3fab99`: Components 3 (`PrismaServiceModerationReader`)
and 4 (`PrismaCandidateProfileModerationReader`) never contained the phrase "sem filtro de status" —
only Component 2 (Job reader) did, and it was rewritten with an explicit `REVISADO (A1/PR#294)` note.
Components 3/4 are simply silent on the status filter, before and after — not contradictory (nothing
false asserted), but incomplete relative to the current code (both readers do carry the same
`findFirst`+status filter, confirmed in source). The consolidated Risks table (design.md:245) and
Tech Decisions table (design.md:266) do correctly describe the fix as applying to "3 readers"
collectively, so the accurate picture exists in the document as a whole. "Redundant, not
contradictory" is defensible; non-blocking documentation debt, correctly disclosed as debt.

### Invariants re-checked, no regression

- `transitionContent`/`TRANSITIONS` (P-005): `git diff ef749d6..f3fab99 -- src/modules/moderation/actions/transition-content.ts src/modules/moderation/domain/` → empty.
- `viewModerationQueue` + `src/app/(app)/moderacao/page.tsx` (P-004): `git diff ef749d6..f3fab99 -- src/app/ src/modules/moderation/queries/moderation-queue.ts src/modules/moderation/views/moderation-queue-item.ts` → empty. `git diff master...feat/usp-066-ver-conteudo-rascunho -- src/app/` → empty (branch-wide, not just this round).
- Permission-before-read (P-002): `open-content.ts` — `requirePermission` still runs before `container.resolve`/`readContent` (line 53-57), unchanged shape.
- `VerificationPanel`/USP-017 checklist and `viewerModeratableKinds`/USP-056: both referenced unchanged in `moderation-queue.tsx`; new A3 tests add coverage for the combined gate, none remove/weaken existing checklist tests.
- 11 original ACs (E-001..E-006, P-001..P-005): re-confirmed intact — no test deleted, no assertion weakened; A3's rewritten cases in `moderation-queue.test.tsx` only *add* a precondition (`openContentFor`) consistent with AC-066-5, per the file's own header comment and the diff (14→17 `it()`, 0 deletions across the round; further +4 new cases this round for achado #9/A2/A3-checklist, still 0 deletions).

### Gate Check (this round, run clean and foreground — sequential, no overlap)

| Gate | Result |
|---|---|
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors/warnings (exit 0) |
| `npm run test` (unit) | ✅ 2169/2170 passed, 304/305 files — 1 failure is `src/shared/__tests__/no-committed-secrets.test.ts` (5000ms `testTimeout` exceeded scanning all tracked files). **Confirmed pre-existing, not a regression**: reproduced the identical timeout on a clean worktree checked out at the pre-correction baseline `ef749d6` (30.9s under the same load, still >5000ms) — the file is untouched by this diff and the tracked-file count only grew 1731→1734. Load-sensitive flake, unrelated to USP-066. |
| `npm run build` | ✅ production build succeeded, all routes compiled, `/moderacao` present (transient Prisma connection warnings during static-generation of `/` are pre-existing graceful-degradation logging, not a build failure — exit 0) |
| `npm run test:integration` | ✅ 671/671 passed, 114/114 files (real local Supabase Postgres; first attempt lost DB connectivity mid-run from unrelated host load per the coordinator's note — re-ran clean after confirming `127.0.0.1:55322` reachable, full pass) |

### Verdict

**PASS ✅** — A1/A4/B1/B5/B6/B7/B8 fully verified with independent evidence (real DB, re-run
mutations, source `grep`s). A2's P-001 exception is legitimate and honestly documented, not a
regression. Two non-blocking follow-ups recorded (not gating this PASS, should be picked up next):

1. Add a test that fails loud if `CONTENT_KINDS_WITH_READER` and the container's registered readers
   diverge (the A2 fail-open trade-off currently relies on a comment, not code).
2. `openContentFor`'s multi-item scoping fix (A3) is currently unexercised by any test — either add
   a genuine multi-item case through the helper or drop the unproven "corrige... quebra com 2+
   itens" claim from its comment.

No blockers. No regression of the original 11 ACs / 5 must-nots. Ready to merge.

---

## Original feature validation — 2026-08-15
**Spec**: `.specs/features/moderacao-conteudo/usp-066-ver-conteudo-rascunho/spec.md` → ICE:
`docs/IDSD/ice-portal-asonseg/expectations/expectations-USP-066.md`, `intents/intent-USP-066.md`,
`matriz-conexoes.md` (card USP-066)
**Diff range**: `ece14e6..8c5e362` (9 commits, T1..T9, 22 files, +1713/-11) — this is the range
validated below. Two docs-only commits landed after it (`9c99e4d` docs: marca USP-066 concluída,
`ef749d6` docs: marca no ROADMAP), neither touching `src/`. PR #294 (opened against this same
range) then received a multi-agent review; the findings (A1..A4, B1..B8) were fixed in a
follow-up correction round on top of `ef749d6` — see the branch's later commits for that work.
This validation report was **not** re-run after the correction round (not requested — see the
correction round's own final report for what changed and why).
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
|---|---|---|
| T1 | ✅ Done | `src/modules/moderation/views/moderation-content.ts`, `ports/content-moderation-reader.port.ts` |
| T2 | ✅ Done | `src/modules/jobs/adapters/prisma-job-moderation-reader.ts` |
| T3 | ✅ Done | `src/modules/services/adapters/prisma-service-moderation-reader.ts` |
| T4 | ✅ Done | `src/modules/persons/adapters/prisma-candidate-profile-moderation-reader.ts` |
| T5 | ✅ Done | `src/modules/moderation/adapters/dispatching-content-moderation-reader.ts` + `shared/container.ts:130-163` |
| T6 | ✅ Done | `src/modules/moderation/actions/open-content.ts` + schema |
| T7 | ✅ Done | `src/modules/moderation/components/moderation-content-details.tsx` |
| T8 | ✅ Done | `src/modules/moderation/components/moderation-content-panel.tsx` |
| T9 | ✅ Done | `src/modules/moderation/components/moderation-queue.tsx` (modified) |

All 22 files in the diff match the task list 1:1 (no unclaimed files). `app/(app)/moderacao/page.tsx`
has **zero diff** in this range (confirmed via `git diff --stat ece14e6..8c5e362 -- src/app/` → empty),
proving the P-004 structural guarantee.

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| AC-066-1 (E-001/E-002, JOB) | Vaga exibe título/descrição/requisitos/salário/jornada/localidade/Empresa inline, sem sair da fila | `src/modules/jobs/adapters/__tests__/prisma-job-moderation-reader.test.ts:39` — mapeia todos os campos de E-002; `moderation-content-details.tsx:26-43` (`JobDetails`) renderiza os mesmos campos; `moderation-content-panel.tsx:53-58` renderiza inline (sem navegação) | ✅ PASS |
| AC-066-1 (salaryVisible) | Faixa salarial oculta quando `salaryVisible=false` | `prisma-job-moderation-reader.test.ts:67` — `expect(view.salaryRange).toBeNull()` com `salaryVisible:false` e min/max presentes | ✅ PASS |
| AC-066-2 (E-003, SERVICE) | Serviço exibe título/descrição/categoria/área de atendimento/fotos | `src/modules/services/adapters/__tests__/prisma-service-moderation-reader.test.ts:33` — mapeia campos + fotos ordenadas por `position`; `moderation-content-details.tsx:45-75` (`ServiceDetails`) renderiza `<img>` por foto | ✅ PASS |
| AC-066-3 (E-004, CANDIDATE_PROFILE) | Escolaridade/formação/experiência/habilidades/cursos + CV por URL assinada TTL 5min | `src/modules/persons/adapters/__tests__/prisma-candidate-profile-moderation-reader.test.ts:43` — `expect(createSignedUrl).toHaveBeenCalledWith(path, 300)` (`SIGNED_URL_TTL_SECONDS`); `moderation-content-details.tsx:90-106` renderiza link/nota | ✅ PASS |
| AC-066-4 (E-005, audit-on-read fail-closed) | Servir conteúdo de candidato grava `SENSITIVE_FIELD_VIEWED` (ator, entityId, momento); falha de auditoria ⇒ conteúdo NÃO entregue | Unit: `open-content.test.ts:80` (happy — grava com `entityId=personId`) e `open-content.test.ts:135` (`E-005 fail-closed: falha ao auditar retorna erro e NÃO entrega o conteúdo` — `expect(res.ok).toBe(false); expect(res).not.toHaveProperty('data')`). Int (DB real): `open-content.int.test.ts:169` — 1 linha `SENSITIVE_FIELD_VIEWED` gravada com `actorPersonId`/`entityId` reais | ✅ PASS |
| AC-066-5 (E-006/P-001) | Carga falhando ⇒ aviso claro + Aprovar desabilitado; devolver/rejeitar seguem habilitados | `moderation-queue.test.tsx:120` — `USP-066/E-006: carga do conteúdo falha ⇒ Aprovar permanece desabilitado; devolver/rejeitar seguem habilitados` — 3 asserções (`toBeDisabled()`/`not.toBeDisabled()` para os 3 botões) | ✅ PASS |
| AC-066-6 (P-002, payload) | Moderador sem permissão para o kind não recebe campo de PII **no payload serializado** | `open-content.test.ts:112` — `expect(res).not.toHaveProperty('data')` após `requirePermission` negado, `expect(readContent).not.toHaveBeenCalled()`. Int: `open-content.int.test.ts:236` — mesma asserção com DB real (papel `CANDIDATE`, sem `MODERATE_CV`) | ✅ PASS |
| AC-066-7 (P-004) | N itens na fila não disparam N leituras nem N URLs assinadas | `moderation-queue.test.tsx:198` — `USP-066/P-004: renderizar a fila com N itens não dispara nenhuma leitura de conteúdo` (3 rows) — `expect(openContent).not.toHaveBeenCalled()`; `moderation-content-panel.test.tsx:36` — `P-004: montar o painel NÃO chama openModerationContent` | ✅ PASS |
| AC-066-8 (P-003) | Conteúdo longo (~5.000 chars) acessível integralmente, sem truncar silenciosamente | `moderation-content-details.test.tsx:96-100` — gera texto de ~5.000 chars, afirma `el.textContent` tem o comprimento integral e a classe `whitespace-pre-wrap` (sem `truncate`/`line-clamp`) | ✅ PASS |
| P-005 (não abre write-path de status) | Conteúdo servido não altera `status`/`publicationStatus`; única via segue `transitionContent` | Int: `open-content.int.test.ts:199` — `P-005: publicationStatus do perfil permanece IN_MODERATION antes/depois de abrir o conteúdo` (lê antes/depois, ambos `IN_MODERATION`). Estrutural: `open-content.ts` não importa `transitionContent`/`prisma.*.update` em nenhum caminho (grep confirma) | ✅ PASS |

**Status**: ✅ All 11 ICE requirements (E-001..E-006, P-001..P-005) covered with `file:line` evidence. No
spec-precision gaps found — every criterion has a precisely defined outcome and the tests assert exactly it.

---

## Discrimination Sensor

Tier: **P0-full** (ICED + must-not USP → ≥5 mutations, all must-not guards covered). Sensor ran against the
real working tree with `git checkout -- <file>` as the revert mechanism (each mutation touched exactly one
tracked file, reverted before the next). Working tree confirmed clean (`git status --short -- src/`) before
starting and after finishing; unrelated pre-existing user changes (`ROADMAP.md`, `docs/prototipo/*`) were
never touched.

| # | Must-not | File:line | Mutation | Killed? |
|---|---|---|---|---|
| 1 | P-001 | `moderation-queue.tsx` Aprovar `disabled` expr | Removed `contentState[id] !== 'loaded'` from the disabled condition | ✅ Killed — 3 tests red in `moderation-queue.test.tsx` (`Aprovar nasce desabilitado`, `E-001/P-001`, `E-006`) |
| 2 | P-002 | `open-content.ts` — reordered reader call before `requirePermission` | Called `reader.readContent` before the authz gate | ✅ Killed — `open-content.test.ts:123` (`readContent` called when it must not be) |
| 3 | P-004 | `moderation-content-panel.tsx` — added `useEffect(load, [])` | Auto-load content on mount | ✅ Killed — 9 tests red across `moderation-content-panel.test.tsx` + `moderation-queue.test.tsx` |
| 4 | P-005 | `open-content.ts` — added `prisma.candidateProfile.update({ publicationStatus: 'ACTIVE' })` in the candidate branch | Unauthorized status write | ✅ Killed — `open-content.int.test.ts` P-005 case: `expected 'ACTIVE' to be 'IN_MODERATION'` |
| 5 | P-003 | `moderation-content-details.tsx` `TextField` — `value.slice(0, 100)` | Silent truncation of long text | ✅ Killed — `moderation-content-details.test.tsx` long-content case |
| 6 | E-005 fail-closed | `open-content.ts` — removed `return fail(...)` from the audit `catch` block | Swallow audit failure, still deliver content | ✅ Killed — `open-content.test.ts:144` (`expected true to be false`) |

**Sensor depth**: P0-full (6/6 killed, all 5 must-nots + the fail-closed guard covered).
**Result**: 6/6 killed — **PASS ✅**

---

## 🧬 Must-Not Verification (ICE mode)

| ID | SHALL NOT… (F-X) | Negative fact (`file:line` + assertion) | eval(−) green? | Guard mutation killed? |
|---|---|---|---|---|
| P-001 (F1) | Offer "Aprovar" for an item whose content wasn't loaded/shown | `moderation-queue.test.tsx:103-118` — `Aprovar` disabled before load, enabled only after `openContentFor` | ✅ | ✅ (#1) |
| P-002 (F2) | Load/transmit content of a `ContentKind` outside the viewer's permission | `open-content.test.ts:112-125` (unit) + `open-content.int.test.ts:236-252` (DB real) — response has no `data` key, `readContent` never called | ✅ | ✅ (#2) |
| P-003 (F3) | Show a silently truncated/summarized/cached version | `moderation-content-details.test.tsx:96-100` — full ~5.000-char text present | ✅ | ✅ (#5) |
| P-004 (F4) | Load full content of all items on queue render | `moderation-queue.test.tsx:198-207` + `moderation-content-panel.test.tsx:36-42` — 0 calls to `openModerationContent` on mount/render | ✅ | ✅ (#3) |
| P-005 (F1) | Alter status via a path other than `transitionContent` | `open-content.int.test.ts:199-220` — `publicationStatus` unchanged before/after | ✅ | ✅ (#4) |

**Status**: ✅ All 5 must-nots proven — every `eval(−)` is green and its guard mutation was independently
killed by the sensor (not just "a test exists").

---

## Interactive UAT

Not performed. Backend + internal moderator-facing tooling; automated coverage (unit + integration + RTL +
sensor) is sufficient per the skill's own criteria (§3 of validate.md — UAT is for user-facing features where
human judgment on visual/interaction design matters; this USP's UI surface is 2 small components reusing
existing DS primitives, already covered by RTL assertions on rendered output).

---

## Code Quality

| Principle | Status | Evidence |
|---|---|---|
| No features beyond what was asked | ✅ | All 22 changed files map 1:1 to a task in tasks.md; no extra endpoints/fields |
| No abstractions for single-use code | ✅ | `DispatchingContentModerationReader` mirrors an existing pattern (`DispatchingContentStatusRepository`), not a novel abstraction |
| No unnecessary "flexibility" | ✅ | Union type has exactly 3 variants (JOB/SERVICE/CANDIDATE_PROFILE), matching design §Data Models |
| Only touched files required for task | ✅ | `git diff --name-status` — 22 files, all listed in tasks.md `Where` |
| Didn't "improve" unrelated code | ✅ | `viewModerationQueue`, `transitionContent`, `TRANSITIONS`, `VerificationPanel` all untouched (confirmed no diff) |
| Matches existing patterns/style | ✅ | Adapter-per-`ContentKind` in container (mirrors status dispatcher); Server Action sequence mirrors `decide.ts`; audit-on-read mirrors `list-job-applicants.ts` |
| Would senior engineer approve? | ✅ | Fail-closed audit, explicit `select`s, no deep imports, PT-BR comments citing ICE IDs throughout |
| Tests map to ACs, non-shallow | ✅ | Spot-checked T6/T9 above — assertions target precise values (`toHaveProperty`, `not.toHaveBeenCalled`, exact TTL `300`), not just "no error" |
| Spec-anchored outcome check | ✅ | See table above — 0 spec-precision gaps |
| Every test maps to a spec AC/edge case | ✅ | No unclaimed tests found in the 4 new/modified test files reviewed |

---

## Deviation Review (Implementer's 5 declared deviations)

1. **T9 modified existing tests in `moderation-queue.test.tsx`** (approve-without-loading cases now call `openContentFor` first). **Verdict: legitimate, not weakened.** Confirmed via `git diff` on the test file: the pre-existing assertions (approve calls the action, error shows alert, error fallback text) are all still present, unchanged in substance — only a precondition (`openContentFor`) was added because the new AC-066-5/P-001 makes it a true precondition of the UI. Net test count in this file: 14→17 (+3), zero deletions. Checklist-gating tests (USP-017, `verifyReady`) live in a separate file (`verification-panel.test.tsx`), untouched by this diff — pre-existing gap, not a T9 regression.
2. **T2 added exports to `moderation/index.ts`** (`CONTENT_MODERATION_READER_TOKEN`, `ContentModerationReader`, `ModerationContentView`) not in T1's own file list. **Verdict: legitimate.** `eslint.config.mjs:16-27` confirms `no-restricted-imports` bans `@/modules/*/*` (deep imports) repo-wide; the `jobs`/`services`/`persons` adapters need these symbols from `moderation`, so barrel export is the only compliant path.
3. **T4 duplicated `resolveSignedCvUrl` instead of importing `resolveCvUrl` from `jobs`.** **Verdict: legitimate, cycle is real.** `grep` confirms `src/modules/jobs/queries/list-job-applicants.ts:5` and `job-applicants-list.tsx:3` import `@/modules/persons`; importing `jobs`'s `resolveCvUrl` back into `persons` would create `persons→jobs→persons`. Behavior parity confirmed: both use the same `SIGNED_URL_TTL_SECONDS` constant (300s) from `shared/lib/supabase/supabase-storage.ts`, identical try/catch-degrade-to-null structure, same log-and-continue pattern. No divergence found.
4. **AC-066-4 refined to audit-on-read fail-closed.** **Verdict: real fail-closed, not best-effort.** `open-content.ts:69-83` — `withAudit` call wrapped in `try/catch`; the `catch` block returns `fail('INTERNAL', ...)` **before** `ok(view)` is ever reached, so no content is returned on audit failure. Confirmed live via mutation #6 (removing the `return fail(...)` line flips the E-005 fail-closed test red). E-005 (audit registers actor/entity/moment) is independently satisfied by the int test (`open-content.int.test.ts:169`).
5. **T6 int test seeds `cvStoragePath: null` ⇒ `cvUrl: null`.** **Verdict: confirmed correct scope.** `open-content.int.test.ts:169-197` asserts on the `SENSITIVE_FIELD_VIEWED` row and `res.data` shape, not on signed-URL generation (which needs a live bucket unavailable in CI) — matches the documented GAP #4 rationale. `publicationStatus` unchanged is asserted separately in the P-005 case.

All 5 deviations independently verified against evidence, not accepted on the Implementer's word alone.

---

## Edge Cases

- [x] Kind `CV` (isolated, no reader) → dispatcher returns `null` → E-006 graceful (`dispatching-content-moderation-reader.test.ts`, kind without entry)
- [x] `cvStoragePath` null → `cvUrl: null` without calling storage (`prisma-candidate-profile-moderation-reader.test.ts:68`)
- [x] Storage error/exception → `cvUrl: null`, never throws (`:80`, `:92`)
- [x] Service with no photos → `photos: []` (`prisma-service-moderation-reader.test.ts:68`)
- [x] Job with legacy freetext salary (no min/max) → uses legacy text (`prisma-job-moderation-reader.test.ts:79`)
- [x] `companyName` falls back to `razaoSocial` when `nomeFantasia` absent (`:92`)
- [x] Zod invalid input → `VALIDATION`, permission never checked (`open-content.test.ts:148`)
- [x] Reload allowed after error (`moderation-content-panel.test.tsx:73`)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`
- **Result**:
  - `typecheck`: ✅ clean (0 errors)
  - `lint`: ✅ clean (0 errors/warnings)
  - `test` (unit): ✅ 2153/2153 passed, 303/303 files
  - `test:integration`: ✅ 667/667 passed, 114/114 files (against local Supabase Postgres)
  - `build`: ✅ production build succeeded, all routes compiled, `/moderacao` present
- **Test count before feature**: baseline `moderation-queue.test.tsx` had 14 `it()` blocks; 0 of the other 8 test files pre-existed (`moderation-queue.test.tsx` is modified, not new — see next line)
- **Test count after feature**: `moderation-queue.test.tsx` 17 `it()` blocks (+3, 0 deletions); + 8 new test files (adapters ×3, dispatcher, action unit+int, content-details, content-panel) — 8, not 9: `moderation-queue.test.tsx` itself is the pre-existing file that was modified, it does not count as a 9th new file
- **Delta**: net increase across the board, zero deletions anywhere in the diff
- **Skipped tests**: none observed in this diff's scope
- **Failures**: none (post-sensor-revert state)

---

## Fix Plans

None — no gaps found.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| E-001 | Implementing | ✅ Verified |
| E-002 (JOB) | Implementing | ✅ Verified |
| E-003 (SERVICE) | Implementing | ✅ Verified |
| E-004 (CANDIDATE_PROFILE/CV) | Implementing | ✅ Verified |
| E-005 | Implementing | ✅ Verified (fail-closed confirmed) |
| E-006 | Implementing | ✅ Verified |
| P-001 (F1) | Implementing | ✅ Verified (eval(−) green, mutation killed) |
| P-002 (F2) | Implementing | ✅ Verified (eval(−) green, mutation killed) |
| P-003 (F3) | Implementing | ✅ Verified (eval(−) green, mutation killed) |
| P-004 (F4) | Implementing | ✅ Verified (eval(−) green, mutation killed) |
| P-005 (F1) | Implementing | ✅ Verified (eval(−) green, mutation killed) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 11/11 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 6/6 mutations killed (P0-full tier — all 5 must-nots + fail-closed guard)
**Must-nots**: 5/5 eval(−) green, all independently confirmed live
**Gate**: typecheck ✅ · lint ✅ · unit 2153/2153 ✅ · integration 667/667 ✅ · build ✅

**What works**: Full USP-066 slice — on-demand content reading per `ContentKind` (JOB/SERVICE/CANDIDATE_PROFILE),
fail-closed audit-on-read for candidate PII, Approve gated on content having loaded, zero batch loading in the
queue render, page.tsx untouched (diff-zero), no new write-path for status. All 5 of the Implementer's declared
deviations independently verified against evidence (not accepted on word).

**Issues found**: None.

**Next steps**: None — ready to merge per project protocol (OpenWolf close-out).
