# USP-061 — Casca de navegação da área logada (Header persistente) Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `bravi-spec-driven` skill: **activate it by name and follow
its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.
The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation,
adequacy review, Verifier, discrimination sensor).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/app-shell-logado/usp-061-casca-header/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `CLAUDE.md` (§Testing Requirements — Server Action matrix, RTL
> component tests), `docs/arch/project-guideline.md` (DoD), `vitest.config.ts`,
> `package.json` scripts. Repo samples: `src/app/(app)/inicio/page.test.tsx`,
> `src/modules/identity/__tests__/SignOutForm.test.tsx`,
> `src/shared/__tests__/casca-no-auth-pii.test.ts` (source-scan guard),
> `src/shared/__tests__/casca-uses-tokens.test.ts`. USP-061 adds **no** domain service,
> Server Action, repository, or migration — only a pure helper + presentational route
> components + static guards. E2E authenticated is deferred (lesson **L-007**, precedent AD-025).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Domain helper (`describeActiveRoles`) | unit | All branches; 1:1 to APP-SHELL-03/04; every edge (empty / single / multiple / unknown role / deterministic order) | `src/modules/identity/__tests__/*.test.ts` | `npm run test` |
| Route/shell components (`AppHeader`, `AppShell`) | unit (RTL) | Render happy + edge (zero roles) + seams present/absent + must-not negatives | `src/app/(app)/_components/__tests__/*.test.tsx` | `npm run test` |
| Composition-root (`(app)/layout.tsx`) | unit (RTL, mock `@/modules/identity`) | Passes session `fullName`+role label to shell; wraps children; MN-03 composition angle | `src/app/(app)/layout.test.tsx` | `npm run test` |
| Page migration (`(app)/inicio/page.tsx`) | unit (RTL) | Hub no longer renders own "Sair" (MN-02); existing HUB-01/02/04/07 stay green | `src/app/(app)/inicio/page.test.tsx` | `npm run test` |
| Static guards (must-not sensors MN-03/MN-04) | unit (source-scan) | Forbidden patterns absent across `(app)/_components/**`; scans ≥1 file | `src/shared/__tests__/*.test.ts` | `npm run test` |
| E2E (authenticated navigation) | none (deferred — L-007 / AD-025) | — (build gate only) | — | build gate only |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (helper) | Yes | Pure function, no IO | `identity/__tests__/hub-links.test.ts` (pure, no DB) |
| unit (RTL component/layout/page) | Yes | Per-file module isolation; mocks only (no DB/connection) | `inicio/page.test.tsx`, `SignOutForm.test.tsx` |
| unit (source-scan guard) | Yes | Reads source files read-only; no shared mutable state | `casca-no-auth-pii.test.ts` |

All USP-061 tests are parallel-safe (no integration/e2e, no shared backing store). `[P]`
is limited only by **code** dependencies between tasks.

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit/RTL/guard tests | `npm run test` (targeted during dev: `npx vitest run <path>`) |
| Full | Same as Quick — USP-061 adds no integration/e2e | `npm run test` |
| Build | After phase completion / final | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Foundation (T1 [P] T2, then T3)

```
T1 ─┐
    ├─(independent)
T2 ─┴─→ T3
```

### Phase 2: Integration + migration (Sequential)

```
(T1,T3) → T4 → T5
```

### Phase 3: Static guards (Parallel)

```
T3 ──┬→ T6 [P]
     └→ T7 [P]
```

3 phases → inline execution (no sub-agent delegation; threshold is >3 phases).

---

## Task Breakdown

### T1: `describeActiveRoles` pure helper + barrel export [P]

**What**: Pure function mapping `CurrentPerson.roles` → PT-BR label string for the header.
**Where**: `src/modules/identity/domain/roles.ts` (modify), `src/modules/identity/index.ts`
(add export), `src/modules/identity/__tests__/roles.test.ts` (new).
**Depends on**: None
**Reuses**: `ALL_ROLE_LABELS` (same file)
**Requirement**: APP-SHELL-03, APP-SHELL-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `describeActiveRoles(roles: readonly string[]): string` iterates `ALL_ROLE_LABELS`
      keys in declaration order, includes labels for roles present, joins with `' · '`.
- [x] `[]` → `''`; unknown role (not in map) → skipped; multiple → joined; order is
      deterministic regardless of input order.
- [x] Exported from `@/modules/identity` barrel.
- [x] Unit tests cover: single role, multiple roles (order), empty, unknown-role, mixed
      known+unknown — 1:1 to APP-SHELL-03/04 and edges.
- [x] Gate check passes: `npm run test`
- [x] Test count: ≥5 new tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): describeActiveRoles — rótulo PT-BR de papéis ativos (USP-061)`

---

### T2: `AppHeader` Server Component [P]

**What**: The persistent `<header>` — brand→`/inicio`, person name + role label, header-nav
seam, and "Sair".
**Where**: `src/app/(app)/_components/app-header.tsx` (new),
`src/app/(app)/_components/__tests__/app-header.test.tsx` (new).
**Depends on**: None (receives `personName`/`roleLabel` as props; composes `SignOutForm` from barrel)
**Reuses**: `SiteHeader` visual (`src/app/(public)/_components/site-header.tsx`), `SignOutForm`
(`@/modules/identity`), `Link` (next), `cn`/`Button` (`@/shared/ui`)
**Requirement**: APP-SHELL-01, APP-SHELL-02, APP-SHELL-03, APP-SHELL-04, APP-SHELL-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Server Component (no `'use client'`); `<header className="sticky top-0 z-40 …">`,
      tokens-only (no raw hex).
- [x] Brand element is a `<Link href="/inicio">` reusing the SiteHeader badge+wordmark visual.
- [x] Renders `personName`; renders `roleLabel` when non-empty; **omits** the role line when
      `roleLabel === ''` (APP-SHELL-04).
- [x] Renders the "Sair" control via `<SignOutForm />` (APP-SHELL-05).
- [x] Accepts `nav?: React.ReactNode`; renders it when provided (header-nav seam for USP-063).
- [x] RTL tests: brand href `/inicio`; name shown; role shown / omitted (2 cases); "Sair"
      button present; `nav` slot rendered when passed.
- [x] Gate check passes: `npm run test`
- [x] Test count: ≥6 new tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): AppHeader persistente da área logada (USP-061)`

---

### T3: `AppShell` Server Component (the extension point) + MN-01

**What**: The casca the layout mounts — composes `AppHeader` + `{children}` + the `bottomNav`
seam; the single point of extension for USP-062/063.
**Where**: `src/app/(app)/_components/app-shell.tsx` (new),
`src/app/(app)/_components/__tests__/app-shell.test.tsx` (new).
**Depends on**: T2
**Reuses**: `AppHeader` (T2), `PublicNav` seam pattern (reference)
**Requirement**: APP-SHELL-06, APP-SHELL-07, **APP-SHELL-MN-01**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Server Component; renders `<AppHeader personName roleLabel nav={headerNav} />`,
      then `{children}`, then `{bottomNav}` (structure per design). Does **not** declare `<main>`.
- [x] Props: `personName`, `roleLabel`, `children`, `headerNav?`, `bottomNav?`.
- [x] APP-SHELL-07: renders correctly with seams omitted (default) — header + children only.
- [x] APP-SHELL-06: `headerNav`/`bottomNav`, when provided, render in their positions.
- [x] **APP-SHELL-MN-01 (negative test)**: rendering the shell with arbitrary `children`
      ALWAYS includes the header with a "Sair" control and a brand link to `/inicio`; the
      shell never renders `children` bare (no path yields content without the header).
- [x] Gate check passes: `npm run test`
- [x] Test count: ≥4 new tests pass (incl. the MN-01 negative test) (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): AppShell — casca da área logada com seams headerNav/bottomNav (USP-061)`

---

### T4: Wire `AppShell` into `(app)/layout.tsx` (composition-root)

**What**: Make the authenticated layout mount the casca, feeding it session data.
**Where**: `src/app/(app)/layout.tsx` (modify), `src/app/(app)/layout.test.tsx` (new).
**Depends on**: T1, T3
**Reuses**: `requireActivePerson` + `describeActiveRoles` (`@/modules/identity`), `AppShell` (T3);
test pattern from `inicio/page.test.tsx` (`vi.mock('@/modules/identity')`)
**Requirement**: APP-SHELL-01, APP-SHELL-03, APP-SHELL-04, **APP-SHELL-MN-03** (composition angle)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Layout keeps `export const dynamic = 'force-dynamic'` and `await requireActivePerson()`.
- [x] Renders `<AppShell personName={person.fullName} roleLabel={describeActiveRoles(person.roles)}>{children}</AppShell>`.
- [x] Includes the `// USP-062/063: inject headerNav/bottomNav here` seam comment.
- [x] RTL test (mock `requireActivePerson`; keep `describeActiveRoles`/`AppShell` real):
      asserts the shell renders the mocked person's name + role label and wraps `{children}`;
      asserts `requireActivePerson` called with no args (inherits first-access redirect).
- [x] Gate check passes: `npm run test`
- [x] Test count: ≥3 new tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(identity): montar AppShell no layout (app) como composition-root (USP-061)`

---

### T5: Migrate logout out of the `/inicio` hub + MN-02

**What**: Remove the loose `<SignOutForm />` from the hub (now provided shell-wide) and update
the hub test to assert the new single-source behavior.
**Where**: `src/app/(app)/inicio/page.tsx` (modify — drop `<SignOutForm />` + its import),
`src/app/(app)/inicio/page.test.tsx` (modify — MN-02).
**Depends on**: T4 (shell must provide logout everywhere before removing it from the hub)
**Reuses**: existing hub tests (HUB-01/02/04/07 stay as negative regression anchors)
**Requirement**: APP-SHELL-08, **APP-SHELL-MN-02**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] `inicio/page.tsx` no longer imports or renders `SignOutForm`; nothing else changes.
- [x] `inicio/page.test.tsx` updated **with a rationale comment** (per Assumption A5): the
      old HUB-06 "hub renders Sair" assertion is replaced by the **MN-02 negative test** —
      the isolated `HubPage` render contains **no** "Sair" button (logout now lives in the
      shell). Remove the now-unused `SignOutForm` from that test's `@/modules/identity` mock.
- [x] Existing HUB-01/HUB-02/HUB-04/HUB-07 assertions remain and stay green (no weakening).
- [x] Gate check passes: `npm run test`
- [x] Test count: hub suite stays at its prior count minus the removed loose-logout case plus
      the MN-02 negative case (net: same or +0); no silent deletions of the other cases.

**Tests**: unit
**Gate**: quick
**Commit**: `refactor(identity): mover Sair do hub /inicio para a casca — fonte única (USP-061)`

---

### T6: MN-03 static guard — shell components source no session/PII [P]

**What**: Source-scan guard proving `(app)/_components/**` never imports session/Prisma/View
Models/Server Actions (identity flows only from the composition-root).
**Where**: `src/shared/__tests__/app-shell-no-auth-pii.test.ts` (new).
**Depends on**: T3 (components must exist so the scan finds ≥1 file)
**Reuses**: `src/shared/__tests__/casca-no-auth-pii.test.ts` (mold — same recursive collector,
same forbidden-pattern list)
**Requirement**: **APP-SHELL-MN-03**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Recursively scans `src/app/(app)/_components/**` (`.ts`/`.tsx`); asserts ≥1 file scanned.
- [x] Reproves import of: `prisma` (`@/shared/lib/prisma`), `getCurrentPerson`,
      `requireActivePerson`, `@/modules/*/views`, `@/modules/*/actions`, `'use server'`.
- [x] Green against the T2/T3 components (they import `SignOutForm` via the barrel — which does
      **not** match any forbidden pattern).
- [x] Gate check passes: `npm run test`
- [x] Test count: guard file green (1 scan-count assertion + 1 per forbidden pattern)

**Tests**: unit (source-scan)
**Gate**: quick
**Commit**: `test(identity): guard MN-03 — casca (app) sem sessão/PII/Prisma (USP-061)`

---

### T7: MN-04 static guard — shell is tokens-only [P]

**What**: Source-scan guard proving `(app)/_components/**` uses only design-system tokens
(no raw hex, no external CDN, no icon/state library).
**Where**: `src/shared/__tests__/app-shell-uses-tokens.test.ts` (new).
**Depends on**: T3
**Reuses**: `casca-uses-tokens.test.ts` + `casca-no-external-cdn.test.ts` +
`casca-no-icon-state-lib.test.ts` (molds)
**Requirement**: **APP-SHELL-MN-04**

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [x] Recursively scans `src/app/(app)/_components/**`; asserts ≥1 file scanned.
- [x] Reproves: raw hex (`#RRGGBB`/`#RGB`), external URL (`http(s)://…`), icon/state libs
      (`lucide-react` and the forbidden state libs from CLAUDE.md — Redux/MobX/Zustand/Jotai).
- [x] Green against the T2/T3 components (tokens-only).
- [x] Gate check passes: `npm run test`
- [x] Test count: guard file green

**Tests**: unit (source-scan)
**Gate**: quick
**Commit**: `test(identity): guard MN-04 — casca (app) tokens-only (USP-061)`

---

## Parallel Execution Map

```
Phase 1 (Foundation):
  T1 [P] ─┐   (helper — independent)
  T2 [P] ─┴─→ T3            (T3 composes AppHeader from T2)

Phase 2 (Integration + migration, Sequential):
  (T1,T3) ──→ T4 ──→ T5

Phase 3 (Static guards, Parallel):
  T3 done, then:
    ├── T6 [P]
    └── T7 [P]
```

**Parallelism constraint:** all test types are parallel-safe (unit/RTL/source-scan). `[P]`
is limited only by code dependencies. T1/T2 have no inter-dependency (order-free). T6/T7 are
order-free once T3 exists.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: `describeActiveRoles` helper + export | 1 function + barrel line | ✅ Granular |
| T2: `AppHeader` component | 1 component | ✅ Granular |
| T3: `AppShell` component | 1 component | ✅ Granular |
| T4: wire layout + layout test | 1 file change (composition-root) | ✅ Granular |
| T5: migrate logout out of hub | 1 removal + 1 test update | ✅ Granular (cohesive: one migration) |
| T6: MN-03 guard | 1 guard file | ✅ Granular |
| T7: MN-04 guard | 1 guard file | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | none (independent) | ✅ Match |
| T2 | None | none (independent) | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T1, T3 | (T1,T3) → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T3 | T3 → T6 | ✅ Match |
| T7 | T3 | T3 → T7 | ✅ Match |

- Every `Depends on` has a matching arrow; every arrow matches a `Depends on`.
- `[P]` tasks in the same phase don't depend on each other: T1∦T2 (Phase 1), T6∦T7 (Phase 3). ✅

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Domain helper | unit | unit | ✅ OK |
| T2 | Route/shell component | unit (RTL) | unit | ✅ OK |
| T3 | Route/shell component | unit (RTL) | unit | ✅ OK |
| T4 | Composition-root (layout) | unit (RTL) | unit | ✅ OK |
| T5 | Page migration | unit (RTL) | unit | ✅ OK |
| T6 | Static guard (must-not sensor) | unit (source-scan) | unit | ✅ OK |
| T7 | Static guard (must-not sensor) | unit (source-scan) | unit | ✅ OK |

No `Tests: none` anywhere; no deferral. All layers map to their required test type. ✅

---

## 💠 Must-Not Ownership (Check 4)

| Must-Not | Owning task | Negative test (in that task's Done-when) | Status |
| -------- | ----------- | ---------------------------------------- | ------ |
| APP-SHELL-MN-01 (no dead-end: header+Sair+brand always present) | T3 | `app-shell.test.tsx` — children never rendered without header/Sair/brand→`/inicio` | ✅ Owned |
| APP-SHELL-MN-02 (single logout source; hub drops its own) | T5 | `inicio/page.test.tsx` — isolated hub render has no "Sair" button | ✅ Owned |
| APP-SHELL-MN-03 (shell sources no session/PII) | T6 | `app-shell-no-auth-pii.test.ts` — forbidden imports absent across `_components/**` | ✅ Owned |
| APP-SHELL-MN-04 (tokens-only, DS intact) | T7 | `app-shell-uses-tokens.test.ts` — no raw hex / CDN / icon-state lib | ✅ Owned |

Every must-not has an owning task and a green negative test. (MN-03 also has a composition
angle covered by T4's layout test — the shell is fed only the session person.)

---

## Tools / MCPs / Skills

No MCPs or extra skills required — this is presentational route UI + a pure helper + static
guards, all local to the repo. `context7` is unnecessary (no library-API question; Next.js
App Router Server/Client patterns already established by the Fase 7 casca). The Implementer
uses the `bravi-spec-driven` skill's Execute flow; the Verifier runs automatically after T7.
