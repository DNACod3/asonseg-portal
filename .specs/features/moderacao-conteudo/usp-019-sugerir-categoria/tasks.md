# USP-019 — Sugerir nova categoria de serviço ou área de vaga — Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the **`bravi-spec-driven`** skill: **activate it by name** and follow its Execute
flow and Critical Rules. Do not search for skill files by filesystem path. The skill is the source of truth
for the full flow (per-task cycle, gate, atomic commit, independent Verifier, discrimination sensor,
must-not negative tests). **If the skill cannot be activated, STOP and report — do not proceed without it.**

**Design**: `.specs/features/moderacao-conteudo/usp-019-sugerir-categoria/design.md`
**Spec**: `.specs/features/moderacao-conteudo/usp-019-sugerir-categoria/spec.md`
**Status**: Draft

> **Reuso ancorado (não recriar):** `withAudit` (`audit/withAudit.ts`), `AuditEvent.CATEGORY_SUGGESTED/_APPROVED`
> (`audit/events.ts:103-104`), `requirePermission` (`identity/server/require-permission.ts`), `getCurrentPerson`
> (`identity/server/session.ts`), `canAccessModerationQueue` (molde — `moderation/server/moderation-access.ts`),
> `decide.ts` (molde de action), `(app)/moderacao/page.tsx` (molde de rota), `listApprovedJobAreas`
> (`jobs/queries/list-approved-job-areas.ts` — já `isSuggestion:false`), DS `@/shared/ui`. **Sem migração de schema.**

---

## Test Coverage Matrix

> Gerada de codebase + guidelines + spec — confirmar antes do Execute. Guidelines encontradas: `CLAUDE.md`
> (§Testing Requirements — Server Action cobre happy/Zod/permission/consent/concurrency; unit 90% em
> domain; integração 80% em Server Actions sensíveis), `vitest.config.ts` (exclui `*.int.test.ts` do run
> jsdom), `vitest.integration.config.ts` (node + Postgres local).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain puro (`foldForDedup`) + Zod schema | unit | Todos os ramos: fold caso/acento/espaço; edges de tamanho/vazio → `VALIDATION` | `src/modules/moderation/__tests__/*.spec.ts` | `npm run test` |
| Server Action sensível (suggest/approve/reject) | integration | happy + `VALIDATION` + `FORBIDDEN`/`UNAUTHENTICATED` + `NOT_FOUND` + `CONFLICT`(dedup+corrida) + audit-na-tx + rollback; nos 2 `kind` | `src/modules/moderation/__tests__/*.int.test.ts` | `npm run test:integration` |
| Query + View + access guard (server) | integration | pendentes-only dos 2 kinds; autor/data; guard coordinator+delegado true, outro false | `src/modules/moderation/__tests__/*.int.test.ts` | `npm run test:integration` |
| Preservação da não-selecionabilidade | integration | `listApprovedJobAreas` exclui `isSuggestion:true` (pendente + pós-rejeição) | `src/modules/jobs/__tests__/list-approved-job-areas.int.test.ts` | `npm run test:integration` |
| React component (fila DS) + `job-form` (entrada) | unit (RTL) | renderiza itens + botões aprovar/rejeitar; "Outro" revela input e dispara `suggestTaxonomy` | `src/modules/**/__tests__/*.spec.tsx` | `npm run test` |
| Catálogo de evento (`events.ts`) + rota (`page.tsx`) | none / unit | `events.test.ts` cobre a nova constante; rota só no build | `src/modules/audit/__tests__/events.test.ts` | `npm run test` / `npm run build` |

## Parallelism Assessment

> Gerada de codebase — confirmar antes do Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit / RTL (`*.spec.ts`, `*.spec.tsx`) | Yes | jsdom, sem store compartilhado, sem IO | `vitest.config.ts` (`environment:'jsdom'`, exclui `*.int.test.ts`) |
| integration (`*.int.test.ts`) | No | Postgres local compartilhado + cleanup por truncação/delete no setup | `vitest.integration.config.ts` (`environment:'node'`); padrão dos int tests de `jobs` |

## Gate Check Commands

> Gerada de codebase — confirmar antes do Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Após tasks só com unit/RTL | `npm run test` |
| Full | Após tasks com integração | `npm run test && npm run test:integration` |
| Build | Fim de fase / rota / catálogo de evento | `npm run typecheck && npm run lint && npm run test && npm run test:integration && npm run build` |

---

## Execution Plan

### Grafo de dependências

```
Fase 1 (Foundation, unit — paralelo-seguro):
  T1 [P]  (audit event CATEGORY_SUGGESTION_REJECTED)
  T2 [P]  (domain TaxonomyKind + foldForDedup + Zod schemas)

Fase 2 (Actions, integração — sequencial, não [P]):
  T2 ──▶ T3 (suggestTaxonomy)
  T1,T2 ▶ T4 (approve/reject)     [T3 ──▶ T4: mesma suíte int, roda em série]

Fase 3 (Reads, integração — sequencial):
  T2 ──▶ T5 (list-taxonomy-suggestions + view + access guard)

Fase 4 (UI — RTL paralelo-seguro):
  T4,T5 ▶ T6 (page /moderacao/sugestoes + componente DS)
  T3 ───▶ T7 (job-form "Outro / sugerir nova")   [T6 ⟂ T7 → [P]]
```

Arestas (para o cross-check): T1→T4; T2→T3; T2→T4; T2→T5; T3→T4 (série de suíte int); T3→T7; T4→T6; T5→T6.

> 4 fases (>3) ⇒ na fase Execute o agente **oferece** um sub-agente por fase (offer-then-confirm). O Verifier
> independente roda automaticamente após a última task.

---

## Task Breakdown

### T1: Adicionar evento de auditoria `CATEGORY_SUGGESTION_REJECTED` [P]

**What**: Registrar a constante do evento de rejeição no catálogo fechado de auditoria.
**Where**: `src/modules/audit/events.ts` (modify); `src/modules/audit/__tests__/events.test.ts` (modify).
**Depends on**: None
**Reuses**: bloco "Configuração global / taxonomia" (`events.ts:102-106`), padrão `AuditEvent`.
**Requirement**: SUGG-MN-04 (habilita a trilha de rejeição)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `CATEGORY_SUGGESTION_REJECTED: 'CATEGORY_SUGGESTION_REJECTED'` adicionado ao objeto `AuditEvent` (grupo taxonomia).
- [ ] **NÃO** adicionado a `JUSTIFICATION_REQUIRED_EVENTS` (motivo é opcional — spec Assumptions).
- [ ] `events.test.ts` cobre a nova constante (presença + `requiresJustification === false`).
- [ ] Gate `quick` passa: `npm run test`. Contagem de testes: não diminui (sem deleção silenciosa).

**Tests**: unit · **Gate**: quick
**Commit**: `feat(audit): evento CATEGORY_SUGGESTION_REJECTED p/ rejeição de sugestão (USP-019)`

---

### T2: Domain `TaxonomyKind` + `foldForDedup` + schemas Zod [P]

**What**: Tipos puros, regra de dedup normalizado e schemas de entrada das 3 actions.
**Where**: `src/modules/moderation/domain/taxonomy-suggestion.ts`, `src/modules/moderation/schemas/taxonomy-suggestion.ts`, `src/modules/moderation/__tests__/taxonomy-suggestion.domain.spec.ts`; barrel `src/modules/moderation/index.ts` (export dos tipos/schemas).
**Depends on**: None
**Reuses**: `zod` (stack); padrão de schema `moderation/schemas/decision.ts`.
**Requirement**: SUGG-05 (fold), edges de validação

**Tools**: MCP: `context7` (Zod, se necessário) · Skill: NONE

**Done when**:
- [ ] `TaxonomyKind` (`'JOB_AREA' | 'SERVICE_CATEGORY'`), `TAXONOMY_NAME_MIN=2`, `TAXONOMY_NAME_MAX=60`.
- [ ] `foldForDedup(name)`: trim + colapsa espaços internos + `toLowerCase` + remove acentos (`normalize('NFD')` + strip diacríticos). Determinístico.
- [ ] `suggestTaxonomySchema` (`kind` + `name` trim/2..60) e `resolveTaxonomySuggestionSchema` (`kind` + `id` uuid + `reason?` ≤280).
- [ ] Unit: fold iguala "Tecnologia"/"tecnologia"/"tecnologìa"/"  tecnologia  "; distingue "TI"×"Tecnologia"; schema rejeita vazio/1-char/>60/só-espaços (`VALIDATION`) e aceita nome válido.
- [ ] Gate `quick`: `npm run test`. `typecheck` + `lint` ✓.

**Tests**: unit · **Gate**: quick
**Commit**: `feat(moderation): domain TaxonomyKind + foldForDedup + schemas de sugestão (USP-019)`

---

### T3: Server Action `suggestTaxonomy` (criar pendente + dedup + auditoria)

**What**: Uma action genérica que persiste sugestão `isSuggestion=true`, deduplicada, não-selecionável, auditada.
**Where**: `src/modules/moderation/actions/suggest-taxonomy.ts` (`'use server'`); `src/modules/moderation/__tests__/suggest-taxonomy.int.test.ts`; barrel export.
**Depends on**: T2
**Reuses**: `withAudit('CATEGORY_SUGGESTED', …)`, `getCurrentPerson`, `prisma` (via `tx`), molde `decide.ts`, `fail`/`ActionResult`.
**Requirement**: SUGG-01, SUGG-02, SUGG-05, SUGG-08 (kind service) · must-nots SUGG-MN-01, SUGG-MN-03, SUGG-MN-04(criação)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `suggestTaxonomy(input): Promise<ActionResult<{id:string}>>` — Zod → `getCurrentPerson()` (`null` ⇒ `fail('UNAUTHENTICATED')`, sem gate de papel) → `withAudit('CATEGORY_SUGGESTED', ...)`.
- [ ] Dentro da tx: dedup fold sobre **todas** as linhas do `kind` (sugeridas + aprovadas) via `tx.<delegate>`; casamento ⇒ rollback + `fail('CONFLICT', 'Essa área já existe ou já foi sugerida.')` (SUGG-MN-03).
- [ ] `create({ data:{ name: limpo, isSuggestion:true, suggestedBy: person.id } })`; `approvedAt` fica `null`; `audit.entityType`/`entityId`/`after` preenchidos.
- [ ] `Prisma P2002` (corrida de casing idêntico) capturado ⇒ `CONFLICT` (**sem 500**); nunca lança.
- [ ] Selektor `delegateFor(kind, tx)` mapeia `JOB_AREA→tx.jobArea`, `SERVICE_CATEGORY→tx.serviceCategory` (uma implementação, 2 kinds).
- [ ] Gate `full` passa; `typecheck` + `lint` ✓.

**Tests**: integration (`@sugg-01 @sugg-02 @sugg-05 @sugg-08`) — cobre: (a) cria `JobArea` pendente + **1** `audit_log CATEGORY_SUGGESTED` na mesma tx (SUGG-01/MN-04); (b) `SERVICE_CATEGORY` idem (SUGG-08); (c) variação de caso/acento de nome existente ⇒ `CONFLICT`, **contagem de linhas inalterada** (SUGG-05/MN-03); (d) a sugestão criada **não** aparece em `listApprovedJobAreas` (SUGG-02/MN-01); (e) nome vazio/1-char/>60 ⇒ `VALIDATION`; (f) 2ª inserção de mesmo casing exato ⇒ `CONFLICT` sem 500. Test count: ≥6 novos, todos verdes.
**Gate**: full
**Commit**: `feat(moderation): action suggestTaxonomy (pendente + dedup + auditoria) (USP-019)`

---

### T4: Server Actions `approveTaxonomySuggestion` / `rejectTaxonomySuggestion`

**What**: Promover (aprovar) ou remover (rejeitar) uma sugestão pendente, com permissão + auditoria.
**Where**: `src/modules/moderation/actions/resolve-taxonomy-suggestion.ts` (`'use server'`); `src/modules/moderation/__tests__/resolve-taxonomy-suggestion.int.test.ts`; barrel export.
**Depends on**: T1, T2 (roda após T3 — mesma suíte de integração, série)
**Reuses**: `requirePermission('APPROVE_CATEGORY_SUGGESTION')`, `withAudit`, `prisma` (via `tx`), molde `decide.ts`.
**Requirement**: SUGG-03, SUGG-04, SUGG-08 (kind service) · must-nots SUGG-MN-02, SUGG-MN-04(aprovar/rejeitar), SUGG-MN-05

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `approveTaxonomySuggestion`: Zod → `requirePermission` (`!ok` ⇒ retorna authz) → `withAudit('CATEGORY_APPROVED', ...)` `update({ where:{ id, isSuggestion:true }, data:{ isSuggestion:false, approvedAt:now, approvedBy: person.id } })`; `P2025`/ausente/já-resolvido ⇒ `fail('NOT_FOUND')`; `audit.before/after`.
- [ ] `rejectTaxonomySuggestion`: Zod → `requirePermission` → `withAudit('CATEGORY_SUGGESTION_REJECTED', ...)`: lê `before`; `null`/`isSuggestion=false` ⇒ `fail('NOT_FOUND')`; senão `delete`; `audit.before=before`; `reason?`→`audit.justification` (opcional). `P2003` (FK defensivo) ⇒ `CONFLICT`.
- [ ] Nenhuma mudança de estado quando permissão negada (SUGG-MN-02) — verificado no teste.
- [ ] Gate `full` passa; `typecheck` + `lint` ✓.

**Tests**: integration (`@sugg-03 @sugg-04 @sugg-08`) — cobre: (a) aprovar ⇒ `isSuggestion=false` + `approvedAt/By` + **1** `CATEGORY_APPROVED` + passa a aparecer em `listApprovedJobAreas` (SUGG-03/MN-04); (b) rejeitar ⇒ linha deletada + **1** `CATEGORY_SUGGESTION_REJECTED` (before-state no log) + **some** de `listTaxonomySuggestions` e continua fora de `listApprovedJobAreas` (SUGG-04/MN-05); (c) aprovar **e** rejeitar sem `APPROVE_CATEGORY_SUGGESTION` ⇒ `FORBIDDEN`, **contagem/estado inalterados** (SUGG-MN-02); (d) `id` inexistente/já resolvido ⇒ `NOT_FOUND`; (e) `SERVICE_CATEGORY` aprovar/rejeitar (SUGG-08). Test count: ≥6 novos, verdes.
**Gate**: full
**Commit**: `feat(moderation): actions aprovar/rejeitar sugestão de taxonomia (USP-019)`

---

### T5: Query `listTaxonomySuggestions` + View + access guard

**What**: Ler a fila de pendentes (áreas + categorias) com autor/data, e o guard de acesso à página.
**Where**: `src/modules/moderation/queries/list-taxonomy-suggestions.ts`, `src/modules/moderation/views/taxonomy-suggestion-item.ts`, `src/modules/moderation/server/taxonomy-suggestion-access.ts`, `src/modules/moderation/__tests__/list-taxonomy-suggestions.int.test.ts`; barrel exports.
**Depends on**: T2 (roda após T4 — integração em série)
**Reuses**: molde `moderation-access.ts` (`isCoordinator` + delegação), padrão View Model de `moderation/views`.
**Requirement**: SUGG-06 (dados da fila + acesso)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `listTaxonomySuggestions(): Promise<TaxonomySuggestionItem[]>` — dois `findMany({ where:{ isSuggestion:true, approvedAt:null }, take:200 })` (áreas + categorias), join `Person.fullName` p/ `suggestedByName`, mescla `createdAt desc`.
- [ ] `TaxonomySuggestionItem { id; kind; name; suggestedByName; createdAt }`.
- [ ] `canApproveTaxonomySuggestions(person)` — `isCoordinator` **ou** delegação ativa de `APPROVE_CATEGORY_SUGGESTION`.
- [ ] Gate `full` passa; barrel exporta query/view/tipo/guard; `typecheck`+`lint` ✓.

**Tests**: integration (`@sugg-06`) — lista **só** pendentes dos 2 kinds (exclui aprovadas e as já rejeitadas); traz autor + data; `canApproveTaxonomySuggestions` = true p/ coordenador e p/ delegado ativo, false p/ Pessoa sem permissão. Test count: ≥4 novos, verdes.
**Gate**: full
**Commit**: `feat(moderation): fila de sugestões de taxonomia + guard de acesso (USP-019)`

---

### T6: Página `(app)/moderacao/sugestoes` + componente DS da fila

**What**: Rota Server da fila (404 se sem acesso) + componente client que renderiza itens e chama aprovar/rejeitar.
**Where**: `src/app/(app)/moderacao/sugestoes/page.tsx`, `src/modules/moderation/components/taxonomy-suggestions-list.tsx`, `src/modules/moderation/__tests__/taxonomy-suggestions-list.spec.tsx`; barrel export do componente.
**Depends on**: T4, T5
**Reuses**: molde `(app)/moderacao/page.tsx` (`force-dynamic` + `requireActivePerson` + `notFound`), `canApproveTaxonomySuggestions` (T5), `listTaxonomySuggestions` (T5), actions (T4), DS `Card`/`Badge`/`Button` (`@/shared/ui`).
**Requirement**: SUGG-06 · must-not SUGG-MN-02 (defesa em profundidade: a action re-checa)

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] `export const dynamic = 'force-dynamic'`; `requireActivePerson()` → `canApproveTaxonomySuggestions(person)` `?` render `:` `notFound()` (404 — rota não revela existência, SUGG-06).
- [ ] `TaxonomySuggestionsList` renderiza cada item em `Card` com `Badge` do `kind` (Área × Serviço), autor/data, e `Button` "Aprovar"/"Rejeitar" (variante `danger` p/ rejeitar) cabeados às actions; feedback de `ActionResult` (pendente removido/duplicata/erro).
- [ ] **Sem** paleta crua (`bg-blue-600`/`text-gray-*`/`bg-gray-*`/`border-gray-*`) nem hex literal — só primitivos/tokens do DS (AD-014); paridade light/dark via tokens.
- [ ] Gate `build` passa (`npm run build` compila a rota); `typecheck`+`lint` ✓.

**Tests**: unit RTL (`@sugg-06`) — `taxonomy-suggestions-list.spec.tsx`: renderiza N itens com o `Badge` de kind correto e os dois botões por item; clicar "Aprovar"/"Rejeitar" invoca a action correspondente (mock) com `{kind,id}`. Test count: ≥3 novos, verdes.
**Gate**: build
**Commit**: `feat(moderation): página /moderacao/sugestoes + fila DS de sugestões (USP-019)`

---

### T7: Entrada "Outro / sugerir nova" no formulário de vaga [P]

**What**: Permitir sugerir uma nova área como texto livre a partir do select de área do `JobForm`.
**Where**: `src/modules/jobs/components/job-form.tsx` (modify); `src/modules/jobs/__tests__/job-form.spec.tsx` (novo ou estende).
**Depends on**: T3
**Reuses**: `Input`/`Button` do DS (`@/shared/ui`), `suggestTaxonomy` via `@/modules/moderation`, `select` de área existente (`job-form.tsx:159-172`).
**Requirement**: SUGG-07

**Tools**: MCP: NONE · Skill: NONE

**Done when**:
- [ ] Opção sentinela "Outro / sugerir nova área" no `<select id="areaId">`; selecioná-la revela `Input` de texto livre + `Button` "Sugerir área".
- [ ] Submeter chama `suggestTaxonomy({ kind:'JOB_AREA', name })`; feedback via `ActionResult` (sucesso = "enviada para aprovação"; `CONFLICT` = "já existe / já sugerida"; `VALIDATION` = erro de campo).
- [ ] O sub-fluxo de sugestão **não** altera o submit de publicação da vaga (`areaId` continua exigido; sugerir não seleciona a nova área — ela é pendente, SUGG-MN-01).
- [ ] Se o barrel `@/modules/moderation` arrastar server-only p/ o bundle client, importar a action pelo caminho com escape-hatch documentado (padrão AD-013 / T-A1) — validar no `build`.
- [ ] Gate `build` passa; `typecheck`+`lint` ✓.

**Tests**: unit RTL (`@sugg-07`) — escolher "Outro" revela o input; submeter com "Jardinagem" invoca `suggestTaxonomy` (mock) com `{kind:'JOB_AREA', name:'Jardinagem'}` e exibe o feedback de pendência. Test count: ≥2 novos, verdes.
**Gate**: build
**Commit**: `feat(jobs): opção "Outro / sugerir nova área" no formulário de vaga (USP-019)`

---

## Validação pré-aprovação (4 checks obrigatórios)

### Check 1 — Granularidade

| Task | Escopo | Status |
| --- | --- | --- |
| T1 | 1 constante de evento + teste | ✅ Granular |
| T2 | 1 domain + 1 schema (coeso, puro) | ✅ Granular |
| T3 | 1 Server Action (suggest) | ✅ Granular |
| T4 | 2 actions coesas (approve/reject, mesmo arquivo/tema) | ✅ Granular |
| T5 | 1 query + 1 view + 1 guard (leituras coesas) | ✅ Granular |
| T6 | 1 rota + 1 componente de apresentação | ✅ Granular |
| T7 | 1 modificação de formulário (sub-fluxo de sugestão) | ✅ Granular |

### Check 2 — Cross-check diagrama × `Depends on`

| Task | Depends on (corpo) | Diagrama (arestas) | Status |
| --- | --- | --- | --- |
| T1 | — | raiz | ✅ Match |
| T2 | — | raiz | ✅ Match |
| T3 | T2 | T2→T3 | ✅ Match |
| T4 | T1, T2 | T1→T4, T2→T4 (série após T3) | ✅ Match |
| T5 | T2 | T2→T5 | ✅ Match |
| T6 | T4, T5 | T4→T6, T5→T6 | ✅ Match |
| T7 | T3 | T3→T7 | ✅ Match |

`[P]` só em T1/T2 (Fase 1, unit) e T6/T7 (Fase 4 — arquivos disjuntos, RTL paralelo-seguro; T6 tem build de rota). T3/T4/T5 são integração ⇒ **nunca** `[P]` (Postgres compartilhado + cleanup). Nenhuma task `[P]` depende de outra `[P]` na mesma fase.

### Check 3 — Co-locação de testes (× Test Coverage Matrix)

| Task | Camada criada/modificada | Matrix exige | Task declara | Status |
| --- | --- | --- | --- | --- |
| T1 | catálogo de evento | unit | unit | ✅ OK |
| T2 | domain + schema | unit | unit | ✅ OK |
| T3 | Server Action sensível | integration | integration | ✅ OK |
| T4 | Server Actions sensíveis | integration | integration | ✅ OK |
| T5 | query + view + guard | integration | integration | ✅ OK |
| T6 | rota + componente React | unit (RTL) + build | unit RTL + build | ✅ OK |
| T7 | componente React (form) | unit (RTL) + build | unit RTL + build | ✅ OK |

Nenhuma task difere seus testes para outra ⇒ sem violação de co-locação.

### 💠 Check 4 — Titularidade de must-not

| Must-not | Owning task(s) | Teste negativo (verde exigido) |
| --- | --- | --- |
| SUGG-MN-01 (pendente não-selecionável) | T3 | int: sugestão criada **não** aparece em `listApprovedJobAreas`. |
| SUGG-MN-02 (sem permissão não aprova/rejeita) | T4 (+ T6 defesa em profundidade) | int: aprovar/rejeitar sem `APPROVE_CATEGORY_SUGGESTION` ⇒ `FORBIDDEN`, estado inalterado. |
| SUGG-MN-03 (sem duplicata caso/acento) | T3 | int: variação de caso/acento ⇒ `CONFLICT`, contagem de linhas inalterada. |
| SUGG-MN-04 (nada persiste sem audit na mesma tx) | T3 (create) + T4 (approve/reject) | int: cada operação grava **exatamente 1** evento; falha de audit ⇒ rollback (via `withAudit`). |
| SUGG-MN-05 (rejeitada some da fila e do select) | T4 | int: pós-rejeição ausente de `listTaxonomySuggestions` e de `listApprovedJobAreas`. |

Todos os 5 must-nots têm task dona + teste negativo. Nenhum órfão.

---

## Tools / MCPs / Skills por task

- **MCP `context7`**: só em T2 se precisar confirmar API do Zod. Demais tasks: NONE.
- **Skill `bravi-spec-driven`**: ativa em todas as tasks (fluxo Execute + gate + commit atômico + Verifier).
- **Sem migração de schema** em nenhuma task (persistência já existe). T1 muda apenas o catálogo de eventos (string).

## Facts (skill-tdad) — a gerar na fase Execute

Se o pipeline usar `skill-tdad`, rodar sobre os ACs da spec (SUGG-01..08 + SUGG-MN-01..05) para produzir os
`.feature`/specs RED e a matriz AC→fact (tags `@sugg-01`…`@sugg-mn-05`); os paths retornados populam o campo
**Tests** de cada task. Caso contrário, os testes co-locados acima são a fonte.
