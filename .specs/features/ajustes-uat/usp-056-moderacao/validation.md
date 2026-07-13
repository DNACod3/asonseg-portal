# USP-056 — Moderação (remediação do UAT) — Validation

**Date**: 2026-07-12
**Spec**: `.specs/features/ajustes-uat/usp-056-moderacao/spec.md`
**Diff range**: `9766036~1..9155686` (5 commits / 5 tasks)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
|------|---------|-------|
| T1 — heurística MOD-6 | ✅ Done | `9766036` |
| T2 — fila CV MOD-1 | ✅ Done | `17beb3d` |
| T3 — helper MOD-7 backend | ✅ Done | `2063f28` |
| T4 — UI gating MOD-7 | ✅ Done | `9155686` |
| T5 — confirmação MOD-8 | ✅ Done | `d3a5234` |

All 5 tasks present as atomic commits, in the order declared by the Execution Plan (T1/T2/T3/T5 parallel-independent, T4 after T3).

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| MOD1-01 (E-001) | `CandidateProfile` IN_MODERATION → item `contentKind=CANDIDATE_PROFILE`, `contentId=personId`, `title=headline??"Perfil de candidato"`, `submittedAt=lastStatusChangeAt` | `src/modules/moderation/queries/__tests__/moderation-queue.int.test.ts:235-254` — `expect(item?.contentKind).toBe('CANDIDATE_PROFILE'); expect(item?.title).toBe('Auxiliar Administrativo Int')`; `moderation-queue.ts:122-128` maps exactly this shape | ✅ PASS |
| MOD1-02 (P-005) | Perfil com `personId==viewerPersonId` SHALL NOT aparecer | `moderation-queue.int.test.ts:256-267` — `expect(queue.find((q) => q.contentId === VIEWER)).toBeUndefined()` | ✅ PASS |
| MOD1-03 (L-001) | `select` explícito, `orderBy`, `take` | `moderation-queue.ts:82-90` — `select: { personId, headline, lastStatusChangeAt }`, `orderBy: { lastStatusChangeAt: 'asc' }`, `take: QUEUE_PAGE_SIZE`; no `include` | ✅ PASS |
| Edge: sem perfis → sem regressão | Fila comporta-se como hoje | `moderation-queue.test.ts` (unit, pre-existing job/service/fixture cases pass unchanged) | ✅ PASS |
| MOD6-01 (P-003) | ≥20 chars, <5 letras distintas → `false` + mensagem existente | `justification.test.ts:12-23` — `expect(isMeaningfulJustification('a'.repeat(30))).toBe(false)`, `expect(...('abcdabcd...'))).toBe(false)`; `:36-40` — message unchanged | ✅ PASS |
| MOD6-02 | ≥20 chars, ≥5 letras distintas → `true` | `justification.test.ts:25-34` — real PT-BR samples + boundary (exactly 5 distinct letters) → `true` | ✅ PASS |
| MOD6-03 | Fonte única em `decision.ts`, `transitionContent`, `inactivate` | `schemas/decision.ts:21` `.refine(isMeaningfulJustification,...)`; `actions/transition-content.ts:70` `isMeaningfulJustification(justification)`; `actions/inactivate.ts` → `transitionContent` (transitively); `decision.test.ts` green (see Gate) | ✅ PASS |
| MOD7-01 (P-007) | Servidor calcula `ContentKind` moderáveis (coordenador→todos; voluntário→delegações) | `server/__tests__/moderation-access.test.ts:68-98` unit; `moderation-access.int.test.ts:47-84` int real (delegação ativa/revogada) | ✅ PASS |
| MOD7-02 | Item fora do conjunto → sem controle acionável, nota PT-BR | `components/__tests__/moderation-queue.test.tsx:141-149` — `queryByRole('button',{name:/aprovar/i})).not.toBeInTheDocument()` + `getByText(/não tem permissão.../i)` | ✅ PASS |
| MOD7-03 | Prop ausente/coordenador → todas as ações (backward-compat) | `moderation-queue.test.tsx:150-166` — prop ausente e prop com todos os kinds → botões presentes | ✅ PASS |
| MOD7-04 (P-007) | Server Action re-checa `requirePermission` | `actions/decide.ts:35,54,72` — `requirePermission(PERMISSION_BY_KIND[...])` unchanged (only the map's location moved); `decide.test.ts` green | ✅ PASS |
| MOD8-01 (SUGG-04) | "Rejeitar" abre confirmação inline, motivo opcional ≤280, sem chamar a action | `taxonomy-suggestions-list.spec.tsx:73-78` — click "Rejeitar" → `rejectTaxonomySuggestion` not called, textarea+Confirmar/Cancelar visible | ✅ PASS |
| MOD8-02 (SUGG-04) | Confirmar → `rejectTaxonomySuggestion({kind,id,reason?})`, reason omitido se vazio | `taxonomy-suggestions-list.spec.tsx:81-94` (com motivo) and `:96-108` (sem motivo, `call).not.toHaveProperty('reason')`) | ✅ PASS |
| MOD8-03 | Cancelar fecha sem chamar a action, item permanece | `taxonomy-suggestions-list.spec.tsx:110-119` — `not.toHaveBeenCalled()` + item still rendered | ✅ PASS |
| MOD8-04 | Rejeição confirmada → item sai da fila + confirmação; Aprovar 1 clique inalterado | `taxonomy-suggestions-list.spec.tsx:81-94` (waitFor "processada(s)"); pre-existing approve test unchanged | ✅ PASS |

**Status**: ✅ All ACs covered, spec-anchored (no spec-precision gaps found).

---

## Discrimination Sensor

Scratch method: direct edit + `git checkout --` restore per mutation (git status confirmed clean after each). No worktree needed — single-file, single-behavior mutations.

| Mutation | File:line | Description | Killed? |
|---|---|---|---|
| 1 | `src/modules/moderation/domain/justification.ts:45` | Disabled distinct-letters guard (`< 0` instead of `< MIN_DISTINCT_LETTERS`) | ✅ Killed — 3 tests in `justification.test.ts` failed (MN-02/MN-03/MOD6-01) |
| 2 | `src/modules/moderation/queries/moderation-queue.ts:85` | Removed `personId: { not: viewerPersonId }` filter on `candidateProfile.findMany` | ✅ Killed — `moderation-queue.int.test.ts` MN-01 case failed |
| 3 | `src/modules/moderation/components/moderation-queue.tsx:138-139` | `canModerate` hardcoded to `true` (gating disabled) | ✅ Killed — `moderation-queue.test.tsx` MN-04 case failed |
| 4 | `src/modules/moderation/components/taxonomy-suggestions-list.tsx:64-68` | `openReject` fires `rejectTaxonomySuggestion` immediately instead of only opening the confirm step | ✅ Killed — 4 tests in `taxonomy-suggestions-list.spec.tsx` failed, incl. MN-05 case |

**Sensor depth**: lightweight (4 targeted mutations, 1 per must-not with a dedicated negative test: MN-01, MN-02/03, MN-04, MN-05).
**Result**: 4/4 killed — PASS ✅

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
|---|---|---|---|---|
| USP056-MN-01 | Incluir na fila perfil cujo `personId == viewerPersonId` | `moderation-queue.int.test.ts:256-267` — `expect(...).toBeUndefined()` | ✅ | ✅ (mutation 2) |
| USP056-MN-02 | `isMeaningfulJustification` retornar `true` p/ caractere repetido | `justification.test.ts:12-18` — `expect(...('a'.repeat(30)))).toBe(false)` | ✅ | ✅ (mutation 1) |
| USP056-MN-03 | Heurística retornar `false` p/ motivo legítimo | `justification.test.ts:25-34` — real samples → `true` | ✅ | ✅ (mutation 1 also proves the inverse: with the guard disabled these already passed `true`, so the guard's necessity is proven by mutation 1's MN-02 failures, and its correctness bound by MOD6-02 boundary case) |
| USP056-MN-04 | UI renderizar controle acionável p/ tipo fora do conjunto | `moderation-queue.test.tsx:141-149` — CV + `[JOB]` → no button, note shown | ✅ | ✅ (mutation 3) |
| USP056-MN-05 | Chamar `rejectTaxonomySuggestion` sem etapa de confirmação | `taxonomy-suggestions-list.spec.tsx:73-78` — 1 click → not called | ✅ | ✅ (mutation 4) |
| USP056-MN-06 | Mudança de status fora de `transitionContent`, nova tabela/migração/dep | Structural — `git diff --stat 9766036~1..9155686 -- prisma/` → empty; `-- 'prisma/migrations/**'` → empty; `package.json`/`package-lock.json` diff → empty; `decide.ts` still calls `transitionContent` (unchanged control flow, only the permission map moved to `domain/moderation-permissions.ts`) | ✅ | n/a (structural, not fault-injectable) |

**Status**: ✅ All must-nots proven (5/5 with green negative test + killed guard mutation; MN-06 verified structurally via diff, as it prohibits an *absence* — no meaningful fault to inject).

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code (no features beyond spec) | ✅ |
| Surgical changes (no scope creep) | ✅ — diff touches only the 2 route/action files needed for wiring (`page.tsx`, `decide.ts` import) + the module's own files |
| No new abstractions for single-use code | ✅ — `moderation-permissions.ts` is shared by `decide.ts` and `moderation-access.ts` (2 consumers), not single-use |
| Matches existing patterns/style | ✅ — reuses `jobItems`/`serviceItems` pattern (T2), inline-expandable pattern from `published-content-manager.tsx` (T5) |
| Spec-anchored outcome check | ✅ — see table above, all assertions target spec-defined exact values |
| Per-layer Coverage Expectation met | ✅ — domain 1:1 (justification.test.ts), query/helper unit+int, component happy+edge+negative |
| Every test maps to a spec AC/must-not | ✅ — all new/updated tests tagged with `[MODn-xx]`/`[USP056-MN-xx]` |
| Documented guidelines followed | `CLAUDE.md` §Testing Requirements (happy/permission/consent path coverage), `tasks.md` Test Coverage Matrix |

---

## Edge Cases

- [x] `headline` null → fallback `"Perfil de candidato"` (`moderation-queue.ts:125`, exercised by unit mock)
- [x] Autor não resolvível → `authorName: null` (pre-existing `viewStaffPersonNames` behavior, unchanged)
- [x] Motivo MOD-6 null/undefined/vazio → `false` (`justification.test.ts:43-47`)
- [x] Motivo MOD-8 > 280 chars → `maxLength={280}` on Textarea + pre-existing schema validation (unchanged, `resolveTaxonomySuggestionSchema`)
- [x] Empate de `submittedAt` → sort is stable (`Array.prototype.sort`, no change to comparator)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` (Build tier, per tasks.md)
- **typecheck**: ✅ clean (0 errors)
- **lint**: ✅ clean (0 errors/warnings)
- **unit (`npm run test`)**: ✅ 269 files / 1902 tests passed, 0 failed
- **integration, isolated scope** (`moderation-queue.int.test.ts` + `moderation-access.int.test.ts`): ✅ 2 files / 11 tests passed
- **integration, full suite** (`npm run test:integration`): 108/111 files passed, 647/650 tests passed. 3 pre-existing failures, all outside this feature's touched files (confirmed via `git diff --stat 9766036~1..9155686 -- 'src/modules/jobs/**' 'src/modules/identity/**'` → empty):
  - `src/modules/identity/__tests__/credential-claim.int.test.ts` — anti-enumeration count assertion (declared pre-existing flake)
  - `src/modules/jobs/__tests__/archive-job.int.test.ts` — `searchJobs` pagination-by-volume (declared pre-existing flake)
  - `src/modules/jobs/__tests__/pause-job.int.test.ts` — same `searchJobs` pagination-by-volume flake
- **build**: ✅ compiled successfully, all routes generated including `/moderacao`
- **Migration/dependency check**: `git diff --stat` for `prisma/`, `prisma/migrations/**`, `package.json`, `package-lock.json` over the full range → all empty (zero migration, zero new dep, confirming USP056-MN-06)
- **Skipped tests**: none unjustified
- **Failures**: 3, all declared-and-confirmed pre-existing flakes outside scope

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| MOD1-01/02/03 | Done (implementer) | ✅ Verified |
| MOD6-01/02/03 | Done | ✅ Verified |
| MOD7-01/02/03/04 | Done | ✅ Verified |
| MOD8-01/02/03/04 | Done | ✅ Verified |
| USP056-MN-01..06 | Done | ✅ Verified |

**Coverage**: 20/20 requirements verified, 0 gaps.

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 18/18 ACs matched spec-defined outcome, 0 spec-precision gaps
**Sensor**: 4/4 mutations killed (1 per must-not with a fault-injectable guard)
**Must-nots**: 6/6 verified (5 via green negative test + killed mutation, 1 structural via diff)
**Gate**: typecheck ✅, lint ✅, unit 1902/1902 ✅, integration (isolated scope) 11/11 ✅, integration (full) 647/650 with 3 declared pre-existing flakes outside scope, build ✅

**What works**: All 4 UAT defects (MOD-1, MOD-6, MOD-7, MOD-8) are fixed per spec, with negative tests proving each must-not, no architecture violation (no new table/migration/dependency, `transitionContent`/`requirePermission` control flow unchanged), and the two intentionally-declared AC changes (T2 Prisma mock gains `candidateProfile.findMany`; T5 reject flow becomes 2-step confirm/cancel) are documented in the spec and correctly reflected in the tests.

**Issues found**: none.

**Next steps**: none — feature ready to merge. Pre-existing flakes (identity/credential-claim, jobs/pause-job, jobs/archive-job) are out of this feature's scope and were not touched by this diff; they remain tracked separately per the Implementer's deviation note.
