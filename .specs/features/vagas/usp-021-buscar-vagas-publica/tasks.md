# USP-021 — Buscar vagas (pública) — Refactor (Fase 2 / Design System) — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill files
by filesystem path. The skill is the source of truth for the per-task cycle (implement → gate → atomic
commit), sub-agent delegation, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator — do not proceed without it.**

**Refactor discipline (every task):** change **only markup/classes**. Do not touch `searchJobs`, View
Models (`viewJobForVisitor`/`companyDisplayName`), the GET semantics/searchParam names, `revalidate`/ISR or
on-demand revalidation. Existing tests MUST stay green (no weakening/deleting). Preserve: filtro on-read,
6 filtros AND, busca `unaccent`, paginação (`take`), anonimização (ADR-0022), ordenação `publishedAt DESC`.

**Novos testes (skill-tdad):** a guarda de estilo pode ser gerada via `skill-tdad` a partir dos must-nots
U21-MN-*.

---

**Design**: `.specs/features/vagas/usp-021-buscar-vagas-publica/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Gerada do codebase + guidelines + spec — confirmar antes do Execute. Toda a superfície da USP-021 é
> **Server Component** → restyle validado por `build`; anonimização/on-read preservados pelos specs
> existentes (`job-list-item.view.spec.ts`, `search-jobs.int.test.ts`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Server Component (`JobCard`/`JobList`/`JobSearchFilters`/página) | none | Gate de build; sem paleta crua | `src/modules/jobs/components/**`, `src/app/(public)/vagas/**` | build gate |
| Guarda de estilo (DS parity) | unit (node:fs) | Zero paleta crua/hex + zero `nomeFantasia` na camada de componente (U21-MN-01/04) | `src/shared/__tests__/ds-*-parity.test.ts` | `npm run test` |
| View Model (existente, preservado) | unit | `job-list-item.view.spec.ts` verde — anônimo sem nome real (U21-MN-01) | `src/modules/jobs/__tests__/*.view.spec.ts` | `npm run test` |
| Query `searchJobs` (existente, preservado) | integration | `search-jobs.int.test.ts` verde — on-read/verificada/expiração/campos restritos (U21-MN-02/03) | `src/modules/jobs/__tests__/*.int.test.ts` | `npm run test:integration` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (node:fs guard / view spec, jsdom) | Yes | Leitura de arquivo / deps mockadas | `ds-ui-uses-tokens.test.ts`, `job-list-item.view.spec.ts` |
| integration (Postgres) | No | Postgres compartilhado + cleanup | `search-jobs.int.test.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Guarda/unit apenas | `npm run typecheck && npm run lint && npm run test` |
| Build | Restyle de Server Component | `npm run typecheck && npm run lint && npm run test && npm run build` |
| Full+Build | Task que precisa confirmar preservação de `searchJobs` (integração) | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` |

---

## Execution Plan

### Phase 1: Restyle de card e lista (Sequential)

```
T1
```

### Phase 2: Restyle de filtros e página (Sequential)

```
T1 ──→ T2 ──→ T3
```

3 fases lógicas colapsadas em cadeia linear → execução inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Restyle `JobCard` + `JobList` para o Design System (só estilo) + guarda de estilo

**What**: `JobCard` raiz → `Card`; pílulas de metadados → `Badge`; estado vazio de `JobList` → `Card`
neutro; cores → tokens (`text-fg`/`text-fg-muted`/`border-border`). Criar/estender a guarda de estilo (sem
paleta crua + sem `nomeFantasia` na camada de componente).
**Where**:
- `src/modules/jobs/components/job-card.tsx` (modify — só marcação/classe)
- `src/modules/jobs/components/job-list.tsx` (modify — só marcação/classe)
- `src/shared/__tests__/ds-vagas-parity.test.ts` (criar se não existir; cobrir card+list)
**Depends on**: None
**Reuses**: `@/shared/ui` (`Card`, `Badge`); `job-list-item.view.spec.ts` (preservação de anonimização); `ds-login-parity.test.ts` (padrão de guarda)
**Requirement**: U21-STYLE-01, U21-MN-01, U21-MN-04

**Tools**:
- MCP: NONE
- Skill: `skill-tdad` (guarda dos must-nots), opcional

**Done when**:
- [ ] `JobCard` usa `Card` (raiz) + `Badge` (pílulas área/região/regime/contrato); título/empresa/salário/data com tokens; **`company.displayName` preservado** (nenhum acesso a `nomeFantasia`).
- [ ] `JobList`: estado vazio em `Card` neutro (`text-fg-muted`), cópia "Nenhuma vaga encontrada" preservada; lista mantém `<ul>` + spacing por token.
- [ ] Nenhuma classe de paleta crua (`bg-blue-600`, `text-gray-*`, `border-gray-*`, `bg-gray-100`, `border-dashed`) nem hex.
- [ ] **Guarda (U21-MN-01/04):** `ds-vagas-parity.test.ts` assevera zero paleta crua/hex **e** zero referência a `nomeFantasia`/`company.name` em `job-card.tsx`/`job-list.tsx`.
- [ ] **Preservação (U21-MN-01):** `job-list-item.view.spec.ts` permanece verde (anônimo ⇒ rótulo por setor; autenticado ⇒ nome real).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component) + unit (guarda + view spec preservado)
**Gate**: build

**Commit**: `refactor(jobs): restyle JobCard/JobList com Design System (AD-014) (USP-021)`

---

### T2: Restyle `JobSearchFilters` (form GET) para o Design System (só estilo)

**What**: Painel de filtros em `Card`; campos → `Input`/`Label`; "Filtrar" → `Button primary`; "Limpar" →
`Button outline asChild`; `<details>` "Mais filtros" preservado e reestilizado. Estender a guarda.
**Where**:
- `src/modules/jobs/components/job-search-filters.tsx` (modify — só marcação/classe)
- `src/shared/__tests__/ds-vagas-parity.test.ts` (estender p/ cobrir o arquivo)
**Depends on**: T1 (guarda já criada)
**Reuses**: `@/shared/ui` (`Card`, `Input`, `Label`, `Button`, `FormRow`)
**Requirement**: U21-STYLE-02, U21-MN-04, U21-MN-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Constantes `fieldClass`/`labelClass` removidas; campos usam `Input`/`Label`; selects com token; "Filtrar" `Button variant="primary"` (submit); "Limpar" `Button variant="outline" asChild` → `<Link href="/vagas">`.
- [ ] **Preservado (U21-MN-05):** `<form action="/vagas" method="get">`, os nomes de searchParam PT (`q/area/regiao/regime/contrato/escolaridade/salarioMin/salarioMax`), e o `<details>` "Mais filtros" com os filtros secundários (P-002 não opressivo, progressive enhancement).
- [ ] Nenhuma paleta crua/hex; renderiza em light/dark.
- [ ] **Guarda (U21-MN-04/05):** `ds-vagas-parity.test.ts` cobre o arquivo (sem paleta crua) e assevera presença de `method="get"` + `<details>`.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component) + unit (guarda)
**Gate**: build

**Commit**: `refactor(jobs): restyle JobSearchFilters com Design System (AD-014) (USP-021)`

---

### T3: Restyle da página `(public)/vagas/page.tsx` (ISR) — só estilo + confirmação de preservação de `searchJobs`

**What**: Casca da página em tokens/`FormHeader`; contagem + paginação reestilizadas (`Button` nos links de
página); confirmar preservação da fatia de leitura (integração). Estender a guarda.
**Where**:
- `src/app/(public)/vagas/page.tsx` (modify — só marcação/classe)
- `src/shared/__tests__/ds-vagas-parity.test.ts` (estender p/ cobrir a página)
**Depends on**: T2
**Reuses**: `@/shared/ui` (`FormHeader`, `Button`); `(public)/page.tsx` (padrão de casca ISR)
**Requirement**: U21-STYLE-02, U21-MN-02, U21-MN-03, U21-MN-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Casca com `FormHeader`/tokens; contagem (`aria-live`) e paginação (`?pagina=` preservando filtros) reestilizadas com `Button`; sem paleta crua.
- [ ] **Preservado sem alteração:** `export const revalidate = 1800`, leitura de `searchParams`, `Promise.all([getCurrentPerson(), listApprovedJobAreas(), listActiveRegions()])`, `searchJobs(filters, viewer)`, o `metadata` estático.
- [ ] **Preservação (U21-MN-02/03):** `search-jobs.int.test.ts` permanece verde — só `ACTIVE`+não-expirada+`company.isVerified` aparece; campos restritos não expostos (`select` explícito).
- [ ] **Guarda (U21-MN-04):** `ds-vagas-parity.test.ts` cobre a página.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build`

**Tests**: none (Server Component) + integration (preservação de `searchJobs`)
**Gate**: full+build

**Commit**: `refactor(jobs): restyle página de busca de vagas com Design System (AD-014) (USP-021)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):  T1 (card + list + cria guarda)
Phase 2 (Sequential):  T1 → T2 (filtros) → T3 (página + preservação searchJobs)
```

Nenhuma task `[P]`: T2/T3 estendem a mesma guarda e dependem em cadeia; integração (T3) não é parallel-safe.

## Task Granularity Check

| Task | Escopo | Status |
| --- | --- | --- |
| T1: card + list + guarda | 2 componentes coesos (mesmo vocabulário Card/Badge) + guarda | ✅ Granular |
| T2: filtros | 1 componente | ✅ Granular |
| T3: página | 1 arquivo | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram | Status |
| --- | --- | --- | --- |
| T1 | None | raiz | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Server Component + guarda + view spec | none/build + unit | build (inclui unit) | ✅ OK |
| T2 | Server Component + guarda | none/build + unit | build | ✅ OK |
| T3 | Server Component + preservação integração | none/build + integration | full+build | ✅ OK |

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U21-MN-01 (anonimização preservada) | T1 | `job-list-item.view.spec.ts` (anônimo sem nome real) + guarda (sem `nomeFantasia` no componente) |
| U21-MN-02 (não-verificada/não-ACTIVE/expirada ocultas) | T3 | `search-jobs.int.test.ts` (só ACTIVE+verificada+não-expirada) permanece verde |
| U21-MN-03 (campos restritos não expostos) | T3 | `search-jobs.int.test.ts` / `job-list-item.view.spec.ts` (`select` explícito) permanece verde |
| U21-MN-04 (sem paleta crua) | T1 + T2 + T3 | `ds-vagas-parity.test.ts` — zero paleta crua/hex nos arquivos tocados |
| U21-MN-05 (filtros não opressivos + GET preservado) | T2 | `ds-vagas-parity.test.ts` — `method="get"` + `<details>` presentes |

---

## Task Verification Standards

Cada `Done when` é binário e referencia o comando de gate. Contagens de teste explícitas previnem deleções
silenciosas. Restyle tasks devem manter verdes todos os testes existentes da USP-021 (regra de refactor: só
estilo).
