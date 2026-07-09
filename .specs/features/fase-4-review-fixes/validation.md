# Fase 4 — Remediação da Review do PR #284 — Validation

**Date**: 2026-07-09
**Spec**: `.specs/features/fase-4-review-fixes/spec.md`
**Diff range**: `f15337c..HEAD` (HEAD = `1e6053f`, 10 commits)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1 (F1)        | ✅ Done | href + test-anchor fixed |
| T2 (F2 code)   | ✅ Done | PROVIDER gate before Storage |
| T3 (F2 test)   | ✅ Done | MN-F2 negative case |
| T4 (F3 code)   | ✅ Done | `photo-path.ts` wired into both actions |
| T5 (F3 test)   | ✅ Done | unit matrix + 2 integration suites |
| T6 (F4)        | ✅ Done | subselect predicate, dead JOIN removed |
| T7 (F5 test)   | ✅ Done | `list-service-categories.int.test.ts` |
| T8 (F6 test)   | ✅ Done | `list-provider-services.int.test.ts` |
| T9 (F7 test)   | ✅ Done | `get-my-service-interest.int.test.ts` |
| — (docs)       | ✅ Done | spec/design/tasks/FINDINGS artifacts committed |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC-F1-1 CTA href | `href="/prestador/servicos/nova"` | `src/modules/persons/components/provider-form.tsx:268` — `<Link href="/prestador/servicos/nova">` | ✅ PASS |
| AC-F1-2 test-âncora | assere href correto, não `/servicos/novo` | `src/modules/persons/__tests__/ProviderForm.test.tsx:87` — `toHaveAttribute('href','/prestador/servicos/nova')` | ✅ PASS |
| AC-F2-1 PROVIDER + arquivo válido → OK | `ok:true`, `storagePath` sob `${person.id}/` | `src/modules/services/__tests__/upload-service-photo.int.test.ts:108-143` happy-path JPG/PNG/WEBP, roles:['PROVIDER'] | ✅ PASS |
| AC-F2-2 sem PROVIDER → FORBIDDEN | `res.error.code==='FORBIDDEN'`, zero storage writes | `upload-service-photo.int.test.ts:205-216` — `expect(res.error.code).toBe('FORBIDDEN')` + `listStorageFiles` unchanged | ✅ PASS |
| AC-F3-1 path próprio válido → aceito | `result.ok===true`, `ServicePhoto` criada | `create-service-draft.int.test.ts:119-136` | ✅ PASS |
| AC-F3-2 path de terceiro → VALIDATION | `error.code==='VALIDATION'`, 0 serviços criados | `create-service-draft.int.test.ts:81-98` (create) + `submit-service.int.test.ts:275-290` (form-direto submit) | ✅ PASS |
| AC-F3-3 path malformado (`../`, ext ruim, etc.) → VALIDATION | idem | `create-service-draft.int.test.ts:100-117` (`../`) + `photo-path.test.ts:17-55` (matriz completa: ext fora de {jpg,png,webp}, sem ext, segmentos extras, não-UUID, string vazia) | ✅ PASS |
| AC-F4-1 categoria como predicado de `services` | `s.category_id IN (SELECT id FROM service_categories WHERE …)`, `Prisma.sql` | `src/modules/services/queries/search-services.ts:87-90`; nenhum `sc.` resta (`grep` confirmado); ambas as queries (`:116-122`) usam só `JOIN persons author`, sem `LEFT JOIN service_categories` | ✅ PASS |
| AC-F4-2 semântica preservada | termo casa título, descrição OU categoria | `search-services.int.test.ts:215` "busca textual casa pelo nome da categoria" — verde | ✅ PASS |
| AC-F5-1 exclui sugestões | approved incluída, suggestion excluída | `list-service-categories.int.test.ts:50-55` — `expect(ids).toContain(approvedId)` / `.not.toContain(suggestionId)` | ✅ PASS |
| AC-F6-1 escopo por author | serviço de B não vaza em A | `list-provider-services.int.test.ts:57-62` — `expect(ids).toContain(serviceAId)` / `.not.toContain(serviceBId)` | ✅ PASS |
| AC-F7-1/2 ignora canceladas | retorna ativo, nunca cancelado | `get-my-service-interest.int.test.ts:75-86` — `expect(result?.id).toBe(activeInterestId)` + caso "só cancelado → null" | ✅ PASS |

**Status**: ✅ All ACs covered — 12/12, no spec-precision gaps.

---

## Discrimination Sensor

Ran in the real working tree via edit→test→`git checkout --` revert (no worktree needed; each mutation reverted before the next, verified `git diff HEAD` empty afterward).

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 (MN-F2 guard) | `src/modules/services/actions/upload-service-photo.ts:64` | `if (!person.roles.includes('PROVIDER'))` → `if (false)` (gate disabled) | ✅ Killed — `upload-service-photo.int.test.ts` "MN-F2" case failed: `res.ok` became `true` instead of `false` |
| 2 (MN-F3 guard) | `src/modules/services/domain/photo-path.ts:30` | `&&` → `\|\|` between format-regex and ownership `startsWith` | ✅ Killed — unit `photo-path.test.ts` 9/9 relevant cases failed; integration `create-service-draft.int.test.ts` (2 cases) + `submit-service.int.test.ts` (1 case) all failed |
| 3 (F4 subselect) | `src/modules/services/queries/search-services.ts:87` | `IN` → `NOT IN` in the category subselect | ✅ Killed — `search-services.int.test.ts` 2 cases failed (category-name search returns wrong set; empty-state case broke) |

**Sensor depth**: P0/must-not tier for MN-F2/MN-F3 (security must-nots) — 1 targeted mutation per guard, both killed decisively (not marginally: MN-F2 flipped the actual return value; MN-F3 flipped the boolean combinator at the heart of the helper). F4 (perf, non-must-not) got 1 lightweight mutation, also killed.
**Result**: 3/3 killed — PASS ✅

---

## 🧬 Must-Not Verification

| ID | SHALL NOT… | Negative fact (`file:line` + assertion) | eval(−) green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| MN-F2 | Pessoa sem papel PROVIDER ativo gravar objeto em `provider-photos` | `upload-service-photo.int.test.ts:205-216` — `expect(res.error.code).toBe('FORBIDDEN')` + `expect(await listStorageFiles(personId)).toHaveLength(before.length)` | ✅ | ✅ |
| MN-F3 | Serviço persistir `ServicePhoto.storagePath` não-próprio/malformado | `create-service-draft.int.test.ts:81-117` + `submit-service.int.test.ts:275-290` — `expect(result.error.code).toBe('VALIDATION')` + `prisma.service.count(...)` = 0 | ✅ | ✅ |

Gate placement confirmed by direct code read: in `upload-service-photo.ts` the PROVIDER check (line 64-66) runs strictly before block "3. MIME real" (line 70) and before any `storage.upload` call (line 83) — Storage is never touched on the FORBIDDEN path. In `photo-path.ts` the regex (`SERVICE_PHOTO_PATH_RE`, single `/`, hex-UUID segments, extension allowlist) combined with `startsWith(ownerPersonId/)` is called in both `create-service-draft.ts:66` and `submit-service-for-moderation.ts:88`, both **before** `tx.service.create`.

**Status**: ✅ All must-nots proven (eval(−) green, guard mutations killed).

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | ✅ — each fix is the smallest change that closes the finding (e.g. F1 is a 2-line diff) |
| Surgical changes | ✅ — 18 files touched total across 10 commits, each commit scoped to one finding |
| No scope creep | ✅ — no rate-limit/volume cap added for F2 (explicitly deferred per FINDINGS.md and spec non-goals); no E2E added for F1 (deferred per L-007) |
| Matches patterns | ✅ — `photo-path.ts` mirrors `photo-mime.ts`; F2 gate mirrors `require-service-authorization.ts` first check; F4 mirrors `search-jobs.ts` predicate style |
| Spec-anchored outcome check | ✅ — see AC table above, all assertions target exact spec-defined outcomes (`FORBIDDEN`, `VALIDATION`, exact row counts) |
| Every test maps to a spec requirement | ✅ — every new/modified test cites its AC/F-id in the test name or comment |

---

## Edge Cases

- [x] F3 malformed path with directory traversal (`../`) — handled (regex blocks non-single-`/`, non-hex-UUID segments)
- [x] F3 path with wrong extension (`.jpeg`, `.gif`, no ext) — handled, unit-tested
- [x] F2 unauthenticated (no session) vs. authenticated-without-PROVIDER — both paths distinct and tested (`UNAUTHENTICATED` vs `FORBIDDEN`)
- [x] F7 client with both a cancelled and an active interest for the same service (partial unique index allows coexistence) — handled, tested
- [x] F4 empty-result state after mutation-probe (`q` matching nothing) — covered by existing test, used productively as part of sensor mutation 3

---

## Gate Check

- **Gate commands**: `npm run typecheck` · `npm run lint` · `npm run test` (unit, vitest.config.ts) · `npm run test:integration` (vitest.integration.config.ts, Postgres local `:55322` via `supabase start`, confirmed UP) · `NODE_ENV=production npm run build`
- **typecheck**: ✅ 0 errors
- **lint**: ✅ 0 errors/warnings
- **unit**: ✅ 188 test files, 1252 tests passed, 0 failed, 0 skipped
- **integration**: ✅ 81 test files, 495 tests passed, 0 failed, 0 skipped
- **build**: ✅ `next build` succeeded; route table confirms `/prestador/servicos/nova` exists and compiles
- **Migrations**: none created (`git diff f15337c..HEAD -- prisma/migrations/` empty) — matches F4 query-only constraint
- **Skipped tests**: none

---

## Fix Plans

None — no defects found.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| REQ-F1 (AC-F1-1/2) | Implementing | ✅ Verified |
| REQ-F2 (AC-F2-1/2, MN-F2) | Implementing | ✅ Verified (eval(−) green) |
| REQ-F3 (AC-F3-1/2/3, MN-F3) | Implementing | ✅ Verified (eval(−) green) |
| REQ-F4 (AC-F4-1/2) | Implementing | ✅ Verified |
| REQ-F5 (AC-F5-1) | Implementing | ✅ Verified |
| REQ-F6 (AC-F6-1) | Implementing | ✅ Verified |
| REQ-F7 (AC-F7-1/2) | Implementing | ✅ Verified |

---

## Scope / Hygiene

- No new file under `prisma/migrations/` in the diff range.
- No deletion under `.claude/skills/**` or `.agents/**` in the diff range (`git diff f15337c..HEAD --name-only -- .claude/skills .agents` empty) — the deletions visible in `git status` are pre-existing unrelated working-tree state (untouched by this remediation, confirmed unchanged before/after the Verifier's mutation-testing session).
- No existing test assertion was weakened; only new tests/cases were added and 2 lines of production code changed per finding (plus F4's 12-line query rewrite).
- All 7 findings (F1–F7) addressed; none silently dropped.

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 12/12 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 3/3 mutations killed (both must-not guards + F4 predicate)
**Must-nots**: 2/2 eval(−) green (MN-F2, MN-F3)
**Gate**: typecheck ✅, lint ✅, unit 1252/1252 ✅, integration 495/495 ✅, build ✅

**What works**: All 7 findings from the PR #284 review are remediated with evidence-backed tests; both security must-nots (MN-F2 PROVIDER gate, MN-F3 photo-path ownership+format) are proven by tests that provably die when their guards are removed; the F4 performance fix preserves search semantics while making both branches of the WHERE clause predicates of `services` (index-eligible); F5/F6/F7 close real test-coverage gaps against the actual `where` clauses, not mocks.

**Issues found**: None.

**Next steps**: None — ready to proceed (PR merge / next ROADMAP phase).
