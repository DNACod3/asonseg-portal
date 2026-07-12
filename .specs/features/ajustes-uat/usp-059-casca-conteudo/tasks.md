# USP-059 — Casca e Conteúdo · Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the project's spec-driven execution skill: **activate it by name
(`bravi-spec-driven`, ou `idsd-spec-driven` conforme o orquestrador) and follow its Execute flow and
Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for
the per-task cycle (implement → gate → atomic commit), the test producer (`skill-tdad`), the adequacy
review, and the independent Verifier + discrimination sensor.

**If the skill cannot be activated, STOP and tell the orchestrator — do not proceed without it.**

**Spec:** `./spec.md` · **Design:** `./design.md`
**Status:** Implemented — todas as 11 tasks concluídas e commitadas (aguardando Verify)

---

## 0. Entry Gate — PASSED

Re-read `spec.md` → Assumptions & Open Questions. O único owner externo é **D-002 (conteúdo jurídico de
`/termos` e `/privacidade`, jurídico/DPO)**. A **implementação (placeholder honesto) NÃO depende** dessa
decisão — foi desenhada para ser independente dela (A1). Nenhum outro item de owner externo bloqueia a
implementação. **→ A USP entra em task breakdown.** (O conteúdo jurídico real permanece fora de escopo,
gate humano.)

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec. Guidelines encontradas: `CLAUDE.md` (Testing Requirements),
> `docs/arch/project-guideline.md`, `vitest`/`playwright` scripts em `package.json`. Não há novo teste de
> integração/DB (nenhuma mudança toca Prisma/Server Action).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Função pura de domínio (`parseTermMarkdown`, mapas de rótulo) | unit | Todos os ramos; 1:1 aos construtos/valores de enum; edge cases (fallback, HTML-like) | `src/modules/**/__tests__/*.test.ts`, `src/shared/ui/__tests__/*.test.ts(x)` | `npm run test` |
| Componente/página sem IO de servidor (`not-found`, `TermMarkdown`, `termos`/`privacidade`, painel consolidado) | unit (RTL) | Render + asserts de ACs + teste negativo do must-not | `src/**/*.test.tsx`, `src/**/__tests__/*.test.tsx` | `npm run test` |
| Guard estático (MN-01 import-scan; MN-03 dep-scan) | unit | Falha se o import/dep proibido aparecer | `src/shared/__tests__/*.test.ts` | `npm run test` |
| Página de rota com IO de servidor, alterada só p/ reusar constantes já testadas (`pessoas/[id]`) | none | Build + typecheck (sem nova lógica; valores cobertos pelos testes de constante) | — | build gate |
| Asset (`src/app/icon.svg`) | none | Build gate + inspeção do `<head>` | — | build gate |
| Docs (SOC-6) | none | Verificação por grep + `git diff` sem `src/` | — | none |

**Nota:** o projeto tem gate de cobertura (target 70%, CI falha <65%). As funções puras (parser, mapas) são
o vetor de maior densidade de teste e NÃO arrastam barrels de módulo para o grafo (lição do projeto sobre
queda de branch) — priorizar testes de helper puro.

## Parallelism Assessment

> Gerada de codebase.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (funções puras) | Yes | Sem estado compartilhado, sem IO | `src/**/__tests__/*.test.ts` (ex.: `identity/domain`) |
| unit (RTL componentes/páginas) | Yes | Render isolado por teste, sem DB | `src/app/(public)/page.test.tsx`, `src/shared/ui/__tests__/lgpd-box.test.tsx` |
| guard estático | Yes | Lê fonte/`package.json`, sem estado | `src/shared/__tests__/casca-no-auth-pii.test.ts` |
| integração (`*.int.test.ts`) | No (N/A) | — | **Nenhuma nesta feature** (sem mudança de DB/Server Action) |

Todas as tarefas usam apenas testes parallel-safe → `[P]` permitido quando não há dependência de código.

## Gate Check Commands

> Gerada de codebase (`package.json`).

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Tarefas com só unit de função pura/constante | `npm run test` |
| Full | Tarefas de componente/uso (renderer, painel, forms) | `npm run test && npm run lint && npm run typecheck` |
| Build | Tarefas que criam rota/asset (`not-found`, `termos`, `privacidade`, `icon.svg`) | `npm run build && npm run lint && npm run typecheck && npm run test` |
| None | Docs-only (SOC-6) | grep de verificação + `git diff --stat` (sem `src/`) |

---

## Execution Plan

### Phase 1: Foundations & folhas independentes (paralelo — sem deps)

```
T1 [P]  T2 [P]  T3 [P]  T4 [P]  T7 [P]  T8 [P]  T11 [P]
```

### Phase 2: Adoção / aplicação (paralelo — dependem da Phase 1)

```
T4 ──┬──→ T5 [P]
     └──→ T6 [P]
T7 ──┬──→ T10 [P]
     └──┐
T8 ──┬──┴──→ T9 [P]
```

> 2 fases → abaixo do limiar de >3 fases; execução inline (sem sub-agente por fase). Verifier sempre roda ao final.

---

## Task Breakdown

### T1: Página 404 global PT-BR com casca `[P]`

**What**: Criar `src/app/not-found.tsx` (Server Component) reusando `SiteHeader`/`SiteFooter`, em PT-BR, com link para a home; + guard de import MN-01.
**Where**: `src/app/not-found.tsx` (novo); `src/app/__tests__/not-found.test.tsx` (novo, RTL); `src/shared/__tests__/not-found-no-auth-pii.test.ts` (novo, guard MN-01).
**Depends on**: None
**Reuses**: `./(public)/_components/site-header`, `./(public)/_components/site-footer`, `FormHeader`/`Button` (`@/shared/ui`), container de `(public)/vagas/page.tsx`, estilo do guard `casca-no-auth-pii.test.ts`.
**Requirement**: PUB3-1, PUB3-2, PUB3-3, PUB3-4, CASCA59-MN-01

**Tools**: MCP: `context7` (convenção `not-found` já verificada) · Skill: `skill-tdad`

**Done when**:
- [x] `not-found.tsx` renderiza título/mensagem PT-BR, `SiteHeader` + `<main>` + `SiteFooter`, botão "Voltar para a home" → `/`, container com classes de token (PUB3-1..4).
- [x] Teste RTL: textos PT-BR presentes, `SiteHeader`/`SiteFooter` montados, link para `/` presente.
- [x] **Negative test (MN-01)**: guard falha se `not-found.tsx` importar `@/shared/lib/prisma`, `getCurrentPerson`, View Model, Server Action ou renderizar PII.
- [x] Gate passa: `npm run build && npm run lint && npm run typecheck && npm run test`
- [x] Test count: ≥2 testes passam (render + guard), sem deleções silenciosas.

**Tests**: unit · **Gate**: build
**Commit**: `feat(infra): 404 PT-BR com casca pública (PUB-3)`

---

### T2: Favicon `icon.svg` (identidade "A") `[P]`

**What**: Criar `src/app/icon.svg` com a marca "A" branca sobre gradiente azul `#2563EB→#3B82F6`.
**Where**: `src/app/icon.svg` (novo).
**Depends on**: None
**Reuses**: identidade `.logo-icon` do protótipo (`docs/prototipo/index.html`) e do header (`site-header.tsx`).
**Requirement**: PUB4-1, PUB4-2

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `src/app/icon.svg` é SVG válido com `linearGradient` `#2563EB`→`#3B82F6` e "A" branca (PUB4-2).
- [x] `npm run build` gera `<link rel="icon" type="image/svg+xml">` no `<head>` (PUB4-1) — inspecionar HTML servido.
- [x] Gate passa: `npm run build && npm run lint && npm run typecheck && npm run test`

**Tests**: none (asset — build gate) · **Gate**: build
**Commit**: `feat(infra): favicon "A" da ASONSEG (PUB-4)`

---

### T3: Páginas `/termos` e `/privacidade` (placeholder honesto) `[P]`

**What**: Criar as duas páginas placeholder no grupo público com casca + aviso "em elaboração"; sem termo/aceite; + teste MN-02.
**Where**: `src/app/(public)/termos/page.tsx`, `src/app/(public)/privacidade/page.tsx` (novos); `src/app/(public)/__tests__/legal-placeholder.test.tsx` (novo, cobre as duas).
**Depends on**: None
**Reuses**: `FormHeader` (`@/shared/ui`), container/padrão de `(public)/vagas/page.tsx`, casca via `(public)/layout.tsx`.
**Requirement**: AUTH2-1, AUTH2-2, AUTH2-3, CASCA59-MN-02

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [x] `/termos` e `/privacidade` = Server Components estáticos, cada um com `FormHeader` (título) + aviso PT-BR "documento em elaboração / disponível em breve" (AUTH2-1, AUTH2-2).
- [x] **Negative test (MN-02)**: cada página renderiza o marcador de placeholder, **não** oferece controle de aceite/checkbox/botão de consentimento e **não** importa/chama `loadTerm`/`LgpdBox`/`legal/consent-terms` (AUTH2-3).
- [x] Cohesive: 2 páginas-irmãs, mesma forma (~15 linhas), mesmo achado AUTH-2 (ver Granularity Check).
- [x] Gate passa: `npm run build && npm run lint && npm run typecheck && npm run test`
- [x] Test count: ≥2 asserts (uma por página), sem deleções silenciosas.

**Tests**: unit · **Gate**: build
**Commit**: `feat(infra): placeholder /termos e /privacidade (AUTH-2)`

---

### T4: Componente `TermMarkdown` + parser puro `[P]`

**What**: Criar `parseTermMarkdown` (função pura) + `TermMarkdown` (componente) em `shared/ui`, cobrindo os construtos usados nos termos, sem dependência nova e sem `dangerouslySetInnerHTML`.
**Where**: `src/shared/ui/term-markdown.tsx` (novo) + export em `src/shared/ui/index.ts`; `src/shared/ui/__tests__/term-markdown.test.tsx` (novo); `src/shared/__tests__/no-markdown-dep.test.ts` (novo, guard MN-03).
**Depends on**: None
**Reuses**: classes de token de `@/shared/ui`; corpo já sem front-matter (`stripTermFrontMatter`).
**Requirement**: AUTH6-1, AUTH6-2, AUTH6-3, CASCA59-MN-03, CASCA59-MN-04

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [x] `parseTermMarkdown` reconhece H1 (`#`), H2 (`##`), negrito (`**`), lista (`- `), citação (`> `), régua (`---`), código inline (`` ` ``), parágrafos; `TermMarkdown` renderiza os elementos correspondentes com classes de token (AUTH6-1).
- [x] Unit tests 1:1 por construto: `#`/`**`/`-`/`>` **não** aparecem como texto literal no output (AUTH6-2); construto desconhecido vira texto inerte sem lançar (AUTH6-3); corpo `TERM_BODY_UNAVAILABLE` renderiza como parágrafo (EC-2).
- [x] **Negative test (MN-03)**: guard falha se `package.json` contiver `react-markdown|remark|rehype|marked|markdown-it`.
- [x] **Negative test (MN-04)**: input `<script>alert(1)</script>` e `<b>x</b>` renderizam como texto literal — sem elemento `<script>`/`<b>` no DOM e sem `dangerouslySetInnerHTML` na fonte.
- [x] Gate passa: `npm run test && npm run lint && npm run typecheck`
- [x] Test count: ≥10 testes (≥1 por construto + 2 negativos + degradação + fallback).

**Tests**: unit · **Gate**: full
**Commit**: `feat(consents): renderer mínimo de Markdown de termos (AUTH-6)`

---

### T5: Adotar `TermMarkdown` nos 4 formulários `[P]`

**What**: Substituir o `<div … whitespace-pre-wrap>{term.body}</div>` por `<TermMarkdown source={term.body} …/>` nos 4 forms (swap mecânico idêntico), preservando o wrapper de scroll e o `aria-label`.
**Where**: `src/modules/persons/components/candidate-form.tsx`, `src/modules/persons/components/provider-form.tsx`, `src/modules/companies/components/create-company-form.tsx`, `src/modules/cv-extraction/components/CvUploadForm.tsx`; testes co-locados desses componentes (atualizar/estender).
**Depends on**: T4
**Reuses**: `TermMarkdown` (T4).
**Requirement**: AUTH6-4

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [x] Os 4 forms exibem o termo via `TermMarkdown` (não mais `{term.body}` cru); wrapper de scroll (`max-h-… overflow-y-auto`) e `aria-label` preservados.
- [x] Teste de cada form: sintaxe Markdown crua não aparece como texto; termo renderizado (ex.: heading/negrito presentes).
- [x] Cohesive: swap idêntico em 4 call sites do mesmo requisito AUTH6-4 (ver Granularity Check).
- [x] Gate passa: `npm run test && npm run lint && npm run typecheck`
- [x] Test count: testes existentes desses forms continuam verdes + asserts de render do termo.

**Tests**: unit · **Gate**: full
**Commit**: `refactor(consents): render de termo nos formulários (AUTH-6)`

---

### T6: Adotar `TermMarkdown` no painel de consentimentos `[P]`

**What**: Substituir `<div … whitespace-pre-wrap>{item.termBody}</div>` por `<TermMarkdown source={item.termBody} …/>` no `consents-panel.tsx`, preservando o toggle "Ver termo aceito".
**Where**: `src/modules/consents/components/consents-panel.tsx`; `src/modules/consents/__tests__/…` (atualizar/estender).
**Depends on**: T4
**Reuses**: `TermMarkdown` (T4); comportamento "Ver termo aceito" (preservado — USP-043 AC#2).
**Requirement**: AUTH6-4

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [x] Ao abrir "Ver termo aceito", o corpo é renderizado via `TermMarkdown` (sem sintaxe crua); toggle e acessibilidade preservados.
- [x] Teste do painel: termo renderizado formatado; `#`/`**` não aparecem literais.
- [x] Gate passa: `npm run test && npm run lint && npm run typecheck`
- [x] Test count: testes existentes do painel verdes + assert de render.

**Tests**: unit · **Gate**: full
**Commit**: `refactor(consents): render de termo no painel de consentimentos (AUTH-6)`

---

### T7: `PERSON_STATUS_LABELS` (persons/domain) `[P]`

**What**: Criar a constante de rótulo PT-BR de `PersonStatus` e exportá-la pelo barrel `@/modules/persons`; + unit test 1:1.
**Where**: `src/modules/persons/domain/person-status-labels.ts` (novo) + export em `src/modules/persons/index.ts`; `src/modules/persons/__tests__/person-status-labels.test.ts` (novo).
**Depends on**: None
**Reuses**: enum `PersonStatus` (`@prisma/client`); literal já usado em `pessoas/[id]/page.tsx:57-59`.
**Requirement**: SOC4-2 (fundação)

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [x] `PERSON_STATUS_LABELS: Record<PersonStatus,string> = { ATIVO:'Ativa', INATIVO:'Inativa' }`, exportado pelo barrel.
- [x] Unit test: cobre **todos** os valores de `PersonStatus` (1:1), valores PT-BR corretos (também são os que `pessoas/[id]` usará em T10).
- [x] Gate passa: `npm run test`
- [x] Test count: ≥1 teste (mapeamento completo) passa.

**Tests**: unit · **Gate**: quick
**Commit**: `feat(persons): rótulos PT-BR de status de pessoa (SOC-4)`

---

### T8: `COMPANY_GRANT_STATUS_LABELS` (companies/domain) `[P]`

**What**: Criar a constante de rótulo PT-BR de `CompanyGrantStatus` e exportá-la pelo barrel `@/modules/companies`; + unit test 1:1.
**Where**: `src/modules/companies/domain/company-grant-status-labels.ts` (novo) + export em `src/modules/companies/index.ts`; `src/modules/companies/__tests__/company-grant-status-labels.test.ts` (novo).
**Depends on**: None
**Reuses**: enum `CompanyGrantStatus` (`@prisma/client`).
**Requirement**: SOC4-3 (fundação)

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [x] `COMPANY_GRANT_STATUS_LABELS: Record<CompanyGrantStatus,string> = { PENDING:'Pendente', ACTIVE:'Ativo' }`, exportado pelo barrel.
- [x] Unit test: cobre todos os valores de `CompanyGrantStatus` (1:1).
- [x] Gate passa: `npm run test`
- [x] Test count: ≥1 teste passa.

**Tests**: unit · **Gate**: quick
**Commit**: `feat(companies): rótulos PT-BR de status de vínculo (SOC-4)`

---

### T9: Rótulos PT-BR no painel consolidado + guard MN-05 `[P]`

**What**: Trocar os 4 badges crus de `consolidated-person-panel.tsx` por rótulos PT-BR (papel, status pessoa, status serviço, status vínculo); + teste negativo de "nenhum enum cru".
**Where**: `src/modules/persons/components/consolidated-person-panel.tsx`; `src/modules/persons/__tests__/consolidated-person-panel.test.tsx` (novo/estender).
**Depends on**: T7, T8
**Reuses**: `ALL_ROLE_LABELS` (`@/modules/identity` — **não** o `ROLE_LABELS` de 3 `PublicRole`), `PERSON_STATUS_LABELS` (T7), `labelContentStatus` (`@/modules/reporting`), `COMPANY_GRANT_STATUS_LABELS` (T8).
**Requirement**: SOC4-1, SOC4-2, SOC4-3, CASCA59-MN-05

**Tools**: MCP: NONE · Skill: `skill-tdad`

**Done when**:
- [x] Badge de papel → `ALL_ROLE_LABELS[role] ?? role`; status pessoa → `PERSON_STATUS_LABELS`; status serviço → `labelContentStatus(...)`; status vínculo → `COMPANY_GRANT_STATUS_LABELS` (SOC4-1..3). Lógica de `variant` do Badge intocada (opera sobre valor cru).
- [x] **Negative test (MN-05)**: render com fixture (papel `CANDIDATE`, status `ATIVO`, 1 serviço `ACTIVE`, 1 vínculo `PENDING`) mostra "Candidato(a)"/"Ativa"/rótulos PT-BR e **nenhum** token cru (`CANDIDATE`,`ATIVO`,`ACTIVE`,`PENDING`) presente.
- [x] Gate passa: `npm run test && npm run lint && npm run typecheck`
- [x] Test count: ≥2 (render de rótulos + negativo de enum cru).

**Tests**: unit · **Gate**: full
**Commit**: `feat(persons): rótulos PT-BR na visão consolidada (SOC-4)`

---

### T10: Dedup de rótulos em `pessoas/[id]` `[P]`

**What**: Remover o `ROLE_LABELS` inline (dup) e o ternário de status inline; consumir `ALL_ROLE_LABELS` + `PERSON_STATUS_LABELS`.
**Where**: `src/app/(app)/pessoas/[id]/page.tsx`.
**Depends on**: T7
**Reuses**: `ALL_ROLE_LABELS` (`@/modules/identity`), `PERSON_STATUS_LABELS` (T7).
**Requirement**: SOC4-4

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] `ROLE_LABELS` inline (l.17-26) removido → `ALL_ROLE_LABELS`; ternário de status (l.57-59) → `PERSON_STATUS_LABELS` — preservando comportamento (mesmos valores PT-BR).
- [x] Mudança preserva-comportamento (dedup): valores idênticos, cobertos pelos testes de T7 + teste existente de `ALL_ROLE_LABELS`; `tsc` valida os tipos dos mapas.
- [x] Gate passa: `npm run build && npm run lint && npm run typecheck && npm run test`

**Tests**: none (página com IO; dedup preserva-comportamento, valores cobertos por T7 — ver Test Co-location) · **Gate**: build
**Commit**: `refactor(persons): consolidar rótulos em pessoas/[id] (SOC-4)`

---

### T11: Alinhar literal do badge na spec e no TD (docs-only) `[P]`

**What**: Trocar o literal curto "Encaminhado pela ASONSEG" pelo canônico "Candidato encaminhado pela ASONSEG" na spec USP-037 e no TD §3.5; sem tocar código.
**Where**: `.specs/features/ficha-social-encaminhamento/usp-037-encaminhar-vaga/spec.md` (linhas 29, 56, 89, 96, 142); `docs/arch/technical-design.md` (linha 693).
**Depends on**: None
**Reuses**: literal canônico do PRD/épico AC-037-5 (`docs/prd/...:731`) e do código (`job-applicants-list.tsx:31`).
**Requirement**: SOC6-1, SOC6-2, SOC6-3

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [x] Spec USP-037: linhas 29/56/89/96/142 usam "Candidato encaminhado pela ASONSEG"; a racionalização da l.56 é reescrita (o canônico é o literal longo do épico, não a variante curta).
- [x] TD §3.5 (l.693) usa o literal longo.
- [x] **SOC6-3**: nenhum arquivo `src/**` alterado — `git diff --stat` não lista `src/`.
- [x] Verificação: `grep -rn "Encaminhado pela ASONSEG"` nos dois arquivos-alvo não retorna o literal curto isolado.

**Tests**: none (docs) · **Gate**: none (grep + `git diff`)
**Commit**: `docs(referrals): alinhar literal do badge à fonte canônica (SOC-6)`

---

## Parallel Execution Map

```
Phase 1 (sem deps — order-free):
  T1 [P]   T2 [P]   T3 [P]   T4 [P]   T7 [P]   T8 [P]   T11 [P]

Phase 2 (após Phase 1 — order-free dentro da fase):
  T4 done → T5 [P], T6 [P]
  T7 done → T10 [P]
  T7+T8 done → T9 [P]
```

`[P]` = sem dependência inter-tarefa dentro da fase (todas as tarefas usam testes parallel-safe).

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: not-found + guard | 1 rota + 2 testes coesos | ✅ Granular |
| T2: icon.svg | 1 asset | ✅ Granular |
| T3: /termos + /privacidade | 2 páginas-irmãs idênticas, 1 achado | ✅ Cohesive (mesma forma, ~15 linhas cada) |
| T4: TermMarkdown + parser | 1 componente + 1 fn pura (mesmo arquivo) | ✅ Granular |
| T5: adotar renderer (4 forms) | swap mecânico idêntico, 1 requisito AUTH6-4 | ✅ Cohesive (refactor uniforme) |
| T6: adotar renderer (painel) | 1 arquivo | ✅ Granular |
| T7: PERSON_STATUS_LABELS | 1 constante | ✅ Granular |
| T8: COMPANY_GRANT_STATUS_LABELS | 1 constante | ✅ Granular |
| T9: painel consolidado + MN-05 | 1 componente | ✅ Granular |
| T10: dedup pessoas/[id] | 1 arquivo | ✅ Granular |
| T11: docs SOC-6 | 2 docs, 1 reconciliação | ✅ Cohesive (docs-only) |

**Cohesive justificado (T3, T5, T11):** swaps/edições mecânicas e idênticas de um mesmo requisito, não múltiplos conceitos — mantidos coesos para evitar cerimônia de tarefas triviais (permitido pela skill).

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | (Phase 1, sem seta) | ✅ Match |
| T2 | None | (Phase 1) | ✅ Match |
| T3 | None | (Phase 1) | ✅ Match |
| T4 | None | (Phase 1) | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T4 | T4 → T6 | ✅ Match |
| T7 | None | (Phase 1) | ✅ Match |
| T8 | None | (Phase 1) | ✅ Match |
| T9 | T7, T8 | T7 → T9, T8 → T9 | ✅ Match |
| T10 | T7 | T7 → T10 | ✅ Match |
| T11 | None | (Phase 1) | ✅ Match |

Tarefas `[P]` na mesma fase não dependem entre si (T5⊥T6; T9⊥T10). ✅

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Componente/página sem IO + guard | unit | unit | ✅ OK |
| T2 | Asset | none | none | ✅ OK |
| T3 | Página sem IO | unit | unit | ✅ OK |
| T4 | Função pura + componente + guard | unit | unit | ✅ OK |
| T5 | Componente (form) | unit | unit | ✅ OK |
| T6 | Componente (painel consent) | unit | unit | ✅ OK |
| T7 | Função/constante de domínio | unit | unit | ✅ OK |
| T8 | Função/constante de domínio | unit | unit | ✅ OK |
| T9 | Componente sem IO | unit | unit | ✅ OK |
| T10 | Página de rota com IO, dedup preserva-comportamento | none (build gate) | none | ✅ OK |
| T11 | Docs | none | none | ✅ OK |

**T10 justificado:** a página faz IO de servidor e a mudança é dedup preserva-comportamento (mesmos valores
PT-BR já testados em T7 + teste de `ALL_ROLE_LABELS`); `tsc` valida os tipos. Não é deferral de teste — não
há lógica nova para testar. Matrix classifica essa camada como "none — build gate".

---

## Must-Not Ownership

| Must-Not | Owning Task | Negative test no `Done when`? |
| -------- | ----------- | ----------------------------- |
| CASCA59-MN-01 (404 sem auth/PII) | T1 | ✅ guard de import |
| CASCA59-MN-02 (placeholder honesto, sem aceite) | T3 | ✅ marcador presente + sem controle de aceite + sem `loadTerm` |
| CASCA59-MN-03 (sem dep nova) | T4 | ✅ guard de `package.json` |
| CASCA59-MN-04 (sem HTML injetado) | T4 | ✅ `<script>`/`<b>` inerte |
| CASCA59-MN-05 (sem enum cru no painel) | T9 | ✅ fixture sem token cru |

Todos os 5 must-nots têm task dona e teste negativo. ✅

---

## MCPs e Skills (modo autônomo — resolvido sem prompt)

- **`skill-tdad`**: produtor de testes (facts/specs red) para T1, T3, T4, T5, T6, T7, T8, T9 — acionado dentro do Execute.
- **`context7`**: consulta de convenção Next (já verificada para `not-found`/`icon`) — opcional em T1/T2.
- **Sem MCP/Skill de teste** em T2 (asset), T10 (dedup preserva-comportamento) e T11 (docs).
