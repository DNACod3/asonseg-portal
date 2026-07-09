# USP-032 — Editar serviço (pausar, arquivar) (tasks)

Sizing: **Large**. NET-NEW. Sem migração. **Pré-requisito duro:** USP-029 T029-2 (`eventTypeFor` estendido p/ SERVICE + eventos `SERVICE_UNPAUSED`/`SERVICE_EDITED_AFTER_APPROVAL`). Ordem: gate → actions → guarda estática → UI → testes.

### T032-1 — Ownership gate `requireServiceOwner`
- **What:** `services/server/require-service-owner.ts` (design §1): owner = autor OU responsável ativo da empresa; checado antes de escrita.
- **Where:** `src/modules/services/server/require-service-owner.ts`
- **Depends on:** USP-029 T029-1  ·  **Reuses:** `requireActiveResponsible` (replicado), `prisma`
- **Done when:** retorna false p/ não-dono; true p/ autor e p/ responsável ativo.
- **Tests:** unit `require-service-owner.test.ts`: autor→ok; responsável→ok; terceiro→false.
- **Gate:** `npm run test -- require-service-owner`

### T032-2 — `editService` (exceção atômica conteúdo+status)
- **What:** `actions/edit-service.ts` (design §2): updateMany `where {id,status:'ACTIVE'}` `data {...fields,status:'DRAFT'}` em `withAudit(SERVICE_EDITED_AFTER_APPROVAL)`; EditConflictError; retorna `{serviceId,status:'DRAFT'}`.
- **Where:** `src/modules/services/actions/edit-service.ts`, `schemas/publish-service.schema.ts` (editServiceSchema — já criado em USP-029 T029-5)
- **Depends on:** T032-1, USP-029 T029-2/T029-5  ·  **Reuses:** `edit-job.ts` (template), `withAudit`
- **Done when:** edita ACTIVE→DRAFT atômico; não-ACTIVE→CONFLICT; ownership negado→FORBIDDEN.
- **Tests:** int `edit-service.int.test.ts`: **AC-032-1/MN-03** ACTIVE→DRAFT (após submit encadeado, IN_MODERATION); não-ACTIVE→CONFLICT; **MN-02** não-dono→FORBIDDEN; concorrência (status mudou no meio)→CONFLICT.
- **Gate:** `npm run test -- edit-service`

### T032-3 — `pauseService` / `resumeService` / `archiveService`
- **What:** `actions/pause-service.ts`, `resume-service.ts`, `archive-service.ts` (design §3) via `transitionContent(SERVICE,...)`.
- **Where:** `src/modules/services/actions/`
- **Depends on:** T032-1, USP-029 T029-2/T029-3  ·  **Reuses:** `pause-job.ts`/`unpause-job.ts`/`archive-job.ts` (templates), `transitionContent`
- **Done when:** pausar→PAUSED, retomar→ACTIVE, arquivar→ARCHIVED; transição inválida→INVALID_TRANSITION; não-dono→FORBIDDEN.
- **Tests:** int `lifecycle-service.int.test.ts`: **AC-032-2** pause; **AC-032-3** archive; **AC-032-4** resume + sem validade automática; **MN-02** ownership; INVALID_TRANSITION em estado errado; auditoria correta (SERVICE_PAUSED/UNPAUSED/ARCHIVED).
- **Gate:** `npm run test -- lifecycle-service`

### T032-4 — Guarda estática de escrita fora-de-banda (SVC032-MN-01)
- **What:** `services/__tests__/no-out-of-band-status-write.test.ts` clonado de jobs (design §4): ALLOWED = adapter + edit-service; escaneia todo `src/modules/services`.
- **Where:** `src/modules/services/__tests__/no-out-of-band-status-write.test.ts`
- **Depends on:** T032-2  ·  **Reuses:** guard de jobs (template)
- **Done when:** falha se qualquer arquivo fora do allowlist mutar `Service.status`; valida `where status:'ACTIVE'` em edit-service.
- **Gate:** `npm run test -- no-out-of-band-status-write`

### T032-5 — UI: painel `/prestador/servicos` + edição + ações
- **What:** rota `src/app/(app)/prestador/servicos/page.tsx` (lista do autor, `listProviderServices`), `[serviceId]/editar/page.tsx`, `components/service-management-list.tsx`, `service-actions.tsx` (client), `service-edit-form.tsx` (client), view `viewProviderServiceRow` (STATUS_LABEL/BADGE + actionsForStatus). Query `queries/list-provider-services.ts`.
- **Where:** `src/app/(app)/prestador/servicos/**`, `src/modules/services/components/`, `queries/list-provider-services.ts`, `views/provider-service-row.view.ts`
- **Depends on:** T032-2, T032-3  ·  **Reuses:** `empresa/[empresaId]/vagas/**` + `company-job-row.view.ts`/`CompanyJobList` (templates), `@/shared/ui`
- **Done when:** painel lista serviços do autor com ações corretas por status; edição encadeia editService→submit; gate ownership em ambas as rotas.
- **Tests:** component `service-management-list.test.tsx` + page tests (`prestador/servicos/page.test.tsx`, `editar/page.test.tsx`): ações por status; gate de acesso; edição de não-ACTIVE mostra card.
- **Gate:** `npm run test -- service-management editar/page` + `npm run build`

### T032-6 — Barrel
- **What:** exportar símbolos da 032 no `services/index.ts`.
- **Gate:** `npm run lint && npm run typecheck`

---

## Test Matrix (USP-032)

| AC / MN | Tipo | Arquivo::caso |
| --- | --- | --- |
| AC-032-1 / MN-03 | int | `edit-service.int.test.ts::forces-remoderation` |
| AC-032-2 | int | `lifecycle-service.int.test.ts::pause` |
| AC-032-3 | int | `lifecycle-service.int.test.ts::archive` |
| AC-032-4 | int | `lifecycle-service.int.test.ts::resume-no-expiry` |
| SVC032-MN-01 | static | `no-out-of-band-status-write.test.ts` |
| SVC032-MN-02 | int+unit | `lifecycle-service.int.test.ts::ownership` + `require-service-owner.test.ts` |

**E2E autenticado** (editar/pausar/arquivar) deferido ao padrão do repo (sem seed de sessão Playwright — AD-019); cobertura autoritativa nos int/component.
