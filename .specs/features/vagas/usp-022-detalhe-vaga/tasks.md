# USP-022 — Ver detalhe da vaga — Refactor (Fase 2 / Design System) — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the **`bravi-spec-driven`** skill: **activate it by name** and follow its Execute
flow and Critical Rules (per-task gate, atomic commit, independent Verifier, discrimination sensor, must-not
negative tests). Do not search for skill files by filesystem path. **If the skill cannot be activated, STOP
and report — do not proceed without it.**

**Design**: `.specs/features/vagas/usp-022-detalhe-vaga/design.md`
**Spec**: `.specs/features/vagas/usp-022-detalhe-vaga/spec.md`
**Status**: Draft

> **Escopo: restyle style-only (AD-015).** Muda-se **markup/classes**; **NÃO** se toca a fatia de dados: query
> `getActiveJobDetail` (on-read + contagem), View Model `viewJobDetail` (única fonte de anonimização + limiar
> do contador + flags por papel), `jobDetailJsonLd`/`serializeJsonLd`, `generateMetadata`, `revalidate=1800`,
> nem a injeção do `<script ld+json>` (sempre `viewJobDetail(row, null)`). Os testes existentes
> (`get-job-detail.int.test.ts`, `job-detail.view.spec.ts`, `job-detail.spec.tsx`) são **testes de
> preservação** — o restyle não pode torná-los vermelhos.
>
> **Reuso ancorado (não recriar):** DS `Card`/`FormCard`/`FormSectionTitle`/`Badge`/`Button`(+`asChild`)/`cn`
> via barrel `@/shared/ui`; `Badge variant` `blue`/`gray` (mesmo mapa do `job-card.tsx` da USP-021); tokens
> `text-fg`/`text-fg-muted`/`border-border`; guarda estática molde `companies/__tests__/no-external-verify.test.ts`.

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes do Execute. Guidelines: `CLAUDE.md` (§Testing —
> Server Action cobre happy/validação/permissão/consent/concorrência; E2E dos fluxos críticos), `AD-014/AD-015`
> (paridade DS + preservação de comportamento), `vitest.config.ts` (jsdom, exclui `*.int.test.ts`),
> `vitest.integration.config.ts` (node + Postgres local).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Componente de apresentação (`job-detail.tsx`) | unit (RTL) | Usa primitivos DS; CTA display-only (U22-MN-04); contador só `!= null` (U22-MN-02); `displayName` (nunca `nomeFantasia`) (U22-MN-01 lado componente) | `src/modules/jobs/__tests__/job-detail.spec.tsx` | `npm run test` |
| View Model (**preservado**) | unit | Já verde: anonimização (E-001/P-002), limiar (E-003/P-001), JSON-LD escapado | `src/modules/jobs/__tests__/job-detail.view.spec.ts` | `npm run test` |
| Rota + metadados/JSON-LD (`(public)/vagas/[id]/page.tsx`) | integration | Anônimo: **nenhum** canal (HTML/OG/Twitter/JSON-LD/canonical) contém `nomeFantasia` (U22-MN-01); on-read não-ativo ⇒ `null` → "encerrada" (U22-MN-03) | `src/modules/jobs/__tests__/*.int.test.ts` | `npm run test:integration` |
| Guarda estática de paridade DS | unit (`node:fs`) | Zero paleta crua (`bg-blue-600`/`text-gray-*`/`bg-gray-*`/`border-gray-*`) e zero hex literal nos 2 arquivos tocados (U22-MN-05) | `src/modules/jobs/__tests__/job-detail-ds-parity.test.ts` | `npm run test` |

## Parallelism Assessment

> Gerada de codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit / RTL / `node:fs` (`*.spec.tsx`, `*.test.ts`) | Yes | jsdom, sem store compartilhado; `node:fs` só lê fontes | `vitest.config.ts` (`environment:'jsdom'`, exclui `*.int.test.ts`); `no-external-verify.test.ts` |
| integration (`*.int.test.ts`) | No | Postgres local compartilhado + cleanup por delete/truncação | `vitest.integration.config.ts`; `get-job-detail.int.test.ts` |

## Gate Check Commands

> Gerada de codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com unit/RTL/guarda | `npm run test` |
| Full | Após tasks com integração (metadados/on-read) | `npm run test && npm run test:integration` |
| Build | Fim de fase / rota tocada | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` |

---

## Execution Plan

### Grafo de dependências

```
Fase 1 (Restyle — arquivos disjuntos):
  T1 [P]  restyle job-detail.tsx (JobDetailView)          [RTL, paralelo-seguro]
  T2      restyle page.tsx + teste P-002 de metadados     [integração, sequencial]

Fase 2 (Guarda — depois dos 2 restyles):
  T1,T2 ─▶ T3  guarda estática de paridade DS (node:fs)
```

Arestas (cross-check): T1→T3; T2→T3. T1 e T2 tocam **arquivos disjuntos** (`job-detail.tsx` × `page.tsx`) e
não têm dependência de código (o restyle do componente não muda a assinatura consumida por `page.tsx`) ⇒
sem aresta T1→T2. 2 fases (≤3) ⇒ execução inline, sem oferta de sub-agente. O Verifier independente roda
automaticamente após T3.

---

## Task Breakdown

### T1: Restyle `JobDetailView` (componente) para o Design System [P]

**What**: Reestilizar a apresentação do detalhe com `Card`/`FormCard`/`FormSectionTitle`, `Badge` (metadados) e
`Button` (CTAs), tokens light/dark — **preservando** todo o comportamento consumido do View Model.
**Where**: `src/modules/jobs/components/job-detail.tsx` (modify); `src/modules/jobs/__tests__/job-detail.spec.tsx` (estende).
**Depends on**: None
**Reuses**: `@/shared/ui` (`Card`/`FormCard`/`FormSectionTitle`/`Badge`/`Button`/`cn`); mapa de `Badge variant` do `job-card.tsx` (USP-021); `formatDate` (`shared/lib/time`).
**Requirement**: U22-STYLE-01 (AC P1-detalhe 1-5) · must-nots U22-MN-01(componente), U22-MN-02, U22-MN-04

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Raiz `<article>` → `Card`/`FormCard`; título → `text-fg` (+ `font-heading`); Empresa (`job.company.displayName`) → `text-fg-muted` (**displayName preservado**, nunca `nomeFantasia`).
- [ ] Pílulas de metadados (`area`/`region`/`workRegime`/`contractType`/`educationLevel`) → `<Badge variant="gray|blue">` (mesmo mapa da USP-021).
- [ ] `Section({title, content})` → `FormSectionTitle` + corpo em token; renderização condicional (só se `content`) **preservada**.
- [ ] Linha `<dl>` (local/validade) → grid com `border-border`/token (ou `FormRow`); `<time dateTime>` preservado.
- [ ] Contador: condição **preservada** `job.applicationCount != null` (P-001) — restyle não reintroduz contagem bruta (U22-MN-02).
- [ ] Salário: omissão preservada (`salaryLabel` inalterado; `salary=null` ⇒ "Salário a combinar").
- [ ] `ApplyCta`: `canApply` → `<Button type="button" variant="primary">Candidatar-se</Button>` **display-only, sem `onClick`/action** (U22-MN-04); `showActivateCandidateCta` → `<Button asChild><Link href="/candidato">…</Link></Button>`; anônimo → `<Button variant="outline" asChild><Link href="/cadastro">…</Link></Button>`. Três branches preservados.
- [ ] **Zero** paleta crua (`bg-blue-600`/`text-gray-*`/`bg-gray-*`/`border-gray-*`) ou hex literal.
- [ ] Permanece **Server Component** (sem `'use client'`).
- [ ] Gate `quick` passa: `npm run test`. `typecheck`+`lint` ✓.

**Tests**: unit RTL — estende `job-detail.spec.tsx` p/ asseverar: (a) uso dos primitivos (papel/estrutura de `Button` p/ os 3 CTAs; `Badge` nos metadados); (b) botão "Candidatar-se" é `type="button"` sem action disparada (U22-MN-04); (c) contador oculto p/ N<3 e visível p/ N≥3 via View Model (U22-MN-02); (d) para anônimo, aparece `displayName` por setor e **nunca** o `nomeFantasia` real (U22-MN-01 lado componente). `job-detail.view.spec.ts` permanece verde (não tocado). Test count: suíte existente + ≥3 asserts novos, todos verdes (sem deleção).
**Gate**: quick
**Commit**: `refactor(jobs): restyle JobDetailView para o Design System (USP-022)`

---

### T2: Restyle da casca `(public)/vagas/[id]/page.tsx` + trava P-002 dos metadados

**What**: Reestilizar os ramos de apresentação da rota (`VagaIndisponivel`, back-link, container) e **travar por
teste** que os metadados/JSON-LD anônimos não vazam `nomeFantasia` — sem tocar a serialização/ISR.
**Where**: `src/app/(public)/vagas/[id]/page.tsx` (modify); `src/modules/jobs/__tests__/vagas-detalhe-metadata.int.test.ts` (novo).
**Depends on**: None (arquivo disjunto de T1)
**Reuses**: `@/shared/ui` (`Card`/`Button`+`asChild`); `getActiveJobDetail`/`viewJobDetail`/`jobDetailJsonLd`/`serializeJsonLd` (intocáveis); `get-job-detail.int.test.ts` (padrão de seed/int).
**Requirement**: U22-STYLE-02 (AC P1-página 1-4) · must-nots U22-MN-01, U22-MN-03 (preservação)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `VagaIndisponivel` (estado "vaga encerrada / temporariamente indisponível") → `Card` neutro + `<Button asChild><Link href="/vagas">Ver outras vagas</Link></Button>`; **sem** botão candidatar (P-005/U22-MN-03).
- [ ] Back-link e `<main>` container → tokens/`Button asChild`; **zero** paleta crua/hex.
- [ ] **Preservado sem tocar** (crítico P-002): `export const revalidate = 1800`; `generateMetadata` chamando `getActiveJobDetail(id, null)` + `viewJobDetail(row, null)` (title/description/OG/Twitter/canonical/`robots`); injeção `<script type="application/ld+json">` com `serializeJsonLd(jobDetailJsonLd(viewJobDetail(row, null)))` **somente** quando `row != null`; branch `row == null ? <VagaIndisponivel/> : <JobDetailView job={viewJobDetail(row, viewer)}/>`.
- [ ] Página e componente permanecem **Server Components** (sem `'use client'`) — ISR + serialização fora do cliente.
- [ ] Gate `build` passa (`npm run build` compila a rota); `typecheck`+`lint` ✓.

**Tests**: integration — `vagas-detalhe-metadata.int.test.ts`: semeia Empresa **verificada** + vaga **ACTIVE** com `nomeFantasia` real; chama `generateMetadata({ params })` e constrói o JSON-LD via `serializeJsonLd(jobDetailJsonLd(viewJobDetail(row, null)))`; assevera que **nenhum** canal (title, description, `openGraph`, `twitter`, `alternates.canonical`, string do JSON-LD `hiringOrganization`) contém o `nomeFantasia` real (U22-MN-01/P-002). Segundo caso: vaga não-`ACTIVE`/expirada/Empresa não-verificada ⇒ `getActiveJobDetail(id, null) == null` ⇒ metadados de "indisponível" (`robots.index=false`), sem dado sensível (U22-MN-03). `get-job-detail.int.test.ts` e `job-detail.view.spec.ts` permanecem verdes. Test count: ≥3 novos, verdes.
**Gate**: build
**Commit**: `refactor(jobs): restyle da página de detalhe + trava P-002 dos metadados (USP-022)`

---

### T3: Guarda estática de paridade DS nos arquivos tocados

**What**: Teste `node:fs` (molde `no-external-verify.test.ts`) que falha se `job-detail.tsx` ou `page.tsx`
retiverem paleta crua/hex — trava "DS construído mas não adotado" (U22-MN-05).
**Where**: `src/modules/jobs/__tests__/job-detail-ds-parity.test.ts` (novo).
**Depends on**: T1, T2
**Reuses**: molde `src/modules/companies/__tests__/no-external-verify.test.ts` (varredura `node:fs` + regex sobre fontes).
**Requirement**: must-not U22-MN-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Lê `src/modules/jobs/components/job-detail.tsx` e `src/app/(public)/vagas/[id]/page.tsx`.
- [ ] Falha se qualquer arquivo contiver, em `className`/markup, `bg-blue-600`, `text-gray-*`, `bg-gray-*`, `border-gray-*` ou hex literal (`#[0-9a-fA-F]{3,8}`) para superfícies temáticas.
- [ ] Passa no estado pós-T1/T2 (ambos já reestilizados) — `expect(offenders).toEqual([])`.
- [ ] Gate `quick` passa: `npm run test`.

**Tests**: unit (`node:fs`) — este arquivo **é** o teste negativo de U22-MN-05. Test count: ≥1 novo, verde.
**Gate**: quick
**Commit**: `test(jobs): guarda estática de paridade DS no detalhe da vaga (USP-022)`

---

## Validação pré-aprovação (4 checks obrigatórios)

### Check 1 — Granularidade

| Task | Escopo | Status |
| --- | --- | --- |
| T1 | 1 componente (restyle) + testes co-locados | ✅ Granular |
| T2 | 1 rota (restyle) + 1 teste de metadados | ✅ Granular |
| T3 | 1 teste-guarda estático | ✅ Granular |

### Check 2 — Cross-check diagrama × `Depends on`

| Task | Depends on (corpo) | Diagrama (arestas) | Status |
| --- | --- | --- | --- |
| T1 | — | raiz | ✅ Match |
| T2 | — | raiz | ✅ Match |
| T3 | T1, T2 | T1→T3, T2→T3 | ✅ Match |

`[P]` só em T1 (RTL, paralelo-seguro). T2 tem teste de integração ⇒ **não** `[P]`. T3 depende de T1+T2. Nenhuma
`[P]` depende de outra na mesma fase.

### Check 3 — Co-locação de testes (× Test Coverage Matrix)

| Task | Camada criada/modificada | Matrix exige | Task declara | Status |
| --- | --- | --- | --- | --- |
| T1 | componente de apresentação | unit (RTL) | unit RTL | ✅ OK |
| T2 | rota + metadados/JSON-LD | integration | integration | ✅ OK |
| T3 | guarda estática | unit (`node:fs`) | unit | ✅ OK |

Nenhuma task difere seus testes para outra ⇒ sem violação de co-locação.

### 💠 Check 4 — Titularidade de must-not

| Must-not | Owning task(s) | Teste negativo (verde exigido) |
| --- | --- | --- |
| U22-MN-01 (nenhum canal expõe `nomeFantasia` a anônimo) | T2 (metadados) + T1 (componente) | `vagas-detalhe-metadata.int.test.ts` (nenhum canal com nome real) + `job-detail.view.spec.ts`/`job-detail.spec.tsx` (anônimo ⇒ `displayName`). |
| U22-MN-02 (contador N∈{0,1,2} oculto) | T1 | `job-detail.view.spec.ts` (N<3 ⇒ `applicationCount=null`) + `job-detail.spec.tsx` (UI não renderiza). |
| U22-MN-03 (vaga não-`ACTIVE` ⇒ "encerrada", sem candidatar) | T2 (preservação) | `get-job-detail.int.test.ts` (não-ACTIVE ⇒ `null`) + página renderiza `VagaIndisponivel` sem botão candidatar. |
| U22-MN-04 (botão candidatar sem cabeamento de ação) | T1 | `job-detail.spec.tsx` — "Candidatar-se" é `type="button"` display-only, nenhuma action disparada. |
| U22-MN-05 (sem paleta crua/hex nos arquivos tocados) | T3 | `job-detail-ds-parity.test.ts` — `offenders == []`. |

Todos os 5 must-nots têm task dona + teste negativo (3 reusam specs existentes como testes de preservação;
P-002 reforçado por teste de metadados; estilo via guarda). Nenhum órfão.

---

## Tools / MCPs / Skills por task

- Nenhuma MCP necessária (restyle style-only sobre primitivos DS já existentes; comportamento intocado).
- **Skill `bravi-spec-driven`** ativa em todas as tasks (Execute + gate + commit atômico + Verifier).
- **Sem** mudança de schema, query, View Model, serialização, `revalidate` ou wiring de ação.
