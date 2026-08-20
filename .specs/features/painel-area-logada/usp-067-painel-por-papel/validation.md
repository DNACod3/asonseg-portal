# USP-067 — Painel `/inicio` por papel — Validation

**Date**: 2026-08-20
**Spec**: `.specs/features/painel-area-logada/usp-067-painel-por-papel/spec.md`
**Diff range**: `origin/master..HEAD` (24 commits, `12a53fb`..`046fb3c`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Verdict: ❌ FAIL

One confirmed must-not violation (PNL-MN-04 — dead-end route rendered as an action link) and one confirmed architecture-drift gap (PNL-00 AC5 — institutional visibility not literally derived from `hubAccessFromRoles`, proven unprotected by a surviving mutant). All gates re-executed green; all 8 must-nots have negative tests that are green and mutation-resistant **except** the row-level route-existence case that PNL-MN-04's coverage never claimed to own. Both issues are narrow and fixable without redesign.

---

## Task Completion

All 19 tasks (T1–T19) present in the commit history with 1:1 commit-to-task mapping, plus 3 declared out-of-plan fix commits (`abca14a`, `abfb7d1`'s sibling `046fb3c`, and a support query `939d911`). No task marked partial in tasks.md checkboxes were found unchecked in the delivered code.

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1–T9 | ✅ Done | commits `99611e4`..`d04b860` |
| T10–T11 | ✅ Done | commits `07e100b`, `c197ba0` |
| T12–T16 | ✅ Done | commits `f07ef6a`..`bd8c322` (+ `939d911` support query, undeclared in tasks.md but transparently `// SPEC_DEVIATION` commented — see below) |
| T17 | ✅ Done | `4e3167f` — but see PNL-00 AC5 finding below |
| T18 | ✅ Done | `22ecc63` — decoy-killable, verified |
| T19 | ✅ Done | `abfb7d1` |

---

## Spec-Anchored Acceptance Criteria

| Criterion (WHEN X THEN Y) | Spec-defined outcome | `file:line` + assertion | Result |
| -------------------------- | --------------------- | ------------------------ | ------ |
| P1.0-1: saudação + blocos por papel dentro da casca | primeiro nome + blocos por papel ativo | `src/app/(app)/inicio/page.test.tsx:114-124` — `expect(screen.getByText('Olá, Ana')).toBeInTheDocument()` | ✅ PASS |
| P1.0-2: papel composto → ordem `ALL_ROLE_LABELS` | headings na ordem exata | `page.test.tsx:126-140` — `expect(headings).toEqual(['Candidato(a)','Prestador(a)','Cliente','Responsável de Empresa'])` | ✅ PASS |
| P1.0-3: lista ≤5 + contador "N de M" | nunca 6ª linha renderizada | `_components/__tests__/dashboard-card.test.tsx` — confirmed via fault injection (see Sensor) | ✅ PASS |
| P1.0-4: "ver lista completa" só quando rota existe/acessível | omite link quando `footHref` ausente | `dashboard-card.tsx:57-67` + `_components/__tests__/dashboard-card.test.tsx` | ⚠️ PASS at card-footer level, **but see PNL-MN-04 finding**: per-row action links (not `footHref`) are not covered by this mechanism at all, and one of them (`institutional-block.tsx` "Ver detalhes" → `/encaminhamentos/[id]`) targets a route that does not exist. |
| P1.0-5: visibilidade institucional deriva **exatamente** de `hubAccessFromRoles`+`canAccessModerationQueue` | nunca leitura ad-hoc | `page.tsx:20,44` — `INSTITUTIONAL_ROLES` hardcoded array, `hubAccessFromRoles` never imported/called | ❌ GAP — see finding below |
| P1.0-6: papel-zero → saudação + estado coerente | sem erro, sem bloco quebrado | `page.test.tsx:183-201` | ✅ PASS |
| P1.0-7: leitura falha → degrade por bloco | try/catch → fallback por dimensão | `_loaders/candidate.ts:61-89` et al. (all 5 loaders use the same pattern) | ✅ PASS |
| P1.1-1..3 (CANDIDATE) | KPIs + 2 cards + ações | `_loaders/candidate.ts` + `_components/__tests__/candidate-block.test.tsx` | ✅ PASS |
| P1.2-1..3 (PROVIDER, sem "marcar respondido") | `listProviderInterests` 1×, sem estado novo | `_loaders/provider.ts` (single call), `provider-block.tsx` (no "marcar respondido" button) | ✅ PASS |
| P1.3-1..3 (CLIENT) | KPI "em andamento" omitido; contadores por categoria | `_loaders/client.ts`, `client-block.tsx` (SPEC_DEVIATION documented for 2nd action, defensible — see Deviations) | ✅ PASS (with documented, defensible deviation) |
| P1.4-1..4 (COMPANY_RESPONSIBLE) | sem empresa → estado vazio + atalho; recent apps sem PII | `_loaders/company.ts:41-47` (EMPTY state), `list-company-recent-applications.ts` select clean | ✅ PASS |
| P1.5-1..3 (COORDINATOR) | fila + ações navegacionais; encaminhamentos c/ ações | `_loaders/institutional.ts`, `institutional-block.tsx` | ⚠️ PASS for fila; **"Ver detalhes" of referrals is a dead link** (see PNL-MN-04) |
| P1.6-1..3 (SOCIAL_ASSISTANT, read-only fila) | fila somente leitura, sem link `/moderacao` | `_components/__tests__/institutional-block.test.tsx` — confirmed via fault injection (see Sensor) | ✅ PASS |
| P1.7-1..2 (BOARD, tudo read-only) | KPIs + fila/encaminhamentos sem ação de decisão | `institutional-block.tsx:48-59` (`canModerate` gate), `_loaders/institutional.ts:107-119` (BOARD KPI branch) | ✅ PASS |

**Status**: ❌ Gaps present (2 items, both scoped and fixable — see Ranked Gaps).

---

## Discrimination Sensor

Sensor run in the real working tree with edit → test → `git checkout --` revert per mutation (no stash needed; tree was clean before/after each). All three targeted the highest-risk new logic: the ≤5 render cap, the read-only moderation gate, and the institutional-visibility duplication called out in the Implementer's own deviation summary.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ------------ | ------- |
| 1 | `src/app/(app)/inicio/_components/dashboard-card.tsx:5` | `DASHBOARD_CARD_MAX_ROWS = 5` → `6` | ✅ Killed — `dashboard-card.test.tsx` PNL-MN-07 test fails (`Linha 6` found) |
| 2 | `src/app/(app)/inicio/_components/institutional-block.tsx:49` | `data.canModerate ? (...) : undefined` → `true ? (...) : undefined` | ✅ Killed — 3 tests fail across `privacy.mn.test.tsx` + `institutional-block.test.tsx` (PNL-MN-03) |
| 3 | `src/app/(app)/inicio/page.tsx:20` | `INSTITUTIONAL_ROLES = ['COORDINATOR','SOCIAL_ASSISTANT','BOARD']` → drop `'BOARD'` (simulates drift vs. `REPORTS_ROLES` in `hub-links.ts`) | ❌ **Survived** — `page.test.tsx` (7/7 tests) still pass; nothing in the suite ties institutional-panel visibility to the actual `hubAccessFromRoles`/`REPORTS_ROLES` source of truth |

**Sensor depth**: lightweight (3 targeted mutations, proportional — this feature is not payment/auth-P0 tier, but does carry PII must-nots)
**Result**: 2/3 killed — 1 survived → **fix task required** (strengthen the PNL-00 AC5 / PNL-MN-04 test to assert against the real `hubAccessFromRoles` output, or better: fix the implementation to call it, which makes the mutation moot).

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | ----------- | ------------------------------------------ | ------ | ------------------------ |
| PNL-MN-01 | vazar campo restrito de terceiro no payload | `__tests__/privacy.mn.test.tsx:33-69,71-104` — decoy fields (`cpf`/`birthDate`/`fullAddress`) not in `container.innerHTML`, injected via `as unknown as X` past the typed interface | ✅ | ✅ (decoy-killable by construction) |
| PNL-MN-02 | expor identidade de candidato no card COMPANY | `jobs/__tests__/list-company-recent-applications.int.test.ts:127-139` (select structurally excludes `candidate`) + `__tests__/privacy.mn.test.tsx:106-133` (component markup) | ✅ | ✅ (verified: `select` block regex-checked, `Object.keys(row)` exact-matched) |
| PNL-MN-03 | expor ação/rota de decisão de moderação sem `canAccessModerationQueue` | `_components/__tests__/institutional-block.test.tsx` + `privacy.mn.test.tsx:150-186` | ✅ | ✅ (confirmed live — mutation 2 above) |
| PNL-MN-04 | render bloco/card/ação cuja rota-alvo não existe/não é acessível | `_components/__tests__/dashboard-card.test.tsx` (footHref omission only) | ⚠️ **Partially covered — a real violation exists outside the tested surface** | N/A — see finding below |
| PNL-MN-05 | Prisma direto em `page.tsx`/`_loaders/**` | `__tests__/no-direct-prisma.guard.test.ts` | ✅ | not re-tested (static regex guard, low-risk to mutate meaningfully) |
| PNL-MN-06 | migração/estado/mutação nova | `__tests__/read-only-queries.guard.test.ts` + `git diff --name-only origin/master...HEAD -- prisma/migrations` (re-run by Verifier: empty) | ✅ | not applicable (structural check) |
| PNL-MN-07 | >5 registros / leitura sem `take` | `dashboard-card.test.tsx` (render) + `list-company-recent-applications.int.test.ts`/`list-recent-referrals.int.test.ts` (`take` literal) | ✅ | ✅ (confirmed live — mutation 1 above) |
| PNL-MN-08 | hex cru / paleta fixa Tailwind nos componentes novos | `__tests__/ds-tokens.guard.test.ts` (recursive scan of `_components/**` + `_loaders/**`) | ✅ | not re-tested (static regex guard) |

**Status**: ❌ **PNL-MN-04 has a confirmed live violation** not caught by its own negative test — the negative test (`dashboard-card.test.tsx`) only exercises the `footHref` omission mechanism, but `institutional-block.tsx`'s per-row "Ver detalhes" action for referrals links to `/encaminhamentos/${referral.id}`, a route with **no `page.tsx`** anywhere in `src/app/(app)/encaminhamentos/[id]/` (only `.../[id]/resultado/page.tsx` and `.../novo/page.tsx` exist — confirmed via `find` and via the production `next build` route manifest, which lists `/encaminhamentos/[id]/resultado` and `/encaminhamentos/novo` but no bare `/encaminhamentos/[id]`). Any COORDINATOR/SOCIAL_ASSISTANT/BOARD user clicking "Ver detalhes" on a referral row in `/inicio` hits a 404. This is also flatly inconsistent with the spec's own Out-of-Scope table entry ("lista/detalhe de encaminhamentos... Onde a rota-alvo não existe, o card omite o link (A-11)") — the card should have omitted the "Ver detalhes" action (or pointed elsewhere), the same way `CandidateBlock` correctly omits `footHref` for "Minhas candidaturas" because that list route doesn't exist either.

Per bravi-spec-driven validate.md §6b: a must-not with a confirmed live violation **forces FAIL**, regardless of how green the rest of the suite is.

---

## Deviation Verdicts (as declared by Implementer)

### 1. T17 — institutional gate: hardcoded array vs. `hubAccessFromRoles(roles).reports`

**Verdict: CONFIRMED gap, non-blocking on its own but reinforces the FAIL above.**

- `REPORTS_ROLES` in `src/modules/identity/domain/hub-links.ts:67` = `['COORDINATOR', 'BOARD', 'SOCIAL_ASSISTANT']`.
- `INSTITUTIONAL_ROLES` in `src/app/(app)/inicio/page.tsx:20` = `['COORDINATOR', 'SOCIAL_ASSISTANT', 'BOARD']`.
- Functionally identical today (same 3 roles, order-independent via `.includes`) — the Implementer's equivalence claim is **true as of this commit**.
- However, spec P1.0 AC5 text is explicit and stronger than "equivalent": *"sua visibilidade SHALL derivar **exatamente** das flags `hubAccessFromRoles` + `canAccessModerationQueue`... **nunca** de leitura ad-hoc que a rota-alvo negaria."* A hardcoded duplicate array is precisely the "leitura ad-hoc" the AC forbids, independent of whether it currently agrees with the source of truth.
- `page.tsx` never imports `hubAccessFromRoles` at all — the design.md mermaid diagram's `ACC["access = hubAccessFromRoles(roles) + canAccessModerationQueue(person)"]` step does not exist in the shipped code.
- **Empirically proven not just theoretical**: discrimination-sensor mutation 3 (drop `'BOARD'` from the local array) survived the entire test suite — no test would catch a future accidental divergence between the two lists (e.g., someone adding a role to `REPORTS_ROLES` for the hub sidebar without remembering the panel's private copy exists).
- **Fix**: replace the local array/derivation with `hubAccessFromRoles(person.roles).reports` (or expose an equivalent named export from `hub-links.ts` if the field name is considered private), removing the duplicate list entirely.

### 2. T17 — hub-of-shortcuts substituted by the panel (SPEC_DEVIATION)

**Verdict: CONFIRMED legitimate, not a regression.**

- `src/app/(app)/layout.tsx:36-43` still calls `buildHubLinks(access)` and passes `groups` to both `AppSidebar` and `AppBottomNav` — the exact same navigation surface (Minha conta / Meus papéis / Institucional) remains reachable via the casca, unchanged by this feature (confirmed: `(app)/layout.tsx`, `app-sidebar.tsx`, `app-bottom-nav.tsx`, `profile-menu.tsx` all absent from the diff).
- `page.test.tsx`'s own docblock (lines 1-19) documents the substitution and explicitly states which old assertions (HUB-01..07) no longer apply and why — this is documentation of a scope decision, not silent test weakening.
- No route previously reachable through the hub became unreachable. Verdict: legitimate substitution, no further action.

### 3a. `abca14a` — `eslint-disable-next-line` for deliberate deep import in T1/T2 tests

**Verdict: CONFIRMED correct remedy, not a mask.**

- Precedent for this exact pattern (`eslint-disable-next-line no-restricted-imports` inside a `__tests__` file, with a rationale comment) already existed pre-feature in `src/shared/__tests__/no-deep-module-imports.test.ts` and `src/shared/__tests__/container-content-moderation-reader-kinds.test.ts` — this is not a new convention invented ad hoc.
- The underlying reason (importing `ContentStatus` from `@/modules/moderation/domain/content-status` directly, not the barrel, to keep coverage-graph pollution out of the v8 branch-coverage denominator) matches design.md's own documented Risk ("Cobertura de branch cai ao importar barrels em testes") and MEMORY lesson `coverage-gate-branch-loading-drop`. Switching to the barrel would have been the actually-wrong fix.
- Verdict: correct call, properly justified inline.

### 3b. `046fb3c` — `ResubmitJobButton`/`ResubmitServiceButton` import Server Actions from source file, not barrel

**Verdict: CONFIRMED real precedent and real build necessity; PARTIALLY unregistered.**

- The precedent cited (`job-form.tsx`/`service-form.tsx` carve-out) is real: `src/shared/__tests__/no-deep-module-imports.test.ts:14-32` documents it at length, with the exact same "Next refuses to bundle `next/headers`/`revalidatePath` for the client" failure mode, empirically verified.
- The build necessity is real too: this Verifier re-ran `npm run build` from a clean state and it succeeded (`/inicio` listed as `ƒ` dynamic route) — this was evidently not true before the fix per the commit message, and is consistent with the barrel's known server-only re-exports.
- **Gap**: `no-deep-module-imports.test.ts` only scans `src/modules/**` (`MODULES_DIR = join(process.cwd(), 'src/modules')`, `sourceFiles(MODULES_DIR)`). It does **not** scan `src/app/**`, so the two new exceptions in `src/app/(app)/inicio/_components/resubmit-job-button.tsx` and `resubmit-service-button.tsx` are invisible to that guard's "exactly 5 known files" assertion — the guard was not (and structurally could not be, without extending its scan root) updated to register these two new carve-outs. The exception is documented in code comments only, not machine-verified the way the module-side exceptions are.
- This is a minor gap, not a must-not violation (`no-restricted-imports` ESLint rule itself still fires globally and is satisfied; `npm run lint` is green). Recommend, as a low-priority follow-up: either extend `no-deep-module-imports.test.ts`'s scan to include `src/app/(app)/inicio/_components/**`, or add a scoped equivalent guard there, so the carve-out is bounded the same way the module-side one is.

### 4. Dead code — `hub-link-card.tsx`

**Verdict: CONFIRMED dead code, non-blocking, legitimate follow-up.**

- `grep -rln "hub-link-card|HubLinkCard" src` (excluding tests) returns only the component's own file — no importer remains after T17's rewrite.
- It is still reached by `ds-tokens.guard.test.ts`'s recursive scan (harmless — it was already tokens-only) and by its own dedicated test file, so nothing is broken; it's inert, not wrong.
- Not mentioned in the spec's Out-of-Scope table, and removing it was not part of any task's Done-when. Leaving it is defensible as "not this feature's job to clean up Phase-8 leftovers" — but it should not linger indefinitely. Recommend a small follow-up task (outside USP-067) to delete `hub-link-card.tsx` + its test.

---

## Gate Check (re-executed by Verifier, not accepted on the Implementer's word)

| Gate | Command | Result | Matches Implementer's claim? |
| ---- | ------- | ------ | ------------------------------ |
| Typecheck | `npm run typecheck` | ✅ exit 0, clean | ✅ Yes |
| Lint | `npm run lint` | ✅ exit 0, clean | ✅ Yes |
| Unit | `npm run test -- --coverage` | ✅ 325/325 files, 2256/2256 tests. Coverage: 75.9% stmts / 69.65% branches / 75.48% funcs / 77.57% lines | ✅ Yes, exact match |
| Integration | `npm run test:integration` | ⚠️ 121/122 files, 691/692 tests. 1 failure: `src/app/api/cron/auth-attempts-retention/route.int.test.ts` — **unrelated file, not in this feature's diff**, passes in isolation (`3/3` re-run standalone) — pre-existing shared-DB ordering flake (matches MEMORY lesson `seed-cnpj-exclusivo` pattern), not a regression from this feature. | ⚠️ Implementer claimed all-green; this Verifier's re-run shows 1 unrelated flake. Not attributable to USP-067. |
| Build | `npm run build` | ✅ exit 0, `/inicio` listed as `ƒ` (dynamic) | ✅ Yes |
| Migrations | `git diff --name-only origin/master...HEAD -- prisma/migrations` | ✅ empty (PNL-MN-06 confirmed) | ✅ Yes |
| Casca intact | `git diff --name-only` filtered for `layout.tsx`/`app-shell`/`app-sidebar`/`profile-menu`/`app-bottom-nav` | ✅ empty — casca untouched | ✅ Yes |

**Test count before feature**: not independently re-baselined against `origin/master` (expensive full run); diff shows only additive test files plus one migrated file (`page.test.tsx`, net +70 lines) — no evidence of test deletion without replacement.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ — loaders/components are thin, data-driven, no speculative abstraction |
| Surgical changes | ✅ — diff fully scoped to `(app)/inicio/**` + owner-module `queries/`/`domain/`/barrels; casca/layout untouched |
| No scope creep | ⚠️ mostly — one undeclared-but-transparent gap-fill (`getCandidatePrimaryArea` query, `939d911`), honestly commented as `SPEC_DEVIATION` in-code; acceptable |
| Matches patterns | ✅ — `try/catch → fallback` mirrors `loadIndicators`; `select` style mirrors `list-job-applicants.ts` |
| Spec-anchored outcome check | ⚠️ — see PNL-00 AC5 / PNL-MN-04 gaps above |
| Per-layer coverage expectation met | ✅ — queries have integration tests with branch coverage on empty/error paths; components have RTL |
| Every test maps to a spec requirement | ✅ — no unclaimed tests observed |
| Documented guidelines followed | CLAUDE.md (barrel imports, View Models, Server Action sequence — mostly followed, with the two explicitly-justified carve-outs above) |

---

## Edge Cases

- [x] Card sem registros → "Nada por aqui ainda." (`dashboard-card.tsx:53`)
- [x] CANDIDATE sem `CandidateProfile`/área → `getCandidatePrimaryArea` returns `null`, `searchJobs({page:1})` fallback confirmed in `candidate.ts:79-84`
- [x] COMPANY_RESPONSIBLE múltiplas empresas → `Promise.all` over grants, confirmed in `company.ts`
- [x] Leitura de módulo lança → loader per-dimension `try/catch`, confirmed across all 5 loaders
- [x] VOLUNTEER puro delegado → institutional block appears via `canModerate`, confirmed in `page.test.tsx` + `institutional.ts` (`needsReferrals` false branch — only queue, no referrals/KPIs beyond "Moderações pendentes")
- [ ] **"Ver lista completa"/action route always valid** — NOT handled for the institutional referrals row-level action (see PNL-MN-04 finding)

---

## Requirement Traceability Update

| Requirement ID | Previous Status | New Status |
| --------------- | ----------------- | ------------ |
| PNL-00 | Pending | ❌ Needs Fix (AC5) |
| PNL-01 | Pending | ✅ Verified |
| PNL-02 | Pending | ✅ Verified |
| PNL-03 | Pending | ✅ Verified |
| PNL-04 | Pending | ✅ Verified |
| PNL-05 | Pending | ⚠️ Verified with defect (see PNL-MN-04) |
| PNL-06 | Pending | ✅ Verified |
| PNL-07 | Pending | ✅ Verified |
| PNL-MN-01 | Pending | ✅ Verified |
| PNL-MN-02 | Pending | ✅ Verified |
| PNL-MN-03 | Pending | ✅ Verified |
| PNL-MN-04 | Pending | ❌ Needs Fix |
| PNL-MN-05 | Pending | ✅ Verified |
| PNL-MN-06 | Pending | ✅ Verified |
| PNL-MN-07 | Pending | ✅ Verified |
| PNL-MN-08 | Pending | ✅ Verified |

---

## Fix Plans

### Fix 1 (Blocker — causes 404 for every institutional user)

- **Root cause**: `institutional-block.tsx`'s "Ver detalhes" action for referral rows links to `/encaminhamentos/${referral.id}`, a route with no `page.tsx`. The spec's Out-of-Scope table explicitly says this detail route doesn't exist and A-11 requires omitting links to nonexistent routes — the CANDIDATE block does this correctly for "Minhas candidaturas"; the institutional block did not apply the same rule to this per-row action.
- **Fix task**: Remove the "Ver detalhes" `<Link href={...}>` for referral rows (or point it at a route that actually exists, e.g. keep only "Registrar resultado" which correctly targets `/encaminhamentos/[id]/resultado`, gated by `canRegisterReferralResult` as already implemented). Add a regression test asserting no `href="/encaminhamentos/${id}"` (bare, without `/resultado`) appears in the rendered markup.
- **Priority**: Blocker

### Fix 2 (Major — architecture drift with proven no-test-coverage)

- **Root cause**: `page.tsx` derives institutional-block visibility from a locally hardcoded `INSTITUTIONAL_ROLES` array instead of calling `hubAccessFromRoles(person.roles).reports`, contradicting spec P1.0 AC5's literal "SHALL derive exactly from the flags... never ad-hoc" language. Discrimination-sensor mutation 3 proved this divergence is currently undetectable by any test.
- **Fix task**: In `src/app/(app)/inicio/page.tsx`, replace `const institutional = canModerate || person.roles.some((role) => INSTITUTIONAL_ROLES.includes(role));` with a call into `hubAccessFromRoles(person.roles).reports` (import from `@/modules/identity`), removing the local `INSTITUTIONAL_ROLES` constant. Add/extend a test in `page.test.tsx` that mocks or spies on `hubAccessFromRoles` (or asserts against its real output for a role set) so a future divergence between the hub's and the panel's role lists fails the suite.
- **Priority**: Major

### Note (non-blocking, no fix task required to reach PASS)

- `resubmit-job-button.tsx`/`resubmit-service-button.tsx` deep-import carve-out is real and lint-enforced but unregistered in `no-deep-module-imports.test.ts` (which only scans `src/modules/**`). Recommend a follow-up to extend that guard's scan root or add an equivalent for `src/app/(app)/inicio/_components/**`.
- `hub-link-card.tsx` is dead code post-T17. Recommend a follow-up cleanup task (not part of this USP's scope).
- Integration suite had 1 unrelated pre-existing flake (`auth-attempts-retention` cron test) — not caused by this feature, passes standalone; no action needed from this USP.

---

## Summary

**Overall**: ❌ Not Ready

**Spec-anchored check**: 14/16 ACs matched spec outcome cleanly; 2 flagged (P1.0-4/PNL-MN-04 partial coverage, P1.0-5/PNL-00-AC5 architecture gap)
**Sensor**: 2/3 mutations killed, 1 survived (institutional-visibility duplication)
**Must-nots**: 7/8 green and mutation-verified; PNL-MN-04 has a confirmed live violation outside its tested surface
**Gate**: typecheck ✅, lint ✅, unit 2256/2256 ✅, integration 691/692 (1 unrelated pre-existing flake) ⚠️, build ✅, migrations empty ✅, casca intact ✅

**What works**: All 7 role blocks render with correct KPIs/cards/actions per the ROADMAP Fase-11 scope table and the A-01..A-18 reconciliations; PII-boundary must-nots (PNL-MN-01/02) are genuinely decoy-killable and verified; the ≤5 cap and moderation read-only gate are proven resistant to fault injection; zero migration; casca fully intact; all declared deviations except the institutional-role duplication are legitimate and well-documented.

**Issues found**:
1. Dead "Ver detalhes" link on institutional referral rows → 404 (Fix 1, Blocker)
2. Institutional visibility computed via an undocumented-as-risky duplicate of `hubAccessFromRoles`'s role list, proven untested against drift (Fix 2, Major)

**Next steps**: Route both fixes to the Implementer. Re-verify after both land — Fix 1 is a small, mechanical removal/test-add; Fix 2 is a small refactor (delete a local array, call the existing exported function) plus one strengthened test. Neither requires new design or new scope.
