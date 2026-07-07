# USP-008 Configurar permissoes delegadas - Refactor (Fase 1) Tasks

## Execution Protocol (MANDATORY - do not skip)

Implement these tasks with the spec-driven execution skill: **activate `bravi-spec-driven` by name**
(fallback `idsd-spec-driven`) and follow its Execute flow and Critical Rules. Do not search for skill
files by filesystem path. The skill is the source of truth for the per-task cycle (implement -> gate ->
atomic commit), sub-agent delegation, adequacy review, and the independent Verifier.

**If the skill cannot be activated, STOP and tell the orchestrator - do not proceed without it.**

**Refactor discipline:**
- **Restyle tasks (T2, T3):** change **only markup/classes**. Do not touch handlers, schemas, actions,
  queries, navigation, metadata, or cache config. Preserve the `isCoordinator -> notFound()` (404) gate,
  `dynamic='force-dynamic'`, the queries, the finite `DELEGABLE_PERMISSIONS` catalog shown in the UI,
  the client guards (selection required; justification >= 10) and the exact action payloads. Existing
  tests stay green.
- **Extraction task (T1):** behavior-preserving **move refactor**. The `z.object(...)` bodies move
  byte-for-byte into `schemas/delegated-permission.schema.ts`; the actions import them. Nothing else in
  the actions changes - `requireCoordinator()` (step 2), the `withAudit` transaction, the concurrency
  `updateMany` (`revokedAt: null`) and the append-only revoke stay verbatim. Same Zod rules, same error
  codes/shapes. This is the **only** backend change in Group D; keep it a separate task from the restyle.

---

**Design**: `.specs/features/identity-acesso-papeis/usp-008-permissoes-delegadas/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec - confirm before Execute. Guidelines found:
> `CLAUDE.md` (§Testing Requirements: Server Action tests cover happy/validation/permission/consent/
> concurrency), `docs/arch/project-guideline.md` (DoD), `vitest.config.ts` + `vitest.integration.config.ts`,
> AD-014 (DS `.tsx` fora do gate de cobertura, mas Client Components tocados tem `.test.tsx` que roda em
> `npm run test`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Zod schema (`delegated-permission.schema.ts`) | unit (via actions) | Regras identicas exercitadas pelas actions: VALIDATION para uuid/enum/scope/justificativa (U8-MN-01) | `src/modules/identity/__tests__/grant-revoke-actions.test.ts` | `npm run test` |
| Server Action (`grant`/`revoke`) | integration | Caminhos DB: happy, NOT_FOUND, PRECONDITION_FAILED, append-only revoke, concorrencia; authz preservada (U8-MN-02) | `src/modules/identity/__tests__/delegated-permissions.int.test.ts` | `npm run test:integration` |
| Client Component (`delegated-permissions-manager.tsx`) | unit (RTL) | **Novo smoke**: guarda de selecao (U8-MN-03a: sem selecao -> nao chama a action + erro); catalogo finito na UI (U8-MN-03b); payload correto no happy | `src/modules/identity/__tests__/DelegatedPermissionsManager.test.tsx` | `npm run test` |
| Server Component (`permissoes/page.tsx`) | none | Gate de build; gate `isCoordinator->404` preservado por diff (sem page.test - padrao do repo) | `src/app/(app)/permissoes/**` | build gate |

## Parallelism Assessment

> Generated from codebase - confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --- | --- | --- | --- |
| unit (action early-exit, mocks) | Yes | `vi.hoisted`/`vi.mock` por arquivo; sem estado compartilhado | `grant-revoke-actions.test.ts:15-52` |
| unit (RTL, jsdom) | Yes | Isolamento por arquivo; actions mockadas | `ActivateRoleForm.test.tsx:11-22` (gabarito) |
| integration (Postgres) | No | Backing store compartilhado; cleanup por CNPJ/linhas; requer `DATABASE_URL` | `delegated-permissions.int.test.ts:1-8, skipIf(!DATABASE_URL)` |

## Gate Check Commands

> Generated from codebase - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tasks com testes unit (RTL) sem DB | `npm run typecheck && npm run lint && npm run test` |
| Full | Tasks que tocam actions com cobertura de integracao (T1) | `npm run typecheck && npm run lint && npm run test && npm run test:integration` |
| Build | Tasks de restyle de Server Component (pagina) | `npm run typecheck && npm run lint && npm run test && npm run build` |

> `test:integration` requer Postgres local (`supabase start` + `DATABASE_URL` via `.env.local`); o int
> test faz `describe.skipIf(!process.env.DATABASE_URL)`, entao o gate Full deve rodar **com** DB provisionado.

---

## Execution Plan

### Phase 1: Extracao de schema (backend, Sequential)

```
T1
```

### Phase 2: Restyle do manager (Sequential)

```
T2
```

### Phase 3: Casca de pagina (Sequential)

```
T2 --> T3
```

3 fases -> execucao inline (sem sub-agentes por fase).

---

## Task Breakdown

### T1: Extrair os schemas Zod inline para `schemas/delegated-permission.schema.ts` + barrel + rewire das actions

**What**: Criar `schemas/delegated-permission.schema.ts` com `grantDelegatedPermissionSchema`/
`revokeDelegatedPermissionSchema` (+ Input types) movidos byte-a-byte das actions; re-cabear ambas as
actions para importa-los (removendo os `z.object` inline e o `import { z }` orfao); atualizar o barrel
para exportar os schemas + Input types do arquivo de schema. Comportamento-preservador.
**Where**:
- `src/modules/identity/schemas/delegated-permission.schema.ts` (create)
- `src/modules/identity/actions/grant-delegated-permission.ts` (modify - so a origem do schema)
- `src/modules/identity/actions/revoke-delegated-permission.ts` (modify - so a origem do schema)
- `src/modules/identity/index.ts` (modify - reexport dos schemas/Input types)
**Depends on**: None
**Reuses**: `activate-role.schema.ts` + `activate-additional-role.ts` (gabarito canonico), `DELEGABLE_PERMISSIONS` (`../domain/permissions`)
**Requirement**: U8-BACKEND-01, U8-MN-01, U8-MN-02

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `schemas/delegated-permission.schema.ts` exporta `grantDelegatedPermissionSchema` (`targetPersonId` uuid `'ID de pessoa invalido'`, `permission` `z.enum(DELEGABLE_PERMISSIONS as [string, ...string[]])`, `scopeArea` `z.string().min(1).max(100).optional()`) e `revokeDelegatedPermissionSchema` (`permissionGrantId` uuid `'ID de concessao invalido'`, `justification` `z.string().min(10, 'Justificativa deve ter ao menos 10 caracteres')`) - **regras e mensagens identicas** as inline atuais - mais os tipos `GrantDelegatedPermissionInput`/`RevokeDelegatedPermissionInput` via `z.infer`.
- [ ] `grant-delegated-permission.ts` importa `{ grantDelegatedPermissionSchema, type GrantDelegatedPermissionInput }` do schema e usa `grantDelegatedPermissionSchema.safeParse`; `revoke-delegated-permission.ts` idem para revoke; **nenhum** `z.object(...)` inline permanece; `import { z }` removido se orfao.
- [ ] `requireCoordinator()` (passo 2), a transacao `withAudit` (grant: create; revoke: `updateMany` condicional `revokedAt: null` + `revokedAt`/`revokedBy`/`justification`), o mapeamento de erro (`NOT_FOUND`/`PRECONDITION_FAILED`/`CONFLICT`/`INTERNAL`) e os `*Result` types permanecem **verbatim**.
- [ ] Barrel `@/modules/identity` exporta `grantDelegatedPermissionSchema`, `revokeDelegatedPermissionSchema`, `GrantDelegatedPermissionInput`, `RevokeDelegatedPermissionInput` (do schema) e mantem os `*Result` types (das actions); sem export duplicado/colidente do mesmo nome.
- [ ] **Negative test (U8-MN-01):** `grant-revoke-actions.test.ts` casos VALIDATION (uuid invalido, permission fora do catalogo, scopeArea vazio, justificativa curta) permanecem verdes sem alteracao das assertivas.
- [ ] **Negative test (U8-MN-02):** `grant-revoke-actions.test.ts` "propaga UNAUTHENTICATED de requireCoordinator" e "propaga FORBIDDEN de requireCoordinator" (grant e revoke) permanecem verdes.
- [ ] `delegated-permissions.int.test.ts` (caminhos DB) verde com Postgres local.
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run test:integration`
- [ ] Test count: `grant-revoke-actions.test.ts` = 9 casos verdes (grant: 3 VALIDATION + 2 authz; revoke: 2 VALIDATION + 2 authz), inalterados; `delegated-permissions.int.test.ts` verde - sem delecoes silenciosas.

**Tests**: integration
**Gate**: full

**Commit**: `refactor(identity): extrai schemas Zod de grant/revoke p/ schemas/delegated-permission.schema.ts`

---

### T2: Restyle `delegated-permissions-manager.tsx` para o Design System (so estilo) + smoke RTL

**What**: Trocar `inputClass`/`btnClass`/`revokeBtnClass` de paleta crua por `Input`/`Button`/`Badge`/
`FormCard`; `<select>` nativos restilizados com tokens; erros em danger-token. Adicionar
`DelegatedPermissionsManager.test.tsx` (smoke) cobrindo U8-MN-03.
**Where**:
- `src/modules/identity/components/delegated-permissions-manager.tsx` (modify - so marcacao/classe)
- `src/modules/identity/__tests__/DelegatedPermissionsManager.test.tsx` (create - smoke RTL)
**Depends on**: None (toca componente diferente de T1; independe da extracao)
**Reuses**: `LoginForm.tsx` (padrao de restyle), `@/shared/ui` (`Input`/`Button`/`Badge`/`FormCard`/`Card`/`FormSectionTitle`), `ActivateRoleForm.test.tsx` (gabarito de RTL)
**Requirement**: U8-STYLE-01, U8-MN-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Inputs de texto (`scopeArea`, `justificativa`) usam `Input`; botao "Conceder permissao" usa `Button variant="primary"`; botao "Revogar" usa `Button variant="outline"` com tokens danger (`text-danger` + realce via `color-mix` sobre `--color-danger`); pill `scopeArea` usa `Badge variant="blue"`. Constantes `inputClass`/`btnClass`/`revokeBtnClass` removidas.
- [ ] `<select>` (voluntario, permissao) permanecem nativos, restilizados com classes de token equivalentes ao `Input`; nenhuma classe de paleta crua (`bg-blue-600`, `text-gray-*`, `border-gray-300`, `focus:ring-blue-*`, `bg-red-50`, `text-red-*`, `bg-blue-100`, `bg-gray-50`).
- [ ] Comportamento preservado: estado, `onGrant`/`onRevoke`, guardas client (selecao obrigatoria; justificativa >= 10), payload identico das actions, atualizacao otimista da lista, `PERMISSION_LABELS`, e a fonte do catalogo `DELEGABLE_PERMISSIONS`.
- [ ] **Novo smoke `DelegatedPermissionsManager.test.tsx`** (actions mockadas) cobre: (a) **U8-MN-03a** - clicar "Conceder permissao" sem voluntario+permissao -> `grantDelegatedPermission` **nao** chamado + texto "Selecione o voluntario e a permissao."; (b) **U8-MN-03b** - o `<select>` de permissao renderiza exatamente `DELEGABLE_PERMISSIONS.length` opcoes do catalogo (+ placeholder), nenhuma extra; (c) happy - selecionar voluntario+permissao e conceder -> `grantDelegatedPermission` chamado com `{ targetPersonId, permission, scopeArea: undefined }`.
- [ ] Renderiza corretamente em light e dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test`
- [ ] Test count: `DelegatedPermissionsManager.test.tsx` >= 3 casos verdes (novos).

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(identity): restyle DelegatedPermissionsManager com Design System (AD-014) + smoke RTL`

---

### T3: Restyle `permissoes/page.tsx` para o Design System (so estilo)

**What**: Envolver a pagina com `FormHeader`; trocar textos `text-gray-*` por tokens; renderizar o
manager reestilizado. Preservar o gate de coordenador.
**Where**: `src/app/(app)/permissoes/page.tsx` (modify - so marcacao/classe)
**Depends on**: T2 (o manager reestilizado e renderizado na pagina)
**Reuses**: `@/shared/ui` (`FormHeader`); `login/page.tsx` como gabarito de composicao
**Requirement**: U8-STYLE-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Pagina compoe `FormHeader title="Permissoes delegadas" description="..."` (texto atual preservado); `<main>` mantem o container com tokens; sem classes de paleta crua (`text-gray-900`, `text-gray-600`).
- [ ] Preservados **verbatim**: `export const dynamic = 'force-dynamic'`, `await requireActivePerson()`, `if (!isCoordinator(viewer)) notFound()`, `Promise.all([listEligibleVolunteers(), listDelegatedPermissions()])`, `<DelegatedPermissionsManager volunteers={volunteers} existing={existing} />`.
- [ ] Renderiza corretamente em light e dark (tokens).
- [ ] Gate check passes: `npm run typecheck && npm run lint && npm run test && npm run build`

**Tests**: none (Server Component - gate de build, padrao do repo)
**Gate**: build

**Commit**: `refactor(identity): restyle pagina de permissoes delegadas com Design System (AD-014)`

---

## Parallel Execution Map

```
Phase 1 (Sequential):
  T1  (extracao de schema + barrel + rewire; full gate c/ integracao)

Phase 2 (Sequential):
  T2  (restyle manager + smoke RTL - independe de T1, arquivo distinto)

Phase 3 (Sequential):
  T2 complete, then:
    T3  (restyle pagina - usa o manager no card)
```

**Parallelism constraint:** T1 (actions/schema/barrel) e T2 (componente) tocam arquivos distintos e nao
tem dependencia de codigo entre si; ficam em fases separadas por clareza de commit (backend, depois
apresentacao) e porque T1 exige gate Full (integracao, **nao** parallel-safe) enquanto T2 e quick. T3
depende de T2 (composicao visual). Nenhum `[P]`: T1 tem testes de integracao nao-parallel-safe e deve
rodar sequencialmente com DB.

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: extracao de schema + barrel + rewire | 1 deliverable coeso (mover o schema; arquivo novo + 2 actions + barrel, todos pela mesma mudanca mecanica) | Granular |
| T2: restyle manager + smoke | 1 componente + seu teste co-localizado | Granular |
| T3: restyle pagina | 1 arquivo | Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | (raiz) | Match |
| T2 | None | (raiz, fase 2) | Match |
| T3 | T2 | T2 -> T3 | Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Zod schema + Server Actions (integracao) | integration | integration | OK |
| T2 | Client Component | unit (RTL) | unit | OK |
| T3 | Server Component (pagina) | none (build) | none | OK |

> T1 escreve o schema e re-cabeia as actions cobertas por integracao; a cobertura vive nos testes ja
> existentes (`grant-revoke-actions.test.ts` unit + `delegated-permissions.int.test.ts` integracao),
> mantidos verdes - nao ha deferimento de teste. T2 cria o teste RTL na mesma task do restyle.

---

## Must-Not Ownership

| Must-Not | Owning Task | Negative Test |
| --- | --- | --- |
| U8-MN-01 (extracao nao afrouxa validacao/catalogo finito) | T1 | `grant-revoke-actions.test.ts` casos VALIDATION (uuid/enum/scope/justificativa) verdes + `delegated-permissions.int.test.ts` verde |
| U8-MN-02 (extracao nao remove `requireCoordinator`) | T1 | `grant-revoke-actions.test.ts` "propaga UNAUTHENTICATED/FORBIDDEN de requireCoordinator" (grant e revoke) verdes |
| U8-MN-03 (restyle nao enfraquece guarda de selecao nem catalogo finito na UI) | T2 | Novo `DelegatedPermissionsManager.test.tsx`: (a) sem selecao -> action nao chamada + erro; (b) `<select>` = catalogo finito exato |

---

## Task Verification Standards

Cada `Done when` e binario e referencia o comando de gate da secao Gate Check Commands. Contagens de
teste explicitas previnem delecoes silenciosas. T1 e a **unica** mudanca de backend do Grupo D e e
comportamento-preservador: prova-se com o gate Full (unit + integracao) e com os casos negativos
U8-MN-01/02 (validacao e authz preservadas). T2/T3 sao restyle (so estilo): mantem verdes os testes
existentes e o gate `isCoordinator -> 404` (preservado por diff em T3). `requireCoordinator` ja e o
passo 2 canonico de ambas as actions - **confirmado**, sem mudanca de authz nesta unidade.
