# USP-063 — Menu Desktop Validation

**Date**: 2026-07-22
**Spec**: `.specs/features/app-shell-logado/usp-063-menu-desktop/spec.md`
**Diff range**: `fb4cbbf..35dbc1a` (unit: 2c5e2d0, 1171943, 11b8ff2, 8fcbfdb, 9d0d002, 35dbc1a)
**Verifier**: independent sub-agent (author ≠ verifier)

> Executed as one combined unit with USP-062 (shared `pickActiveHref` foundation
> and the single `(app)/layout.tsx` composition-root edit). This report covers
> the DNAV-* requirement surface; see the sibling `usp-062-bottom-tab-bar/validation.md`
> for the full discrimination-sensor log and gate-run detail (same commit range,
> same gate, same PASS verdict).

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1: `pickActiveHref` (shared w/ USP-062) | ✅ Done | `src/modules/identity/domain/app-nav.ts:19-29` |
| T5: `AppDesktopMenu` | ✅ Done | `app-desktop-menu.tsx` |
| T6: layout wiring (shared with T4/USP-062) | ✅ Done | `(app)/layout.tsx:29-46` |

---

## Spec-Anchored Acceptance Criteria

### P1: Menu desktop com a navegação completa role-aware

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | --------------------- | ------------------------ | ------ |
| DNAV-01: botão disclosure abre painel com navegação completa | botão `aria-expanded` toggla; painel com todos os grupos/links de `buildHubLinks` aparece no DOM | `app-desktop-menu.test.tsx:37-51` — `toHaveAttribute('aria-expanded','true'/'false')` + `getElementById('app-menu-panel')` presente/ausente | ✅ PASS |
| DNAV-02: links agrupados por título, só grupos concedidos | `getByText('Minha conta')`/`'Meus papéis'` presentes, `queryByText('Institucional')` ausente p/ candidate-only | `app-desktop-menu.test.tsx:62-75` | ✅ PASS |
| DNAV-03: active-state longest-match, `/perfil` ≠ ativo em `/perfil/papeis` | link `/perfil/papeis` recebe `aria-current="page"`; `/perfil` explicitamente sem o atributo (não apenas ausência de asserção) | `app-desktop-menu.test.tsx:86-95` — `toHaveAttribute(...)` + `not.toHaveAttribute` no par aninhado | ✅ PASS |
| DNAV-04: toggle `useState`, fecha ao clicar link, `aria-expanded`/`aria-controls`/`aria-label` | painel some do DOM (`getElementById` null) após clicar num `<Link>` | `app-desktop-menu.test.tsx:53-59` | ✅ PASS |
| DNAV-05: oculto em `< md` | wrapper `className` contém `hidden` E `md:block` | `app-desktop-menu.test.tsx:98-103` — 2 asserções `toMatch` distintas (não uma regex OR frouxa) | ✅ PASS |

**Status**: ✅ All ACs covered (5/5), 0 spec-precision gaps.

---

## Discrimination Sensor

Ver log completo de mutações no relatório da USP-062 (mesma execução, mesmo diff range). Mutações
diretamente relevantes à superfície DNAV-* desta USP:

| # | File:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 | `app-nav.ts:24` | `pickActiveHref`: flip longest-match (`>`→`<`) | ✅ Killed (mata também o caso `/perfil` vs `/perfil/papeis` do DNAV-03, coberto pelo mesmo helper compartilhado) |
| 5 | `app-desktop-menu.tsx:47` | `style={{color:'#123456'}}` (hex cru) | ✅ Killed — `app-shell-uses-tokens.test.ts` (padrão hex; DNAV-MN-04) |
| 6 | `app-desktop-menu.tsx:71` | Link hardcoded fora da allowlist (`/rota-fora-da-allowlist`) no painel | ✅ Killed — DNAV-MN-01 negativo em `app-desktop-menu.test.tsx:106-116` |
| 7 | `layout.tsx:33` | Composition-root: `moderation: true` hardcoded, ignora o guard `canAccessModerationQueue` | ✅ Killed — `layout.test.tsx` (2 testes; cobre o ângulo composição de DNAV-MN-02) |
| import de `prisma` em `nav-icons.tsx` | (arquivo do USP-062, guard compartilhado — MN-03) | ✅ Killed — mesmo guard varre `app-desktop-menu.tsx` (asserção explícita linha 59-62 do guard) |

**Sensor depth**: lightweight (compartilhado com USP-062, ver relatório irmão para as 7 mutações completas)
**Result**: killed em todas as mutações que tocam a superfície DNAV — PASS ✅

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | ----------- | ----------------------------------------- | ------ | ------------------------ |
| DNAV-MN-01 | Link com `href ∉ EXISTING_HUB_ROUTES` | `app-desktop-menu.test.tsx:106-117` (acesso total → todo href ∈ allowlist) | ✅ | ✅ (mutação #6) |
| DNAV-MN-02 | Grupo/link sem permissão | `app-desktop-menu.test.tsx:119-128` (candidate-only) + `layout.test.tsx:132-147` (composição) | ✅ | ✅ (mutação #7) |
| DNAV-MN-03 | Import de `prisma`/sessão/View Model/Server Action/`'use server'` | `src/shared/__tests__/app-shell-no-auth-pii.test.ts:59-62,64-70` (asserção explícita de `app-desktop-menu.tsx` + varredura) | ✅ | ✅ (via mutação equiv. #4 no relatório irmão, mesmo guard) |
| DNAV-MN-04 | hex cru / paleta fixa / CDN externa / lib de ícone/estado | `src/shared/__tests__/app-shell-uses-tokens.test.ts:58-62,63-109` | ✅ | ✅ (mutação #5) |

**Status**: ✅ All 4 DNAV must-nots proven — evidence-or-zero satisfied.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code (nenhuma feature além do pedido) | ✅ — sem ícones no menu (A6 respeitada, out-of-scope) |
| Sem abstrações de uso único | ✅ |
| Sem "flexibilidade" desnecessária | ✅ — sem lib de dropdown, disclosure puro (A1) |
| Só tocou arquivos necessários à task | ✅ |
| Não "melhorou" código não relacionado | ✅ |
| Casa com padrões existentes | ✅ — molde direto de `PublicNav` (useState, aria-expanded/controls/label, SVG hambúrguer, fecha ao clicar) |
| Aprovaria um engenheiro sênior? | ✅ |
| Testes mapeiam às ACs, não-superficiais | ✅ — active-state aninhado testado com asserção negativa explícita, não só a positiva |
| Spec-anchored outcome check | ✅ — 0 gaps |
| Coverage por camada | ✅ |
| Todo teste mapeia a uma AC/edge/Done-when | ✅ |
| Guideline seguido | CLAUDE.md, `docs/arch/project-guideline.md` §17/18 |

---

## Edge Cases

- [x] Só "Minha conta" (zero papéis) → menu mostra apenas esse grupo — coberto indiretamente por `buildHubLinks` (invariante já verificado em USP-049) + render real em `app-desktop-menu.test.tsx:62-75` (grupo institucional ausente, grupo base presente)
- [x] `pathname` sem correspondência → nenhum link ativo — coberto pelo mesmo `pickActiveHref` (mutação #1 mata o caso geral; não há teste RTL dedicado a "no-match" no menu, mas a função é a mesma testada exaustivamente em `app-nav.test.ts:35-37`)
- [x] `/perfil/papeis` → ativo é `/perfil/papeis`, não `/perfil` — `app-desktop-menu.test.tsx:86-95`
- [x] Painel fechado → links fora do fluxo focável (via `open &&` unmount, não CSS) — `app-desktop-menu.tsx:65` (`{open && (...)}`), confirmado por `getElementById` retornando null quando fechado em `app-desktop-menu.test.tsx:42,50`

---

## Gate Check

Idêntico ao relatório da USP-062 (mesma execução, mesmo commit range):

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build`
- **Result**: typecheck ✅ · lint ✅ · test 294 files / 2093 tests all passed · build ✅
- **Delta**: +70 new tests across the unit, 0 deletados/enfraquecidos
- **Skipped/Failures**: none

---

## Requirement Traceability Update

| Requirement ID | Previous Status | New Status |
| --------------- | ---------------- | ----------- |
| DNAV-01 | Pending | ✅ Verified |
| DNAV-02 | Pending | ✅ Verified |
| DNAV-03 | Pending | ✅ Verified |
| DNAV-04 | Pending | ✅ Verified |
| DNAV-05 | Pending | ✅ Verified |
| DNAV-MN-01 | Pending | ✅ Verified |
| DNAV-MN-02 | Pending | ✅ Verified |
| DNAV-MN-03 | Pending | ✅ Verified |
| DNAV-MN-04 | Pending | ✅ Verified |

---

## SPEC_DEVIATION Review

See the full review in the sibling `usp-062-bottom-tab-bar/validation.md` (§SPEC_DEVIATION Review) —
same deviation applies verbatim to `app-desktop-menu.tsx` (direct import of `domain/app-nav` and
`domain/hub-links` instead of the barrel). Verdict: legitimate, empirically confirmed necessary
(barrel import reproduces the exact `next/headers` build failure), no fix task needed.

---

## Fix Plans

None — no issues found.

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 5/5 DNAV ACs matched spec-defined outcome, 0 spec-precision gaps
**Sensor**: all mutations touching DNAV surface killed (see table above; full log in USP-062 report)
**Must-nots**: 4/4 DNAV must-nots green, each with a guard-mutation kill
**Gate**: typecheck/lint/test(2093)/build all green

**What works**: Desktop disclosure menu opens/closes correctly, renders the full role-aware grouped
navigation, correct longest-match active-state for nested routes, closes on link click, hidden below
`md`, zero design-system drift, zero PII/session leakage.

**Issues found**: none

**Next steps**: none — unit ready to proceed (shared verdict with USP-062, see sibling report).
