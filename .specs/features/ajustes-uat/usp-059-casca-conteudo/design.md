# USP-059 — Casca e Conteúdo · Design

**Spec:** `./spec.md` · **Sizing:** Large (6 áreas, 5 must-nots, sem migração)
**Premissa transversal:** sem mudança de arquitetura, sem dependência nova, PT-BR, reuso máximo.

Este design **referencia** decisões já existentes (casca USP-046, View Models, metadata do Next, ADR-0013)
e não as re-decide. Fatos de código abaixo foram levantados diretamente no repositório.

---

## 1. PUB-3/SOC-3 — Página 404 (`src/app/not-found.tsx`)

**Convenção Next (verificada via context7):** o root `app/not-found.tsx` renderiza **dentro do root
layout** (`src/app/layout.tsx` já fornece `<html lang="pt-BR">`, `<body>`, fontes Nunito/DM Sans e
theme-script) e é acionado por rotas inexistentes **e** por `notFound()` não capturado por um
`not-found` mais próximo. Não há `(app)/not-found.tsx` → este global cobre todos os grupos. Escolhido
`not-found.tsx` (não `global-not-found.tsx`, que ignoraria o layout) — decisão A9.

**Reuso da casca:** como o root `not-found` não é envolvido pelo `(public)/layout.tsx`, a página monta a
casca ela mesma, reusando os componentes do grupo público:

```
src/app/not-found.tsx  (Server Component, sem 'use client')
  ├─ import { SiteHeader } from './(public)/_components/site-header'
  ├─ import { SiteFooter } from './(public)/_components/site-footer'
  ├─ import { FormHeader, Button } from '@/shared/ui'
  └─ import Link from 'next/link'

  <SiteHeader />
  <main>
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <FormHeader title="Página não encontrada"
                  description="A página que você procura não existe ou foi movida." />
      <Button asChild><Link href="/">Voltar para a home</Link></Button>
    </div>
  </main>
  <SiteFooter />
```

- **Container/tokens:** replica o wrapper de `(public)/vagas/page.tsx` (`max-w-3xl … px-4 py-8`) e usa
  `FormHeader`/`Button` do `@/shared/ui` — só classes de token (PUB3-4).
- **Landmark:** um único `<main>` na própria página (o root layout não injeta `<main>`).
- **CASCA59-MN-01:** a página não importa nada de sessão/PII/View Model/prisma/Server Action. `SiteHeader`
  e `SiteFooter` já são Server Components estáticos sem sessão (garantidos pelos guards CASCA-MN-01).
- **Import cross-group:** `'./(public)/_components/…'` — `(public)` é diretório real e `_components` é
  pasta privada importável; caminho relativo a partir de `src/app/`.
- **Status HTTP:** o Next serve `not-found.tsx` com 404 automaticamente.

**Consequência aceita (A4/EC-1):** em 404 pós-login o header mostra "Entrar/Cadastrar" — Fase 9 (H-4).

---

## 2. PUB-4 — Favicon (`src/app/icon.svg`)

**Convenção Next (verificada via context7):** um arquivo `icon.(svg|png|…)` no topo de `app/` é detectado
e o Next injeta `<link rel="icon" type="image/svg+xml" href="/icon.svg?…">` no `<head>`. Zero código de
metadata, zero dependência (não há `public/` no projeto — SVG inline é o caminho limpo).

**Conteúdo (identidade existente — A2):** SVG estático desenhando a marca do protótipo
(`docs/prototipo/index.html` `.logo-icon`): quadrado com cantos arredondados, `linearGradient` de
`#2563EB` → `#3B82F6` (135°), letra "A" branca centralizada, fonte pesada.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#2563EB"/><stop offset="1" stop-color="#3B82F6"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="12" fill="url(#g)"/>
  <text x="32" y="45" text-anchor="middle" font-family="'Nunito',sans-serif"
        font-weight="900" font-size="40" fill="#fff">A</text>
</svg>
```

- **Hex literal:** aceitável — é um asset (favicon), fora do escopo do guard CASCA-MN-02 (que varre
  `(public)/_components/**`). Não é um componente temável.
- **Não inventa identidade:** só a marca "A"/azul já usada no header (`site-header.tsx`) e no protótipo.

---

## 3. AUTH-2 — `/termos` e `/privacidade` (placeholder)

Duas páginas estáticas no grupo público (herdam a casca via `(public)/layout.tsx`):

```
src/app/(public)/termos/page.tsx
src/app/(public)/privacidade/page.tsx
```

Cada uma: Server Component, sem `export const revalidate` (conteúdo 100% estático → prerender no build),
wrapper `max-w-3xl … px-4 py-8` + `FormHeader` (título "Termos de Uso" / "Política de Privacidade") +
um `<p>` com o aviso PT-BR de placeholder. **Sem** LgpdBox, **sem** `loadTerm`, **sem** controle de aceite.

- **CASCA59-MN-02:** o corpo é um marcador honesto ("Este documento está em elaboração e ficará
  disponível em breve.") — nenhum texto jurídico inventado; nenhuma ação de aceite.
- **Links do cadastro:** `RegisterPersonForm.tsx:221,225` já apontam `/termos` e `/privacidade`; criar as
  rotas os torna vivos sem tocar o form.
- **Duplicação mínima:** as duas páginas são quase idênticas; mantidas inline (curtas) — não se cria
  componente em `_components/**` para não entrar no escopo dos 4 guards da USP-046 (A8).

---

## 4. AUTH-6/EMP-7 — Renderer de Markdown do termo

**Fato:** `LgpdBox` (`src/shared/ui/lgpd-box.tsx`) só renderiza `{children}`; o despejo cru acontece nos
5 consumidores, em `<div className="… whitespace-pre-wrap …">{term.body|item.termBody}</div>`. Nenhuma lib
de markdown existe (e é proibida). O corpo chega já sem front-matter (`stripTermFrontMatter`).

**Construtos realmente usados nos 8 termos** (`legal/consent-terms/*/v1.0.md`): `#`, `##`, `**negrito**`,
lista `- `, citação `> `, régua `---`, código inline `` ` ``, parágrafos. **Ausentes:** H3+, itálico,
listas ordenadas, `*`-bullets, links, tabelas.

**Componente novo (sem dependência):** `src/shared/ui/term-markdown.tsx`

```
export function parseTermMarkdown(md: string): TermBlock[]   // função PURA, unit-testável 1:1
export function TermMarkdown({ source, className?, 'aria-label'?: … }): JSX.Element
```

- **Modelo:** `parseTermMarkdown` quebra o texto em blocos por linha
  (`heading1|heading2|list|blockquote|hr|paragraph`), e cada bloco em spans inline (`text|bold|code`).
  `TermMarkdown` mapeia blocos → `<h1>/<h2>/<ul><li>/<blockquote>/<hr>/<p>` e spans → `<strong>/<code>/texto`,
  tudo com classes de token (`text-fg`, `text-fg-muted`, `font-semibold`, etc.).
- **CASCA59-MN-04 (segurança):** renderiza **React elements** (nunca `dangerouslySetInnerHTML`). Qualquer
  `<...>` do conteúdo vira texto (React escapa automaticamente) → HTML-like é inerte.
- **AUTH6-3 (degradação):** linhas que não casam nenhum construto viram parágrafo de texto; nunca lança.
- **Localização:** `shared/ui` (componente genérico reutilizado por 4 módulos) + barrel `src/shared/ui/index.ts`.
- **Pureza p/ cobertura (lição do projeto):** o parser é função pura testada isoladamente — não arrasta
  barrels de módulo para o grafo de cobertura (evita queda de branch global).

**Adoção (AUTH6-4):** trocar o `<div>…{term.body}</div>` por `<TermMarkdown source={term.body} aria-label={…}/>`
(mantendo o wrapper de scroll `max-h-… overflow-y-auto`) em:
`candidate-form.tsx:211-216`, `provider-form.tsx:222-227`, `create-company-form.tsx:199-204`,
`CvUploadForm.tsx:190-195` e `consents-panel.tsx:130-134` (`{item.termBody}`).

---

## 5. SOC-4 — Rótulos PT-BR na visão consolidada

**Fato:** `src/modules/persons/components/consolidated-person-panel.tsx` (Server Component) renderiza cru:
papel `{role}` (linhas 42-46), status da Pessoa `{person.status}` (l.38), status de serviço
`{service.status}` (l.174, `ContentStatus`), status de vínculo `{grant.status}` (l.218, `CompanyGrantStatus`).
Mapas existentes: `ALL_ROLE_LABELS` (`@/modules/identity`, 8 papéis) e `labelContentStatus`
(`@/modules/reporting`). **Não existe** mapa PT-BR para `PersonStatus` nem `CompanyGrantStatus`.

**Constantes de domínio (novas, pequenas, unit-testáveis):**

```
src/modules/persons/domain/person-status-labels.ts
  export const PERSON_STATUS_LABELS: Record<PersonStatus,string> = { ATIVO:'Ativa', INATIVO:'Inativa' };
  // barrel: @/modules/persons

src/modules/companies/domain/company-grant-status-labels.ts
  export const COMPANY_GRANT_STATUS_LABELS: Record<CompanyGrantStatus,string> = { PENDING:'Pendente', ACTIVE:'Ativo' };
  // barrel: @/modules/companies
```

**Aplicação no painel (SOC4-1..3):**
- papel: `{ALL_ROLE_LABELS[role] ?? role}` (import `@/modules/identity` — **atenção**: usar `ALL_ROLE_LABELS`,
  não o `ROLE_LABELS` de 3 `PublicRole` que também é exportado do mesmo barrel).
- status Pessoa: `{PERSON_STATUS_LABELS[person.status] ?? person.status}`.
- status serviço: `{labelContentStatus(service.status)}` (reuso `@/modules/reporting` — A6).
- status vínculo: `{COMPANY_GRANT_STATUS_LABELS[grant.status] ?? grant.status}`.
- A lógica de `variant` do Badge (que já compara `=== 'ATIVO'`/`=== 'ACTIVE'`) permanece sobre o valor cru;
  só o **texto** muda para o rótulo.

**Dedup (SOC4-4):** `src/app/(app)/pessoas/[id]/page.tsx` — remover o `ROLE_LABELS` inline (l.17-26) e
importar `ALL_ROLE_LABELS`; trocar o ternário de status (l.57-59) por `PERSON_STATUS_LABELS`. Fecha a
duplicação que a USP-049 explicitamente deferiu para cá.

**CASCA59-MN-05:** com os quatro badges rotulados, nenhum token cru aparece; o teste do painel verifica.

---

## 6. SOC-6 — Alinhamento do literal (docs-only)

Literal canônico = **"Candidato encaminhado pela ASONSEG"** (PRD/épico AC-037-5, `docs/prd/...:731`; código
`src/modules/jobs/components/job-applicants-list.tsx:31` e testes já usam). Editar **apenas docs**:

- `.specs/features/ficha-social-encaminhamento/usp-037-encaminhar-vaga/spec.md` — linhas **29, 56, 89, 96, 142**
  (curto → longo). A linha 56 tem racionalização hoje incorreta ("texto canônico do TD §3.5"): reescrever para
  refletir que o canônico é o literal longo do épico (o código/PRD manda).
- `docs/arch/technical-design.md` — linha **693** (nota do diagrama §3.5).
- **SOC6-3:** nenhum arquivo em `src/**` é tocado.

---

## 7. Módulos, arquivos e contratos

| Área | Novo/Alterado | Caminho | Tipo |
| ---- | ------------- | ------- | ---- |
| PUB-3 | novo | `src/app/not-found.tsx` | Server Component |
| PUB-4 | novo | `src/app/icon.svg` | asset |
| AUTH-2 | novo | `src/app/(public)/termos/page.tsx`, `…/privacidade/page.tsx` | Server Components |
| AUTH-6 | novo | `src/shared/ui/term-markdown.tsx` (+ export no barrel) | fn pura + componente |
| AUTH-6 | alterado | `candidate-form.tsx`, `provider-form.tsx`, `create-company-form.tsx`, `CvUploadForm.tsx`, `consents-panel.tsx` | uso do renderer |
| SOC-4 | novo | `persons/domain/person-status-labels.ts`, `companies/domain/company-grant-status-labels.ts` (+ barrels) | constantes |
| SOC-4 | alterado | `consolidated-person-panel.tsx`, `pessoas/[id]/page.tsx` | uso dos mapas |
| SOC-6 | alterado (docs) | `usp-037…/spec.md`, `docs/arch/technical-design.md` | documentação |

**Reuso-chave:** `SiteHeader`/`SiteFooter`/`FormHeader`/`Button`/`Badge`/`Card` (shell + `@/shared/ui`);
`ALL_ROLE_LABELS` (`@/modules/identity`); `labelContentStatus` (`@/modules/reporting`);
padrão de container de página do `(public)`; `stripTermFrontMatter` (já entrega o corpo pronto).

---

## 8. Riscos e mitigação

| Risco | Mitigação |
| ----- | --------- |
| Import cross-group no `not-found` (`./(public)/_components/…`) falhar no build | Caminho relativo válido (diretório real); T1 valida com build gate. |
| Reuso `persons → reporting` (labelContentStatus) soar acoplamento | Constante pura exportada por barrel; A6 documenta; troca trivial p/ mapa local se a review preferir. |
| Renderer perder um construto e vazar sintaxe crua | Cobertura de teste 1:1 por construto (levantados dos 8 termos); AUTH6-3 garante degradação inerte. |
| Favicon SVG não renderizar "A" em todos navegadores | SVG favicon tem suporte amplo; fallback é o gradiente (marca preservada). Achado é P3. |
| SVG favicon com hex literal disparar guard de tokens | Guard varre `(public)/_components/**`; `src/app/icon.svg` está fora do escopo (A2). |

---

## 9. Testabilidade (entra na matriz do tasks.md)

- **Funções puras** (`parseTermMarkdown`, mapas de rótulo) → unit tests 1:1 (alta densidade, sem IO).
- **Componentes** (`not-found`, `TermMarkdown`, painel, páginas placeholder) → React Testing Library (render + asserts).
- **Guards estáticos** (MN-01 import-scan; MN-03 dep-scan) → unit tests de leitura de fonte/`package.json`.
- **Asset/docs** (`icon.svg`, SOC-6) → build gate / verificação por grep (sem teste unitário).
- **Sem integração/DB**: nenhuma mudança toca Prisma/Server Action → nenhum teste `*.int.test.ts`.
