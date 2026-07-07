# Fase 0 — Fundação Validation

**Date**: 2026-07-06
**Spec**: `.specs/features/fase-0-fundacao/spec.md` (+ upstream `.specs/features/seed-taxonomia-checklists/spec.md` for US-111/AC-111-1/AC-111-2)
**Diff range**: `97a588e..HEAD` (12 commits, `38499e1`…`3d48c70`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T-A1 | ✅ Done | 3 deep imports carved out with `eslint-disable-next-line` + justification; guard added |
| T-A2 | ✅ Done | `src/__tests__/` gone; `middleware.test.ts` co-located at `src/middleware.test.ts` |
| T-A3 | ✅ Done | Seed split into `prisma/seeds/{reference,demo}.ts`, thin entrypoint |
| T-A4 | ✅ Done | `supabase-storage.ts` added, no consumer yet (documented, ADR-0005) |
| T-A5 | ✅ Done | `docs/arch/0017-conformidade-fundacao-fase-0.md` |
| T-B1 | ✅ Done | `prisma/__tests__/seed.integration.test.ts` |
| T-B2 | ✅ Done | Seed data pinned to `taxonomia-inicial.md`, names asserted verbatim |
| T-B3 (split B3a/B3b) | ✅ Done | `507649b` (model+seed+query) + `acaaa7a` (rewire UI) |
| T-B4 | ✅ Done | `tests/docs/checklist-empresa-fantasma.test.ts` |
| T-C1 | ✅ Done | `docs/infra/fase-0-provisioning-runbook.md` + structural test |
| T-C2 | ✅ Done | `.env.staging` confirmed never tracked; defensive guard added |

All 11 tasks (12 commits, T-B3 split counted) complete. No partial/blocked tasks.

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | --------------------- | ------------------------ | ------ |
| WS-A AC1 — deep imports rerouted via barrel | Only 2 files carry a documented, justified exception; every other deep-import is a violation | `src/shared/__tests__/no-deep-module-imports.test.ts:64` — `expect(offenders).toEqual([])`; `:79` — pins exception set to exactly `candidate-form.tsx`/`provider-form.tsx` | ✅ PASS (verified discriminating — see Sensor) |
| WS-A AC2 — closed `src/` root | `readdirSync('src')` dirs ⊆ `{app,modules,shared}` | `src/shared/__tests__/closed-src-root.test.ts:31` — `expect(offenders).toEqual([])`; independently confirmed via `find src -maxdepth 1 -type d` → `app`, `modules`, `shared` only | ✅ PASS |
| WS-A AC3 — seed split reference/demo | `prisma/seeds/reference.ts` (prod-safe) vs `prisma/seeds/demo.ts` (dev-only) | `prisma/seed.ts` (entrypoint, git diff 97a588e..HEAD) — reduced to thin `main()`; `prisma/seeds/reference.ts` new, `prisma/seeds/demo.ts` new | ✅ PASS |
| WS-A AC4 — Supabase Storage client | Client exists or deferment documented | `src/shared/lib/supabase/supabase-storage.ts:39-43` — `createSupabaseStorageClient()`, no consumer, comment cites USP-040 trigger | ✅ PASS |
| WS-A AC5 — conformance note | Doc reconciles ADR location + container.ts carve-out | `docs/arch/0017-conformidade-fundacao-fase-0.md` — both carve-outs (container.ts, client/server boundary) documented with rationale | ✅ PASS |
| US-111/AC-111-1 — seed populates 3 tables, idempotent, `is_suggestion=false`, region active | Re-run does not change row counts; upstream canonical outcome | `prisma/__tests__/seed.integration.test.ts:104` — `expect(after).toEqual(before)` (killed by mutation — see Sensor #1); `:~40-60` asserts `isSuggestion:false`/`isActive:true` | ✅ PASS |
| US-111/AC-111-2 — checklist doc with verifiable criteria | Doc exists + contains CNPJ/razão social/endereço/aprovar-rejeitar+motivo | `tests/docs/checklist-empresa-fantasma.test.ts:17` (exists) + `:23-28` (regex match on all 5 required terms) | ✅ PASS |
| F0B-01 — checklist items from seedable source, no redeploy | JSX contains no canonical label literal; items come from DB query | `src/modules/moderation/__tests__/checklist-config.test.ts:41,47` — `expect(offenders).toEqual([])` over both component files (killed by mutation — see Sensor #4); `src/modules/moderation/queries/list-verification-checklist.int.test.ts` — query returns active/ordered rows + fallback | ✅ PASS |
| F0C-01 — runbook covers 6 services + drill + 3 spikes with 3 columns, cross-linked | Structural presence, no content precision defined in spec | `tests/docs/fase-0-runbook.test.ts` (33 assertions, all passing) — structure only | ⚠️ Spec-precision gap (spec doesn't define what "estado atual" must literally say — acceptable, doc content isn't machine-checkable, but flagging per rule) |
| F0C-02 / F0-MN-05 — no committed real secret; `.env.staging` untracked | `offenders===[]`; guard has teeth against a real secret | `src/shared/__tests__/no-committed-secrets.test.ts:122` (killed by mutation — see Sensor #5); `:127` — `.env.staging` not in `git ls-files` (independently reproduced) | ✅ PASS |

**Status**: ✅ All ACs covered; 1 spec-precision gap flagged (F0C-01, non-blocking — doc content is not intended to be machine-verified beyond structure per spec's own Independent Test).

---

## Discrimination Sensor

Ran in the real working tree with git-reversible mutations (each mutation isolated, tests run, then `git checkout`/manual revert — confirmed clean via `git status --porcelain` after each). Sensor depth: **P0/must-not-full** (this unit carries 5 formal must-nots) — one mutation aimed at each must-not's guard.

| # | File:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 (F0-MN-01) | `prisma/seeds/reference.ts::seedRegions` | Added unconditional `prisma.region.create` with a fresh unique name each run (breaks idempotency) | ✅ Killed — `seed.integration.test.ts` idempotency assertion failed (`16` vs expected `15`) |
| 2 (F0-MN-02) | new scratch file `src/modules/persons/__mutant_scratch.ts` | Added an unjustified deep-import (`@/modules/identity/actions/...`, no disable comment) | ✅ Killed — `offenders` non-empty |
| 2b (F0-MN-02, escape-hatch check) | same scratch file, with `eslint-disable-next-line` added | Tried to abuse the documented carve-out by copying the disable comment onto a 3rd, unauthorized file | ✅ Killed — the 2nd guard test (`exceção documentada continua restrita aos 2 arquivos conhecidos`) failed, proving the allowlist is closed, not just "any disable comment passes" |
| 3 (F0-MN-03) | `src/__mutant_extra_dir/` | Created a 4th top-level dir under `src/` | ✅ Killed — `offenders` non-empty |
| 4 (F0-MN-04) | `src/modules/moderation/components/verification-panel.tsx` | Replaced `{item.label}` render with hardcoded literal `'CNPJ válido e ativo'` | ✅ Killed — `checklist-config.test.ts` offenders non-empty |
| 5 (F0-MN-05) | scratch tracked file `src/shared/__mutant_secret.txt` (git-added) | Injected a realistic Postgres pooler URL with a non-allowlisted password | ✅ Killed — `no-committed-secrets.test.ts` offenders non-empty |

**Sensor depth**: P0-full (6 mutations across the 5 must-nots, incl. one escape-hatch probe)
**Result**: 6/6 killed — ✅ PASS

All mutations were reverted; post-sensor re-run of `npm run test` confirmed 99/99 files, 751/751 tests green (clean state restored).

---

## 🧬 Must-Not Verification (ICE-adjacent — this unit uses local must-not IDs, not ICE P-NNN)

| ID | SHALL NOT… | Negative fact (`file:line` + assertion) | eval(−) green? | Guard mutation killed? |
| -- | ---------- | ---------------------------------------- | --------------- | ------------------------ |
| F0-MN-01 | Seed re-run duplicate taxonomy rows | `prisma/__tests__/seed.integration.test.ts:104` — `expect(after).toEqual(before)` | ✅ | ✅ (Sensor #1) |
| F0-MN-02 | Module import via deep path without documented exception | `src/shared/__tests__/no-deep-module-imports.test.ts:64,79` | ✅ | ✅ (Sensor #2, #2b) |
| F0-MN-03 | 4th top-level folder under `src/` without RFC | `src/shared/__tests__/closed-src-root.test.ts:31` | ✅ | ✅ (Sensor #3) |
| F0-MN-04 | Checklist items hardcoded in JSX (redeploy-coupled) | `src/modules/moderation/__tests__/checklist-config.test.ts:41,47` | ✅ | ✅ (Sensor #4) |
| F0-MN-05 | Real credential committed/tracked | `src/shared/__tests__/no-committed-secrets.test.ts:122,127` | ✅ | ✅ (Sensor #5) |

**Status**: ✅ All 5 must-nots proven (negative fact green AND guard mutation killed for every one).

---

## Deviation Review (Implementer's summary — independently re-verified, not taken on trust)

1. **T-A1 carve-out (3 unrouted deep imports).** Verified genuinely build-forced: the barrel `@/modules/identity` transitively pulls in `./server/session` → `supabase/server.ts` → `next/headers` and `./ports/captchaVerifier` → `container.ts` → `next/cache`, both server-only. The guard (`no-deep-module-imports.test.ts`) discriminates correctly — proven by Sensor #2 (an unjustified deep import fails) and Sensor #2b (copying the escape-hatch comment onto an unauthorized 3rd file also fails, because a second test pins the exception set to exactly the 2 known files). Not an excuse — it's a closed allowlist with a kill-test on both sides. **Verified.**
2. **T-B3 migration hygiene.** `prisma/migrations/20260706231944_usp017_verification_checklist_items/migration.sql` contains only the `CREATE TABLE verification_checklist_items` + unique index — no other DDL. Independently confirmed `jobs_area_id_fkey` is still `ON DELETE RESTRICT` (from the pre-existing `20260616205612_usp020_job` migration, untouched) and `prisma/schema.prisma`'s diff for this range touches only the new model. No schema/migration drift introduced. **Verified.**
3. **Config include extensions.** `vitest.config.ts` (`tests/**`) and `vitest.integration.config.ts` (`prisma/**/*.integration.test.ts`) — confirmed both new test files actually execute under the project's real npm scripts (`npm run test` picked up all 6 new unit/doc test files incl. `tests/docs/*`; `npm run test:integration` picked up `prisma/__tests__/seed.integration.test.ts` and `list-verification-checklist.int.test.ts`, both passing). Not silently excluded. **Verified.**
4. **T-C1 runbook claims.** Independently ran `gh secret list --repo DNACod3/asonseg-portal` and `gh variable list --repo DNACod3/asonseg-portal` — both return empty, confirming "0 secrets/variables configured" as claimed. Structural test (`tests/docs/fase-0-runbook.test.ts`) passes with the required 3 columns + 6 services + drill + 3 spikes. Vercel state is correctly marked non-verifiable (no CLI/token in this environment) rather than fabricated. **Verified.**
5. **T-C2 secret guard.** Independently confirmed via `git log --all -- .env.staging` (empty) and `git ls-files | grep env` (`.env.example` only) that `.env.staging` was never tracked. `.gitignore` lines 29-31 cover `.env`/`.env.*`/`.env.staging` with `!.env.example` negation, matching the guard's own assertion (`no-committed-secrets.test.ts:130-134`). The guard has teeth (Sensor #5: kills a real-looking injected secret) and does not false-positive on demo/CI values (guard's own allowlist tests for `supabase-demo` JWT and CI fakes pass green in the full run). **Verified.**

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ — each task's diff matches its stated scope; no scope creep into `services`/`referrals`/`cv-extraction` (correctly deferred per A-01) |
| Surgical changes | ✅ |
| No scope creep | ✅ — `jobs_area_id_fkey` drift explicitly excluded from the migration |
| Matches patterns | ✅ — guards follow `no-external-verify.test.ts` pattern; seed follows existing upsert-by-unique-key pattern |
| Spec-anchored outcome check | ✅ — see table above |
| Every test maps to a spec requirement | ✅ — no unclaimed tests found in the diff surface |

---

## Edge Cases (spec.md)

- [x] Seed re-run against existing taxonomy → upsert by name, no duplicates, IDs stable (T-B1 test + Sensor #1)
- [x] Seed split doesn't break `db:seed` entrypoint — `prisma.seed` config verified; build/typecheck green
- [x] Barrel guard treats `container.ts` deep-imports as documented exception, not violation — confirmed excluded from `MODULES_DIR` scan scope (guard only scans `src/modules/**`, container.ts lives in `src/shared/`)
- [x] Anti-secret guard would fail RED before untrack — moot now since `.env.staging` was never tracked (premise corrected by orchestrator, independently reconfirmed)
- [x] Taxonomy final list pending directoria sign-off — seed correctly uses `taxonomia-inicial.md` as working source, test pins current set, non-blocking per A-08

---

## Gate Check

- **Gate command**: `npm run build && npm run lint && npm run typecheck && npm run test && npm run test:integration`
- **Result**:
  - `npm run typecheck` — 0 errors
  - `npm run lint` — 0 errors
  - `npm run build` — compiled successfully, all routes generated
  - `npm run test` — **99 test files passed (99), 751 tests passed (751)**
  - `npm run test:integration` — **39 test files passed (39), 217 tests passed (217)**
- **Test count before feature**: not independently measured pre-diff (feature branch not diffed against a pre-feature test run); no evidence of any test deletion in the diff (`git diff --stat` shows only additions to test files, no removed test files)
- **Delta**: +6 new test files in unit suite (`no-deep-module-imports`, `closed-src-root`, `no-committed-secrets`, `checklist-config`, `tests/docs/checklist-empresa-fantasma`, `tests/docs/fase-0-runbook`), +2 new integration test files (`seed.integration.test.ts`, `list-verification-checklist.int.test.ts`)
- **Skipped tests**: none observed
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | ---------------- | ----------- |
| F0A-01 (barrel) | Pending | ✅ Verified |
| F0A-02 (raiz fechada) | Pending | ✅ Verified |
| F0A-03 (split seed) | Pending | ✅ Verified |
| F0A-04 (storage client) | Pending | ✅ Verified |
| F0A-05 (nota conformidade) | Pending | ✅ Verified |
| US-111 / AC-111-1 (upstream) | Pending | ✅ Verified |
| US-111 / AC-111-2 (upstream) | Pending | ✅ Verified |
| F0B-01 (checklist configurável) | Pending | ✅ Verified |
| F0C-01 (runbook) | Pending | ✅ Verified (⚠️ spec-precision gap noted, non-blocking) |
| F0C-02 (guarda segredo) | Pending | ✅ Verified |
| F0-MN-01 (idempotência) | Pending | ✅ Verified (eval(−) green) |
| F0-MN-02 (barrel) | Pending | ✅ Verified (eval(−) green) |
| F0-MN-03 (raiz fechada) | Pending | ✅ Verified (eval(−) green) |
| F0-MN-04 (checklist redeploy) | Pending | ✅ Verified (eval(−) green) |
| F0-MN-05 (segredos) | Pending | ✅ Verified (eval(−) green) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 10/10 ACs matched spec outcome; 1 spec-precision gap flagged (F0C-01 — non-blocking, doc content isn't meant to be machine-checked beyond structure)
**Sensor**: 6/6 mutations killed (P0-full depth, one per must-not + one escape-hatch probe)
**Must-nots**: 5/5 eval(−) green
**Gate**: build ✅, lint ✅, typecheck ✅, unit 751/751 ✅, integration 217/217 ✅

**What works**: All 3 workstreams (WS-A scaffolding reconciliation, WS-B US-111 seed+checklist, WS-C runbook+secret guard) are implemented, tested, and independently re-verified against the real repo state (git history, `gh` CLI, live gate runs) rather than trusted from the implementer's summary. Each of the 5 must-nots has a negative test proven to actually discriminate (not vacuous) via live fault injection in the working tree, fully reverted afterward.

**Issues found**: None blocking. One non-blocking spec-precision note on F0C-01 (runbook content isn't a precise spec-defined outcome, only structural presence — already how the spec itself scoped the Independent Test).

**Next steps**: None required. Feature ready to close out (kickoff/closure protocol, board update).
