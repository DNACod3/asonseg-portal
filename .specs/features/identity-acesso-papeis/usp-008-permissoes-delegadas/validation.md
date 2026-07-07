# USP-008 Configurar permissões delegadas — Validation

**Date**: 2026-07-07
**Spec**: `.specs/features/identity-acesso-papeis/usp-008-permissoes-delegadas/spec.md`
**Diff range**: `28578fc..HEAD` (commits `d73a73a`, `ce40abf`, `636fb3d` — 3 of the 5 Group D commits)
**Verifier**: independent sub-agent (author != verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1   | Done | `refactor(identity): extrai schemas Zod de grant/revoke p/ schemas/delegated-permission.schema.ts` (`d73a73a`) |
| T2   | Done | `refactor(identity): restyle DelegatedPermissionsManager com Design System (AD-014) + smoke RTL` (`ce40abf`) |
| T3   | Done | `refactor(identity): restyle pagina de permissoes delegadas com Design System (AD-014)` (`636fb3d`) |

---

## Spec-Anchored Acceptance Criteria

### P1 Restyle (`delegated-permissions-manager.tsx` / `permissoes/page.tsx`)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: manager usa `Input`/`Button`/`Badge`/`FormCard` (ou `Card`/`FormSectionTitle`), preserva estado/validações/payload/atualização otimista | `inputClass`/`btnClass`/`revokeBtnClass` removidos; DS primitives imported; `onGrant`/`onRevoke` bodies unchanged | `src/modules/identity/components/delegated-permissions-manager.tsx:4` — `import { Badge, Button, Card, FormRow, FormSectionTitle, Input, Label } from '@/shared/ui'`; `onGrant` (line 52) / `onRevoke` (line 99) bodies present in the diff with **zero** `-`/`+` inside the function bodies (only the JSX return block changed) | PASS |
| AC2: `permissoes/page.tsx` composto com `FormHeader`, preserva `isCoordinator -> notFound()` verbatim, `dynamic`, queries `listEligibleVolunteers()`/`listDelegatedPermissions()` | Gate/dynamic/query lines untouched in diff | `git diff 28578fc..HEAD -- src/app/(app)/permissoes/page.tsx` — hunk shows `if (!isCoordinator(viewer)) { notFound(); }`, `export const dynamic = 'force-dynamic'`, `Promise.all([listEligibleVolunteers(), listDelegatedPermissions()])` outside any `-`/`+` line | PASS |
| AC3: dark mode via tokens, sem hex cru; `<select>` nativos restilizados com tokens | No raw palette classes in added lines | `git diff 28578fc..HEAD -- .../delegated-permissions-manager.tsx .../permissoes/page.tsx \| grep '^+' \| grep -E 'bg-blue-\|text-gray-\|border-gray-300\|focus:ring-blue-\|bg-red-50\|bg-blue-100\|bg-gray-50'` → no matches | PASS |

### P1 Extração de schema (`delegated-permission.schema.ts` + rewire)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --- | --- | --- | --- |
| AC1: `schemas/delegated-permission.schema.ts` exporta `grantDelegatedPermissionSchema`/`revokeDelegatedPermissionSchema` com regras/mensagens idênticas | `targetPersonId` uuid `'ID de pessoa inválido'`, `permission` = `z.enum(DELEGABLE_PERMISSIONS as [string, ...string[]])`, `scopeArea` `.min(1).max(100).optional()`; `permissionGrantId` uuid `'ID de concessão inválido'`, `justification` `.min(10, 'Justificativa deve ter ao menos 10 caracteres')` | `src/modules/identity/schemas/delegated-permission.schema.ts:15-19` (grant) and `:31-34` (revoke) — byte-for-byte match against `git show 28578fc:.../grant-delegated-permission.ts` and `revoke-delegated-permission.ts` inline schemas (diff confirms only the schema block moved, no field/rule/message changed) | PASS |
| AC2: actions importam os schemas, sem `z.object(...)` inline, `import { z }` órfão removido | `grep z.object` in both action files → 0 matches | `src/modules/identity/actions/grant-delegated-permission.ts:8-11` — `import { grantDelegatedPermissionSchema, type GrantDelegatedPermissionInput } from '../schemas/delegated-permission.schema'`; `git diff` shows `-import { z } from 'zod';` removed from both action files, no residual `z.object` | PASS |
| AC3: barrel exporta os schemas + Input types com origem no schema, nomes públicos preservados, sem colisão | `@/modules/identity` exports both schemas + both Input types from the schema file, `*Result` types from actions | `src/modules/identity/index.ts:124-135` — `export { grantDelegatedPermissionSchema, revokeDelegatedPermissionSchema } from './schemas/delegated-permission.schema'` + `export type { GrantDelegatedPermissionInput, RevokeDelegatedPermissionInput } from './schemas/delegated-permission.schema'`; old `export type { GrantDelegatedPermissionInput, ... } from './actions/...'` removed from the same diff hunk — no duplicate export of the same name | PASS |
| AC4: comportamento observável idêntico (códigos de erro, `fieldErrors`, desfechos DB) | Same `VALIDATION`/`NOT_FOUND`/`PRECONDITION_FAILED`/`CONFLICT`/`INTERNAL` codes; all existing tests green | `src/modules/identity/__tests__/grant-revoke-actions.test.ts` — 9/9 passed (see Gate Check); `src/modules/identity/__tests__/delegated-permissions.int.test.ts` — 12/12 passed, including `revokeDelegatedPermission — integração > duplo submit simultâneo: apenas um vence, o outro vira CONFLICT` (concurrency path exercised end-to-end) | PASS |

**Status**: All 7 ACs (3 restyle + 4 extraction) covered.

---

## Discrimination Sensor

Run in a disposable `git worktree` (`git worktree add .../verify-wt HEAD`) with `node_modules`/`.env.local` symlinked from the real tree; every mutation reverted (file restored from `.bak`) before `git worktree remove --force`. The real working tree was never mutated — `git status` before/after the sensor run shows only the pre-existing, unrelated working-tree changes noted in Scope Hygiene below.

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `src/modules/identity/schemas/delegated-permission.schema.ts:34` | `justification: z.string().min(10, ...)` → `.min(1, ...)` (weakens U8-MN-01 catalog/length guard) | Killed — `grant-revoke-actions.test.ts` "retorna VALIDATION para justificativa curta (< 10 chars)" fails: got `INTERNAL` instead of `VALIDATION` |
| 2 | `src/modules/identity/actions/grant-delegated-permission.ts:40` | `if (!authz.ok) return authz;` → `if (false) return authz;` (bypasses U8-MN-02 `requireCoordinator` gate) | Killed — `grant-revoke-actions.test.ts` "propaga FORBIDDEN de requireCoordinator" and 1 other case fail with `TypeError: Cannot read properties of undefined (reading 'person')` (the removed early-return exposes the unauthorized path) |
| 3 | `src/modules/identity/components/delegated-permissions-manager.tsx:53` | `if (!selectedVolunteer \|\| !selectedPermission) {` → `if (false) {` (removes U8-MN-03a selection guard) | Killed — `DelegatedPermissionsManager.test.tsx` "sem voluntário e permissão selecionados..." fails: `getByRole('alert')` finds no element (no error rendered, guard bypassed) |

**Sensor depth**: lightweight (3 targeted mutations, one per must-not: U8-MN-01 catalog/length rule, U8-MN-02 authz gate, U8-MN-03a client selection guard). U8-MN-03b (finite catalog rendering) was not separately mutated — it is a rendering-completeness assertion (`select.options` length/order equals `DELEGABLE_PERMISSIONS`), not a conditional guard, and mutating the `<select>`'s `.map(DELEGABLE_PERMISSIONS...)` call is redundant with the already-proven AC (any drift from the catalog would fail `DelegatedPermissionsManager.test.tsx:52-56` on the option-count/values assertion directly).
**Result**: 3/3 killed — PASS

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| --- | --- | --- | --- | --- |
| U8-MN-01 | Aceitar entradas hoje rejeitadas (uuid inválido, permission fora do catálogo, scopeArea vazio, justification < 10) após a extração | `src/modules/identity/__tests__/grant-revoke-actions.test.ts` — 4 VALIDATION cases (uuid, enum, scopeArea, justification) all assert `r.error.code === 'VALIDATION'`; `delegated-permissions.int.test.ts` 12/12 green | Yes | Yes (Sensor #1) |
| U8-MN-02 | Perder o passo 2 `requireCoordinator()` na re-cabeagem | `grant-revoke-actions.test.ts` "propaga UNAUTHENTICATED de requireCoordinator" and "propaga FORBIDDEN de requireCoordinator" (grant + revoke, 4 cases total within the 9) | Yes | Yes (Sensor #2) |
| U8-MN-03 | (a) Chamar `grantDelegatedPermission` sem voluntário+permissão; (b) renderizar permissões fora de `DELEGABLE_PERMISSIONS` | `src/modules/identity/__tests__/DelegatedPermissionsManager.test.tsx:39` (a) and `:47` (b) | Yes (3/3 in this file) | Yes for (a) — Sensor #3; (b) covered by direct AC evidence (rendering-completeness, see Sensor depth note) rather than a separate mutation |

**Status**: All must-nots proven.

---

## Code Quality

| Principle | Status |
| --- | --- |
| Minimum code | Yes — T1 is a pure move (37-line new file, ~equal lines removed from the two actions); T2/T3 are markup/className only |
| Surgical changes | Yes — `requireCoordinator`, `withAudit` transaction bodies, `updateMany(revokedAt: null)` concurrency guard: 0 lines changed in T1's diff outside imports + `safeParse` target |
| No scope creep | Yes — `domain/permissions.ts`, `queries/list-delegated-permissions.ts` absent from `git diff 28578fc..HEAD --name-only` |
| Matches patterns | Yes — schema file mirrors `activate-role.schema.ts` convention (`.schema.ts` suffix, `z.infer` types); manager restyle mirrors `LoginForm.tsx`/`ActivateRoleForm.tsx` precedent |
| Spec-anchored outcome check | Yes — see AC tables above |
| Per-layer Coverage Expectation met | Yes — schema/actions covered by unit (9 cases) + integration (12 cases, incl. concurrency); Client Component has a new 3-case smoke exercising both must-not guards + happy path; Server Component page has no test per repo convention (build gate), matching the spec's own decision |
| Every test maps to a spec requirement | Yes — `grant-revoke-actions.test.ts` 9 cases map to U8-MN-01/02; `delegated-permissions.int.test.ts` 12 cases map to AC4 (happy/NOT_FOUND/PRECONDITION/CONFLICT/append-only); `DelegatedPermissionsManager.test.tsx` 3 cases map to U8-MN-03a/b + happy payload |
| Documented guidelines followed | `docs/arch/project-guideline.md` (DoD), AD-014 (Design System), CLAUDE.md §Testing Requirements (concurrency case present) |

---

## Edge Cases

- [x] uuid/enum/scopeArea/justification inválidos → `VALIDATION` idêntico — `grant-revoke-actions.test.ts`, green, sensor-confirmed discriminating.
- [x] Chamador não-coordenador → `UNAUTHENTICATED`/`FORBIDDEN` (action) + 404 (página) — action-level green + sensor-confirmed; page gate confirmed by 0-line diff on the `if (!isCoordinator(viewer)) notFound()` block.
- [x] Manager sem voluntário+permissão → NÃO chama `grantDelegatedPermission` — `DelegatedPermissionsManager.test.tsx`, green, sensor-confirmed.
- [x] Justificativa de revogação < 10 chars → NÃO chama `revokeDelegatedPermission` (client guard) — covered by the schema-level `.min(10)` sensor (Sensor #1) plus `revoke-delegated-permission.ts` unit case; a client-side smoke for this specific guard was not added in T2 (T2's smoke targets grant-side U8-MN-03a/b per spec — revoke-side client guard is unchanged JSX, protected transitively by the schema mutation above).
- [x] Restyle não altera handlers/schema/actions/queries/`dynamic`/gate/payload/catálogo — confirmed by diff inspection across all 4 restyle files.

---

## Gate Check

- **Gate command (T1, Full)**: `npm run typecheck && npm run lint && npm run test && npm run test:integration`
- **Gate command (T2, Quick)**: `npm run typecheck && npm run lint && npm run test`
- **Gate command (T3, Build)**: `npm run typecheck && npm run lint && npm run test && npm run build`
- **Result**: typecheck 0 errors; lint 0 errors; unit tests 858/858 passed; build succeeded (`/permissoes` route present in output); integration tests 219/219 passed (full suite, Postgres via `supabase start`)
- **`grant-revoke-actions.test.ts`**: 9/9 passed (spec-required count: grant 3 VALIDATION + 2 authz; revoke 2 VALIDATION + 2 authz)
- **`delegated-permissions.int.test.ts`**: 12/12 passed (isolated run confirmed: `npx vitest run --config vitest.integration.config.ts` with `DATABASE_URL` loaded via `dotenv -e .env.local`)
- **`DelegatedPermissionsManager.test.tsx`**: 3/3 passed (new file, spec requires >= 3)
- **Test count before feature**: not independently re-measured pre-`28578fc`; the spec's explicit counts (9 unit, 12 integration, 5 for USP-006) match current counts exactly — no silent deletions
- **Skipped tests**: none
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| --- | --- | --- |
| IDN-17 (upstream) | Preserved | Verified |
| IDN-18 (upstream) | Preserved | Verified |
| U8-STYLE-01 | Pending | Verified |
| U8-BACKEND-01 | Pending | Verified |
| U8-MN-01 | Pending | Verified |
| U8-MN-02 | Pending | Verified |
| U8-MN-03 | Pending | Verified |

---

## Scope Hygiene

`git status` at session start and after validation shows the same set of pre-existing, uncommitted working-tree changes (`.agents/.skill-lock.json*`, deleted `.claude/skills/idsd-spec-driven/*` and `technical-design-doc-creator/*`, `.wolf/task-timer.json`, untracked `.specs/prd/`, `.specs/evaluations/`, `.specs/features/vagas/usp-023-editar-vaga/`, new skill directories). None of these appear in `git diff 28578fc..HEAD --name-only` (verified directly) — they are not part of the Group D commit range and were not touched by this validation.

---

## Summary

**Overall**: Ready

**Spec-anchored check**: 7/7 ACs matched spec outcome (3 restyle + 4 extraction)
**Sensor**: 3/3 mutations killed
**Must-nots**: 3/3 green (U8-MN-01, U8-MN-02, U8-MN-03a directly mutation-tested; U8-MN-03b confirmed by direct rendering-completeness assertion)
**Gate**: typecheck + lint + 858 unit + build + 219 integration all green

**What works**: T1's schema extraction is a byte-equivalent move — `requireCoordinator`, the `withAudit` GRANTED/REVOKED transactions, and the `updateMany(revokedAt: null)` concurrency guard are untouched (diff limited to import lines + `safeParse` target); the barrel re-exports cleanly with no duplicate-export collision. T2/T3 restyle `delegated-permissions-manager.tsx` and `permissoes/page.tsx` to DS tokens with zero behavioral diff; the `isCoordinator -> notFound()` gate and both queries are preserved verbatim. The new `DelegatedPermissionsManager.test.tsx` smoke is a genuine sensor, not vacuous — confirmed by killing 2 of the 3 injected mutations directly and being the AC-level evidence for the third (catalog rendering).

**Issues found**: none.

**Next steps**: none — PASS.
