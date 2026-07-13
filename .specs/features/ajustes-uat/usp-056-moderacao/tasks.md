# USP-056 — Moderação (remediação do UAT) — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implemente estas tasks com o skill de execução spec-driven do projeto: **ative-o pelo nome (`bravi-spec-driven`) e siga seu Execute flow e Critical Rules.** Não busque arquivos de skill por caminho. O skill é a fonte da verdade do fluxo (ciclo por-task, delegação a sub-agentes, adequacy review, Verifier, sensor de discriminação).

**Se o skill não puder ser ativado, PARE e avise — não prossiga sem ele.**

**Contrato inviolável (dossiê + premissas):** sem mudança de arquitetura (moderação via `transitionContent`, adapter por `ContentKind` no container, RBAC `requirePermission`, `audit_log` append-only, View Models); **sem tabela/entidade nova**, **sem migração**, **sem dep nova**; PT-BR; preservar a suíte de moderação existente (com as atualizações intencionais de MOD-7/MOD-8 documentadas na spec). 1 commit atômico por task.

---

**Design**: `.specs/features/ajustes-uat/usp-056-moderacao/design.md`
**Status**: Done

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes do Execute. Guidelines encontradas: `CLAUDE.md` (§Testing Requirements: happy/Zod/permission/consent/concorrência; unit 90% em domínio; integração em Server Actions sensíveis), `vitest.config.ts` + `vitest.integration.config.ts` (comandos), padrões de teste co-locados do módulo `moderation`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
|---|---|---|---|---|
| Domínio puro (`justification.ts`) | unit | Todos os ramos; 1:1 aos ACs MOD6-01/02 + edges (vazio, repetido, alfabeto curto, motivo real) | `src/modules/moderation/domain/__tests__/*.test.ts` | `npm run test` |
| Query de fila (`moderation-queue.ts`) | unit + integration | Unit: mapeamento/união/ordem com Prisma mockado (novo caso CANDIDATE_PROFILE). Int: perfil real IN_MODERATION aparece; P-005 exclui o do viewer | `queries/__tests__/*.test.ts` (unit) · `queries/__tests__/*.int.test.ts` (int) | `npm run test` · `npm run test:integration` |
| Helper server (`moderation-access.ts`) | unit + integration | Unit: coordenador→todos; voluntário→subconjunto (Prisma mockado, espelha o teste-irmão). Int: filtro real de `delegated_permission` (padrão AD-021) | `server/__tests__/*.test.ts` (unit) · `server/__tests__/*.int.test.ts` (int) | `npm run test` · `npm run test:integration` |
| Componentes cliente (`moderation-queue.tsx`, `taxonomy-suggestions-list.tsx`) | unit (RTL) | Todos os ramos de UI + testes negativos dos must-nots (MN-04, MN-05); casos existentes preservados/atualizados | `components/__tests__/*.test.tsx` \| `*.spec.tsx` | `npm run test` |
| Route page (`(app)/moderacao/page.tsx`) | none (build gate) | Fiação server→componente coberta por typecheck + build (padrão do repo: `moderacao/page` não tem page test) | — | build gate |

**Coverage Expectation** — de guidelines primeiro; defaults fortes quando não houver. Domínio → todos os ramos, 1:1 aos ACs. Query/repo → caminhos-chave + erro (unit mock + int no `where` real). Componente → happy + edges + negativos. Page-only-wiring → build gate.

## Parallelism Assessment

> Gerada de codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
|---|---|---|---|
| unit (domínio, `vitest run`) | Yes | Funções puras, sem estado compartilhado | `domain/__tests__/transition-rules.test.ts` |
| unit (Prisma mockado) | Yes | `vi.mock('@/shared/lib/prisma')` por arquivo | `queries/__tests__/moderation-queue.test.ts` |
| component (RTL/jsdom) | Yes | `render` isolado por teste, actions mockadas | `components/__tests__/moderation-queue.test.tsx` |
| integration (Postgres real) | **No** | DB compartilhado + `deleteMany`/`upsert` em setup/teardown | `queries/__tests__/moderation-queue.int.test.ts` (afterEach `deleteMany`) |

→ Tasks com teste **integration** (T2, T3) **não** recebem `[P]` (execução de teste é sequencial). Tasks unit-only (T1, T5) podem ser `[P]`.

## Gate Check Commands

> Gerada de codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
|---|---|---|
| Quick | Após tasks só com unit/component | `npm run test` |
| Full | Após tasks com teste de integração | `npm run test && npm run test:integration` |
| Build | Fim de fase / task com fiação de route/RSC | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` |

---

## Execution Plan

### Phase 1: Correções independentes (sem deps entre si)

```
T1 [P]  (MOD-6 heurística — unit)
T2      (MOD-1 fila CV — unit + int)
T3      (MOD-7 backend — unit + int)
T5 [P]  (MOD-8 confirmação — component unit)
```

### Phase 2: UI de gating (depende do helper)

```
T3 ──→ T4  (MOD-7 UI + fiação da page)
```

---

## Task Breakdown

### T1: Reforçar `isMeaningfulJustification` (MOD-6) [P]

**What**: Rejeitar motivo de ≥ 20 chars com baixa diversidade de letras (caractere repetido), mantendo motivos legítimos e a mensagem PT-BR existente.
**Where**: `src/modules/moderation/domain/justification.ts` (modificar) · `src/modules/moderation/domain/__tests__/justification.test.ts` (novo)
**Depends on**: None
**Reuses**: `MIN_JUSTIFICATION_LENGTH`, `NON_MEANINGFUL`, `JUSTIFICATION_NOT_MEANINGFUL_MESSAGE` (mensagem inalterada)
**Requirement**: MOD6-01, MOD6-02, MOD6-03 · **Must-not**: USP056-MN-02, USP056-MN-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Nova const `MIN_DISTINCT_LETTERS = 5`; a função conta letras distintas via `toLowerCase().normalize('NFD').replace(/[^a-z]/g,'')` e retorna `false` se `< 5`.
- [x] `isMeaningfulJustification('a'.repeat(30))` → `false` (USP056-MN-02, teste negativo).
- [x] `isMeaningfulJustification('Faltou descrever as atividades do cargo')` → `true`; amostras PT-BR reais de ≥ 20 chars → `true` (USP056-MN-03, teste negativo do falso-positivo).
- [x] Edges preservados: `null`/`undefined`/vazio/só-pontuação → `false`; `< 20` chars → `false`.
- [x] `src/modules/moderation/schemas/__tests__/decision.test.ts` permanece **verde** (fonte única propagada; MOD6-03).
- [x] Gate quick passa: `npm run test`
- [x] Test count: casos novos de `justification.test.ts` + decision.test.ts intactos (sem deleções silenciosas)

**Tests**: unit
**Gate**: quick
**Commit**: `fix(moderation): heurística de motivo exige diversidade mínima de caracteres (MOD-6/P-003)`

---

### T2: Fila lê perfis de candidato IN_MODERATION (MOD-1)

**What**: Adicionar `candidate_profiles` como 4ª fonte de `viewModerationQueue`, mapeando cada perfil IN_MODERATION a um item `CANDIDATE_PROFILE`.
**Where**: `src/modules/moderation/queries/moderation-queue.ts` (modificar) · `queries/__tests__/moderation-queue.test.ts` (atualizar mock+casos) · `queries/__tests__/moderation-queue.int.test.ts` (novo describe)
**Depends on**: None
**Reuses**: padrão `jobItems`/`serviceItems`; `PrismaCandidateProfileStatusRepository` como referência de contrato (`contentId = personId`, `publicationStatus`); `viewStaffPersonNames`
**Requirement**: MOD1-01, MOD1-02, MOD1-03 · **Must-not**: USP056-MN-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `Promise.all` inclui `prisma.candidateProfile.findMany({ where: { publicationStatus: IN_MODERATION, personId: { not: viewerPersonId } }, select: { personId, headline, lastStatusChangeAt }, orderBy: { lastStatusChangeAt: 'asc' }, take: QUEUE_PAGE_SIZE })`.
- [x] Map → `{ contentKind: CANDIDATE_PROFILE, contentId: personId, title: headline ?? 'Perfil de candidato', authorPersonId: personId, submittedAt: lastStatusChangeAt }`, unido ao `rows` (mesmo sort/slice).
- [x] Comentário de cabeçalho atualizado (CANDIDATE_PROFILE agora lê a tabela real; CV segue fixture).
- [x] Unit: mock de Prisma ganha `candidateProfile: { findMany }`; novo caso "perfil IN_MODERATION aparece como CANDIDATE_PROFILE com contentId=personId"; asserts existentes (job/service/fixture, P-005, ordem) permanecem verdes.
- [x] Int: perfil real IN_MODERATION aparece na fila; perfil com `personId == viewer` **não** aparece (USP056-MN-01, teste negativo); cleanup por ids criados.
- [x] Gate full passa: `npm run test && npm run test:integration`
- [x] Test count: casos novos + suíte de fila intacta

**Tests**: unit + integration
**Gate**: full
**Commit**: `fix(moderation): fila lista perfis de candidato IN_MODERATION via candidate_profiles (MOD-1/E-001)`

---

### T3: Helper `listViewerModeratableKinds` (MOD-7 backend)

**What**: Calcular os `ContentKind` que o viewer pode moderar (coordenador→todos; voluntário→delegações ativas) e extrair o mapa tipo→permissão para uma fonte pura reusável.
**Where**: `src/modules/moderation/domain/moderation-permissions.ts` (novo — mapa puro `PERMISSION_BY_KIND` + inverso) · `src/modules/moderation/server/moderation-access.ts` (adicionar helper) · `src/modules/moderation/actions/decide.ts` (importar o mapa, sem mudar comportamento) · `src/modules/moderation/index.ts` (export) · `server/__tests__/moderation-access.test.ts` (adicionar casos unit) · `server/__tests__/moderation-access.int.test.ts` (novo)
**Depends on**: None
**Reuses**: consulta de `delegated_permission` de `canAccessModerationQueue`; `isCoordinator`; `ContentKind`
**Requirement**: MOD7-01, MOD7-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] `domain/moderation-permissions.ts` exporta `PERMISSION_BY_KIND` (JOB→MODERATE_JOB, CV→MODERATE_CV, SERVICE→MODERATE_SERVICE, CANDIDATE_PROFILE→MODERATE_CV) — arquivo puro (sem `'use server'`).
- [x] `decide.ts` importa `PERMISSION_BY_KIND` do novo arquivo (remove a const local); `actions/__tests__/decide.test.ts` permanece **verde** (comportamento idêntico — MOD7-04, defesa server-side intacta).
- [x] `listViewerModeratableKinds(person)`: coordenador → `[JOB, SERVICE, CV, CANDIDATE_PROFILE]`; voluntário → tipos cujas permissões (`MODERATE_JOB/CV/SERVICE`, `revokedAt: null`) ele possui; exportado no barrel.
- [x] Unit: coordenador→todos; voluntário só-`MODERATE_JOB`→`[JOB]`; voluntário `MODERATE_CV`→inclui `CV` e `CANDIDATE_PROFILE` (Prisma mockado, espelha o teste-irmão).
- [x] Int: exercita o filtro real `delegated_permission` (`revokedAt: null`, grant revogado não conta) — padrão AD-021; cleanup por ids.
- [x] Gate full passa: `npm run test && npm run test:integration`
- [x] Test count: casos novos + decide.test.ts/moderation-access.test.ts intactos

**Tests**: unit + integration
**Gate**: full
**Commit**: `feat(moderation): helper listViewerModeratableKinds para gating de ações por permissão (MOD-7)`

---

### T4: `ModerationQueue` oculta ações por tipo + fiação da page (MOD-7 UI)

**What**: Prop opcional `viewerModeratableKinds` no componente da fila; itens de tipo fora do conjunto não oferecem ações acionáveis (nota PT-BR no lugar); a page passa o conjunto real.
**Where**: `src/modules/moderation/components/moderation-queue.tsx` (modificar) · `src/app/(app)/moderacao/page.tsx` (passar o prop) · `components/__tests__/moderation-queue.test.tsx` (atualizar/estender)
**Depends on**: T3
**Reuses**: estrutura de render atual; `ContentKind`; `listViewerModeratableKinds` (T3)
**Requirement**: MOD7-02, MOD7-03 · **Must-not**: USP056-MN-04

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] Prop **opcional** `viewerModeratableKinds?: readonly ContentKind[]`; ausente → todos moderáveis (backward-compat, MOD7-03).
- [x] Por linha: se o `contentKind` **não** está no conjunto → não renderiza aprovar/devolver/rejeitar nem o formulário de motivo; renderiza nota PT-BR (`text-fg-muted`, ex.: "Você não tem permissão para moderar este tipo.").
- [x] `page.tsx`: `const moderatableKinds = await listViewerModeratableKinds(person)` passado ao `ModerationQueue`.
- [x] Component test: item `CANDIDATE_PROFILE` (ou `SERVICE`) + `viewerModeratableKinds={[JOB]}` → **sem** botão acionável de aprovar/rejeitar para ele (USP056-MN-04, teste negativo); com todos os kinds (ou prop ausente) → botões presentes; casos existentes (aprovar/devolver/rejeitar/cancelar/erros) permanecem **verdes**.
- [x] Gate build passa: `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` (valida a fiação RSC da page).
- [x] Test count: casos novos + suíte de componente intacta

**Tests**: unit (component)
**Gate**: build
**Commit**: `fix(moderation): fila oculta ações para tipos sem permissão do viewer (MOD-7/P-007)`

---

### T5: `TaxonomySuggestionsList` — confirmação + motivo opcional na rejeição (MOD-8) [P]

**What**: "Rejeitar" abre etapa inline de confirmação com motivo opcional; Confirmar chama `rejectTaxonomySuggestion({kind,id,reason?})`. Aprovar segue 1 clique.
**Where**: `src/modules/moderation/components/taxonomy-suggestions-list.tsx` (modificar) · `components/__tests__/taxonomy-suggestions-list.spec.tsx` (atualizar para o fluxo de 2 etapas + negativo)
**Depends on**: None
**Reuses**: padrão inline-expandível de `published-content-manager.tsx` (open/close/reason state); `rejectTaxonomySuggestion` + `resolveTaxonomySuggestionSchema` (já aceitam `reason` opcional → `audit.justification`); `@/shared/ui` (`Textarea`, `Label`)
**Requirement**: MOD8-01, MOD8-02, MOD8-03, MOD8-04 · **Must-not**: USP056-MN-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [x] "Rejeitar" abre etapa inline (Textarea de motivo opcional `≤ 280`, `Confirmar rejeição` [danger] + `Cancelar`) **sem** chamar a action (USP056-MN-05).
- [x] `Confirmar` → `rejectTaxonomySuggestion({ kind, id, ...(reason.trim() ? { reason: reason.trim() } : {}) })` — `reason` omitido quando vazio; item sai da fila + confirmação (MOD8-02/04).
- [x] `Cancelar` fecha a etapa sem chamar a action; item permanece (MOD8-03).
- [x] "Aprovar" permanece **1 clique** (inalterado).
- [x] Spec test atualizado: "Rejeitar em 1 clique **não** chama a action" (negativo MN-05); "Confirmar com motivo chama `rejectTaxonomySuggestion` com `reason`"; "Confirmar sem motivo chama sem `reason`"; casos de aprovar/erro/vazio/autor-nulo permanecem verdes.
- [x] Gate quick passa: `npm run test`
- [x] Test count: casos novos/atualizados; demais intactos

**Tests**: unit (component)
**Gate**: quick
**Commit**: `fix(moderation): rejeição de sugestão pede confirmação e motivo opcional (MOD-8/SUGG-04)`

---

## Task Granularity Check

| Task | Scope | Status |
|---|---|---|
| T1: reforço da função pura + testes | 1 função (1 arquivo) | ✅ Granular |
| T2: 1 fonte na query + testes | 1 arquivo de query | ✅ Granular |
| T3: 1 helper + extração de mapa puro + testes | 1 helper (arquivos coesos) | ✅ Granular (mapa+helper coesos) |
| T4: 1 prop no componente + fiação da page | 1 componente + 1 page | ✅ Granular (page = fiação mínima do prop) |
| T5: 1 componente (confirmação) + testes | 1 componente | ✅ Granular |

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
|---|---|---|---|
| T1 | None | Phase 1, sem seta | ✅ Match |
| T2 | None | Phase 1, sem seta | ✅ Match |
| T3 | None | Phase 1, sem seta | ✅ Match |
| T4 | T3 | `T3 ──→ T4` (Phase 2) | ✅ Match |
| T5 | None | Phase 1, sem seta | ✅ Match |

`[P]`: T1, T5 (unit-only, sem dep). T2, T3 sem `[P]` (teste de integração → sequencial). T4 depende de T3 (não `[P]`).

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
|---|---|---|---|---|
| T1 | Domínio puro | unit | unit | ✅ OK |
| T2 | Query de fila | unit + integration | unit + integration | ✅ OK |
| T3 | Helper server (data-access) | unit + integration | unit + integration | ✅ OK |
| T4 | Componente cliente (+ page-wiring) | unit (component) [+ build p/ page] | unit (component), gate build | ✅ OK |
| T5 | Componente cliente | unit (component) | unit (component) | ✅ OK |

Nenhuma `Tests: none` — sem deferral de teste.

## 💠 Must-Not Ownership

| Must-Not | Owning Task | Negative Test (no `Done when`) |
|---|---|---|
| USP056-MN-01 (perfil do viewer não entra na fila) | T2 | Int: perfil `personId==viewer` ausente |
| USP056-MN-02 (caractere repetido não é significativo) | T1 | Unit: `'a'.repeat(30)` → false |
| USP056-MN-03 (motivo legítimo não é rejeitado) | T1 | Unit: amostras reais → true; decision.test.ts verde |
| USP056-MN-04 (UI não oferece ação sem permissão) | T4 | Component: item CV + kinds `[JOB]` → sem botão acionável |
| USP056-MN-05 (rejeição não dispara em 1 clique) | T5 | Component: 1 clique em Rejeitar não chama a action |
| USP056-MN-06 (sem status fora de transitionContent / sem tabela/migração/dep) | T1–T5 | Guards existentes + ausência de migração/dep no diff (verificado no gate build/PR) |

Todos os must-nots têm task dona e teste negativo. ✅

## Task Verification Standards

Cada task segue `Done when` + `Tests` + `Gate`. Cada `Done when` é binário e referencia o comando de gate da seção **Gate Check Commands**. Contagem de testes citada para evitar deleções silenciosas. Alterações intencionais de teste (T2 mock, T4 componente, T5 fluxo de 2 etapas) são **atualizações por mudança de AC** (não enfraquecimento) — documentadas na spec §Risks e nos `Done when`.
