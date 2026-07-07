# Fundação de Design System da Fase 1 — Specification

> **Unidade transversal / fundacional (não é USP do ROADMAP).** Precedente ad-hoc: AD-013
> (Fase 0 reconciliada fora da linha-USP). Esta unidade entrega **apenas a fundação** de UI;
> **não** re-estiliza as telas da Fase 1 (isso é trabalho de unidades posteriores) — exceto o
> smoke de paridade obrigatório em 1 tela (login).

## Problem Statement

O protótipo estático (`docs/prototipo/index.html`) define uma linguagem visual madura — sistema de
design tokens (cores, tipografia, espaçamento, raio, sombra), modo escuro por `[data-theme]` e um
conjunto de classes de componente (`form-card`, `form-header`/`step-icon`, `form-row`, `lgpd-box`,
`btn`/`btn-primary`/`btn-lg`, inputs, badges). Já as telas reais da Fase 1 usam Tailwind solto
(`bg-blue-600`, `system-ui`, `text-gray-*`) **sem nenhum** desses tokens: `src/shared/ui/` está vazio
e `src/app/globals.css` só declara `--background`/`--foreground` genéricos. Não há fundação
reutilizável — cada tela reinventa estilo, e não há como restilizar a Fase 1 de forma consistente.

Esta unidade extrai a linguagem do protótipo para uma **fundação de UI reutilizável** em
`src/shared/ui/` + `src/app/globals.css` + `tailwind.config.ts`, de modo que TODAS as telas da Fase 1
possam depois ser restilizadas contra um único contrato de tokens e primitivos.

## Goals

- [ ] **G1** — Tokens do protótipo (cores/tipografia/espaço/raio/sombra + modo escuro) vivem como
  variáveis CSS em `globals.css` e mapeados no `tailwind.config.ts`, com valores idênticos aos do
  protótipo (paridade verificável 1:1).
- [ ] **G2** — Cada classe-alvo do protótipo (`btn*`, inputs, `form-card`, `form-section-title`,
  `form-header`+`step-icon`, `form-row`, `lgpd-box`, `badge*`, `card`) existe como primitivo React em
  `src/shared/ui/`, exportado via barrel, seguindo convenções shadcn/ui (cva onde fizer sentido).
- [ ] **G3** — Modo escuro `[data-theme="dark"]` funciona no App Router sem lib de estado proibida
  (React nativo + script inline anti-FOUC).
- [ ] **G4** — Fontes (Nunito + DM Sans) são **auto-hospedadas** via `next/font/google` (sem CDN
  externo em produção).
- [ ] **G5** — Prova de paridade: a tela de **login** (page + `LoginForm`) é restilizada com os
  primitivos/tokens e apresenta paridade visual com o protótipo, provando o caminho ponta-a-ponta
  (tokens → fonte → tema → Button/Input/Label/FormCard/FormHeader).

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Reason |
|---|---|
| Restilizar as demais telas da Fase 1 (cadastro, consentimentos, perfil, permissões, etc.) | Trabalho de unidades posteriores; esta unidade entrega **só a fundação** + 1 smoke (login). |
| Fundir/alterar fluxos de LGPD/arquitetura (cadastro↔consentimento↔perfil) | Decisão do dono (b): estilo visual apenas; fluxos e Server Actions preservados. |
| Componentes de layout de página do protótipo (header/nav, hero, footer, filtros, cards de vaga) | Fora do inventário fundacional enumerado; são compostos por tela em unidades futuras. |
| Instalar o CLI/registry do shadcn (`components.json`, `npx shadcn add`) | Portamos primitivos à mão com as convenções shadcn; o registry não é necessário e evita drift de config. |
| Visual regression automatizado (screenshots/Chromatic/Percy) | Fora do stack atual; paridade é validada por build + testes de render + guardas estáticas. |
| Migração de `bg-blue-600` etc. nas telas **não**-login | Débito assumido; coberto pelas unidades de restilização posteriores. |

---

## Assumptions & Open Questions

Toda ambiguidade resolvida ou registrada aqui — nada fica silenciosamente indefinido. Modo autônomo:
o dono já fixou as duas decisões de produto governantes (a: extrair o DS e aplicá-lo a todas as telas
da Fase 1; b: preservar fluxos LGPD/arquitetura, aplicar só estilo). O restante é discricionário do
agente (owner: `agent`).

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
|---|---|---|---|---|
| **Duas famílias de fonte, não uma.** O protótipo usa `Nunito` (títulos/logo, 700/800/900) **e** `DM Sans` (corpo/botões/inputs, 400/500/700). O briefing citou só "Nunito". | agent | Portar **ambas**: `Nunito`→`font-heading`, `DM Sans`→`font-sans` (default). | Fidelidade ao protótipo (fonte da verdade da paridade). Portar só Nunito quebraria o corpo. | y (evidência: `docs/prototipo/index.html` L9,136-151) |
| Estratégia de carga de fonte | agent | `next/font/google` (auto-hospeda no build; expõe CSS vars). | Sem CDN externo em prod (DS-MN-01); `next/font` é o caminho canônico do Next 15 e elimina FOUC de fonte. | y |
| Onde vive o util `cn` (clsx+tailwind-merge) | agent | `src/shared/ui/cn.ts` | Mantém o DS coeso e auto-contido; `cn` é utilitário exclusivo de UI, só consumido pelos primitivos. Alternativa `shared/lib/` documentada em design.md. | y |
| Nomes dos tokens no Tailwind | agent | Manter **valores** verbatim do protótipo em `globals.css` (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`); expor sob chaves **semânticas** no Tailwind (`primary`, `cta`, `surface`, `fg`, `fg-muted`, `border`…). | Cópia literal preserva auditabilidade da paridade; camada semântica dá ergonomia. Mapa em design.md. | y |
| Mecanismo de modo escuro | agent | `data-theme="dark"` no `<html>` + `ThemeScript` inline (anti-FOUC) + `ThemeToggle` (React nativo, `localStorage`). Sem `next-themes`. Tailwind `darkMode: ['selector','[data-theme="dark"]']`. | Variáveis CSS re-resolvem no cascade ao trocar `data-theme` — sem `dark:` na maioria dos primitivos. `next-themes` evitado para não ampliar deps além do allowlist. | y |
| Qual tela para o smoke de paridade | agent | **login** (`(auth)/login/page.tsx` + `LoginForm.tsx`) | Menor superfície que exercita tokens+fonte+tema+Button+Input+Label+FormCard+FormHeader; menor blast radius. `form-row`/`lgpd-box` são provados por teste de render próprio (login não os usa). | y |
| Dependências novas permitidas (allowlist) | agent | `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, `@radix-ui/react-label` | Base mínima do padrão shadcn/ui já exigido pelo CLAUDE.md. Nenhuma é lib de estado/CSS-in-JS/data proibida (DS-MN-05). | y |
| Registrar convenção como decisão de projeto | agent | Propor **AD-014** (bloco pronto em design.md) — não editar `STATE.md` direto (escopo Planner). | Evita colisão com o orquestrador; a fundação fixa convenção que todas as telas seguirão. | y |

**Open questions:** none — todas resolvidas ou registradas acima.

---

## User Stories

### P1: Tokens de design como fonte única da verdade ⭐ MVP

**User Story**: Como desenvolvedor de UI da Fase 1, quero os tokens do protótipo disponíveis como
variáveis CSS + chaves do Tailwind, para estilizar qualquer tela contra um contrato único, coerente e
theme-aware.

**Why P1**: Sem tokens não há como restilizar consistentemente; é a base de todo o resto.

**Acceptance Criteria**:

1. WHEN o build processa `globals.css` THEN o sistema SHALL declarar em `:root` os tokens do protótipo
   com valores idênticos: `--color-primary:#2563EB`, `--color-secondary:#3B82F6`, `--color-cta:#F97316`,
   `--color-cta-hover:#EA580C`, `--color-background:#F8FAFC`, `--color-text:#1E293B`,
   `--color-text-light:#64748B`, `--color-border:#E2E8F0`, `--color-white:#FFFFFF`,
   `--color-success:#10B981`, `--color-danger:#EF4444`, as escalas `--space-xs..3xl`
   (4/8/16/24/32/48/64px), `--radius-sm..xl` (8/12/16/24px) e `--shadow-sm..xl`.
2. WHEN `data-theme="dark"` está presente no `<html>` THEN o sistema SHALL sobrescrever os mesmos
   tokens com os valores dark do protótipo (`--color-primary:#3B82F6`, `--color-cta:#FB923C`,
   `--color-background:#0F172A`, `--color-text:#F1F5F9`, `--color-border:#334155`,
   `--color-white:#1E293B`, sombras dark…).
3. WHEN um primitivo usa uma classe Tailwind de cor/raio/sombra/fonte (ex.: `bg-cta`, `text-fg`,
   `border-border`, `rounded-md`, `shadow-sm`, `font-heading`) THEN o sistema SHALL resolvê-la para o
   token CSS correspondente (mapeamento em `tailwind.config.ts theme.extend`).
4. WHEN `tailwind.config.ts` é carregado THEN `darkMode` SHALL ser `['selector','[data-theme="dark"]']`
   para que utilitários `dark:` (quando usados) casem com o mesmo mecanismo dos tokens.

**Independent Test**: Import de `globals.css` num teste de leitura de arquivo confirma os pares
token→valor (light e dark); teste de `tailwind.config.ts` confirma as chaves mapeadas e o `darkMode`.
Build (`npm run build`) compila sem erro de token/purge.

---

### P1: Primitivos React reutilizáveis em `src/shared/ui/` ⭐ MVP

**User Story**: Como desenvolvedor de UI, quero as classes de componente do protótipo como primitivos
React tipados com API previsível, para compor telas sem reescrever CSS.

**Why P1**: São o vocabulário de composição de toda a Fase 1.

**Acceptance Criteria**:

1. WHEN importo de `@/shared/ui` THEN o barrel SHALL exportar: `Button`, `Input`, `Label`, `Textarea`,
   `Card`, `FormCard`, `FormSectionTitle`, `FormHeader`, `StepIcon`, `FormRow`, `LgpdBox`, `LgpdCheck`,
   `Badge`, `ThemeToggle`, `ThemeScript`, `cn`.
2. WHEN renderizo `<Button variant="primary">` THEN o sistema SHALL aplicar o estilo `.btn-primary` do
   protótipo (fundo CTA laranja, hover `--color-cta-hover`); `variant` cobre `primary|secondary|outline`
   e `size` cobre `sm|default|lg` (via cva), casando `.btn-sm`/`.btn-lg`.
3. WHEN renderizo `<Button asChild>` com um `<a>` filho THEN o sistema SHALL renderizar o filho com as
   classes do botão (Radix `Slot`), sem `<button>` extra.
4. WHEN renderizo `<Input>`/`<Textarea>` THEN o sistema SHALL aplicar a borda 1.5px `--color-border`,
   raio `sm` e o anel de foco `--color-primary` do protótipo, e SHALL encaminhar `ref` e todos os
   atributos nativos (compatível com `react-hook-form register`).
5. WHEN renderizo `<StepIcon variant="blue|orange|green">` THEN o sistema SHALL aplicar as combinações
   de fundo/cor do protótipo (`.step-icon-*`) inclusive nas variantes dark.
6. WHEN renderizo `<FormRow>` THEN o sistema SHALL exibir grid 2 colunas que colapsa para 1 coluna em
   telas estreitas (`.form-row` + media query do protótipo).
7. WHEN renderizo `<Badge variant="blue|orange|green|gray">` THEN o sistema SHALL aplicar as cores de
   `.badge-*` (light e dark).
8. WHEN qualquer primitivo é montado THEN ele SHALL usar **apenas** classes mapeadas por token — nunca
   hex cru nem utilitário de paleta fixa (ver DS-MN-02).

**Independent Test**: Testes RTL por primitivo verificam classes/estrutura e o forward de `ref`/props;
render sob `data-theme="dark"` confirma que variantes dark não quebram. Barrel importável sem erro de
tipos (`npm run typecheck`).

---

### P1: Modo escuro no App Router sem lib de estado ⭐ MVP

**User Story**: Como usuário, quero alternar tema claro/escuro e ter minha escolha persistida sem
flash de conteúdo incorreto, para conforto visual.

**Why P1**: O protótipo é theme-aware; a fundação precisa entregar o mecanismo, não só as cores.

**Acceptance Criteria**:

1. WHEN o documento carrega THEN `ThemeScript` (script inline no `<head>`) SHALL setar
   `document.documentElement.dataset.theme` a partir de `localStorage.theme` (ou `prefers-color-scheme`)
   **antes da pintura**, sem FOUC.
2. WHEN o usuário aciona `<ThemeToggle>` THEN o sistema SHALL alternar `data-theme` no `<html>` e
   persistir a escolha em `localStorage`, usando apenas React nativo (`useState`/`useEffect`) — sem
   Redux/MobX/Zustand/Jotai nem `next-themes`.
3. WHEN `data-theme` muda THEN todos os primitivos SHALL refletir o tema pela re-resolução das
   variáveis CSS (sem re-render manual de cor).

**Independent Test**: Teste RTL do `ThemeToggle` confirma o toggle de `data-theme` e a escrita no
`localStorage`; leitura do `layout.tsx` confirma presença do `ThemeScript` inline.

---

### P1: Fontes auto-hospedadas ⭐ MVP

**User Story**: Como operador, quero as fontes servidas pelo próprio app, para a tipografia não depender
de CDN externo (indisponível em produção).

**Why P1**: DS-MN-01; sem isso a tipografia quebra em prod.

**Acceptance Criteria**:

1. WHEN o app é buildado THEN `Nunito` e `DM Sans` SHALL ser carregadas via `next/font/google`
   (auto-hospedagem no build), expostas como CSS vars (`--font-nunito`, `--font-dm-sans`) e aplicadas no
   `<html>`/`<body>` do root layout.
2. WHEN o Tailwind resolve `font-sans`/`font-heading` THEN SHALL apontar para `--font-dm-sans` e
   `--font-nunito` respectivamente.

**Independent Test**: Leitura de `layout.tsx` confirma import de `next/font/google` e aplicação das
vars; guarda estática confirma ausência de `<link>`/`@import` para `fonts.googleapis.com`/`gstatic`.

---

### P1: Prova de paridade na tela de login ⭐ MVP

**User Story**: Como revisor, quero ver a fundação aplicada de fato em uma tela real, para confirmar
que ela substitui o estilo ad-hoc e atinge paridade com o protótipo.

**Why P1**: Fundação sem prova de aplicação é "construída mas não provada"; o smoke fecha o loop.

**Acceptance Criteria**:

1. WHEN a página de login renderiza THEN ela SHALL usar os primitivos (`FormCard`, `FormHeader`,
   `Button`, `Input`, `Label`) e os tokens/fonte/tema — sem `bg-blue-600`, `text-gray-*` cru,
   `system-ui` ou `ring-blue-*` hardcoded (ver DS-MN-03).
2. WHEN o login é aberto THEN os fluxos existentes SHALL ser preservados: `LoginForm` mantém RHF+Zod,
   `loginAction`, mensagem única anti-enumeração e navegação de `redirectTo` — só o estilo muda.
3. WHEN `data-theme="dark"` está ativo THEN a tela de login SHALL exibir corretamente no tema escuro
   (superfícies/inputs/botão via tokens).

**Independent Test**: Teste RTL do login confirma render dos primitivos e preservação de labels/erros;
guarda estática confirma ausência de utilitários de paleta crua nos arquivos do login; `npm run build`
compila a rota.

---

## Edge Cases

- WHEN `localStorage` está indisponível (SSR / navegador privado) THEN `ThemeScript`/`ThemeToggle`
  SHALL degradar para `prefers-color-scheme` sem lançar exceção.
- WHEN um primitivo recebe `className` extra THEN o sistema SHALL mesclar via `cn` (tailwind-merge)
  sem duplicar/contradizer classes de token.
- WHEN `<Button asChild>` recebe múltiplos filhos THEN o comportamento SHALL seguir o contrato do Radix
  `Slot` (um único filho) — documentado.
- WHEN a viewport é estreita THEN `<FormRow>` SHALL colapsar para 1 coluna (media query do protótipo).
- WHEN o Tailwind faz purge THEN as classes mapeadas por token (usadas só nos primitivos) SHALL
  permanecer no CSS final (content globs já cobrem `src/shared/**`).

---

## Must-Nots (world-level prohibitions)

O que NUNCA pode acontecer, por qualquer caminho. Cada um exige um teste negativo (guarda estática no
padrão `src/shared/__tests__/*.test.ts`, `node:fs`) asseverando que o resultado proibido não ocorre.

| ID | WHEN [context] THEN system SHALL NOT… | Prevents | Owning task | Negative test |
|---|---|---|---|---|
| DS-MN-01 | WHEN a fundação carrega fontes THEN SHALL NOT referenciar host externo de fonte (`fonts.googleapis.com`/`fonts.gstatic.com`) via `<link>`/`@import` em `globals.css`/`layout.tsx`/repo — fontes só via `next/font`. | Tipografia quebrada / falha de CSP em prod (sem CDN externo). | T3 | `src/shared/__tests__/ds-no-external-fonts.test.ts` |
| DS-MN-02 | WHEN um primitivo de `src/shared/ui/**` é estilizado THEN SHALL NOT conter hex cru (`#RRGGBB`) nem utilitário de paleta fixa (`bg-blue-600`, `text-orange-500`, `border-slate-*`, `text-gray-*`) para superfícies temáticas — só classes mapeadas por token. | Quebra de dark-mode / drift da fonte única de tokens. | T12 | `src/shared/__tests__/ds-ui-uses-tokens.test.ts` |
| DS-MN-03 | WHEN a tela de login (page + `LoginForm`) é migrada THEN SHALL NOT reter utilitários de paleta crua (`bg-blue-600`, `text-gray-*`, `ring-blue-*`, `system-ui`). | "Fundação construída mas não provada" — smoke que o DS de fato substitui o ad-hoc. | T13 | `src/shared/__tests__/ds-login-parity.test.ts` |
| DS-MN-04 | WHEN `globals.css` define o tema THEN SHALL NOT manter o bloco legado `@media (prefers-color-scheme: dark)` sobrescrevendo `--background`/`--foreground` que conflita com `[data-theme]`. | Dois mecanismos de dark-mode concorrentes → tema inconsistente. | T2 | `src/shared/__tests__/ds-single-dark-mechanism.test.ts` |
| DS-MN-05 | WHEN a fundação adiciona dependências/pastas THEN SHALL NOT introduzir lib de estado proibida (Redux/MobX/Zustand/Jotai), CSS-in-JS runtime, lib de data alternativa, nem 4ª pasta de topo em `src/`. | Violação de arquitetura (CLAUDE.md: libs proibidas + raiz `src/` fechada). | T1 (deps) + guarda `closed-src-root` existente (pastas) | `src/shared/__tests__/ds-no-forbidden-deps.test.ts` (+ `closed-src-root.test.ts` reusado) |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
|---|---|---|---|
| DS-01 | P1: Tokens (globals.css valores light) | Execute | Implementing |
| DS-02 | P1: Tokens (dark override `[data-theme]`) | Execute | Implementing |
| DS-03 | P1: Tokens (mapeamento Tailwind theme.extend) | Execute | Implementing |
| DS-04 | P1: Tokens (`darkMode` selector) | Execute | Implementing |
| DS-05 | P1: Primitivos (barrel exporta o inventário) | Execute | Implementing |
| DS-06 | P1: Button (cva variant/size + asChild) | Execute | Implementing |
| DS-07 | P1: Input/Textarea/Label (ref forward + foco) | Execute | Implementing |
| DS-08 | P1: StepIcon (cva blue/orange/green + dark) | Execute | Implementing |
| DS-09 | P1: FormRow (grid responsivo) | Execute | Implementing |
| DS-10 | P1: Badge (cva variant + dark) | Execute | Implementing |
| DS-11 | P1: FormCard/FormSectionTitle/Card/FormHeader/LgpdBox/LgpdCheck | Execute | Implementing |
| DS-12 | P1: Primitivos só com classes token (DS-MN-02) | Execute | Implementing |
| DS-13 | P1: ThemeScript anti-FOUC | Execute | Implementing |
| DS-14 | P1: ThemeToggle (React nativo + localStorage) | Execute | Implementing |
| DS-15 | P1: Re-resolução de tema por variáveis CSS | Execute | Implementing |
| DS-16 | P1: Fontes via next/font (auto-hospedadas) | Execute | Implementing |
| DS-17 | P1: font-sans/font-heading mapeadas | Execute | Implementing |
| DS-18 | P1: Login usa primitivos/tokens (paridade) | Execute | Implementing |
| DS-19 | P1: Login preserva fluxos (RHF/Zod/action) | Execute | Implementing |
| DS-20 | P1: Login correto no dark | Execute | Implementing |
| DS-MN-01 | Must-Not: sem host externo de fonte | Execute | Implementing |
| DS-MN-02 | Must-Not: primitivos só com token | Execute | Implementing |
| DS-MN-03 | Must-Not: login sem paleta crua | Execute | Implementing |
| DS-MN-04 | Must-Not: mecanismo único de dark | Execute | Implementing |
| DS-MN-05 | Must-Not: sem dep/pasta proibida | Execute | Implementing |

**ID format:** `DS-NN` / must-nots `DS-MN-NN`.
**Status values:** Pending → In Design → In Tasks → Implementing → Verified
**Coverage:** 25 requisitos totais (20 funcionais + 5 must-nots); mapeamento para tarefas em tasks.md.

---

## Success Criteria

- [ ] `src/shared/ui/index.ts` exporta os 15 primitivos + `cn`; `npm run typecheck` limpo.
- [ ] `globals.css` + `tailwind.config.ts` reproduzem os tokens do protótipo 1:1 (light + dark),
  confirmado por teste de leitura de arquivo.
- [ ] Modo escuro alterna por `[data-theme]` sem lib de estado e sem FOUC.
- [ ] Nunito + DM Sans auto-hospedadas; zero referência a CDN de fonte no repo.
- [ ] Tela de login renderiza com os primitivos/tokens, preserva os fluxos e some com toda paleta crua.
- [ ] Os 5 must-nots têm teste negativo verde.
- [ ] Gates verdes: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
</content>
</invoke>
