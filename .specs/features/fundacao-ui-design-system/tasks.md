# Fundação de Design System da Fase 1 — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implemente estas tarefas com a skill de execução spec-driven: **ative-a pelo nome** —
`bravi-spec-driven` (ou `idsd-spec-driven`, o consumidor do pipeline) — e siga seu fluxo Execute e as
Critical Rules. Não procure arquivos de skill por caminho de filesystem. A skill é a fonte da verdade do
fluxo (ciclo por tarefa, delegação a sub-agentes, revisão de adequação, Verifier, sensor de discriminação).

**Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

---

**Design**: `.specs/features/fundacao-ui-design-system/design.md`
**Status**: Draft

> **Entry Gate (§0):** re-lidas as Assumptions & Open Questions do spec. Todos os itens têm
> `owner = agent` e `Confirmed? = y` (as duas decisões de produto governantes já foram fixadas pelo dono;
> nenhuma pende de terceiro). Blockers ativos B-001..B-004 são gates de **go-live** de outras USPs, sem
> relação com esta unidade. **Nenhum item externo pendente → o gate está aberto; a unidade entra em
> breakdown.**

---

## Test Coverage Matrix

> Gerada do codebase + guidelines + spec. Guidelines encontradas: `CLAUDE.md` (§Testing Requirements),
> `docs/arch/project-guideline.md` (DoD), `vitest.config.ts` (coverage include=`src/shared/**/*.ts` +
> `src/modules/**/*.ts`; `.tsx` de UI/página **fora** do gate de cobertura por design do repo).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Primitivo de UI (`.tsx`) em `src/shared/ui/` | unit (RTL) | Render + cada variante/prop + forward de `ref`/props + render sob `data-theme="dark"`; 1:1 aos ACs do primitivo. Fora do gate de cobertura, mas roda na suíte. | `src/shared/ui/__tests__/*.test.tsx` | `npm run test` |
| Util (`.ts`) `cn` | unit | Merge + dedup de classes conflitantes; entra no gate de cobertura (`.ts` em `shared/`). | `src/shared/ui/__tests__/cn.test.ts` | `npm run test` |
| Guarda estática de must-not (`.ts`) | unit (`node:fs`) | Assevera que o resultado proibido NÃO ocorre (scan de arquivos). | `src/shared/__tests__/ds-*.test.ts` | `npm run test` |
| Config/tokens (`globals.css`, `tailwind.config.ts`, `layout.tsx`) | none (build gate) + guarda de arquivo | Build compila; guardas cobrem os must-nots associados. | — | `npm run build` (+ guardas) |
| Tela de paridade (`login/page.tsx` + `LoginForm.tsx`) | unit (RTL) | Render dos primitivos + preservação de labels/erros/ação + guarda de paleta crua. | `src/app/(auth)/login/page.test.tsx` | `npm run test` + `npm run build` |

## Parallelism Assessment

> Gerada do codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| RTL de componente (jsdom) | Yes | Render por teste, sem store compartilhado; cleanup do RTL. | `vitest.setup.ts`, `src/app/(auth)/redefinir-senha/page.test.tsx` |
| Guarda estática (`node:fs`, read-only) | Yes | Só leitura de arquivos; sem estado mutável. | `src/shared/__tests__/closed-src-root.test.ts` |
| Build / typecheck / lint | No (processo único) | — | `package.json` scripts |

## Gate Check Commands

> Gerada do codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tarefas com unit/RTL/guarda | `npm run test` |
| Full | Após tarefas com typecheck relevante (esta unidade não tem integração DB) | `npm run typecheck && npm run test` |
| Build | Após config/tokens/fonte, fim de fase, e na tela de paridade | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Fundação de tokens/config (Sequential)

Build-critical; cada gate assenta sobre o anterior.

```
T1 → T2 → T3
```

### Phase 2: Primitivos (Parallel OK)

Após T3, cada primitivo é independente (só depende de `cn`=T1 e tokens=T2). RTL é parallel-safe → `[P]`.

```
        ┌→ T4  [P]
        ├→ T5  [P]
        ├→ T6  [P]
T2,T1 ──┼→ T7  [P]
        ├→ T8  [P]
        ├→ T9  [P]
        ├→ T10 [P]
        └→ T11 [P]
```

### Phase 3: Barrel + guarda de token (Sequential)

```
T3,T4,T5,T6,T7,T8,T9,T10,T11 → T12
```

### Phase 4: Prova de paridade (Sequential)

```
T12, T3 → T13
```

---

## Task Breakdown

### T1: Deps do design system + util `cn` + guarda de deps proibidas

**What**: Adicionar o allowlist mínimo shadcn e criar o helper `cn`; guardar contra libs proibidas.
**Where**: `package.json`; `src/shared/ui/cn.ts`; `src/shared/ui/__tests__/cn.test.ts`; `src/shared/__tests__/ds-no-forbidden-deps.test.ts`
**Depends on**: None
**Reuses**: padrão de guarda `src/shared/__tests__/closed-src-root.test.ts`
**Requirement**: DS-05 (parcial), DS-MN-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `package.json` inclui **apenas** `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, `@radix-ui/react-label` (deps novas); `npm install` roda.
- [ ] `cn(...inputs)` mescla via `clsx`+`twMerge`; teste cobre dedup de classes conflitantes (ex.: `cn('p-2','p-4') === 'p-4'`).
- [ ] Guarda `ds-no-forbidden-deps` FALHA se `package.json` contiver Redux/MobX/Zustand/Jotai, CSS-in-JS runtime (`styled-components`/`@emotion/*`), `next-themes` ou lib de data ≠ date-fns; verde no estado atual (DS-MN-05).
- [ ] Gate passa: `npm run typecheck && npm run test`
- [ ] Test count: cn ≥3 asserts; guarda ≥1 teste

**Tests**: unit
**Gate**: full
**Commit**: `feat(infra): base do design system (deps shadcn + util cn + guarda de deps)`

---

### T2: Tokens de design em globals.css + mapeamento no Tailwind + guarda de mecanismo único de dark

**What**: Portar os tokens do protótipo (light + dark) para `globals.css` e mapeá-los no Tailwind;
remover o bloco `prefers-color-scheme` legado.
**Where**: `src/app/globals.css`; `tailwind.config.ts`; `src/shared/__tests__/ds-tokens.test.ts`; `src/shared/__tests__/ds-single-dark-mechanism.test.ts`
**Depends on**: T1
**Reuses**: valores verbatim de `docs/prototipo/index.html` L12-58; padrão de guarda `node:fs`
**Requirement**: DS-01, DS-02, DS-03, DS-04, DS-MN-04

**Tools**:
- MCP: `context7` (Tailwind v3.4 `darkMode` selector / `theme.extend`)
- Skill: NONE

**Done when**:
- [ ] `globals.css` declara em `:root` todos os `--color-*`, `--space-*`, `--radius-*`, `--shadow-*` com os valores do protótipo, e o bloco `[data-theme="dark"]` com os overrides dark (DS-01/DS-02).
- [ ] O bloco `@media (prefers-color-scheme: dark)` legado e as vars genéricas `--background`/`--foreground` foram removidos (DS-MN-04).
- [ ] `tailwind.config.ts` mapeia `colors` (primary/secondary/cta{DEFAULT,hover}/background/surface/fg{DEFAULT,muted}/border/success/danger), `borderRadius` sm/md/lg/xl, `boxShadow` sm/md/lg/xl, `fontFamily` sans/heading, e `darkMode: ['selector','[data-theme="dark"]']` (DS-03/DS-04).
- [ ] Guarda `ds-tokens` confirma ≥8 pares token→valor light e ≥5 dark idênticos ao protótipo; guarda `ds-single-dark-mechanism` FALHA se `globals.css` reintroduzir `prefers-color-scheme` sobre `--background/--foreground` (DS-MN-04).
- [ ] Gate passa: `npm run typecheck && npm run lint && npm run test && npm run build`
- [ ] Test count: tokens ≥2 testes; dark-mechanism ≥1 teste

**Tests**: unit
**Gate**: build
**Commit**: `feat(infra): tokens de design (globals.css + tailwind) e mecanismo único de dark`

---

### T3: Fontes auto-hospedadas (next/font) + ThemeScript anti-FOUC no layout + guarda anti-CDN de fonte

**What**: Carregar Nunito + DM Sans via `next/font/google`, aplicá-las no root layout e injetar o
script de inicialização de tema (anti-FOUC).
**Where**: `src/app/layout.tsx`; `src/shared/ui/theme-script.tsx`; `src/shared/ui/__tests__/theme-script.test.tsx`; `src/shared/__tests__/ds-no-external-fonts.test.ts`
**Depends on**: T2
**Reuses**: `src/app/layout.tsx` atual (`<html lang="pt-BR">`)
**Requirement**: DS-13, DS-16, DS-17, DS-MN-01

**Tools**:
- MCP: `context7` (`next/font/google` no Next 15: `variable`, `subsets`, `weight`)
- Skill: NONE

**Done when**:
- [ ] `layout.tsx` importa `Nunito` e `DM_Sans` de `next/font/google` com `variable: '--font-nunito'`/`'--font-dm-sans'`, `subsets:['latin']`, `display:'swap'`, pesos do protótipo; classes `.variable` no `<html>`, `font-sans` no `<body>` (DS-16/DS-17).
- [ ] `<ThemeScript />` inline renderiza no `<head>`: seta `document.documentElement.dataset.theme` a partir de `localStorage.theme` ou `prefers-color-scheme` em try/catch (anti-FOUC, degrada sem `localStorage`) (DS-13, edge case).
- [ ] Guarda `ds-no-external-fonts` FALHA se `globals.css`/`layout.tsx`/repo referenciarem `fonts.googleapis.com`/`fonts.gstatic.com` via `<link>`/`@import`; verde no estado atual (DS-MN-01).
- [ ] Gate passa: `npm run typecheck && npm run lint && npm run test && npm run build`
- [ ] Test count: theme-script ≥2 (seta atributo; não quebra sem localStorage); guarda ≥1

**Tests**: unit
**Gate**: build
**Commit**: `feat(infra): fontes auto-hospedadas (next/font) + ThemeScript anti-FOUC`

---

### T4: Primitivo `Button` (cva variant/size + asChild) [P]

**What**: Botão com variantes mapeando `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-outline`/`.btn-sm`/`.btn-lg`.
**Where**: `src/shared/ui/button.tsx`; `src/shared/ui/__tests__/button.test.tsx`
**Depends on**: T1, T2
**Reuses**: `cn` (T1), `class-variance-authority`, `@radix-ui/react-slot`
**Requirement**: DS-06

**Tools**:
- MCP: `context7` (cva + Radix `Slot` `asChild`)
- Skill: NONE

**Done when**:
- [ ] `<Button variant size asChild? />` com `variant: primary|secondary|outline`, `size: sm|default|lg`; `primary`=CTA laranja com hover `cta-hover` (só classes token; sem hex/paleta crua).
- [ ] `asChild` renderiza o filho via `Slot` sem `<button>` extra; `ref`/props nativos encaminhados.
- [ ] RTL cobre cada variante+size, `asChild` com `<a>`, e render sob `data-theme="dark"`.
- [ ] Gate passa: `npm run test`
- [ ] Test count: ≥5 testes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): primitivo Button (cva + asChild)`

---

### T5: Primitivos `Input` / `Label` / `Textarea` (família input-group) [P]

**What**: Controles de formulário mapeando `.input-group input|label|textarea`.
**Where**: `src/shared/ui/input.tsx`, `label.tsx`, `textarea.tsx`; `src/shared/ui/__tests__/input.test.tsx`
**Depends on**: T1, T2
**Reuses**: `cn` (T1), `@radix-ui/react-label`
**Requirement**: DS-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `Input`/`Textarea` são `forwardRef` sobre os nativos (borda 1.5px `border-border`, `rounded-sm`, anel de foco `primary`); `Label` sobre `@radix-ui/react-label`.
- [ ] `ref` e props encaminhados (compatível com `react-hook-form register`); render sob dark OK.
- [ ] RTL confirma forward de `ref`, `htmlFor`/associação de `Label`, e classes de foco.
- [ ] Gate passa: `npm run test`
- [ ] Test count: ≥4 testes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): primitivos Input/Label/Textarea`

---

### T6: Primitivos `Card` / `FormCard` / `FormSectionTitle` [P]

**What**: Superfícies mapeando `.card`, `.form-card`, `.form-section-title`.
**Where**: `src/shared/ui/card.tsx`, `form-card.tsx`; `src/shared/ui/__tests__/card.test.tsx`
**Depends on**: T1, T2
**Reuses**: `cn` (T1)
**Requirement**: DS-11 (parcial)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `Card` (surface+border+`shadow-sm`, hover `shadow-md`); `FormCard` (surface, `rounded-lg`, `p-8`, `shadow-sm`); `FormSectionTitle` (`font-heading`, borda inferior) — só classes token.
- [ ] `className` extra mescla via `cn`; `children` renderizados; dark OK.
- [ ] RTL confirma estrutura + merge de `className`.
- [ ] Gate passa: `npm run test`
- [ ] Test count: ≥3 testes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): primitivos Card/FormCard/FormSectionTitle`

---

### T7: Primitivos `FormHeader` / `StepIcon` (cva blue/orange/green) [P]

**What**: Cabeçalho de formulário e ícone de passo mapeando `.form-header` e `.step-icon-*`.
**Where**: `src/shared/ui/form-header.tsx`, `step-icon.tsx`; `src/shared/ui/__tests__/form-header.test.tsx`
**Depends on**: T1, T2
**Reuses**: `cn` (T1), `class-variance-authority`
**Requirement**: DS-08, DS-11 (parcial)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `FormHeader title description?` (centralizado, h1 `font-heading`); `StepIcon variant=blue|orange|green` (cva; combinações light + variantes dark do protótipo).
- [ ] RTL cobre as 3 variantes de `StepIcon` (incl. dark) e o render de `FormHeader` com/sem `description`.
- [ ] Gate passa: `npm run test`
- [ ] Test count: ≥4 testes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): primitivos FormHeader/StepIcon`

---

### T8: Primitivo `FormRow` (grid responsivo) [P]

**What**: Grid de formulário mapeando `.form-row`/`.form-row-3` e o colapso mobile.
**Where**: `src/shared/ui/form-row.tsx`; `src/shared/ui/__tests__/form-row.test.tsx`
**Depends on**: T1, T2
**Reuses**: `cn` (T1)
**Requirement**: DS-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `FormRow cols?=2|3` → `grid-cols-1 md:grid-cols-{2|3}` com gap = espaço `md`.
- [ ] RTL confirma as classes de grid para cols=2 e cols=3.
- [ ] Gate passa: `npm run test`
- [ ] Test count: ≥2 testes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): primitivo FormRow`

---

### T9: Primitivos `LgpdBox` / `LgpdCheck` [P]

**What**: Caixa e checkbox de consentimento mapeando `.lgpd-box` e `.lgpd-check` (só estilo — semântica preservada).
**Where**: `src/shared/ui/lgpd-box.tsx`; `src/shared/ui/__tests__/lgpd-box.test.tsx`
**Depends on**: T1, T2
**Reuses**: `cn` (T1)
**Requirement**: DS-11 (parcial)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `LgpdBox title` (fundo `#F8FAFC`/dark `#1A2332` via token, borda, `rounded-md`); `LgpdCheck` (checkbox `accent-color` primário + label; props encaminhados ao input).
- [ ] RTL confirma render de `title`/`children`, associação do checkbox e forward de props.
- [ ] Gate passa: `npm run test`
- [ ] Test count: ≥3 testes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): primitivos LgpdBox/LgpdCheck`

---

### T10: Primitivo `Badge` (cva blue/orange/green/gray) [P]

**What**: Selo mapeando `.badge` + `.badge-*`.
**Where**: `src/shared/ui/badge.tsx`; `src/shared/ui/__tests__/badge.test.tsx`
**Depends on**: T1, T2
**Reuses**: `cn` (T1), `class-variance-authority`
**Requirement**: DS-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `Badge variant=blue|orange|green|gray` (cva; light + dark do protótipo) — só classes token.
- [ ] RTL cobre as 4 variantes (incl. dark).
- [ ] Gate passa: `npm run test`
- [ ] Test count: ≥4 testes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): primitivo Badge`

---

### T11: Primitivo `ThemeToggle` (React nativo + localStorage) [P]

**What**: Botão de alternância de tema mapeando `.theme-toggle`, sem lib de estado.
**Where**: `src/shared/ui/theme-toggle.tsx`; `src/shared/ui/__tests__/theme-toggle.test.tsx`
**Depends on**: T1, T2
**Reuses**: `cn` (T1); React nativo (`useState`/`useEffect`)
**Requirement**: DS-14, DS-15

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `'use client'`; ao clicar, alterna `document.documentElement.dataset.theme` e persiste em `localStorage`; ícone lua/sol via SVG inline (sem `lucide-react`).
- [ ] Degrada sem `localStorage` (try/catch) sem lançar (edge case).
- [ ] RTL confirma o toggle de `data-theme` e a escrita no `localStorage`.
- [ ] Gate passa: `npm run test`
- [ ] Test count: ≥3 testes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(infra): primitivo ThemeToggle (sem lib de estado)`

---

### T12: Barrel `index.ts` + guarda "primitivos só com token" (DS-MN-02)

**What**: Exportar todos os primitivos + `cn` por barrel e guardar contra hex/paleta crua em `src/shared/ui/**`.
**Where**: `src/shared/ui/index.ts`; `src/shared/__tests__/ds-ui-uses-tokens.test.ts`
**Depends on**: T3, T4, T5, T6, T7, T8, T9, T10, T11
**Reuses**: padrão de guarda `node:fs`; barris existentes (`@/modules/*`)
**Requirement**: DS-05, DS-12, DS-MN-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `index.ts` reexporta `Button, Input, Label, Textarea, Card, FormCard, FormSectionTitle, FormHeader, StepIcon, FormRow, LgpdBox, LgpdCheck, Badge, ThemeToggle, ThemeScript, cn`; `import { ... } from '@/shared/ui'` resolve (DS-05).
- [ ] Guarda `ds-ui-uses-tokens` FALHA se qualquer `.tsx` em `src/shared/ui/**` contiver hex cru (`#RRGGBB`) ou utilitário de paleta fixa (`bg-(blue|orange|slate|gray|red|green)-\d`, `text-(...)-\d`, `system-ui`); verde após os primitivos (DS-MN-02, DS-12).
- [ ] Gate passa: `npm run typecheck && npm run test`
- [ ] Test count: guarda ≥1 (varre todos os arquivos do dir)

**Tests**: unit
**Gate**: full
**Commit**: `feat(infra): barrel de src/shared/ui + guarda de uso de token`

---

### T13: Prova de paridade — restilizar a tela de login com os primitivos (DS-MN-03)

**What**: Migrar `login/page.tsx` + `LoginForm.tsx` para os primitivos/tokens/tema, preservando os
fluxos; guardar contra paleta crua remanescente.
**Where**: `src/app/(auth)/login/page.tsx`; `src/modules/identity/components/LoginForm.tsx`; `src/app/(auth)/login/page.test.tsx`; `src/shared/__tests__/ds-login-parity.test.ts`
**Depends on**: T12, T3
**Reuses**: primitivos (`@/shared/ui`); `LoginForm` atual (RHF+Zod+`loginAction`)
**Requirement**: DS-18, DS-19, DS-20, DS-MN-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `page.tsx` envolve o form com `FormCard`+`FormHeader`; `LoginForm` usa `Input`/`Label`/`Button` no lugar de `<input>`/`<label>`/`<button>` crus (DS-18).
- [ ] Fluxos preservados: RHF+Zod, `loginAction`, mensagem única anti-enumeração, navegação `redirectTo`, links "Esqueci minha senha"/"Criar conta" (DS-19).
- [ ] Nenhum `bg-blue-600`/`text-gray-*`/`ring-blue-*`/`system-ui` nos arquivos do login; render correto sob `data-theme="dark"` (DS-20).
- [ ] Guarda `ds-login-parity` FALHA se `login/page.tsx` ou `LoginForm.tsx` reintroduzirem utilitário de paleta crua (DS-MN-03).
- [ ] RTL do login confirma render dos primitivos + preservação de labels/erros/links.
- [ ] Gate passa: `npm run typecheck && npm run lint && npm run test && npm run build`
- [ ] Test count: login RTL ≥3; guarda ≥1

**Tests**: unit
**Gate**: build
**Commit**: `refactor(identity): aplica a fundação de design system ao login (prova de paridade)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1 ──→ T2 ──→ T3

Phase 2 (Parallel, após T3; cada um depende só de T1+T2):
  T4 [P]  T5 [P]  T6 [P]  T7 [P]  T8 [P]  T9 [P]  T10 [P]  T11 [P]

Phase 3 (Sequential):
  T3..T11 completos ──→ T12

Phase 4 (Sequential):
  T12 + T3 ──→ T13
```

> `[P]` é informativo (sem dependência inter-tarefa na fase). Com 4 fases (>3), a skill Execute
> oferecerá 1 sub-agente por fase (offer-then-confirm) — decisão do agente executor, não deste plano.

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1 | deps + 1 util + 1 guarda | ✅ Granular (coeso) |
| T2 | tokens (globals+config) + 2 guardas | ✅ Granular (1 conceito: tokens) |
| T3 | fontes + ThemeScript + 1 guarda | ✅ Granular (1 conceito: fonte/tema no layout) |
| T4 | 1 componente (Button) | ✅ Granular |
| T5 | família input-group (3 arquivos coesos) | ⚠️ OK — cohesive |
| T6 | Card/FormCard/FormSectionTitle (surfaces) | ⚠️ OK — cohesive |
| T7 | FormHeader/StepIcon | ⚠️ OK — cohesive |
| T8 | 1 componente (FormRow) | ✅ Granular |
| T9 | LgpdBox/LgpdCheck | ⚠️ OK — cohesive |
| T10 | 1 componente (Badge) | ✅ Granular |
| T11 | 1 componente (ThemeToggle) | ✅ Granular |
| T12 | barrel + 1 guarda | ✅ Granular |
| T13 | restilização de 1 tela + 1 guarda | ✅ Granular (1 tela) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | (raiz) | ✅ Match |
| T2 | T1 | T1→T2 | ✅ Match |
| T3 | T2 | T2→T3 | ✅ Match |
| T4 | T1, T2 | T1,T2→T4 | ✅ Match |
| T5 | T1, T2 | T1,T2→T5 | ✅ Match |
| T6 | T1, T2 | T1,T2→T6 | ✅ Match |
| T7 | T1, T2 | T1,T2→T7 | ✅ Match |
| T8 | T1, T2 | T1,T2→T8 | ✅ Match |
| T9 | T1, T2 | T1,T2→T9 | ✅ Match |
| T10 | T1, T2 | T1,T2→T10 | ✅ Match |
| T11 | T1, T2 | T1,T2→T11 | ✅ Match |
| T12 | T3..T11 | (T3..T11)→T12 | ✅ Match |
| T13 | T12, T3 | (T12,T3)→T13 | ✅ Match |

> Tarefas `[P]` (T4..T11) não dependem entre si — só de T1/T2. ✅ Consistente.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | util `.ts` (cn) + guarda `.ts` | unit | unit | ✅ OK |
| T2 | config/tokens + guardas `.ts` | none (build) + guarda | unit (guardas) + build | ✅ OK |
| T3 | layout/fonte + ThemeScript `.tsx` + guarda | unit + build | unit + build | ✅ OK |
| T4 | primitivo `.tsx` | unit (RTL) | unit | ✅ OK |
| T5 | primitivos `.tsx` | unit (RTL) | unit | ✅ OK |
| T6 | primitivos `.tsx` | unit (RTL) | unit | ✅ OK |
| T7 | primitivos `.tsx` | unit (RTL) | unit | ✅ OK |
| T8 | primitivo `.tsx` | unit (RTL) | unit | ✅ OK |
| T9 | primitivos `.tsx` | unit (RTL) | unit | ✅ OK |
| T10 | primitivo `.tsx` | unit (RTL) | unit | ✅ OK |
| T11 | primitivo `.tsx` | unit (RTL) | unit | ✅ OK |
| T12 | barrel `.ts` + guarda `.ts` | unit | unit | ✅ OK |
| T13 | tela `.tsx` + guarda `.ts` | unit (RTL) + build | unit + build | ✅ OK |

> Nenhum `Tests: none` indevido; todo layer com teste requerido tem teste na mesma tarefa.

---

## 💠 Must-Not Ownership (Check 4)

| Must-Not | Owning task | Teste negativo (na tarefa) | Status |
|---|---|---|---|
| DS-MN-01 (sem CDN de fonte) | T3 | `ds-no-external-fonts.test.ts` | ✅ Owned |
| DS-MN-02 (primitivos só token) | T12 | `ds-ui-uses-tokens.test.ts` (varre `src/shared/ui/**`) | ✅ Owned |
| DS-MN-03 (login sem paleta crua) | T13 | `ds-login-parity.test.ts` | ✅ Owned |
| DS-MN-04 (mecanismo único de dark) | T2 | `ds-single-dark-mechanism.test.ts` | ✅ Owned |
| DS-MN-05 (sem dep/pasta proibida) | T1 (+ `closed-src-root` existente p/ pastas) | `ds-no-forbidden-deps.test.ts` | ✅ Owned |

> Todo must-not tem tarefa dona e teste negativo verde na mesma tarefa. ✅

---

## Tools & Skills (resumo)

- **MCP `context7`**: apenas onde a API de biblioteca importa — T2 (Tailwind darkMode/theme.extend), T3
  (`next/font/google` no Next 15), T4 (cva + Radix `Slot`). Demais tarefas: NONE.
- **Skills**: NONE por tarefa (testes são RTL/guardas simples; a skill de execução `bravi-spec-driven`/
  `idsd-spec-driven` orquestra o ciclo). Se desejado, `frontend-design`/`ui-ux-pro-max` podem apoiar
  refino visual, mas não são requisito de gate.

## Task Verification Standards

Cada tarefa segue `Done when` + `Tests` + `Gate`. Todo `Done when` é binário e cita o comando de gate.
Contagens de teste (`Test count`) previnem deleção silenciosa. Após a última tarefa (T13), o **Verifier**
independente roda automaticamente (author ≠ verifier): checagem ancorada no spec + sensor de
discriminação + verificação dos 5 must-nots (evidência-ou-zero).
</content>
