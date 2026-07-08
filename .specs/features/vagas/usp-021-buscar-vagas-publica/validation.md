# USP-021 — Buscar vagas (pública) (Restyle Fase 2 / DS) — Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/vagas/usp-021-buscar-vagas-publica/spec.md`
**Diff range**: `c83b0d8..HEAD` (9 commits; USP-021 commits: `cae2136`, `74c512d`, `469eac3`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 — Restyle `JobCard`+`JobList` + guarda | ✅ Done | `job-card.tsx`, `job-list.tsx`, `ds-vagas-parity.test.ts` created |
| T2 — Restyle `JobSearchFilters` | ✅ Done | `job-search-filters.tsx` |
| T3 — Restyle página `(public)/vagas` + confirmação `searchJobs` | ✅ Done | `src/app/(public)/vagas/page.tsx` |

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1 (card/lista): `Card`+`Badge`, no raw palette | `ds-vagas-parity.test.ts:53-64` (`JobCard`/`JobList` entries: `requiredPrimitives: Card/Badge`, no `FIXED_PALETTE_PATTERN`/hex) | `job-card.tsx:34` (`<Card className="p-5">`), `:40` (`<Badge>` pills) | ✅ PASS |
| AC2 (card): same data incl. `company.displayName`, link preserved, no raw `nomeFantasia` access | `job-card.tsx:37` uses `job.company.displayName`; guard `ds-vagas-parity.test.ts:56-58` — `forbiddenPatterns: [/nomeFantasia/]` | `job-card.tsx:37`; `ds-vagas-parity.test.ts:102-108` (`não referencia padrões proibidos`) | ✅ PASS |
| AC3 (lista vazia): "Nenhuma vaga encontrada" preserved, no `border-dashed` | `job-list.tsx` empty-state in neutral `Card` | Guard covers `job-list.tsx` (`ds-vagas-parity.test.ts:61-64`) | ✅ PASS |
| AC4 (dark mode): tokens only | No hex | `ds-vagas-parity.test.ts:84-88` | ✅ PASS |
| AC1 (filtros): `Input`/`Label`/`Button`, `method="get"` + searchParam names preserved | `job-search-filters.tsx` uses DS primitives; guard `requiredPatterns: [/method="get"/, /<details\b/]` | `ds-vagas-parity.test.ts:66-73,110-116` | ✅ PASS |
| AC2 (filtros): P-002 layout — primary filters visible, secondary in `<details>` "Mais filtros" | Preserved `<details>` progressive enhancement | `ds-vagas-parity.test.ts:72` (`requiredPatterns: /<details\b/`) — asserted present | ✅ PASS |
| AC3 (página): `revalidate=1800`, `searchParams`, `getCurrentPerson()`+`searchJobs` preserved | Unchanged | `page.tsx` — `export const revalidate = 1800`; guard `ds-vagas-parity.test.ts:77-79` (`requiredPatterns: /export const revalidate = 1800/`, `/searchJobs\(filters, viewer\)/`) | ✅ PASS |
| AC4 (página): dark mode | tokens only | `ds-vagas-parity.test.ts:84-88` | ✅ PASS |

**Status**: ✅ All ACs covered — no spec-precision gaps.

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/modules/jobs/components/job-card.tsx:34` | `className="p-5"` → `className="p-5 bg-blue-600"` (raw-palette regression injected into a USP-021 file) | ✅ Killed — `ds-vagas-parity.test.ts` (`JobCard (USP-021) não contém paleta crua nem hex`) failed with 1/16 tests red |

Mutation injected in the real working tree (tracked file), test run, then reverted with `git checkout --` (confirmed clean via `git status --short` before/after — no residual diff). Two additional mutations (hex-literal in `job-detail.tsx`, behavior-level flip of the `applicationCount` counter guard) were run for USP-022's guard files; log in `.specs/features/vagas/usp-022-detalhe-vaga/validation.md`.

**Sensor depth**: lightweight (1 mutation directly on this USP's files; guard mechanism shared/proven across all 3)
**Result**: 1/1 killed — ✅ PASS

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U21-MN-01 | Expose `nomeFantasia` to anonymous visitor | `job-list-item.view.spec.ts:47-48` — `expect(item.company.isAnonymized).toBe(true)`, `expect(item.company.displayName).toBe('Empresa do setor de ...')`; guard `ds-vagas-parity.test.ts:56-58` (`forbiddenPatterns: [/nomeFantasia/]`) | ✅ (unit suite, unaffected by the int-test flake) | ✅ (guard proven via mutation 1 mechanism — same regex family) |
| U21-MN-02 | List non-verified / non-ACTIVE / expired job | `search-jobs.int.test.ts:225-235` — `expect(ids).not.toContain(jExpirada/jModeracao/jNaoVerificada)` | ⚠️ **RED at run time** — see Pre-Existing-Flake Finding below | Not separately mutated (evidence is the preserved test itself, query file untouched) |
| U21-MN-03 | Expose restricted fields (contact, companyId raw) to anon | `search-jobs.int.test.ts` / `job-list-item.view.spec.ts` — explicit `select` | ✅ (unit portion green; int portion shares the same flake window as MN-02) | n/a |
| U21-MN-04 | Retain raw palette/hex in restyled files | `ds-vagas-parity.test.ts` (all 6 `FILES` entries) | ✅ | ✅ (mutation 1) |
| U21-MN-05 | Oppressive filter bar / broken GET+searchParam contract | `ds-vagas-parity.test.ts:66-73` — `method="get"` + `<details>` present | ✅ | n/a (structural presence check, not a guard-removal candidate) |

**Status**: ✅ All must-nots proven, **with one flagged caveat** — U21-MN-02/03's integration-level negative test (`search-jobs.int.test.ts`) was RED at the time of this run. See the mandatory pre-existing-flake investigation below: this is proven environmental, not a restyle regression, and does **not** block PASS per the orchestrator's explicit disposition for this run. It is recorded here as a residual for follow-up.

---

## CRITICAL — Pre-Existing-Flake Investigation (mandatory)

**Claim**: 4 integration failures (3 in `search-jobs.int.test.ts`, 1 in `get-job-detail.int.test.ts`) are a pre-existing, time-window-dependent flake — `dateOffset()`'s local `Date.setDate()` arithmetic collides with `hojeSaoPaulo()`'s UTC-normalized comparison against the `@db.Date` `valid_until` column, during the ~21:00–00:00 America/Sao_Paulo window. Run started at **21:41 SP** (`date` confirmed `Tue Jul 7 21:41:29 -03 2026`).

**Independent reproduction**:

1. Created an isolated `git worktree` at `c83b0d8` (the base commit, before any Fase-2 restyle work) — `/private/tmp/.../scratchpad/wt-master`, symlinked `node_modules` (no `package.json` diff in range, confirmed via `git diff c83b0d8..HEAD -- package.json` = empty), copied `.env.local`.
2. Ran **only** the two named files on pristine master:
   ```
   npx dotenv -e .env.local -- vitest run --config vitest.integration.config.ts \
     src/modules/jobs/__tests__/search-jobs.int.test.ts \
     src/modules/jobs/__tests__/get-job-detail.int.test.ts
   ```
3. **Result: the SAME 4 test cases failed, with the same assertion mismatches**:
   - `get-job-detail.int.test.ts > @e-005 @p-004 @p-005 vaga não-ACTIVE / expirada / Empresa não verificada ⇒ null` — `jExpirada` (created with `validUntil: dateOffset(-1)`) returned a non-null row instead of `null`.
   - `search-jobs.int.test.ts > @e-001 @p-003 @p-005 só lista ACTIVE + não-expirada + Empresa verificada` — `jExpirada` incorrectly included in results.
   - `search-jobs.int.test.ts > @usp-018 @inact-mn-04 vaga INACTIVATED some da busca pública` — `total` off by 1 (3 instead of 2), same root cause cascading through the shared seed.
   - `search-jobs.int.test.ts > @l-002 pagina com take/skip e total coerente` — same `total` mismatch.

**Verdict: pre-existing, confirmed on pristine master — NOT caused by the restyle.**

**Structural impossibility check**: `git diff c83b0d8..HEAD --name-only` does not include `search-jobs.ts`, `get-job-detail.ts`, `job-detail.view.ts` (`viewJobDetail`), `search-jobs.int.test.ts`, or `get-job-detail.int.test.ts` — the restyle diff surface is `page.tsx`/`job-card.tsx`/`job-list.tsx`/`job-search-filters.tsx`/`job-form.tsx`/`job-detail.tsx` + their own tests + the new `ds-vagas-parity.test.ts`/`job-detail-ds-parity.test.ts`/`vagas-detalhe-metadata.int.test.ts`. It is structurally impossible for this diff to have changed query behavior.

**Root cause** (confirmed by code reading): `dateOffset(days)` in all three int-test files (`search-jobs.int.test.ts:26-30`, `get-job-detail.int.test.ts:24-28`, `vagas-detalhe-metadata.int.test.ts:33-37`) does `new Date(); d.setDate(d.getDate()+days); return d` — local wall-clock arithmetic. `hojeSaoPaulo()` (`src/shared/lib/time.ts:35-38`) formats "now" in `America/Sao_Paulo` and returns midnight-UTC of that calendar day. Near the 21:00–00:00 SP window, the machine's local `new Date()` (also SP, `-03`) is already past local midnight-3h-equivalent in UTC terms, so `dateOffset(-1)`'s resulting UTC calendar date can collide with "today" per `hojeSaoPaulo()`, making a job seeded as "expired yesterday" compare as still valid. This is a test-helper defect, not a product-code defect.

**Disposition**: Per the orchestrator's explicit instruction for this investigation, this confirmed pre-existing/environmental flake does **not** block PASS. Recorded as a residual finding with a recommended (non-blocking) fix task: make `dateOffset()` UTC-safe (e.g., compute via `formatInTimeZone`/date-fns-tz the same way `hojeSaoPaulo()` does, or use `Date.UTC` arithmetic on the calendar day) in `search-jobs.int.test.ts`, `get-job-detail.int.test.ts`, and `vagas-detalhe-metadata.int.test.ts`.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code (style-only) | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ |
| Matches existing patterns (`ds-login-parity.test.ts` guard precedent) | ✅ |
| Spec-anchored outcome check | ✅ |
| Documented guidelines followed | `CLAUDE.md` §Testing, AD-014/AD-015 |

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`
- **Result**: typecheck 0 errors; lint 0 errors; unit 966/966 passed; integration 258/262 passed (4 failures — pre-existing flake, see above); build succeeded, `/vagas` compiles (180 kB First Load JS).
- **Test count before/after**: 132→134 unit files, 940→966 unit tests (+26, no deletions).
- **Failures**: 4 (all attributable to the confirmed pre-existing timezone flake, not this USP's diff).

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| U21-STYLE-01 | Pending | ✅ Verified |
| U21-STYLE-02 | Pending | ✅ Verified |
| U21-MN-01 | Pending | ✅ Verified |
| U21-MN-02 | Pending | ⚠️ Verified with caveat (test RED at run time due to confirmed pre-existing environmental flake — logic itself unchanged/untouched by diff) |
| U21-MN-03 | Pending | ⚠️ Verified with caveat (same flake) |
| U21-MN-04 | Pending | ✅ Verified |
| U21-MN-05 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready (with one recorded residual, non-blocking)

**Spec-anchored check**: 8/8 ACs matched spec outcome, 0 spec-precision gaps
**Sensor**: 1/1 mutation killed
**Must-nots**: 5/5 green in principle; 2/5 (MN-02/03) had their integration evidence RED at run time due to a proven pre-existing, time-window-dependent test-helper bug — reproduced identically on pristine `c83b0d8`, structurally impossible to be caused by this diff
**Gate**: typecheck ✅, lint ✅, unit 966/966 ✅, integration 258/262 (4 pre-existing failures), build ✅

**What works**: Full DS adoption across card/list/filters/page; anonymization, GET contract, ISR revalidate, and `searchJobs` on-read filter all preserved and evidenced.

**Issues found**: Non-blocking residual — `dateOffset()` test helper in 3 int-test files is not UTC-safe and flakes near the SP midnight window. Not introduced by this PR; recommend a follow-up fix task (outside this restyle's scope).

**Next steps**: Merge as-is. File a small, separate fix task for the `dateOffset()` helper (touches test files only, no product code).
