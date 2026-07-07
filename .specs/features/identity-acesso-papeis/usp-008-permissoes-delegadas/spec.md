# USP-008 Configurar permissoes delegadas a voluntario - Refactor (Fase 1) Specification

> **Fonte da verdade upstream (adaptar, nao re-derivar):** os requisitos funcionais da USP-008 ja
> vivem no epico `.specs/features/identity-acesso-papeis/spec.md` (historia "P1: Configurar permissoes
> delegadas a voluntario", requisitos **IDN-17 / IDN-18** e Edge Cases). Este documento **nao
> re-deriva** aqueles ACs - a USP ja esta implementada e mergeada. Ele especifica **apenas os dois
> deltas de refactor da Fase 1**: (1) restyle da tela ao Design System AD-014 (estilo apenas) e (2)
> extracao dos schemas Zod inline das actions grant/revoke para `schemas/` (mecanica,
> comportamento-preservador). Os IDs `IDN-17/18` permanecem canonicos; os IDs locais (`U8-*`) cobrem so
> o que o epico nao descreve.

## Problem Statement

A USP-008 esta entregue e correta. Restam duas lacunas na rodada de reconciliacao da Fase 1:

1. **Restyle (estilo apenas).** A rota `(app)/permissoes/page.tsx` e o Client Component
   `delegated-permissions-manager.tsx` usam Tailwind solto (`bg-blue-600`, `text-gray-*`,
   `border-gray-*`, `focus:ring-blue-*`, `bg-red-50`/`text-red-*`, `bg-blue-100`, `inputClass`/
   `btnClass`/`revokeBtnClass` com paleta crua) fora do DS. Estas telas **nao existem no protótipo**;
   aplica-se a **linguagem visual** do protótipo (FormHeader/FormCard/Input/Button/Badge + tokens), nao
   uma copia 1:1.

2. **Consistencia de backend (localizacao de schema).** As actions `grant-delegated-permission.ts` e
   `revoke-delegated-permission.ts` definem seus schemas Zod **inline** (`const grantSchema = z.object(...)`
   e `const revokeSchema = z.object(...)` no proprio arquivo da action), divergindo da convencao do
   modulo - toda outra USP tem `schemas/*.schema.ts` (ex.: `activate-role.schema.ts`,
   `credential-claim.schema.ts`, `password-reset.schema.ts`, `register-by-assistant.schema.ts`). O
   delta e **extrair** esses dois schemas para `src/modules/identity/schemas/delegated-permission.schema.ts`,
   exporta-los pelo barrel e re-cabear as actions para importa-los. E um **movimento mecanico**:
   preserva as regras de validacao exatas e as formas de erro; os testes existentes permanecem verdes.

**Confirmacao de autorizacao (nenhuma mudanca necessaria):** ambas as actions **ja** usam
`requireCoordinator()` como passo 2 canonico (`grant-delegated-permission.ts:45`,
`revoke-delegated-permission.ts:37`), que retorna `UNAUTHENTICATED`/`FORBIDDEN` para nao-coordenadores
(nunca lanca). A pagina **ja** aplica o gate `isCoordinator(viewer) -> notFound()` (404). Nao ha
mudanca de authz nesta unidade - a extracao **preserva** a chamada a `requireCoordinator` verbatim.

## Goals

- [ ] Reestilizar `delegated-permissions-manager.tsx` (formulario de concessao + lista de permissoes
      ativas + revogacao) com primitivos/tokens do DS - **sem alterar comportamento** (estado,
      validacoes client, chamadas a `grantDelegatedPermission`/`revokeDelegatedPermission`, atualizacao
      otimista da lista).
- [ ] Reestilizar `permissoes/page.tsx` com `FormHeader` e tokens - **preservando** o gate
      `isCoordinator -> notFound()`, `dynamic='force-dynamic'` e as queries `listEligibleVolunteers`/
      `listDelegatedPermissions` verbatim.
- [ ] Extrair os schemas Zod inline (`grantSchema`, `revokeSchema`) para
      `src/modules/identity/schemas/delegated-permission.schema.ts`, exporta-los pelo barrel e re-cabear
      as actions para importa-los - **comportamento-preservador** (mesmas regras Zod, mesmos codigos/
      formas de erro), com `requireCoordinator` preservado.
- [ ] Manter verdes todos os testes existentes da USP-008 (`grant-revoke-actions.test.ts` unit,
      `delegated-permissions.int.test.ts` integracao, `permissions.test.ts`, `require-permission.test.ts`,
      `queries/__tests__/list-delegated-permissions.test.ts`); adicionar um RTL smoke para o manager
      (hoje sem teste) que protege as guardas do restyle.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Alterar a autorizacao (`requireCoordinator`/`isCoordinator`/`checkPermission`) | Ja correta e usada como passo 2 canonico; a extracao a preserva. Nenhuma mudanca de authz nesta unidade. |
| Alterar as regras Zod (mensagens, min/max, enum do catalogo, `.optional()`) | A extracao e **mecanica**: move o `z.object(...)` sem tocar em nenhuma regra. Mesmos codigos (`VALIDATION`) e formas de erro. |
| Alterar a logica de negocio das actions (transacao, `withAudit`, guarda de concorrencia, append-only) | Fora do escopo: `DELEGATED_PERMISSION_GRANTED/REVOKED`, `updateMany` condicional (`revokedAt: null`), `revokedAt`/`revokedBy`/`justification` permanecem verbatim. So a **origem** do schema muda. |
| Alterar `domain/permissions.ts` (`DELEGABLE_PERMISSIONS`, catalogo finito) | O catalogo finito permanece a fonte do `z.enum` e da UI; nao e alterado. |
| Alterar as queries (`list-delegated-permissions.ts`) | So consumidas; nao tocadas. |
| Novos requisitos funcionais de IDN-17/18 | Ja entregues e cobertos pelos testes existentes. |

---

## Assumptions & Open Questions

| Assumption / decision | Owner | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- | --- |
| Nome do arquivo de schema extraido. | agent | `src/modules/identity/schemas/delegated-permission.schema.ts` (sufixo `.schema.ts` como os schemas novos do modulo). | Alinha ao padrao canonico (`activate-role.schema.ts` etc.); um arquivo para ambos os schemas (grant + revoke), coerente com a proximidade de dominio. | y |
| Nomes exportados dos schemas e tipos. | agent | Exportar `grantDelegatedPermissionSchema`, `revokeDelegatedPermissionSchema`, `type GrantDelegatedPermissionInput`, `type RevokeDelegatedPermissionInput` do arquivo de schema. | Nomes descritivos coerentes com `activateAdditionalRoleSchema`. As actions passam a importar `{ grantDelegatedPermissionSchema, type GrantDelegatedPermissionInput }` do schema (padrao de `activate-additional-role.ts`). | y |
| Preservacao da API publica do barrel. | agent | O barrel passa a exportar os dois schemas + os dois Input types **do arquivo de schema** (novas linhas na secao USP-008), e as actions continuam exportando os `*Result` types. Os nomes publicos `GrantDelegatedPermissionInput`/`RevokeDelegatedPermissionInput` permanecem exportados (agora com origem no schema). | Mantem `@/modules/identity` estavel para consumidores; espelha como os outros schemas sao expostos. | y |
| Local do `z.enum` do catalogo. | agent | O schema importa `DELEGABLE_PERMISSIONS` de `../domain/permissions` e mantem `z.enum(DELEGABLE_PERMISSIONS as [string, ...string[]])` identico. | Preserva a validacao de "catalogo finito" (IDN-18) sem duplicar a lista; mesma coercao de tipo ja usada inline. | y |
| Gate da task de extracao. | agent | **Full** (typecheck + lint + unit + integracao): a extracao toca `grant`/`revoke`, que sao exercitadas por `delegated-permissions.int.test.ts` (Postgres). | O seam nao muda o comportamento, mas a task toca actions com cobertura de integracao; rodar o full gate prova que os caminhos DB seguem verdes. | y |
| O manager (Client Component) hoje **nao** tem teste. | agent | Adicionar um RTL **smoke** focado (`DelegatedPermissionsManager.test.tsx`) que assevera as guardas que o restyle nao pode enfraquecer (nao conceder sem selecao; catalogo finito na UI) e o cabeamento (payload correto). Nao testar exaustivamente a atualizacao otimista. | Um restyle estilo-apenas de um componente interativo **sem** teste e exatamente onde um smoke discriminante ganha o custo; da rede a U8-MN-03 sem sobre-testar logica complexa. | y |
| Gate do manager (T2). | agent | **Quick** (typecheck + lint + test) - o smoke roda em jsdom com actions mockadas; sem DB. | O manager e Client Component; nenhum caminho DB e exercitado pelo smoke. | y |
| Server Component de pagina (`permissoes`) segue o padrao do repo: gate de estilo e typecheck+lint+build, sem teste RTL de pagina; o gate `isCoordinator -> 404` e preservado por diff (nao e reescrito). | agent | Nao criar `page.test.tsx` para `permissoes`. O restyle so troca o JSX retornado dentro do `<main>`; as linhas `if (!isCoordinator(viewer)) notFound()`, `dynamic` e as queries ficam verbatim (Verifier confirma por diff). | Testar Server Component com imports server async e pesado; o repo so tem page.test onde ha roteamento condicional a exercitar - aqui o gate ja e coberto no nivel de action (`requireCoordinator`, testado em `grant-revoke-actions.test.ts`). | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Restyle da gestao de permissoes delegadas para o Design System (AD-014) - so estilo ⭐ MVP

**User Story**: Como coordenador, quero que a tela de conceder/revogar permissoes a voluntarios tenha a
mesma identidade visual do restante do portal, para que a experiencia seja coesa.

**Why P1**: Consistencia visual e o objetivo central da rodada Fase 1 (AD-014).

**Acceptance Criteria**:

1. QUANDO o `delegated-permissions-manager.tsx` e reestilizado ENTAO o sistema DEVE usar
   `Input`/`Button`/`Badge`/`FormCard` (ou `Card`/`FormSectionTitle`) do barrel `@/shared/ui` e a caixa
   de erro no padrao danger-token, substituindo `inputClass`/`btnClass`/`revokeBtnClass` de paleta crua,
   **preservando** o estado React, as validacoes client (selecao obrigatoria; justificativa >= 10),
   as chamadas a `grantDelegatedPermission`/`revokeDelegatedPermission` com payload identico e a
   atualizacao otimista da lista.
2. QUANDO a rota `permissoes/page.tsx` e reestilizada ENTAO o sistema DEVE compo-la com `FormHeader`
   e tokens e DEVE preservar **verbatim** o gate `isCoordinator(viewer) -> notFound()`,
   `dynamic='force-dynamic'` e as queries `listEligibleVolunteers()`/`listDelegatedPermissions()`.
3. QUANDO qualquer tela restilizada e aberta em modo escuro ENTAO o sistema DEVE resolver as cores via
   tokens (`data-theme`), sem hex cru. Os `<select>` (sem primitivo Select no DS) permanecem nativos,
   restilizados com classes de token equivalentes ao `Input`.

**Independent Test**: Rodar o novo `DelegatedPermissionsManager.test.tsx` (smoke) verde apos o restyle;
abrir `permissoes` no browser em light/dark como coordenador (lista/concede/revoga) e como
nao-coordenador (recebe 404) confirmando o gate preservado.

---

### P1: Extrair os schemas Zod inline das actions grant/revoke para `schemas/` (consistencia) ⭐ MVP

**User Story**: Como mantenedor do modulo identity, quero que os schemas de validacao das actions de
delegacao vivam em `schemas/*.schema.ts` como no resto do modulo, para que a convencao de localizacao
seja uniforme e os schemas sejam reutilizaveis/testaveis isoladamente.

**Why P1**: Consistencia arquitetural: toda outra USP do modulo define seus schemas em
`schemas/*.schema.ts` e os exporta pelo barrel; os schemas inline de grant/revoke sao a unica excecao.

**Acceptance Criteria**:

1. QUANDO os schemas sao extraidos ENTAO o sistema DEVE conter
   `src/modules/identity/schemas/delegated-permission.schema.ts` exportando `grantDelegatedPermissionSchema`
   e `revokeDelegatedPermissionSchema` com **as mesmas regras Zod** (grant: `targetPersonId` uuid,
   `permission` = `z.enum(DELEGABLE_PERMISSIONS)`, `scopeArea` string 1..100 opcional; revoke:
   `permissionGrantId` uuid, `justification` string min 10) e as mesmas mensagens.
2. QUANDO as actions sao re-cabeadas ENTAO `grant-delegated-permission.ts` e
   `revoke-delegated-permission.ts` DEVEM importar os schemas (e os Input types) do arquivo de schema, e
   **nao** DEVEM mais declarar `z.object(...)` inline; o passo 2 `requireCoordinator()` e toda a
   transacao `withAudit` permanecem verbatim.
3. QUANDO o barrel e atualizado ENTAO `@/modules/identity` DEVE exportar `grantDelegatedPermissionSchema`,
   `revokeDelegatedPermissionSchema` e os tipos `GrantDelegatedPermissionInput`/`RevokeDelegatedPermissionInput`
   (agora com origem no schema), preservando os nomes publicos ja exportados.
4. QUANDO a extracao esta completa ENTAO o comportamento observavel DEVE ser **identico**: mesmos codigos
   de erro (`VALIDATION` para entradas invalidas), mesmas formas de `fieldErrors`, mesmos desfechos
   `NOT_FOUND`/`PRECONDITION_FAILED`/`CONFLICT`/`INTERNAL`; todos os testes existentes verdes.

**Independent Test**: `grant-revoke-actions.test.ts` (early-exits: VALIDATION para uuid/enum/scope/
justificativa; propaga UNAUTHENTICATED/FORBIDDEN de `requireCoordinator`) verde sem alteracao das
assertivas; `delegated-permissions.int.test.ts` (caminhos DB: happy, NOT_FOUND, PRECONDITION, append-only
revoke, concorrencia) verde com Postgres local.

---

## Edge Cases

- QUANDO `targetPersonId` nao e UUID, `permission` esta fora de `DELEGABLE_PERMISSIONS`, `scopeArea` e
  string vazia, ou `justification` tem < 10 chars ENTAO a action DEVE retornar `VALIDATION` (identico ao
  atual) - garantido pelos schemas extraidos.
- QUANDO o chamador nao e coordenador ENTAO grant/revoke DEVEM retornar `UNAUTHENTICATED`/`FORBIDDEN`
  (via `requireCoordinator`, preservado) e a pagina DEVE retornar 404 (via `isCoordinator -> notFound`).
- QUANDO o manager e submetido sem voluntario+permissao selecionados ENTAO o sistema DEVE **nao** chamar
  `grantDelegatedPermission` (guarda client preservada no restyle).
- QUANDO a justificativa de revogacao tem < 10 chars ENTAO o sistema DEVE **nao** chamar
  `revokeDelegatedPermission` (guarda client preservada no restyle).
- QUANDO o restyle e aplicado ENTAO o sistema DEVE **nao** alterar handlers, schema, actions, queries,
  `dynamic`, o gate `isCoordinator -> 404`, o payload das actions nem o catalogo finito exibido.

---

## Must-Nots (world-level prohibitions)

| ID | WHEN [context] THEN system SHALL NOT... | Prevents | Owning task | Negative test |
| --- | --- | --- | --- | --- |
| U8-MN-01 | QUANDO os schemas sao extraidos ENTAO grant/revoke NAO DEVEM aceitar entradas hoje rejeitadas (uuid invalido, `permission` fora do catalogo finito, `scopeArea` vazio, `justification` < 10) - o codigo/forma de erro (`VALIDATION` + `fieldErrors`) permanece identico. | Extracao alterar silenciosamente uma regra Zod (afrouxar o catalogo finito ou os limites), abrindo brecha de validacao. | T1 | `grant-revoke-actions.test.ts` casos VALIDATION (uuid/enum/scope/justificativa) verdes sem alteracao + `delegated-permissions.int.test.ts` verde. |
| U8-MN-02 | QUANDO as actions sao re-cabeadas ENTAO grant/revoke NAO DEVEM perder o passo 2 `requireCoordinator()` - nao-coordenador continua bloqueado (`UNAUTHENTICATED`/`FORBIDDEN`) antes de qualquer escrita. | Extracao remover/burlar o gate de coordenador durante a mexida no arquivo da action. | T1 | `grant-revoke-actions.test.ts` "propaga UNAUTHENTICATED de requireCoordinator" e "propaga FORBIDDEN de requireCoordinator" (grant e revoke) verdes. |
| U8-MN-03 | QUANDO o `delegated-permissions-manager.tsx` e reestilizado ENTAO o sistema NAO DEVE (a) chamar `grantDelegatedPermission` sem voluntario+permissao selecionados, nem (b) renderizar permissoes fora do catalogo finito `DELEGABLE_PERMISSIONS`. | Restyle enfraquecer a guarda de selecao ou vazar/omitir itens do catalogo finito (IDN-18). | T2 | Novo `DelegatedPermissionsManager.test.tsx`: (a) clicar "Conceder permissao" sem selecao -> action NAO chamada + erro exibido; (b) o `<select>` de permissao renderiza exatamente os `DELEGABLE_PERMISSIONS.length` itens do catalogo (+ placeholder). |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| IDN-17 (upstream, canonico) | USP-008 | Verified (entregue) | Preservado |
| IDN-18 (upstream, canonico) | USP-008 | Verified (entregue) | Preservado |
| U8-STYLE-01 (local) | P1 Restyle | Tasks | Pending |
| U8-BACKEND-01 (local) | P1 Extracao de schema | Tasks | Pending |
| U8-MN-01 (local) | P1 Extracao de schema | Tasks | Pending |
| U8-MN-02 (local) | P1 Extracao de schema | Tasks | Pending |
| U8-MN-03 (local) | P1 Restyle | Tasks | Pending |

- **U8-STYLE-01**: Restyle de `permissoes/page.tsx` + `delegated-permissions-manager.tsx` com primitivos/tokens do DS, estilo apenas (AC P1-Restyle 1-3).
- **U8-BACKEND-01**: Extracao dos schemas Zod inline para `schemas/delegated-permission.schema.ts` + barrel + rewire das actions, comportamento-preservador (AC P1-Extracao 1-4).

**Coverage:** 7 itens (2 upstream preservados, 5 locais); 5 locais mapeados a tasks.

---

## Success Criteria

- [ ] `permissoes/page.tsx` e `delegated-permissions-manager.tsx` usam exclusivamente primitivos/tokens do DS; paridade visual em light e dark; gate `isCoordinator -> 404` preservado.
- [ ] `schemas/delegated-permission.schema.ts` existe e e a origem unica dos schemas grant/revoke; as actions o importam e nao tem mais `z.object(...)` inline; o barrel exporta schemas + Input types; `requireCoordinator` preservado verbatim.
- [ ] Comportamento identico: mesmos codigos/formas de erro; todos os testes existentes da USP-008 verdes (`grant-revoke-actions.test.ts` unit + `delegated-permissions.int.test.ts` integracao com Postgres).
- [ ] Novo `DelegatedPermissionsManager.test.tsx` (smoke) protege as guardas do restyle (U8-MN-03) e passa.
