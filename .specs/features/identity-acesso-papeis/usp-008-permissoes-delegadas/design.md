# USP-008 Configurar permissoes delegadas - Refactor (Fase 1) Design

**Spec**: `.specs/features/identity-acesso-papeis/usp-008-permissoes-delegadas/spec.md`
**Status**: Draft

> **Fontes da verdade upstream (adaptar, nao re-derivar):** Design System AD-014
> (`.specs/features/fundacao-ui-design-system/design.md` + barrel `src/shared/ui/index.ts`) fixa os
> primitivos e tokens; o protótipo `docs/prototipo/index.html` fixa a linguagem visual; o padrao de
> schema `schemas/*.schema.ts` do proprio modulo (ex.: `activate-role.schema.ts`) fixa a convencao de
> extracao. STATE.md `## Decisions`: **AD-014 (active)** consumida por este design; nenhuma decisao
> ativa e conflitada ou supersedida. Este design **nao re-decide** nada do DS nem da autorizacao.

---

## Architecture Overview

Duas frentes desacopladas: um refactor de apresentacao (2 arquivos, so markup/classe) e uma extracao
mecanica de schema (movimento de arquivo, comportamento-preservador).

```mermaid
graph TD
    subgraph DS[src/shared/ui - AD-014 (nao alterado)]
      FH[FormHeader]
      FC[FormCard / Card / FormSectionTitle]
      IN[Input / Button / Badge]
    end
    subgraph Restyle[Frente 1 - so estilo]
      PAGE[permissoes/page.tsx]
      MGR[delegated-permissions-manager.tsx]
    end
    subgraph Extract[Frente 2 - extracao de schema]
      NEWSCH[schemas/delegated-permission.schema.ts NOVO]
      GACT[actions/grant-delegated-permission.ts]
      RACT[actions/revoke-delegated-permission.ts]
      BARREL[index.ts barrel]
    end
    subgraph Preserved[Preservado - comportamento identico]
      RC[server/require-permission.ts requireCoordinator]
      DOM[domain/permissions.ts DELEGABLE_PERMISSIONS]
      Q[queries/list-delegated-permissions.ts]
    end
    FH --> PAGE
    FC --> MGR
    IN --> MGR
    PAGE --> MGR
    NEWSCH --> GACT & RACT
    NEWSCH --> BARREL
    DOM -->|z.enum| NEWSCH
    GACT & RACT --> RC
    MGR -->|payload IDENTICO| GACT & RACT
    PAGE -->|gate isCoordinator->404 preservado| Q
```

**Principio central:** a Frente 2 e um *move refactor* - o corpo dos `z.object(...)` sai da action e
entra no arquivo de schema **byte-a-byte**; a action passa a importa-lo. Nada mais na action muda: o
passo 2 `requireCoordinator()`, a transacao `withAudit`, o `updateMany` condicional de concorrencia, o
append-only (`revokedAt`/`revokedBy`) e o tratamento de erro ficam verbatim. A Frente 1 troca elementos
crus por primitivos e paleta por tokens, sem tocar estado/handlers/payload.

---

## Code Reuse Analysis

### Existing Components to Leverage

| Component | Location | How to Use |
| --- | --- | --- |
| `FormHeader` | `src/shared/ui` | Cabecalho da pagina `permissoes` (titulo + descricao atuais preservados). |
| `FormCard` / `Card` / `FormSectionTitle` | `src/shared/ui` | Envolver as secoes "Conceder permissao" e "Permissoes ativas" e os cartoes por voluntario. |
| `Input` / `Button` | `src/shared/ui` | Substituir `inputClass` (input de texto de escopo/justificativa) e `btnClass`/`revokeBtnClass` (botoes). |
| `Badge` (`variant="blue"`) | `src/shared/ui` | Substituir o pill `bg-blue-100 text-blue-700` do `scopeArea`. |
| `LoginForm.tsx` / `login/page.tsx` | `src/modules/identity`, `src/app/(auth)/login` | Gabarito de restyle: caixa danger-token, `FormHeader`+`FormCard`, `Button variant="primary"`. |
| `activate-role.schema.ts` + `activate-additional-role.ts` | `src/modules/identity/schemas`, `.../actions` | Padrao canonico de "schema em arquivo + action importa `{ schema, type Input }`". Gabarito da extracao. |
| `grant-revoke-actions.test.ts` | `src/modules/identity/__tests__` | Rede de seguranca unit (early-exits VALIDATION + authz) - deve permanecer verde apos a extracao. |
| `delegated-permissions.int.test.ts` | `src/modules/identity/__tests__` | Rede de integracao (caminhos DB) - deve permanecer verde (full gate). |
| `ActivateRoleForm.test.tsx` / `LoginForm` RTL | `src/modules/identity/__tests__` | Modelo de estilo/estrutura para o novo `DelegatedPermissionsManager.test.tsx` (mock de action + render). |

### Integration Points

| System | Integration Method |
| --- | --- |
| `grantDelegatedPermission` / `revokeDelegatedPermission` | O manager continua importando e chamando as actions com **payload identico** (`targetPersonId`/`permission`/`scopeArea`; `permissionGrantId`/`justification`). Sem mudanca. |
| `DELEGABLE_PERMISSIONS` (`domain/permissions.ts`) | Fonte do `z.enum` no schema extraido **e** da lista de opcoes na UI. Nao alterado. |
| `requireCoordinator` (`server/require-permission.ts`) | Passo 2 das actions - preservado verbatim; a extracao nao o toca. |
| Queries `listEligibleVolunteers`/`listDelegatedPermissions` | Consumidas pela pagina; nao tocadas. |
| Barrel `@/modules/identity` | Passa a reexportar os dois schemas + Input types do arquivo de schema (linhas novas na secao USP-008); nomes publicos preservados. |
| Vitest (jsdom + Postgres) | Manager smoke em `npm run test`; actions em `npm run test` (unit) + `npm run test:integration` (Postgres). |

---

## Components

### `schemas/delegated-permission.schema.ts` (NOVO - extracao mecanica)

- **Purpose**: alojar os schemas Zod de grant/revoke e seus Input types, hoje inline nas actions.
- **Location**: `src/modules/identity/schemas/delegated-permission.schema.ts`
- **Interfaces** (identicas as inline atuais):
  - `grantDelegatedPermissionSchema` = `z.object({ targetPersonId: z.string().uuid('ID de pessoa invalido'), permission: z.enum(DELEGABLE_PERMISSIONS as [string, ...string[]]), scopeArea: z.string().min(1).max(100).optional() })`
  - `revokeDelegatedPermissionSchema` = `z.object({ permissionGrantId: z.string().uuid('ID de concessao invalido'), justification: z.string().min(10, 'Justificativa deve ter ao menos 10 caracteres') })`
  - `type GrantDelegatedPermissionInput = z.infer<typeof grantDelegatedPermissionSchema>`
  - `type RevokeDelegatedPermissionInput = z.infer<typeof revokeDelegatedPermissionSchema>`
- **Dependencies**: `zod`, `DELEGABLE_PERMISSIONS` (`../domain/permissions`).
- **Reuses**: o catalogo finito de `domain/permissions.ts` (nao duplica a lista).

### `grant-delegated-permission.ts` / `revoke-delegated-permission.ts` (rewire - so a origem do schema)

- **Location**: `src/modules/identity/actions/`
- **Mudancas**: remover `const grantSchema = z.object(...)` / `const revokeSchema = z.object(...)` e o `import { z }` se ficar orfao; importar `{ grantDelegatedPermissionSchema, type GrantDelegatedPermissionInput }` (e o par de revoke) do schema; trocar `grantSchema.safeParse` -> `grantDelegatedPermissionSchema.safeParse` (idem revoke); o tipo do parametro publico passa a vir do schema. Manter os `export type Grant/RevokeDelegatedPermissionInput = ...` como reexport do tipo do schema (ou remover e deixar o barrel exportar do schema - ver barrel abaixo), preservando os nomes publicos.
- **Preservado (verbatim)**: `requireCoordinator()` (passo 2), toda a transacao `withAudit`, o `updateMany` condicional (`revokedAt: null`) de concorrencia, `revokedAt`/`revokedBy`/`justification`, o mapeamento de erros (`NOT_FOUND`/`PRECONDITION_FAILED`/`CONFLICT`/`INTERNAL`), os `*Result` types.
- **Reuses**: `schemas/delegated-permission.schema.ts`.

### barrel `index.ts` (rewire - reexport dos schemas)

- **Location**: `src/modules/identity/index.ts`
- **Mudancas**: na secao "Permissoes delegadas a voluntarios (USP-008)", exportar
  `grantDelegatedPermissionSchema`, `revokeDelegatedPermissionSchema` e os tipos
  `GrantDelegatedPermissionInput`/`RevokeDelegatedPermissionInput` **do arquivo de schema**; manter os
  `*Result` types exportados das actions. Nomes publicos preservados (consumidores nao quebram).

### `delegated-permissions-manager.tsx` (restyle - so estilo)

- **Location**: `src/modules/identity/components/delegated-permissions-manager.tsx`
- **Mudancas (markup/classe apenas)**:
  - Remover as constantes `inputClass`/`btnClass`/`revokeBtnClass` (paleta crua).
  - Inputs de texto (`scopeArea`, `justificativa`) -> `Input`; `<select>` (voluntario, permissao) permanecem nativos (DS nao tem Select) mas restilizados com classes de token equivalentes ao `Input`.
  - Botao "Conceder permissao" -> `Button variant="primary"`; botao "Revogar" -> `Button variant="outline"` com tokens danger (`text-danger`, borda/realce via `color-mix` sobre `--color-danger`; DS nao tem variante danger).
  - Pill `scopeArea` (`bg-blue-100 text-blue-700`) -> `Badge variant="blue"`.
  - Secoes/cartoes (`rounded-xl border border-gray-200 p-5`, `bg-gray-50`) -> `FormCard`/`Card` (ou classes de token); titulos "Conceder permissao"/"Permissoes ativas" -> `FormSectionTitle` ou `text-fg`.
  - Erros (`text-red-600`) -> `text-danger`; textos `text-gray-*` -> `text-fg`/`text-fg-muted`.
- **Preservado**: todo o estado (`grants`/`selectedVolunteer`/`selectedPermission`/`scopeArea`/`error`/`revokeError`/`justification`/`isPending`/`pendingRevokeId`), `onGrant`/`onRevoke`, as guardas client (selecao obrigatoria; justificativa >= 10), o payload das actions, a atualizacao otimista da lista, `PERMISSION_LABELS`, e a fonte do catalogo (`DELEGABLE_PERMISSIONS`).
- **Reuses**: `@/shared/ui` (`Input`/`Button`/`Badge`/`FormCard`/`Card`/`FormSectionTitle`).

### `permissoes/page.tsx` (restyle - so estilo)

- **Location**: `src/app/(app)/permissoes/page.tsx`
- **Mudancas (markup/classe apenas)**: `<header>`+`<h1 className="text-gray-900">`+`<p className="text-gray-600">` -> `FormHeader title="Permissoes delegadas" description="..."` (texto atual preservado); `<main>` mantem o container com tokens.
- **Preservado (verbatim)**: `export const dynamic = 'force-dynamic'`, `await requireActivePerson()`, `if (!isCoordinator(viewer)) notFound()`, `Promise.all([listEligibleVolunteers(), listDelegatedPermissions()])`, `<DelegatedPermissionsManager volunteers={...} existing={...} />`.
- **Reuses**: `@/shared/ui` (`FormHeader`).

---

## Data Models (if applicable)

N/A - nenhum modelo Prisma, migracao ou coluna e criado ou alterado. `DelegatedPermission`,
`PermissionId` e o catalogo `DELEGABLE_PERMISSIONS` permanecem intactos. A extracao de schema nao muda
forma de dado - apenas a localizacao do `z.object`.

---

## Error Handling Strategy

| Error Scenario | Handling | User Impact |
| --- | --- | --- |
| Entrada invalida (uuid/enum/scope/justificativa) | Mesmo `safeParse` -> `fail('VALIDATION', ...)` com `fieldErrors` identicos (schema so mudou de arquivo) | Mensagem/codigo identicos (U8-MN-01). |
| Nao-coordenador | `requireCoordinator` -> `UNAUTHENTICATED`/`FORBIDDEN` (preservado); pagina -> 404 | Bloqueado antes de qualquer escrita (U8-MN-02). |
| Concessao sem selecao / justificativa curta (client) | Guarda client preservada (nao chama a action; erro exibido) | Comportamento identico (U8-MN-03). |
| DB (NOT_FOUND / PRECONDITION / CONFLICT / INTERNAL) | Mapeamento de erro das actions preservado verbatim | Desfechos identicos; provado por `delegated-permissions.int.test.ts`. |
| Cor em modo escuro | Tokens re-resolvem via `data-theme` | Sem hex cru; paridade light/dark. |

---

## Risks & Concerns

| Concern | Location (file:line) | Impact | Mitigation |
| --- | --- | --- | --- |
| Reexport de tipo pode duplicar/colidir nome no barrel | `index.ts:124-133` | Erro de typecheck se `GrantDelegatedPermissionInput` for exportado de dois lugares | Exportar o Input type **so** do schema (ajustar a linha atual que o exporta da action); typecheck gate detecta colisao. |
| Extracao toca actions cobertas por integracao (Postgres) | `actions/grant-*`/`revoke-*` | Regressao silenciosa nos caminhos DB | Full gate na T1 (`npm run test:integration` com `supabase start`); int test cobre happy/NOT_FOUND/PRECONDITION/append-only/concorrencia. |
| `import { z }` orfao na action apos remover o `z.object` | `grant-*`/`revoke-*.ts:2` | Lint `no-unused-vars` falha | Remover o import se nao houver outro uso de `z` na action; lint gate detecta. |
| Manager sem teste antes do restyle | `delegated-permissions-manager.tsx` | Restyle sem rede -> regressao de guarda/catalogo | T2 adiciona `DelegatedPermissionsManager.test.tsx` (smoke) cobrindo U8-MN-03 antes/junto do restyle. |
| `<select>` sem primitivo Select no DS | `delegated-permissions-manager.tsx:130-155` | Tentacao de introduzir dep/primitivo novo | Manter `<select>` nativo com classes de token; introduzir Select e outra unidade (documentado). |
| Botao "Revogar" e vermelho; DS nao tem variante danger | `delegated-permissions-manager.tsx:119-120` | Uso de `bg-red-*` cru | `Button variant="outline"` + tokens danger via `color-mix` sobre `--color-danger`. |

> Nenhum outro concern relevante encontrado nos arquivos tocados.

---

## Tech Decisions (only non-obvious ones)

| Decision | Choice | Rationale |
| --- | --- | --- |
| Um arquivo de schema para grant + revoke | `schemas/delegated-permission.schema.ts` (ambos) | Proximidade de dominio (delegacao); menos arquivos; espelha a coesao dos schemas por USP. |
| Origem dos Input types | Arquivo de schema (barrel reexporta) | Padrao canonico (`activate-role.schema.ts`); evita duplicacao/colisao no barrel. |
| `<select>` nativo restilizado vs. Select primitivo | Nativo + tokens | DS nao tem Select; estilo-apenas. Select e outra unidade. |
| Botao "Revogar" | `Button variant="outline"` + tokens danger | DS nao tem variante danger; token `--color-danger` via `color-mix` mantem a semantica destrutiva sem hex cru. |
| Gate da extracao (T1) | Full (inclui integracao) | Toca actions com cobertura de integracao; prova comportamento-preservador nos caminhos DB. |
| Smoke RTL para o manager | Novo `DelegatedPermissionsManager.test.tsx` | Restyle de componente interativo sem teste - smoke discriminante protege U8-MN-03 sem sobre-testar. |
| Sem page.test para `permissoes` | Gate de build; gate `isCoordinator->404` preservado por diff | Render sem roteamento condicional novo; authz ja coberta no nivel de action. |

> **Project-level decisions:** nenhuma nova - este design **consome** AD-014 e o padrao de schema ja
> vigente. Nada a anexar a STATE.md `## Decisions`.

---

## Tips aplicadas
- Context first: reusa `activate-role.schema.ts`/`activate-additional-role.ts` como gabarito da extracao e `LoginForm` como gabarito de restyle.
- Reuse e rei: so primitivos do barrel; o catalogo finito continua unico em `domain/permissions.ts`.
- Interfaces first: as regras Zod e o payload das actions sao contratos fixos - movidos, nao alterados.
