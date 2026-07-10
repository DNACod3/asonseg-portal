# USP-041 — Home pública com indicadores em tempo real — Validation

**Date**: 2026-07-09
**Spec**: `.specs/features/indicadores-relatorios/usp-041-home-indicadores/spec.md`
**Diff range**: `f6c1562..bc4d15f` (6 commits, T1–T6) on `feat/fase-6-relatorios-home-hardening`
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
|---|---|---|
| T1 | ✅ Done | `domain/indicators.ts` + `domain/metrics.ts` — `applyMinimumDisplay`, threshold=5 |
| T2 | ✅ Done | `queries/home-indicators.ts` — 3 counts, no PII |
| T3 | ✅ Done | `__tests__/home-revalidate.test.ts` — static TTL guard |
| T4 | ✅ Done | `components/home-indicators.tsx` — presentational cards |
| T5 | ✅ Done | `app/(public)/page.tsx` wired, page test, e2e spec |
| T6 | ✅ Done | `server/revalidate-home.ts` + single chokepoint call-site in `transitionContent()` |

---

## Spec-Anchored Acceptance Criteria

| Criterion (ICE ID) | Spec-defined outcome | `file:line` + assertion | Result |
|---|---|---|---|
| E-001 (MP4/MP1/MP2, agregado sem PII) | `{activeJobs, activeCandidates, verifiedCompanies}` = exact counts of `Job.status=ACTIVE` / `CandidateProfile.publicationStatus=ACTIVE` / `Company.isVerified` | `src/modules/reporting/__tests__/home-indicators.int.test.ts:126-132` — `expect(after.activeJobs - baseline.activeJobs).toBe(6)` (+7, +3) | ✅ PASS |
| E-001 (rendering) | 3 labeled cards with number | `src/modules/reporting/__tests__/HomeIndicators.test.tsx:10-21` — `getByText('47')`, `getByText('Vagas ativas')` etc. | ✅ PASS |
| E-002 (ISR 600s piso) | `revalidate` exported, ≤600s | `src/modules/reporting/__tests__/home-revalidate.test.ts:17-19` — `expect(revalidate).toBeLessThanOrEqual(600)` | ✅ PASS |
| E-002 (on-demand revalidation, D-005) | `revalidatePath('/')` fired after commit when `to===ACTIVE` | `src/modules/reporting/__tests__/revalidate-home.test.ts:16-23` (unit) + `src/modules/moderation/actions/__tests__/transition-content.test.ts:133/348/357` (call-site spy, incl. soft-fail case at :354-360) + `src/modules/moderation/__tests__/transition-content.int.test.ts:113/203` (integration call-site) | ✅ PASS |
| E-003 (limiar N=5, cold start) | `n<5→placeholder`; `n>=5→value`; exact boundary at 5 | `src/modules/reporting/__tests__/indicators.test.ts:28-31` — `applyMinimumDisplay(4)→placeholder`, `applyMinimumDisplay(5)→{value:5}` | ✅ PASS |

**Status**: ✅ All ACs covered — no spec-precision gaps found.

---

## Discrimination Sensor

Sensor tier: **P0/must-not USP → full manual mutation run** (one mutation per must-not, all in the highest-risk guard per the Must-Not Ownership table). All mutations injected directly on the real files (working tree), test(s) run, then `git checkout --` on the exact file to restore — no stash/worktree was needed since each mutation touched exactly one file at a time.

| # | File:line | Description | Killed? |
|---|---|---|---|
| 1 | `src/modules/reporting/queries/home-indicators.ts:26-34` | REL41-MN-01 — appended a `findMany({select:{razaoSocial:true}})` PII leak field (`verifiedCompanyNames`) to the return object | ✅ Killed — `home-indicators.int.test.ts` "REL41-MN-01 (negativo)" failed: `Object.keys(result)` gained an unexpected key |
| 2 | `src/modules/reporting/domain/indicators.ts:24` | REL41-MN-02 — boundary flip `n < threshold` → `n <= threshold` | ✅ Killed — `indicators.test.ts` "fronteira exata" and "n>=5→value" both failed: `applyMinimumDisplay(5)` returned `placeholder` instead of `{kind:'value',value:5}` |
| 3 | `src/app/(public)/page.tsx:9` | REL41-MN-03 — `revalidate = 600` → `revalidate = 3600` | ✅ Killed — `home-revalidate.test.ts` failed: `expect(3600).toBeLessThanOrEqual(600)` |

**Sensor depth**: P0-full (targeted at all 3 must-not guards, per spec's explicit anchor list)
**Result**: 3/3 killed — PASS ✅. All 3 mutations restored (`git checkout --`); working tree confirmed clean of sensor artifacts post-run (`git diff --stat` shows only pre-existing, unrelated dirt — see Notes).

---

## 🧬 Must-Not Verification (ICE mode)

| ID | SHALL NOT… | Negative fact (`file:line` + assertion) | eval(−) green? | Guard mutation killed? |
|---|---|---|---|---|
| REL41-MN-01 | Home must never expose PII (name/CNPJ/person or company row) | `home-indicators.int.test.ts:146-163` — `Object.keys(result).sort()` exact-equals 3 numeric keys; `JSON.stringify` excludes seeded names/CNPJs | ✅ | ✅ (mutation 1) |
| REL41-MN-02 | Must never render raw `0`/number when indicator `<5` | `indicators.test.ts:28-31` (unit, domain) + `HomeIndicators.test.tsx:24-50` (component: `activeJobs=2→"Em breve"`, cold-start `0/0/0→"Em breve"×3`) | ✅ | ✅ (mutation 2) |
| REL41-MN-03 | Home TTL must never exceed 600s | `home-revalidate.test.ts:16-19` — `revalidate` numeric, `>0`, `<=600` | ✅ | ✅ (mutation 3) |

**Status**: ✅ All 3 must-nots proven (evidence-or-zero, live mutation confirmed).

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`
- **typecheck**: ✅ clean, no errors
- **lint**: ✅ clean, no errors/warnings
- **test (unit)**: ✅ **1379/1379 passed** (209 test files) — matches Implementer's reported count exactly
- **test:integration**: ✅ **574/574 passed** (94 test files) — matches Implementer's reported count exactly (ran against live Supabase local Postgres, :55322)
- **build**: ✅ **passed, exit code 0** — reproduced 3× independently (see Build Adjudication below); all 6 static/dynamic routes generated including `/` with `Revalidate 10m` (600s) confirmed in build output
- **Skipped tests**: none observed
- **Failures**: none

### Build Adjudication (independent, per orchestrator's instruction)

The Implementer reported `npm run build` failing at a `/500` prerender error (`<Html> should not be imported outside of pages/_document`), claimed pre-existing per the `build-404-html-blocker` project lesson.

**Independent finding: the claim does not reproduce.** I ran `npm run build` on the exact feature-branch HEAD (`bc4d15f`) three times, with `rm -rf .next` before two of the three runs to rule out stale cache:
1. First run (pre-existing local `layout.tsx` dirt stashed out of the way): exit 0, clean.
2. Second run (same `layout.tsx` dirt re-applied — an unrelated, uncommitted `suppressHydrationWarning` addition present in the working tree, unconnected to any commit in `f6c1562..bc4d15f`): exit 0, clean.
3. Third run (explicit `rm -rf .next` + capture of `$?`): **`EXIT_CODE=0`**, clean, all pages generated, `/` shows `Revalidate 10m / Expire 1y` as expected from `export const revalidate = 600`.

No `<Html>` error and no `/500` prerender error appeared in any of the 3 runs. This is consistent with the project's own `build-404-html-blocker` lesson ("Build e E2E ... são gates confiáveis desde 2026-06-02; o antigo blocker /404 não aparece no CI") and with Fase 5's closing gate report in STATE.md (`NODE_ENV=production build OK`).

**Verdict: (a) not reproducible as a pre-existing condition, and (b) not a USP-041 regression either — there is currently no build failure on this branch.** The Implementer's report appears to have been a stale/transient observation (possibly tied to a local `.next` cache state or an intermediate commit during T1–T6 development, not the final HEAD). This does **not** block PASS — the build gate is green — but I flag the discrepancy so the orchestrator is aware the Implementer's self-report was inaccurate for this one item, even though the final deliverable is sound.

---

## Deviations — Verdict

| # | Deviation | Verdict | Evidence |
|---|---|---|---|
| 1 | T6 collapsed 3 source Server Actions into 1 chokepoint `transitionContent()` | ✅ Sound | Traced: job approval → `moderation/actions/decide.ts:approveContent` → `transitionContent({contentKind: JOB, to: ACTIVE})`. Candidate profile activation → same `decide.ts:approveContent` with `ContentKind.CANDIDATE_PROFILE` (shares `MODERATE_CV` permission, per code comment). Company verification → `CompanyVerifyHookPort.onContentActivated`, invoked **inside** `transitionContent`'s transaction only when `to===ACTIVE` (`transition-content.ts:135-141`). All 3 indicator-moving events pass through this single function — confirms ADR-0011 "única via". `revalidateHomeIndicators()` fires at `transition-content.ts:136-142`, **after** the `withAudit` block resolves (outside tx), guarded by `data.to === ContentStatus.ACTIVE`, wrapped in try/catch with `log.warn` soft-fail. No bypass found. |
| 2 | `ACCESS_REPORT_ROLES` moved from `'use server'` file to `domain/access-report-roles.ts` | ✅ Sound, behavior-preserving | `git diff` shows byte-identical array `['SOCIAL_ASSISTANT', 'BOARD', 'COORDINATOR']`, same `.includes(role)` gate at `access-report.ts:58`, same import surface via barrel. Reason documented inline (Next.js `'use server'` files may only export async functions — build-breaking otherwise once any route imports the barrel). No authz change. |
| 3 | Barrel exports component as `HomeIndicatorsView`; page test co-located at `(public)/page.test.tsx` instead of `(public)/__tests__/page.test.tsx` | ✅ Cosmetic, no functional impact | `page.tsx:1` imports and renders `HomeIndicatorsView` correctly; component behavior unchanged (same `HomeIndicators` function, aliased on export). Test file confirmed picked up and passing as part of the 1379-test unit run (`src/app/(public)/page.test.tsx` present in `git diff --stat`, 3 tests inside, all green). |
| 4 | Integration tests use delta-based (before/after) assertions against shared dev Postgres | ✅ Still discriminating, not tautological | Confirmed by mutation 1: the exact same test file (`home-indicators.int.test.ts`) went RED under a real query mutation. The delta test itself (`+6/+7/+3`) requires the query to filter correctly post-seed — a mutation that widened the `where` (e.g. counted DRAFT too) would break the exact delta match; the baseline capture pattern is the established repo convention (same as `apply-to-job.int.test.ts` per the file's own doc comment). |
| 5 | Pre-existing tests emit a swallowed `revalidatePath`-outside-request WARN when calling `transitionContent(to=ACTIVE)` | ✅ Confirmed swallowed, no masking | `transition-content.ts:136-142` wraps `revalidateHomeIndicators()` in try/catch, logs `log.warn(...)`, does not rethrow or alter the return value. Verified empirically: `moderation:transition:home-indicators-revalidate-failed` WARN appears repeatedly in the `npm run test:integration` output, yet the full suite still finished **574/574 passed** — the WARN is cosmetic log noise, not a failure. |

---

## Code Quality

| Principle | Status |
|---|---|
| Minimum code | ✅ |
| Surgical changes | ✅ (16 files, no unrelated churn) |
| No scope creep | ✅ |
| Matches patterns | ✅ (barrel exports, `ActionResult`, soft-fail side effects, `container`/DI, delta-based integration tests all match existing repo conventions) |
| Spec-anchored outcome check (asserted values match spec) | ✅ |
| Every test maps to a spec requirement — no unclaimed tests | ✅ |

---

## Edge Cases

- [x] Baseline 0 (no jobs/candidates/companies) → "Em breve", no error — covered by `HomeIndicators.test.tsx` cold-start test + `page.test.tsx` fallback test + `home-indicators.int.test.ts` baseline test.
- [x] Query fails / cache unavailable → home stays loadable — `page.tsx:loadIndicators` try/catch → `FALLBACK_INDICATORS` (all zeros → renders "Em breve" via the same threshold rule, never raw `0`), covered by `page.test.tsx:63-72`.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
|---|---|---|
| E-001 | Implementing | ✅ Verified |
| E-002 | Implementing | ✅ Verified |
| E-003 | Implementing | ✅ Verified |
| REL41-MN-01 (PII) | Implementing | ✅ Verified (eval(−) green, mutation killed) |
| REL41-MN-02 (Em breve <5) | Implementing | ✅ Verified (eval(−) green, mutation killed) |
| REL41-MN-03 (TTL ≤600s) | Implementing | ✅ Verified (eval(−) green, mutation killed) |

---

## Notes — pre-existing, out-of-scope working-tree state

At session start the working tree already carried unrelated, uncommitted dirt (not part of `f6c1562..bc4d15f`, not touched by this Verifier): modified `.agents/.skill-lock.json[.backup]`, deleted `.claude/skills/idsd-spec-driven/*` and other skill-workspace files, modified `.gitignore`/`.wolf/task-timer.json`, and a modified `src/app/layout.tsx` (`suppressHydrationWarning` addition, unrelated to the `<Html>` build-error claim — see Build Adjudication). None of this was introduced or altered by this verification pass; it is left exactly as found.

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 5/5 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 3/3 mutations killed
**Must-nots**: 3/3 eval(−) green
**Gate**: typecheck ✅, lint ✅, 1379/1379 unit ✅, 574/574 integration ✅, build ✅ (exit 0, independently adjudicated as not a regression — see above)

**What works**: All 3 live indicators (MP4/MP1/MP2) render correctly with count-only aggregation (structurally impossible to leak PII — `count()`-only query, 3-`number` type). Minimum-display rule (N=5) enforced at both domain and component layers with an exact boundary test. ISR 600s piso + on-demand revalidation both verified; the on-demand path is proven to route through the single ADR-0011 chokepoint (`transitionContent`) for all 3 source events (job approval, candidate profile activation, company verification), soft-failing safely with the ISR floor as backstop.

**Issues found**: None blocking. One informational discrepancy: the Implementer's self-reported build failure did not reproduce under independent testing (see Build Adjudication) — recommend the Implementer double-check their local `.next` cache state in future runs, but this does not affect the USP-041 verdict.

**Next steps**: Proceed to Dev Sênior / `pr-review` pass per §6b.3 of the Validate phase; no fix tasks required from this Verifier pass.
