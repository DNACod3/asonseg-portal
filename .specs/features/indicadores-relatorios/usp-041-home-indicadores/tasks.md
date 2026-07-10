# USP-041 — Home pública com indicadores em tempo real (Tasks)

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the **`idsd-spec-driven`** skill: **activate it by name** and follow its
Execute flow and Critical Rules. Do not search for skill files by filesystem path. The skill is the
source of truth for the full flow (per-task cycle, gate, atomic commit, must-not/negative tests,
discrimination sensor, Verifier). **If the skill cannot be activated, STOP and report — do not proceed
without it.** In ICE mode the RED facts are produced by **`skill-tdad`** from the ACs/must-nots — the
`Tests` field of each task below names the target test files and asserts; the implementer does not
invent tests.

Non-negotiable per task: tests derive from spec ACs/must-nots (not implementation); the gate (tests
pass) decides done; one atomic commit per task; never weaken/skip/delete tests; every **must-not** is
owned by a task and proven by a green **negative test** that a mutation would flip.

---

**Spec**: `.specs/features/indicadores-relatorios/usp-041-home-indicadores/spec.md`
**Design**: `.specs/features/indicadores-relatorios/usp-041-home-indicadores/design.md`
**Status**: Draft
**Módulo dono**: `reporting` · **Sem migração** (agregação de leitura).

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Regra pura (`reporting/domain/indicators.ts`) | unit | ≥90%; limiar N=5 (0..4→placeholder, ≥5→value, fronteira em 5) | `src/modules/reporting/__tests__/*.test.ts` | `npm run test` |
| Query agregada (`reporting/queries/home-indicators.ts`) | integration | ≥80%; 3 `count` com `where` real contra Postgres; baseline 0; **REL41-MN-01** (só inteiros, sem PII) | `src/modules/reporting/__tests__/*.int.test.ts` | `npm run test:integration` |
| Componente (`reporting/components/home-indicators.tsx`) | unit (component) | rótulos + número; "Em breve" no placeholder; sem PII no markup | `src/modules/reporting/__tests__/*.test.tsx` | `npm run test` |
| Guard estático TTL (`app/(public)/page.tsx`) | unit (static) | **REL41-MN-03**: `revalidate` exportado ≤ 600 | `src/modules/reporting/__tests__/*.test.ts` | `npm run test` |
| Página pública (`app/(public)/page.tsx`) | e2e + page test | anônimo (sem sessão) vê 3 indicadores; carrega sem erro | page: `src/**/__tests__/*.test.tsx` · e2e: `e2e/**/*.spec.ts` | `npm run test` · `npm run test:e2e` |

> **Sem migração / sem schema:** USP-041 não altera `prisma/schema.prisma`.
> **E2E público:** a home é ISR pública (sem sessão) — o E2E cobre o carregamento anônimo real (não precisa do seed de sessão Supabase; contraste com L-007).

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit (`*.test.ts`) | Yes | Funções puras / sem backing store | `reporting/__tests__/access-report.test.ts` |
| component (`*.test.tsx`) | Yes | Testing Library, DOM por teste, sem DB | (novo) |
| integration (`*.int.test.ts`) | **No** | Postgres compartilhado + cleanup global; `describe.skipIf(!DATABASE_URL)` | `vitest.integration.config.ts` |
| e2e (`*.spec.ts`) | No | Servidor/estado compartilhado | `e2e/` |

## Gate Check Commands

| Gate Level | When | Command |
|---|---|---|
| Quick | Após tasks só com testes unit/component | `npm run test` |
| Full | Após tasks com testes de integração | `npm run test && npm run test:integration` |
| Build | Após tasks de rota + E2E | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` (E2E: `npm run test:e2e`) |

---

## Execution Plan

### Phase 1: Fundação de domínio (unit, paralelizável)
```
T1 (metrics.ts catálogo)   T2? — ver ordem
```
### Phase 2: Regra + query
```
T1 (indicators.ts threshold) [P] ── T2 (home-indicators query, int)
```
### Phase 3: UI + cache
```
T2 ──> T4 (component) ──> T5 (página + guard TTL) ──> T6 (revalidação on-demand)
T3 (guard TTL) [P]
```

---

## Task Breakdown

### T1: Regra pura de exibição mínima + catálogo de métricas [P]

**What**: `applyMinimumDisplay` (limiar "Em breve") e o catálogo puro `metrics.ts` (fundação compartilhada com USP-042).
**Where**: `src/modules/reporting/domain/indicators.ts`, `src/modules/reporting/domain/metrics.ts` (+ barrel `src/modules/reporting/index.ts`) · teste `src/modules/reporting/__tests__/indicators.test.ts`
**Depends on**: None
**Reuses**: convenção de domínio puro do módulo (sem IO)
**Requirement**: **E-003**, **REL41-MN-02**

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `MINIMUM_DISPLAY_THRESHOLD = 5`; `applyMinimumDisplay(n: number, threshold = MINIMUM_DISPLAY_THRESHOLD): IndicatorDisplay` → `n < threshold` ⇒ `{ kind: 'placeholder' }`, senão `{ kind: 'value', value: n }`.
- [ ] `metrics.ts`: catálogo `MP` (id/label/unit) para MP1..MP10 **como constantes puras** (041 consome MP1/MP2/MP4; demais preenchidas mas não usadas aqui) — nenhuma dependência de Prisma/runtime.
- [ ] **Negative test (REL41-MN-02, discriminador):** `0,1,2,3,4 → placeholder`; `5,6,47 → value`; fronteira exata em `5`. Mutação `<`→`<=` ou `5`→`0` fica vermelha.
- [ ] Exportado no barrel; `npm run test` verde. Test count registrado.

**Tests**: unit
**Gate**: quick
**Commit**: `feat(reporting): minimum-display rule + MP metric catalog (USP-041)`

---

### T2: Query agregada `getHomeIndicators` (3 counts, sem PII)

**What**: Read query agregada dos 3 indicadores da home — `count` puro, sem `select` de linha.
**Where**: `src/modules/reporting/queries/home-indicators.ts` (+ barrel) · teste `src/modules/reporting/__tests__/home-indicators.int.test.ts`
**Depends on**: None
**Reuses**: `prisma` singleton (`@/shared/lib/prisma`); campos verificados: `Job.status`, `CandidateProfile.publicationStatus`, `Company.isVerified`
**Requirement**: **E-001**, **REL41-MN-01**

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `getHomeIndicators(): Promise<HomeIndicators>` = `{ activeJobs, activeCandidates, verifiedCompanies }` via `job.count({where:{status:'ACTIVE'}})`, `candidateProfile.count({where:{publicationStatus:'ACTIVE'}})`, `company.count({where:{isVerified:true}})` (3 counts; pode usar `$transaction([...])` para consistência de snapshot).
- [ ] O tipo `HomeIndicators` tem **apenas 3 `number`** — nenhum campo de PII.
- [ ] **Integration:** seed com 6 vagas ACTIVE + 2 DRAFT / 7 candidatos ACTIVE + 1 DRAFT / 3 empresas verificadas + 1 não → retorna `{6,7,3}`; **baseline 0** (banco limpo) → `{0,0,0}` sem erro.
- [ ] **Negative test (REL41-MN-01):** o objeto retornado, serializado (`JSON.stringify`), **não** contém nenhum nome/CPF/e-mail/id de pessoa ou empresa — só os 3 inteiros. (Mutação que troca `count` por `findMany({select:{...name}})` quebra o tipo/teste.)
- [ ] Exportado no barrel; Gate `npm run test && npm run test:integration` verde. Test count registrado.

**Tests**: integration
**Gate**: full
**Commit**: `feat(reporting): getHomeIndicators aggregate query, no PII (USP-041)`

---

### T3: Guard estático de TTL da home [P]

**What**: Teste-guarda que fixa o TTL da home ≤ janela acordada (600s).
**Where**: teste `src/modules/reporting/__tests__/home-revalidate.test.ts` (importa `revalidate` de `app/(public)/page.tsx`)
**Depends on**: None
**Reuses**: padrão de guard estático do repo (`no-external-verify.test.ts`, `DS-MN-*`)
**Requirement**: **REL41-MN-03**, E-002

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Importa `revalidate` de `src/app/(public)/page.tsx` e asserta `typeof revalidate === 'number' && revalidate > 0 && revalidate <= 600`.
- [ ] **Negative test (REL41-MN-03):** documenta que `revalidate = 86400` (ou `false`) faria o teste falhar — mutação viva.
- [ ] `npm run test` verde. Test count registrado.

**Tests**: unit (static guard)
**Gate**: quick
**Commit**: `test(reporting): static guard for home ISR TTL <= 600s (USP-041)`

---

### T4: Componente `HomeIndicators`

**What**: Componente apresentacional dos 3 cards de indicador; "Em breve" no placeholder.
**Where**: `src/modules/reporting/components/home-indicators.tsx` (+ barrel) · teste `src/modules/reporting/__tests__/HomeIndicators.test.tsx`
**Depends on**: T1
**Reuses**: `@/shared/ui` (Card/Badge, AD-014); `applyMinimumDisplay` (T1); tipo `HomeIndicators` (T2)
**Requirement**: **E-001**, **E-003**, **REL41-MN-01**, **REL41-MN-02**

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] Recebe `HomeIndicators`, aplica `applyMinimumDisplay` por indicador e renderiza 3 cards (rótulos "Vagas ativas" / "Candidatos" / "Empresas verificadas") com o número **ou "Em breve"**.
- [ ] **Component test (E-003/REL41-MN-02):** `{activeJobs:2,...}` → card de vagas mostra "Em breve", **não** "2"/"0"; `{activeJobs:47,...}` → mostra "47".
- [ ] **Component test (REL41-MN-01):** markup não contém PII (o componente só recebe inteiros; teste-âncora garante que a prop não carrega objeto de pessoa).
- [ ] `npm run test` verde. Test count registrado.

**Tests**: unit (component)
**Gate**: quick
**Commit**: `feat(reporting): HomeIndicators presentational component (USP-041)`

---

### T5: Wire da home `(public)/page.tsx` + página lê indicadores

**What**: A home (Server Component ISR) busca `getHomeIndicators()` e renderiza `<HomeIndicators/>`; tolerância a falha de query.
**Where**: `src/app/(public)/page.tsx` · page test `src/app/(public)/__tests__/page.test.tsx` · `e2e/home/indicadores.spec.ts`
**Depends on**: T2, T4
**Reuses**: `revalidate=600` já setado; `getHomeIndicators` (T2); `HomeIndicators` (T4); barrel `@/modules/reporting`
**Requirement**: **E-001**, **E-002**, **REL41-MN-01**

**Tools**: MCP: NONE · Skill: skill-tdad (facts)

**Done when**:
- [ ] `page.tsx` (mantém `export const revalidate = 600`) chama `getHomeIndicators()` e passa ao `<HomeIndicators/>`; **fallback** (try/catch → placeholders/últimos valores) para não quebrar a página se a query falhar (ADR-0026, edge case do spec).
- [ ] **Page test:** render server-side com indicadores mockados → os 3 rótulos + valores/"Em breve" presentes; sem sessão exigida.
- [ ] **E2E (público, spec real):** visitante anônimo abre `/` → vê os 3 rótulos de indicador; página responde 200 sem login.
- [ ] Gate `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` verde; `npm run test:e2e` da spec nova verde/gated. Test count registrado.

**Tests**: e2e (+ page test)
**Gate**: build
**Commit**: `feat(reporting): render live indicators on public home (USP-041)`

---

### T6: Revalidação on-demand dos indicadores (E-002 / D-005)

**What**: Helper `revalidateHomeIndicators()` e sua chamada pós-commit nas 3 Server Actions de origem.
**Where**: `src/modules/reporting/server/revalidate-home.ts` (+ barrel) · call-sites: aprovação de vaga→ACTIVE (moderation), ativação de perfil de candidato→ACTIVE (persons/identity), verificação de Empresa (companies/moderation) · teste `src/modules/reporting/__tests__/revalidate-home.test.ts`
**Depends on**: T5
**Reuses**: `revalidatePath` (`next/cache`); pontos de efeito colateral já existentes das transições
**Requirement**: **E-002**, D-005 (novo dado aparece em ≤ janela)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `revalidateHomeIndicators()` = `revalidatePath('/')`, exportado no barrel; chamado **após** o commit (fora da tx) nas 3 Server Actions de origem (aprovar vaga → ACTIVE; ativar candidato → ACTIVE; verificar Empresa).
- [ ] **Unit test:** `revalidateHomeIndicators` chama `revalidatePath` com `'/'` (spy). Nos call-sites, teste-âncora confirma a chamada após sucesso e a **não-chamada** em caminho de erro/rollback.
- [ ] Documenta que o piso ISR de 600s é o backstop de correção (REL41-MN-03 não regride).
- [ ] Gate `npm run test && npm run test:integration` verde. Test count registrado.

**Tests**: unit (+ integration nos call-sites se tocar Server Action com DB)
**Gate**: full
**Commit**: `feat(reporting): on-demand home revalidation on source events (USP-041)`

---

## Parallel Execution Map

```
Phase 1:  T1 [P] (unit)          T3 [P] (static guard)
Phase 2:  T1 ──> T2 (int)
Phase 3:  (T1,T2) ──> T4 (component) ──> T5 (page+e2e) ──> T6 (revalidação)
```
**Constraint:** T1/T3 são unit puros ([P]). T2 é integração. T4 depende de T1(+T2 tipo). T5 depende de T2/T4. T6 depende de T5.

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1 | 2 arquivos de domínio puro | ✅ |
| T2 | 1 query + teste | ✅ |
| T3 | 1 guard estático | ✅ |
| T4 | 1 componente | ✅ |
| T5 | 1 página + wire | ✅ |
| T6 | 1 helper + 3 call-sites | ✅ (coeso: "atualizar a home nas fontes") |

## Must-Not Ownership

| Must-Not | Owning task(s) | Negative test |
|---|---|---|
| **REL41-MN-01** (home sem PII) | T2 (query só `count`), T4/T5 (markup só inteiros) | T2: retorno serializado sem PII; mutação `count`→`findMany(select name)` quebra tipo/teste |
| **REL41-MN-02** ("Em breve" < 5) | T1 (regra), T4 (render) | T1: 0..4→placeholder / ≥5→value, fronteira em 5; T4: `{2}`→"Em breve" |
| **REL41-MN-03** (TTL ≤ 600s) | T3 (guard estático) | `revalidate` ≤ 600; mutação p/ 86400/false fica vermelha |

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate` binários. Contagem de testes registrada por task (anti-deleção
silenciosa). O Verifier independente (author ≠ verifier) roda após a última task: checagem spec-anchored por AC
(E-001/E-002/E-003), sensor de discriminação por mutação viva e verificação evidence-or-zero dos must-nots
REL41-MN-01/02/03 (alvos primários de mutação: o `count`-only da query, a comparação de limiar, o `revalidate`).
