# USP-046 — Casca de navegação pública — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tarefas com a skill de execução spec-driven: **ative-a pelo nome** —
`idsd-spec-driven` (o consumidor do pipeline) — e siga seu fluxo Execute e as Critical Rules. Não
procure arquivos de skill por caminho de filesystem. A skill é a fonte da verdade do fluxo (ciclo por
tarefa, delegação a sub-agentes, revisão de adequação, Verifier, sensor de discriminação).

**Se a skill não puder ser ativada, PARE e avise — não prossiga sem ela.**

---

**Spec**: `.specs/features/fachada-publica/usp-046-casca-navegacao/spec.md`
**Design**: `.specs/features/fachada-publica/usp-046-casca-navegacao/design.md`
**Status**: Draft

> **Entry Gate (§0):** re-lidas as Assumptions & Open Questions do spec. Todos os itens têm
> `owner = agent` e `Confirmed? = y`; nenhum pende de terceiro. USP net-new, sem card de matriz e sem
> dependência de decisão externa (a Fundação de Design System da Fase 1 já entregou tokens/fontes/
> dark-mode/`Button`, do qual esta USP só **consome**). USP-047/048 dependem **desta**, não o contrário.
> **Nenhum item externo pendente → gate aberto; a unidade entra em breakdown.**

---

## Test Coverage Matrix

> Gerada de `CLAUDE.md` (§Testing Requirements), `docs/arch/project-guideline.md` (DoD) e
> `vitest.config.ts` (coverage include = `src/shared/**/*.ts` + `src/modules/**/*.ts`; `.tsx` de UI/
> página **fora** do gate de cobertura por design do repo, mas roda na suíte).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Componente de casca (`.tsx`) em `(public)/_components/` | unit (RTL) | Render + landmarks + links reais + active-state + menu mobile + dark; 1:1 aos ACs. Fora do gate de cobertura, roda na suíte. | `src/app/(public)/_components/__tests__/*.test.tsx` | `npm run test` |
| Layout do grupo (`(public)/layout.tsx`) | unit (RTL) | Ordem header→main→footer; ausência de `revalidate`. | `src/app/(public)/__tests__/layout.test.tsx` | `npm run test` |
| Guarda estática de must-not (`.ts`) | unit (`node:fs`) | Assevera que o resultado proibido NÃO ocorre (scan de arquivos). Entra no gate de cobertura (`.ts` em `shared/`). | `src/shared/__tests__/casca-*.test.ts` | `npm run test` |
| Rotas `(public)` (build) | none (build gate) | Build compila; header/footer no HTML. | — | `npm run build` |
| E2E navegação pública (opcional) | e2e (Playwright) | Top-flow: header navega `/`↔`/vagas`↔`/servicos`; footer presente. Gated por label/push-master. | `e2e/*.spec.ts` | `npm run test:e2e` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| RTL de componente (jsdom) | Yes | Render por teste, sem store compartilhado; cleanup do RTL; `usePathname` mockado por teste. | `vitest.setup.ts`, `(public)/page.test.tsx` |
| Guarda estática (`node:fs`, read-only) | Yes | Só leitura de arquivos. | `src/shared/__tests__/closed-src-root.test.ts` |
| Build / typecheck / lint | No (processo único) | — | `package.json` scripts |

## Gate Check Commands

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tarefas com unit/RTL/guarda | `npm run test` |
| Full | Após tarefas com typecheck/guarda relevante | `npm run typecheck && npm run test` |
| Build | Após montar a casca no layout / fim de USP | `npm run typecheck && npm run lint && npm run test && npm run build` |

---

## Execution Plan

### Phase 1: Componentes de casca (Parallel OK)

`SiteFooter` e `PublicNav` são independentes entre si (só consomem tokens/`Button`/`Link` da Fase 1).

```
T1 [P]   T2 [P]
```

### Phase 2: Composição do header (Sequential)

```
T2 → T3
```

### Phase 3: Guardas de must-not + montagem no layout (Parallel OK, após a casca existir)

```
T1,T2,T3 ──┬→ T4 [P]  (guardas estáticas — scan dos arquivos da casca)
           └→ T5 [P]  (montagem no layout + regressão + build)
```

---

## Task Breakdown

### T1: `SiteFooter` (Server Component, estático) + RTL [P]

**What**: Rodapé institucional fiel ao protótipo (marca + colunas de links reais + copyright/tagline),
só com classes token; links institucionais sem rota como não-links "em breve".
**Where**: `src/app/(public)/_components/site-footer.tsx`; `src/app/(public)/_components/__tests__/site-footer.test.tsx`
**Depends on**: None
**Reuses**: tokens (`bg-fg`/`text-surface`/`text-fg-muted`, `font-heading`) + `next/link` `Link`; texto do protótipo L2136-2178; `cn` (`@/shared/ui`)
**Requirement**: CASCA-08, CASCA-09, CASCA-10, CASCA-11

**Tools**:
- MCP: NONE
- Skill: `skill-tdad` (opcional — derivar os RTL dos ACs CASCA-08..11); se indisponível, RTL à mão no padrão do repo.

**Done when**:
- [ ] `<footer>` com bloco de marca (logo + descrição institucional) e colunas (Candidatos/Empresas/Serviços/Institucional), paridade estrutural com o protótipo (CASCA-08).
- [ ] Todo link de navegação aponta para rota real (`/vagas`, `/servicos`, `/cadastro`, `/login`); **nenhum** `href="#"` (CASCA-09).
- [ ] Itens institucionais sem rota (Sobre a ASONSEG, A Paróquia, Termos e Privacidade, Contato) renderizados como **não-links** (texto não-focável, marcado "em breve") — nunca âncora morta (CASCA-10, A-07).
- [ ] Rodapé inferior com copyright "© 2026 ASONSEG…" + tagline; só classes token (light/dark); colapso 1-coluna em viewport estreita via classes responsivas (CASCA-11).
- [ ] RTL: landmark `<footer>`, `href` dos links reais, ausência de `href="#"`, institucionais como não-links, texto de copyright.
- [ ] Gate passa: `npm run test`
- [ ] Test count: ≥4 asserts (landmark; links reais; sem `#`; copyright)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(fachada-publica): SiteFooter da casca pública`

---

### T2: `PublicNav` (client — active-state + menu mobile + a11y) + RTL + guarda de lib proibida [P]

**What**: Navegação primária do header: itens data-driven (Início/Vagas/Serviços), active-state por
`usePathname`, colapso responsivo e menu mobile togglado por React nativo, acessível.
**Where**: `src/app/(public)/_components/public-nav.tsx`; `src/app/(public)/_components/__tests__/public-nav.test.tsx`; `src/shared/__tests__/casca-no-icon-state-lib.test.ts`
**Depends on**: None
**Reuses**: `usePathname` (`next/navigation`), `Link` (`next/link`), `cn`; padrão React-nativo do `ThemeToggle` (SVG inline); padrão de guarda `node:fs` (`ds-no-forbidden-deps`)
**Requirement**: CASCA-02, CASCA-03, CASCA-05, CASCA-06, CASCA-07, CASCA-15, CASCA-MN-04

**Tools**:
- MCP: `context7` (Next 15 App Router: `usePathname` em Client Component)
- Skill: `skill-tdad` (opcional — RTL dos ACs de nav/active/mobile)

**Done when**:
- [ ] `'use client'`; exporta `type NavItem = { label; href }` e default `PUBLIC_NAV_ITEMS` (Início `/`, Vagas `/vagas`, Serviços `/servicos`); aceita prop `items?: NavItem[]` (seam USP-048) e `className?` merge via `cn` (CASCA-02, CASCA-15).
- [ ] Helper puro `isActive(href, pathname)`: `/` casa exato; demais casam por prefixo de seção (`/vagas/123`→Vagas; `/servicos/x`→Serviços); item ativo recebe `aria-current="page"` + marcação `.active`; nenhum ativo fora da nav (CASCA-03, edge cases).
- [ ] `<nav aria-label="Navegação principal">`; nav inline visível ≥769px e oculta <768px; botão hamburguer visível <768px (mesmos breakpoints do protótipo) (CASCA-05, CASCA-07).
- [ ] Botão mobile com `aria-expanded={open}` + `aria-controls="public-mobile-menu"`; `onClick` alterna `useState`; painel `id="public-mobile-menu"` lista os itens; ícones SVG inline; **sem** lib de estado, **sem** `lucide-react` (CASCA-06, CASCA-MN-04, A-06).
- [ ] Guarda `casca-no-icon-state-lib` FALHA se qualquer arquivo em `(public)/_components/**` importar `lucide-react`/`zustand`/`redux`/`mobx`/`jotai`/`next-themes`; verde no estado atual (CASCA-MN-04).
- [ ] RTL com `vi.mock('next/navigation')`: active-state em `/`, `/vagas`, `/vagas/123`; toggle do menu mobile muda `aria-expanded` e exibe o painel; `aria-label` do `<nav>`.
- [ ] Gate passa: `npm run typecheck && npm run test`
- [ ] Test count: RTL ≥5 (active exato; active por prefixo; nenhum ativo; toggle aberto; toggle fechado); guarda ≥1

**Tests**: unit
**Gate**: full
**Commit**: `feat(fachada-publica): PublicNav (active-state + menu mobile acessível)`

---

### T3: `SiteHeader` (Server Component) — marca + PublicNav + ações Entrar/Cadastrar

**What**: Header sticky que compõe a marca (→ `/`), o `PublicNav` e as ações Entrar/Cadastrar via
`Button asChild`+`Link`, só com classes token.
**Where**: `src/app/(public)/_components/site-header.tsx`; `src/app/(public)/_components/__tests__/site-header.test.tsx`
**Depends on**: T2
**Reuses**: `PublicNav` (T2); `Button` (`asChild`/Slot, DS-06) e `cn` de `@/shared/ui`; `Link`; tokens (`bg-surface`, `border-border`, `font-heading`, gradiente `from-primary to-secondary`)
**Requirement**: CASCA-01, CASCA-04, CASCA-15

**Tools**:
- MCP: NONE
- Skill: `skill-tdad` (opcional — RTL dos ACs de header)

**Done when**:
- [ ] `<header>` sticky (`sticky top-0 z-…`, `bg-surface` + `border-b border-border`) com a marca (logo-icon "A" gradiente token + "ASONSEG" `font-heading text-primary` + subtítulo "Portal de Vagas") linkando `/` (CASCA-01).
- [ ] Renderiza `<PublicNav/>` e, nas ações, `<Button asChild variant="outline" size="sm"><Link href="/login">Entrar</Link></Button>` e `<Button asChild variant="primary" size="sm"><Link href="/cadastro">Cadastrar</Link></Button>` — sem `<button>` extra (CASCA-04, A-04).
- [ ] Aceita `className?` (merge via `cn`) e slot opcional de ações (seam USP-047/048) sem quebrar o default (CASCA-15).
- [ ] Só classes token; render correto sob `data-theme="dark"`; SVGs decorativos com `aria-hidden` (CASCA-01).
- [ ] RTL: landmark `<header>`, marca→`/`, `PublicNav` presente, Entrar→`/login`, Cadastrar→`/cadastro` como âncoras (asChild).
- [ ] Gate passa: `npm run typecheck && npm run test`
- [ ] Test count: RTL ≥4

**Tests**: unit
**Gate**: full
**Commit**: `feat(fachada-publica): SiteHeader (marca + nav + Entrar/Cadastrar)`

---

### T4: Guardas estáticas de must-not da casca (privacidade + tokens + CDN) [P]

**What**: Três guardas `node:fs` que varrem `src/app/(public)/_components/**` e falham se a casca violar
os must-nots de privacidade, token e CDN externo.
**Where**: `src/shared/__tests__/casca-no-auth-pii.test.ts`; `src/shared/__tests__/casca-uses-tokens.test.ts`; `src/shared/__tests__/casca-no-external-cdn.test.ts`
**Depends on**: T1, T2, T3
**Reuses**: padrão das guardas `ds-*-parity.test.ts` / `closed-src-root.test.ts`
**Requirement**: CASCA-MN-01, CASCA-MN-02, CASCA-MN-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `casca-no-auth-pii` FALHA se algum arquivo da casca importar `getCurrentPerson`/`@/modules/*/views`/`@/shared/lib/prisma`/`@/modules/*/actions`, contiver `'use server'`, ou consumir sessão/PII; verde no estado atual (CASCA-MN-01).
- [ ] `casca-uses-tokens` FALHA se algum arquivo da casca contiver hex cru (`#RRGGBB`) ou utilitário de paleta fixa (`bg-(blue|gray|slate|red|green|orange)-\d`, `text-…-\d`, `system-ui`); verde no estado atual (CASCA-MN-02).
- [ ] `casca-no-external-cdn` FALHA se algum arquivo da casca referenciar `fonts.googleapis.com`/`fonts.gstatic.com` ou `href="http`/`src="http` (host externo); verde no estado atual (CASCA-MN-03).
- [ ] Cada guarda resolve a lista de arquivos por diretório (varre TODOS os `.tsx` da casca — pega arquivos novos), não por lista fixa.
- [ ] Gate passa: `npm run typecheck && npm run test`
- [ ] Test count: 3 guardas (≥1 asserção cada)

**Tests**: unit
**Gate**: full
**Commit**: `test(fachada-publica): guardas de must-not da casca (privacidade/token/CDN)`

---

### T5: Montar a casca no `(public)/layout.tsx` + regressão + build [P]

**What**: Compor `SiteHeader` + `<main>{children}</main>` + `SiteFooter` no layout do grupo público;
remover o `<main>` duplicado da home; garantir zero regressão e build verde.
**Where**: `src/app/(public)/layout.tsx`; `src/app/(public)/__tests__/layout.test.tsx`; `src/app/(public)/page.tsx` (remover `<main>` interno); (opcional) `e2e/casca-publica.spec.ts`
**Depends on**: T1, T2, T3
**Reuses**: `(public)/layout.tsx` atual (pass-through); `SiteHeader` (T3), `SiteFooter` (T1); padrão RTL de layout
**Requirement**: CASCA-12, CASCA-13, CASCA-14

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `(public)/layout.tsx` renderiza `<SiteHeader/>` + `<main>{children}</main>` + `<SiteFooter/>`; **não** declara `export const revalidate` (ISR por página preservado) (CASCA-12, CASCA-13, A-01).
- [ ] `(public)/page.tsx` deixa de declarar `<main>` de topo (evita landmark duplicado); demais páginas públicas confirmadas sem `<main>` de topo (CASCA-12, nota de migração §7).
- [ ] Suíte de páginas públicas existente segue verde: `(public)/page.test.tsx`, `(public)/servicos/page.test.tsx`, e RTL de `vagas` (CASCA-14).
- [ ] RTL do `PublicLayout` confirma ordem header→main→footer e um único `<main>`.
- [ ] `npm run build` compila as rotas `(public)`; header/footer aparecem no HTML renderizado.
- [ ] (Opcional) `e2e/casca-publica.spec.ts`: header navega `/`↔`/vagas`↔`/servicos`; footer presente (top-flow; gated por label/push-master — não bloqueia merge).
- [ ] Gate passa: `npm run typecheck && npm run lint && npm run test && npm run build`
- [ ] Test count: layout RTL ≥2; regressão = suíte existente verde

**Tests**: unit (+ e2e opcional)
**Gate**: build
**Commit**: `feat(fachada-publica): monta a casca pública no layout do grupo (public)`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  T1 [P]   T2 [P]

Phase 2 (Sequential):
  T2 ──→ T3

Phase 3 (Parallel, após T1+T2+T3):
  T4 [P]   T5 [P]
```

> `[P]` é informativo. Com 3 fases, a skill Execute pode oferecer 1 sub-agente por fase
> (offer-then-confirm) — decisão do agente executor, não deste plano.

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1 | 1 componente (SiteFooter) + RTL | ✅ Granular |
| T2 | 1 componente (PublicNav) + 1 guarda | ✅ Granular (1 conceito: navegação) |
| T3 | 1 componente (SiteHeader) + RTL | ✅ Granular |
| T4 | 3 guardas estáticas coesas (mesmo scan-dir) | ⚠️ OK — coeso (must-nots da casca) |
| T5 | montagem no layout + regressão + build | ✅ Granular (1 conceito: montagem) |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | (raiz, Phase 1) | ✅ Match |
| T2 | None | (raiz, Phase 1) | ✅ Match |
| T3 | T2 | T2→T3 | ✅ Match |
| T4 | T1, T2, T3 | (T1,T2,T3)→T4 | ✅ Match |
| T5 | T1, T2, T3 | (T1,T2,T3)→T5 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | componente `.tsx` (footer) | unit (RTL) | unit | ✅ OK |
| T2 | componente `.tsx` (nav) + guarda `.ts` | unit (RTL) + unit | unit | ✅ OK |
| T3 | componente `.tsx` (header) | unit (RTL) | unit | ✅ OK |
| T4 | guardas `.ts` | unit (`node:fs`) | unit | ✅ OK |
| T5 | layout `.tsx` + edição de página + build | unit (RTL) + build | unit + build | ✅ OK |

> Nenhum `Tests: none` indevido; todo layer com teste requerido tem teste na mesma tarefa.

---

## 💠 Must-Not Ownership (Check 4)

| Must-Not | Owning task | Teste negativo (na tarefa) | Status |
|---|---|---|---|
| CASCA-MN-01 (sem sessão/PII/Prisma/ViewModel) | T4 | `casca-no-auth-pii.test.ts` | ✅ Owned |
| CASCA-MN-02 (só token) | T4 | `casca-uses-tokens.test.ts` | ✅ Owned |
| CASCA-MN-03 (sem CDN externo) | T4 | `casca-no-external-cdn.test.ts` | ✅ Owned |
| CASCA-MN-04 (sem lib estado/ícone) | T2 (+ `ds-no-forbidden-deps` p/ `package.json`) | `casca-no-icon-state-lib.test.ts` | ✅ Owned |

> Todo must-not tem tarefa dona e teste negativo verde na mesma tarefa. ✅

---

## Tools & Skills (resumo)

- **MCP `context7`**: só onde a API de biblioteca importa — T2 (`usePathname` em Client Component no
  Next 15). Demais: NONE.
- **Skill `skill-tdad`**: produtor opcional dos RTL a partir dos ACs (T1/T2/T3). Como esta USP é
  greenfield (sem `expectations-US-NNN.md`), o `skill-tdad` opera a partir dos ACs deste spec; se
  indisponível, escrever RTL à mão no padrão do repo (`(public)/page.test.tsx`).
- **Skills de apoio (não-gate):** `frontend-design`/`ui-ux-pro-max`/`web-design-guidelines` podem
  refinar a fidelidade visual/a11y, mas não são requisito de gate.

## Task Verification Standards

Cada tarefa segue `Done when` + `Tests` + `Gate`. Todo `Done when` é binário e cita o comando de gate.
`Test count` previne deleção silenciosa. Após a última tarefa (T5), o **Verifier** independente roda
automaticamente (author ≠ verifier): checagem ancorada no spec (cada AC) + sensor de discriminação +
verificação dos 4 must-nots (evidência-ou-zero). Guardas negativas devem falhar quando o proibido é
injetado em scratch e passar no estado limpo.
