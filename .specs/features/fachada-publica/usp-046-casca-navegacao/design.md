# USP-046 — Casca de navegação pública — Design

> **Modo: Greenfield-adapter (não-ICE).** Sem card em `docs/prd/matriz-conexoes.md` → o Design é
> **gerado**, não resolvido. Fonte da verdade visual: `docs/prototipo/index.html` (header L811-838,
> footer L2136-2178). Fonte da verdade de estilo: a Fundação de Design System da Fase 1
> (`globals.css`, `tailwind.config.ts`, `src/shared/ui/`, guardas `DS-MN-*`). O design **reutiliza** e
> **não re-deriva** tokens, fontes, dark-mode nem o primitivo `Button`.

## 1. Visão geral da arquitetura

A casca é composição de UI **do grupo de rotas `(public)`**, montada uma única vez no layout do grupo:

```
src/app/(public)/layout.tsx        (Server Component — monta a casca)
├── <SiteHeader/>                  (Server Component)   ─ (public)/_components/site-header.tsx
│     ├── <SiteBrand/> → Link "/"  (inline/presentacional)
│     ├── <PublicNav/>             ('use client')       ─ (public)/_components/public-nav.tsx
│     │     ├── nav desktop (Início/Vagas/Serviços, active-state via usePathname)
│     │     └── menu mobile (botão hamburguer + painel, useState)
│     └── ações: <Button asChild variant="outline"><Link href="/login">Entrar</Link></Button>
│                <Button asChild variant="primary"><Link href="/cadastro">Cadastrar</Link></Button>
├── <main> {children} </main>      (landmark único por página)
└── <SiteFooter/>                  (Server Component)   ─ (public)/_components/site-footer.tsx
```

**Fronteira Server/Client (A-08):** só `PublicNav` é `'use client'` (precisa de `usePathname()` e do
estado do menu mobile). `SiteHeader`, `SiteBrand` e `SiteFooter` são Server Components estáticos —
mantêm a casca cacheável/ISR-friendly. As ações Entrar/Cadastrar são `Button asChild` sobre `<Link>`
(navegação declarativa; sem handler client).

## 2. Onde a casca vive (layout placement) — confirmação da A-01

`src/app/(public)/layout.tsx` é hoje um pass-through (`<>{children}</>`). Ele envolve **exatamente** as
rotas públicas (`/`, `/vagas`, `/vagas/[id]`, `/servicos`, `/servicos/[id]`) e nada mais — `(auth)` e
`(app)` têm seus próprios layouts/chrome. Portanto é o lar natural e correto da casca pública.

Restrições respeitadas:
- **ISR intacto:** o layout do grupo **não** declara `revalidate` (senão se propagaria a todas as rotas
  — o comentário do próprio arquivo alerta para isso). Cada página mantém o seu (`/`=600s, listagens
  =1800s). CASCA-13.
- **Um único `<main>`:** o layout envolve `{children}` num `<main>`; as páginas não devem re-declarar
  `<main>` (hoje `(public)/page.tsx` usa `<main>` — ver §7 Regressão/Nota de migração).

## 3. Onde os componentes moram (component location) — decisão A-02

CLAUDE.md: **"Root `src/` structure is closed: only `app/`, `modules/`, `shared/`."** Não existe
`modules/fachada-publica` (não é um dos 11 módulos canônicos) e criar um exigiria RFC. Sobram duas
opções lícitas:

| Opção | Onde | Veredito |
|---|---|---|
| **A (escolhida)** | `src/app/(public)/_components/` — colocação sob o grupo de rota | ✅ A casca é **acoplada a rotas públicas** (`/vagas`, `/login`, `/cadastro`), específica do grupo `(public)`. Pasta `_`-prefixada é **pasta privada do App Router** (não vira rota). Mantém `src/` fechada (ainda sob `app/`). Não polui a fundação. |
| B (rejeitada) | `src/shared/ui/` (SiteHeader/SiteFooter/PublicNav como "primitivos") | ❌ O barrel de `shared/ui` é explicitamente **"primitivos da fundação"** (DS-05). Componentes com rotas hard-coded e `usePathname()` não são primitivos genéricos; colocá-los ali acopla a fundação a rotas públicas e dilui o contrato. |

> **Precedente:** hoje não há `_components` colocado sob `src/app` (só `__tests__`). Esta USP
> **estabelece** o padrão para a Fase 7; USP-047/048 colocam os componentes da home/nav no mesmo lugar.
> A guarda `closed-src-root` verifica só o topo de `src/` → uma pasta profunda sob `(public)` é lícita.

## 4. Sistema de tokens / dark-mode — **reuso**, não re-derivação

A casca consome as chaves semânticas do Tailwind já mapeadas em `tailwind.config.ts`
(`theme.extend`), que resolvem para as variáveis CSS de `globals.css` (`:root` + `[data-theme="dark"]`):

| Elemento do protótipo | Classe token a usar |
|---|---|
| `.header` fundo/borda | `bg-surface` (com opacidade/`backdrop-blur` via utilitário) + `border-b border-border` |
| `.logo-icon` gradiente | gradiente `from-primary to-secondary` (classes token) |
| `.logo-text` / títulos | `font-heading text-primary` |
| `.nav a` / `.nav a.active` | `text-fg-muted` → `text-primary` (ativo) + sublinhado `bg-primary` |
| `.nav-actions` botões | primitivo `Button` (`variant="outline"|"primary"`, `size="sm"`) |
| `.footer` fundo | superfície escura via token (o protótipo usa `--color-text` no light e `#020617` no dark; mapear para `bg-fg` + override dark documentado) |
| `.footer-col a` | `text-fg-muted hover:text-surface` (token) |

**Dark-mode:** mecanismo único `[data-theme="dark"]` (DS-MN-04). A casca **não** reintroduz
`@media (prefers-color-scheme)` nem usa hex cru (CASCA-MN-02). Onde o protótipo tem regras dark
específicas de `.header`/`.footer` (L59-62, L97-98), reproduzir via variantes `dark:` (Tailwind
`darkMode:['selector','[data-theme="dark"]']`) ou tokens que já invertem no dark.

> **Nota de fidelidade (footer):** o footer do protótipo usa uma superfície escura fixa em ambos os
> temas (`--color-text`/`#020617`). Como não há token semântico "footer-surface", o Implementer deve
> usar as chaves token existentes (`bg-fg` / `text-surface`) + uma variante `dark:` explícita, **sem
> hex cru**. Se ficar inevitável um valor bruto, adicionar um token semântico em `globals.css`
> (`--color-footer`) e mapeá-lo — nunca hex inline num `.tsx` (CASCA-MN-02).

## 5. Navegação: active-state, responsividade, menu mobile

**Active-state (CASCA-03):** `PublicNav` é `'use client'` e lê `const pathname = usePathname()`. Um
helper puro decide o item ativo por **match de seção**:

```
isActive(itemHref, pathname):
  if itemHref === '/'  → pathname === '/'            // raiz casa exatamente (não por prefixo)
  else                 → pathname === itemHref || pathname.startsWith(itemHref + '/')
```

Assim `/vagas/123` ativa "Vagas" e `/servicos/x` ativa "Serviços"; `/` ativa só "Início". Item ativo
recebe `aria-current="page"` + a marcação visual `.active` do protótipo (sublinhado). Nenhum item ativo
quando a rota não casa (edge case).

**Responsividade (CASCA-05):** mesmos breakpoints do protótipo — nav/ações inline visíveis ≥769px
(`md:flex`), ocultas <768px (`hidden`); botão hamburguer visível <768px (`md:hidden`). Sem JS de
resize; puro CSS/Tailwind responsivo.

**Menu mobile (CASCA-06, A-06):** botão hamburguer (SVG inline, paridade L835-837) com
`aria-expanded={open}` + `aria-controls="public-mobile-menu"`; `onClick` alterna `useState` `open`. O
painel (`id="public-mobile-menu"`) lista os mesmos itens de nav + ações. Fechar ao navegar (ou no
clique de link). **Sem** lib de estado, **sem** `lucide-react` (CASCA-MN-04). Espelha o padrão do
`ThemeToggle` (React nativo, SVG inline).

**Teclado/foco (CASCA-07):** ordem natural do DOM (links são `<a>`/`<Link>`, botão é `<button>`); foco
visível herdado dos tokens/primitivos; `<nav aria-label="Navegação principal">`.

## 6. Contrato de acessibilidade (resumo dos ACs de a11y)

| Landmark/atributo | Onde | AC |
|---|---|---|
| `<header>` | `SiteHeader` | CASCA-01 |
| `<nav aria-label="Navegação principal">` | `PublicNav` | CASCA-07 |
| `aria-current="page"` no item ativo | `PublicNav` | CASCA-03 |
| botão mobile: `aria-expanded` + `aria-controls` | `PublicNav` | CASCA-06 |
| `<main>` (único) | `(public)/layout.tsx` | CASCA-12 |
| `<footer>` | `SiteFooter` | CASCA-08 |
| SVGs decorativos: `aria-hidden` + `<span class="sr-only">` p/ ícones-ação | header/footer | CASCA-01/06 |

## 7. Seams para USP-047 (home) e USP-048 (nav integrada) — G6/CASCA-15

- **`PublicNav` data-driven:** exporta `type NavItem = { label: string; href: string }` e um default
  `PUBLIC_NAV_ITEMS` (Início/Vagas/Serviços). Aceita prop opcional `items?: NavItem[]` (default = o
  público) → USP-048 pode injetar itens (ex.: "Sou Candidato/Sou Empresa") **sem** reescrever a casca.
- **`SiteHeader`/`SiteFooter`** aceitam `className?` (merge via `cn`) e, onde fizer sentido, um slot
  opcional (`children`/`actions?`) para USP-047/048 estenderem ações/CTA sem editar o componente.
- **Layout estável:** USP-047 troca só o `{children}` da home (`(public)/page.tsx`); a casca não muda.
- **Nota de migração (regressão):** `(public)/page.tsx` hoje declara seu próprio `<main>`. Como o layout
  passará a prover o `<main>`, o Implementer deve **remover** o `<main>` interno da home (ou trocá-lo por
  `<div>`/fragment) para não duplicar o landmark. Essa é uma edição mínima e coberta pela regressão
  (CASCA-14); as demais páginas (`vagas`, `servicos`) usam `FormHeader`/`<section>` e não declaram
  `<main>` de topo — confirmar no Execute.

## 8. Reuso (o que já existe e será consumido)

| Reuso | De onde | Uso |
|---|---|---|
| `Button` (`asChild`/Slot, `variant`, `size`) | `@/shared/ui` (DS-06) | ações Entrar/Cadastrar sobre `<Link>` |
| `cn` | `@/shared/ui` | merge de `className` nos seams |
| Tokens/dark (`bg-surface`, `text-fg*`, `border-border`, `font-heading`) | `globals.css`+`tailwind.config.ts` | toda a estilização |
| `next/link` `Link` / `usePathname` (`next/navigation`) | Next 15 App Router | navegação + active-state |
| Padrão de guarda estática `node:fs` | `src/shared/__tests__/ds-*-parity.test.ts`, `closed-src-root.test.ts` | os 4 testes negativos de must-not |
| Padrão RTL de página/componente | `src/app/(public)/page.test.tsx`, `src/app/(auth)/login/page.test.tsx`, `vitest.setup.ts` | RTL da casca |
| `ThemeToggle` fixo global | `src/app/layout.tsx` (root) | permanece — serve as páginas públicas (A-05) |

## 9. Aplicação dos Must-Nots (enforcement)

| Must-Not | Mecanismo | Owning task |
|---|---|---|
| CASCA-MN-01 (sem sessão/PII/Prisma/ViewModel) | Guarda `node:fs` varre `(public)/_components/**` e falha se houver import de `getCurrentPerson`/`@/modules/*/views`/`@/shared/lib/prisma`/`'use server'`/actions | T4 |
| CASCA-MN-02 (só token) | Guarda varre `(public)/_components/**` p/ `#RRGGBB`/`bg-(blue\|gray\|slate\|…)-\d`/`system-ui` | T4 |
| CASCA-MN-03 (sem CDN externo) | Guarda varre `(public)/_components/**` p/ `fonts.googleapis`/`gstatic`/`href="http`/`src="http` | T4 |
| CASCA-MN-04 (sem lib estado/ícone) | Guarda varre imports p/ `lucide-react`/`zustand`/`redux`/`mobx`/`jotai`/`next-themes` (+ `ds-no-forbidden-deps` existente cobre `package.json`) | T2 |

## 10. Estratégia de testes

- **RTL (`.tsx`, fora do gate de cobertura, mas roda na suíte):** `SiteHeader`, `PublicNav`
  (com `usePathname` mockado via `vi.mock('next/navigation')`), `SiteFooter`, e `PublicLayout`
  (ordem header→main→footer). Precedente: `(public)/page.test.tsx`, `login/page.test.tsx`.
- **Guardas estáticas (`.ts`, entram no gate):** os 4 testes negativos de must-not em
  `src/shared/__tests__/casca-*.test.ts`.
- **Build:** `npm run build` compila as rotas `(public)` e confirma header/footer no HTML.
- **Regressão:** suíte de páginas públicas existentes segue verde (RTL de página renderiza a página,
  não o layout → a casca não altera esses testes; só a remoção do `<main>` duplicado da home é editada
  e re-verificada).
- **E2E (opcional, gated por label/push-master — MEMORY):** cenário Playwright "header navega entre
  `/`↔`/vagas`↔`/servicos` e footer presente" pode ser adicionado a `e2e/` como top-flow; não é gate de
  merge (E2E roda `skipped` em PR comum).

## 11. Decisão de projeto proposta (para o orquestrador registrar)

> **Proposta AD-025** (numeração final é do orquestrador; AD-024 é o último em `STATE.md`). O Planner
> **não** edita `STATE.md`.

**AD-025 — Casca pública mora no layout do grupo `(public)` + convenção `(public)/_components`.**
- **Contexto:** Fase 7 precisa de header/footer globais fiéis ao protótipo; não há módulo
  `fachada-publica` e `src/` é fechada.
- **Decisão:** (1) a casca do grupo `(public)` é montada no `(public)/layout.tsx`; (2) seus componentes
  moram em `src/app/(public)/_components/` (pasta privada do App Router), não em `shared/ui` (reservado
  a primitivos da fundação, DS-05); (3) componentes acoplados a rota do grupo seguem esse padrão
  (USP-047/048 idem).
- **Consequências:** mantém `src/` fechada; separa fundação (genérica) de chrome (acoplado a rota);
  ISR preservado (layout não declara `revalidate`).

## 12. Ideias deferidas

- **DEF-1:** Realocar o `ThemeToggle` do root layout (fixo) para dentro do `SiteHeader` (fidelidade
  total ao protótipo), unificando o toggle app-wide — requer tocar root layout + grupos `(auth)`/`(app)`.
- **DEF-2:** Páginas institucionais (Sobre a ASONSEG, A Paróquia, Termos e Privacidade, Contato) e
  ativação dos respectivos links do footer, quando as rotas existirem.
- **DEF-3:** Itens "Sou Candidato/Sou Empresa" e CTAs cruzados na nav (wiring de USP-048, via o seam
  `items` do `PublicNav`).
- **DEF-4:** E2E dedicado da navegação pública promovido a top-flow no gate de E2E.
