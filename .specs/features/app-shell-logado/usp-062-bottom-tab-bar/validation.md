# USP-062 — Bottom Tab Bar Validation

**Date**: 2026-07-22
**Spec**: `.specs/features/app-shell-logado/usp-062-bottom-tab-bar/spec.md`
**Diff range**: `fb4cbbf..35dbc1a` (unit: 2c5e2d0, 1171943, 11b8ff2, 8fcbfdb, 9d0d002, 35dbc1a)
**Verifier**: independent sub-agent (author ≠ verifier)

> Executed as one combined unit with USP-063 (shared `pickActiveHref` foundation
> and the single `(app)/layout.tsx` composition-root edit). This report covers
> the BNAV-* requirement surface; see the sibling `usp-063-menu-desktop/validation.md`
> for the DNAV-* surface. The gate run, sensor mutations, and PASS verdict are
> shared/identical across both reports since they validate the same commit range.

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1: `pickActiveHref` | ✅ Done | `src/modules/identity/domain/app-nav.ts:19-29`, exported from barrel |
| T2: `selectPrimaryTabs` + `BOTTOM_TAB_SHORT_LABELS` | ✅ Done | `app-nav.ts:42-87` |
| T3: `nav-icons.tsx` registry | ✅ Done | 11 mapped hrefs + fallback |
| T4: `AppBottomNav` | ✅ Done | `app-bottom-nav.tsx` |
| T6: layout wiring (shared with T5/USP-063) | ✅ Done | `(app)/layout.tsx:29-46` |

---

## Spec-Anchored Acceptance Criteria

### P1: Bottom tab bar role-aware em mobile/tablet

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | --------------------- | ------------------------ | ------ |
| BNAV-01: renderiza `nav` fixo landmark em `< md` | `<nav aria-label="Navegação principal">` presente, `md:hidden` | `app-bottom-nav.test.tsx:52-55` — `getByRole('navigation', {name:'Navegação principal'})`; `app-bottom-nav.tsx:42-48` | ✅ PASS |
| BNAV-02: Início+Perfil fixos + 1º link/grupo, ≤5 abas | exatamente `[Início,Perfil]` p/ zero papéis; 4 abas p/ candidate+moderation, nunca >5 | `app-nav.test.ts:78-108` — `toEqual([...])` / `toHaveLength(4)` (valores exatos, não só presença) | ✅ PASS |
| BNAV-03: active-state longest-match, ≤1 ativa | aba cujo href é o candidato mais longo recebe `aria-current="page"`; as demais, sem o atributo | `app-bottom-nav.test.tsx:65-79` — `toHaveAttribute('aria-current','page')` + `not.toHaveAttribute` nas demais (2 casos: match e no-match) | ✅ PASS |
| BNAV-04: ícone SVG inline + rótulo curto; fallback sem crash | `<svg aria-hidden>` por aba; href desconhecido → ícone sem `<path>` (fallback), sem lançar | `nav-icons.test.tsx:26-43` — svg presente, fallback `circle[r="7"]` distinto dos ícones mapeados | ✅ PASS |
| BNAV-05: oculta em `≥ md`; spacer reserva espaço | `nav.className` contém `md:hidden`; spacer `aria-hidden h-16 md:hidden` antes do `<nav>` | `app-bottom-nav.test.tsx:83-91` — `toMatch(/\bmd:hidden\b/)` no `<nav>` e no spacer | ✅ PASS |

### P1: `selectPrimaryTabs`

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | --------------------- | ------------------------ | ------ |
| BNAV-06: subconjunto primário determinístico, rótulo curto | ordem exata `[Início,Perfil,...]`; mesma combinação → mesma lista | `app-nav.test.ts:78-123` — `toEqual` de arrays exatos + `ordem determinística` (2 chamadas iguais) | ✅ PASS |
| BNAV-07: papel ausente → aba omitida | `hrefs` não contém o 1º link do grupo ausente | `app-nav.test.ts:110-116` — `not.toContain('/prestador/servicos')` etc. | ✅ PASS |

**Status**: ✅ All ACs covered (7/7), 0 spec-precision gaps — todas as ACs têm valor exato de spec testado, não apenas presença de asserção.

---

## Discrimination Sensor

Executado em scratch (edição direta na working tree, gate rodado, mutação descartada via `git checkout --`; diff pós-run idêntico ao original — confirmado por `git diff --stat`).

| # | File:line | Description | Killed? |
| - | --------- | ------------ | ------- |
| 1 | `src/modules/identity/domain/app-nav.ts:24` | `pickActiveHref`: flip `href.length > best.length` → `<` (inverte longest-match) | ✅ Killed — 3 testes falharam em `app-nav.test.ts` (aninhado, múltiplos candidatos) |
| 2 | `src/modules/identity/domain/app-nav.ts:77` | `selectPrimaryTabs`: remove o `if (group.title === 'Minha conta') continue` | ✅ Killed — 4 testes falharam (contagem de abas: zero-papéis, combinado 4-abas) |
| 3 | `src/app/(app)/_components/app-bottom-nav.tsx:42` | Injeta `<Link href="/admin-secreto">` incondicional (fora da allowlist) | ✅ Killed — BNAV-MN-01 negativo falhou (`app-bottom-nav.test.tsx`) |
| 4 | `src/app/(app)/_components/nav-icons.tsx:1` | Importa `@/shared/lib/prisma` no registry de ícones | ✅ Killed — guard `app-shell-no-auth-pii.test.ts` (padrão `Prisma`) |
| 5 | `src/app/(app)/_components/app-desktop-menu.tsx:47` | `style={{color:'#123456'}}` (hex cru) — guard MN-04 compartilhado | ✅ Killed — `app-shell-uses-tokens.test.ts` (padrão hex) — cobre BNAV-MN-04 também (mesmo guard, diretório) |
| 6 | `src/app/(app)/layout.tsx:33` | Composition-root: `moderation: true` hardcoded, ignora `canAccessModerationQueue(person)` | ✅ Killed — 2 testes falharam em `layout.test.tsx` (negativo BNAV-MN-02/DNAV-MN-02 + asserção de chamada do guard) |
| 7 (deviation probe) | `app-bottom-nav.tsx:16` | Substituído o import direto por import via barrel `@/modules/identity` (reversão do SPEC_DEVIATION) | ✅ `next build` falha com o erro exato citado (`next/headers` não suportado fora de Server Component) — confirma que o workaround é necessário, não cosmético |

**Sensor depth**: lightweight, 7 mutações (feature com múltiplos must-nots — cobertura estendida por §6b)
**Result**: 7/7 killed — PASS ✅ (mutação #7 é uma prova do SPEC_DEVIATION, não um teste de regressão de comportamento; incluída por relevância)

---

## Must-Not Verification

| ID | SHALL NOT… | Negative test (`file:line` + assertion) | Green? | Guard mutation killed? |
| -- | ----------- | ----------------------------------------- | ------ | ------------------------ |
| BNAV-MN-01 | Aba com `href ∉ (EXISTING_HUB_ROUTES ∪ {/inicio})` | `app-nav.test.ts:125-133` (2^9 combos) + `app-bottom-nav.test.tsx:94-106` (render) | ✅ | ✅ (mutação #3) |
| BNAV-MN-02 | Aba de área sem permissão | `app-nav.test.ts:135-144` (candidate-only) + `app-bottom-nav.test.tsx:108-119` + `layout.test.tsx:132-147` (composição) | ✅ | ✅ (mutação #6) |
| BNAV-MN-03 | Import de `prisma`/sessão/View Model/Server Action/`'use server'` em `(app)/_components/**` | `src/shared/__tests__/app-shell-no-auth-pii.test.ts:53-56,64-70` (varredura + asserção explícita de `app-bottom-nav.tsx`/`nav-icons.tsx` no conjunto) | ✅ | ✅ (mutação #4) |
| BNAV-MN-04 | hex cru / paleta fixa / CDN externa / lib de ícone/estado | `src/shared/__tests__/app-shell-uses-tokens.test.ts:52-56,63-109` (varredura + asserção explícita) | ✅ | ✅ (mutação #5) |

**Status**: ✅ All 4 BNAV must-nots proven — evidence-or-zero satisfied, cada um com mutação de guard confirmada.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code (nenhuma feature além do pedido) | ✅ |
| Sem abstrações de uso único | ✅ — `app-nav.ts` é o único arquivo com os 2 helpers coesos, sem indireção extra |
| Sem "flexibilidade" desnecessária | ✅ |
| Só tocou arquivos necessários à task | ✅ — diff scoped a `(app)/_components/**`, `identity/domain/app-nav.ts`, barrel, `(app)/layout.tsx`, guards | 
| Não "melhorou" código não relacionado | ✅ |
| Casa com padrões existentes | ✅ — molde `PublicNav` (SVG inline, disclosure), molde `hub-links.test.ts` (2^9 combos) |
| Aprovaria um engenheiro sênior? | ✅ |
| Testes mapeiam às ACs, não-superficiais | ✅ — spot-check P1 acima; valores exatos testados, não presença |
| Spec-anchored outcome check | ✅ — ver tabela acima, 0 gaps |
| Coverage por camada (domain 1:1; RTL happy+edge+negativo) | ✅ |
| Todo teste mapeia a uma AC/edge/Done-when (sem teste órfão) | ✅ |
| Guideline seguido | CLAUDE.md (padrões de módulo/barrel), `docs/arch/project-guideline.md` §17/18 |

---

## Edge Cases

- [x] Zero papéis → exatamente 2 abas (Início, Perfil) — `app-nav.test.ts:78-84`
- [x] Público + institucional → 4 abas, nunca >5 — `app-nav.test.ts:104-108`
- [x] `pathname` sem correspondência → nenhuma aba ativa — `app-bottom-nav.test.tsx:73-79`
- [x] href sem ícone mapeado → fallback, sem crash — `nav-icons.test.tsx:35-43`
- [x] `min-h-screen` + spacer — `app-bottom-nav.test.tsx:82-91` (spacer presente, `md:hidden`)

---

## Gate Check

- **Gate command**: `npm run typecheck && npm run lint && npm run test && npm run build`
- **Result**: typecheck ✅ 0 errors · lint ✅ 0 errors · test 294 files / 2093 tests, **all passed, 0 failed, 0 skipped** · build ✅ (todas as rotas `(app)/*` `ƒ` dynamic)
- **Test count before feature** (baseline `fb4cbbf`): 2093 − 70 (novos desta unidade, ver diff --stat de arquivos `*.test.*`) = 2023
- **Test count after feature**: 2093
- **Delta**: +70 new tests (7 arquivos de teste: novos + `layout.test.tsx` estendido), 0 deletados/enfraquecidos
- **Skipped tests**: none
- **Failures**: none

---

## Requirement Traceability Update

| Requirement ID | Previous Status | New Status |
| --------------- | ---------------- | ----------- |
| BNAV-01 | Pending | ✅ Verified |
| BNAV-02 | Pending | ✅ Verified |
| BNAV-03 | Pending | ✅ Verified |
| BNAV-04 | Pending | ✅ Verified |
| BNAV-05 | Pending | ✅ Verified |
| BNAV-06 | Pending | ✅ Verified |
| BNAV-07 | Pending | ✅ Verified |
| BNAV-MN-01 | Pending | ✅ Verified |
| BNAV-MN-02 | Pending | ✅ Verified |
| BNAV-MN-03 | Pending | ✅ Verified |
| BNAV-MN-04 | Pending | ✅ Verified |

---

## SPEC_DEVIATION Review (shared with USP-063)

**Claim** (commit `35dbc1a`, also in `app-bottom-nav.tsx`/`app-desktop-menu.tsx`): Client Components import
`pickActiveHref`/`buildHubLinks`/`HubLinkGroup` directly from `@/modules/identity/domain/app-nav` and
`domain/hub-links` instead of the barrel `@/modules/identity`, with `eslint-disable-next-line no-restricted-imports`.

**Verification performed**:
1. Read `src/modules/identity/index.ts` — confirmed it re-exports `requireActivePerson`/`getCurrentPerson`
   from `./server/session` (which imports `next/headers` via `createSupabaseServerClient` and `prisma`),
   plus multiple `'use server'` actions.
2. Read `src/modules/persons/components/candidate-form.tsx:8-15` — confirmed the cited precedent is real
   and structurally identical (Client Component, same `no-restricted-imports` disable, same rationale).
3. Confirmed both directly-imported files (`domain/app-nav.ts`, `domain/hub-links.ts`) have **zero IO** —
   `app-nav.ts` imports only a type from `./hub-links`; `hub-links.ts` has no imports at all. Neither
   re-exports anything server-only.
4. **Empirical proof** (mutation #7 above): reverting the deviation to import via the barrel in
   `app-bottom-nav.tsx` makes `next build` fail with exactly the cited error
   ("You're importing a component that needs next/headers... not supported in the pages/ directory"),
   tracing through `@/modules/identity` → `server/session.ts` → `@/shared/lib/supabase/server.ts`.

**Verdict**: Legitimate, necessary workaround — not a cosmetic bypass. It does not introduce coupling beyond
what already exists in the repo (same exception class as `candidate-form.tsx`), and the imported modules are
pure (no leakage risk). No fix task needed.

---

## Fix Plans

None — no issues found.

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 7/7 BNAV ACs matched spec-defined outcome, 0 spec-precision gaps
**Sensor**: 7/7 mutations killed (6 behavioral + 1 deviation-necessity probe)
**Must-nots**: 4/4 BNAV must-nots green, each with a guard-mutation kill
**Gate**: typecheck/lint/test(2093)/build all green

**What works**: Bottom tab bar renders role-aware primary tabs (≤5, never empty), correct longest-match
active-state, SVG icon registry with safe fallback, hides at `≥ md` with a spacer that reserves space,
zero design-system drift, zero PII/session leakage into the presentational layer.

**Issues found**: none

**Next steps**: none — unit ready to proceed (shared verdict with USP-063, see sibling report).
