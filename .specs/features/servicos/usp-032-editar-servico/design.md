# USP-032 — Editar serviço (pausar, arquivar) (design)

Espelha `jobs/actions/edit-job.ts` + `pause-job.ts`/`archive-job.ts`/`unpause-job.ts` (USP-023) + `no-out-of-band-status-write.test.ts`. NET-NEW. **Sem migração** (schema da USP-029). Depende do `eventTypeFor` estendido e dos eventos `SERVICE_UNPAUSED`/`SERVICE_EDITED_AFTER_APPROVAL` (adicionados na USP-029 T029-2).

## 1. Ownership gate — `services/server/require-service-owner.ts`

```
requireServiceOwner(personId, serviceId): Promise<{ ok: boolean; companyId: string | null }>
```
Carrega `service {authorPersonId, companyId}`. Owner se `authorPersonId === personId` OU (`companyId != null` E `requireActiveResponsible(personId, companyId)`). Checado **antes** de qualquer escrita (anti-bypass, SVC032-MN-02). `NOT_FOUND` se serviço não existe (sem vazar existência para não-dono, se preferir escopo por dono como em `cancelApplication`).

## 2. `editService` — exceção atômica conteúdo+status (mirror `editJob`)

`actions/edit-service.ts`. **Único lugar (além do adapter) que escreve `Service.status`.**
- Zod `editServiceSchema` (jobId→serviceId; sem `companyId`/campos imutáveis). Sessão. `requireServiceOwner`.
- Se `status !== 'ACTIVE'` → `CONFLICT`.
- `withAudit(SERVICE_EDITED_AFTER_APPROVAL, tx => { updateMany({ where:{ id, status:'ACTIVE' }, data:{ ...fields, status:'DRAFT', lastStatusChangeAt: now } }); if(count!==1) throw EditConflictError; audit.before/after })`. `SERVICE_EDITED_AFTER_APPROVAL` **não** exige justificativa.
- Concorrência otimista: `where {id, status:'ACTIVE'}` é a guarda de transição (bypassa `transitionContent`, que não muta campos). Retorna `{ serviceId, status:'DRAFT' }`.
- **UI encadeia** `submitServiceForModeration({ serviceId })` no sucesso → `IN_MODERATION` (AC-032-1/MN-03).

## 3. `pauseService` / `resumeService` / `archiveService` (mirror lifecycle jobs)

Cada: Zod `serviceIdSchema` → sessão → `requireServiceOwner` → `transitionContent({ contentKind: SERVICE, contentId, to, trigger:'AUTHOR_ACTION', actorPersonId })`:
- `pauseService`: `to = PAUSED` → evento `SERVICE_PAUSED`.
- `resumeService`: `to = ACTIVE` (de `PAUSED`) → evento `SERVICE_UNPAUSED`.
- `archiveService`: `to = ARCHIVED` → evento `SERVICE_ARCHIVED`.
Propaga `ActionResult` da FSM (transição inválida → `INVALID_TRANSITION`). Nunca `throw`.

> **Dependência crítica:** sem a extensão de `eventTypeFor` (USP-029 T029-2) para SERVICE, pause/archive/unpause falham com `INTERNAL`. Garantir T029-2 antes.

## 4. Guarda estática — `no-out-of-band-status-write.test.ts` (SVC032-MN-01)

Clonar `jobs/__tests__/no-out-of-band-status-write.test.ts` para `services/__tests__/`:
- `SRC_ROOT = src/modules/services`, `ALLOWED_FILES = { adapters/prisma-service-status.ts, actions/edit-service.ts }`.
- Detectar `.update(`/`.updateMany(` com `status:` no bloco `data:` + `$executeRaw*` com `UPDATE services` + `status =`, ignorando `.create(`.
- Asserts: (1) nenhum arquivo não-permitido muta status; (2) em `edit-service.ts`, o `updateMany` tem `where` com `status:'ACTIVE'`; (3) ambos os arquivos permitidos existem.

## 5. UI — painel de gestão do prestador + edição

- `src/app/(app)/prestador/servicos/page.tsx` (`force-dynamic`) — lista **os serviços do próprio prestador** (todos os status) via `listProviderServices(personId)` (mirror `listCompanyJobs`, mas escopo por `authorPersonId = person.id`). Renderiza `<ServiceManagementList>` com ações por status.
- `src/app/(app)/prestador/servicos/[serviceId]/editar/page.tsx` (`force-dynamic`) — gate ownership; se `status !== 'ACTIVE'` mostra card informativo; senão `<ServiceEditForm>` (pré-preenchido). No submit chama `editService` → em sucesso, `submitServiceForModeration`.
- `components/service-management-list.tsx` (server) + `components/service-actions.tsx` (client — botões pausar/retomar/arquivar/editar por status; import de actions via `../actions/...` relativo). View helper `viewProviderServiceRow` com `STATUS_LABEL`/`STATUS_BADGE_VARIANT` e `actionsForStatus` (mirror `company-job-row.view.ts`; ACTIVE→{editar,pausar,arquivar}, PAUSED→{retomar,arquivar}, demais→∅).

## 6. Queries + Barrel

- `services/queries/list-provider-services.ts` — `listProviderServices(personId)` (todos os status do autor; paginado com `take`).
- `services/index.ts`: `editService`, `pauseService`, `resumeService`, `archiveService`, `listProviderServices`, `viewProviderServiceRow`, componentes de gestão.

## Knowledge chain

Resolvido do codebase (edit-job, lifecycle jobs, guard estático, company-job-row.view, empresa/vagas routes). Sem incerteza pendente.
