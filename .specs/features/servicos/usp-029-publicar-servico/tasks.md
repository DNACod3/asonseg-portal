# USP-029 — Publicar serviço (tasks)

Sizing: **Large**. Todas NET-NEW. Ordem: schema/migração → wiring moderação/eventos → domínio/schemas Zod → adapter → actions → fotos → gate → UI → testes. `[P]` = paralelizável.

Convenção de commit: `feat(services): ...` / `feat(moderation): ...` / `feat(audit): ...` / `feat(infra): ...` (escopos válidos). Um commit por task.

---

### T029-1 — Schema `Service` + `ServicePhoto` + migração + dedup index
- **What:** Adicionar models `Service`/`ServicePhoto` a `prisma/schema.prisma` (ver design §1), back-relations (`services`/`authoredServices`) em `ServiceCategory`/`Region`/`Company`/`Person`. Criar migração `20260708170000_usp029_service` com tabelas, FKs (`onDelete` conforme design), índices e o índice único parcial `service_dedup_alive` (SQL bruto).
- **Where:** `prisma/schema.prisma`, `prisma/migrations/20260708170000_usp029_service/migration.sql`
- **Depends on:** —
- **Reuses:** enum `content_status` (existe), `ServiceCategory`/`Region`/`Company`/`Person` (existem)
- **Done when:** `prisma migrate diff`/`db reset` aplica limpo; `service_dedup_alive` presente; `npx prisma validate` ok.
- **Tests:** migração aplica limpa (gate); dedup coberto em T029-6.
- **Gate:** `supabase db reset` OK + `npm run typecheck`

### T029-2 — Wiring da moderação: `eventTypeFor` + eventos de auditoria
- **What:** (a) `src/modules/audit/events.ts`: adicionar `SERVICE_DRAFT_SAVED`, `SERVICE_UNPAUSED`, `SERVICE_EDITED_AFTER_APPROVAL`; incluir `SERVICE_EDITED_AFTER_APPROVAL` no set "não exige justificativa". (b) `src/modules/moderation/actions/transition-content.ts` `eventTypeFor`: estender casos `PAUSED`/`ARCHIVED`/`ACTIVE(unpause)` para `SERVICE` (ver design §2.5).
- **Where:** `src/modules/audit/events.ts`, `src/modules/moderation/actions/transition-content.ts`
- **Depends on:** —  ·  **Reuses:** `AuditEvent`, `eventTypeFor` existentes
- **Done when:** `eventTypeFor(SERVICE, ACTIVE→PAUSED, AUTHOR_ACTION)===SERVICE_PAUSED`; idem ARCHIVED/UNPAUSED; branches JOB intactos.
- **Tests:** unit `event-type-for.test.ts` (estender): SERVICE pause/archive/unpause mapeiam; **neg:** kind SERVICE sem trigger AUTHOR_ACTION → null.
- **Gate:** `npm run test -- event-type-for`

### T029-3 — `PrismaServiceStatusRepository` + registro no container
- **What:** `src/modules/services/adapters/prisma-service-status.ts` implementando `ContentStatusRepository` (template = `PrismaJobStatusRepository`; `UPDATE services`, `published_at=COALESCE` na ativação). Registrar `[ContentKind.SERVICE]` no `DispatchingContentStatusRepository` em `src/shared/container.ts` (deep-import no bloco eslint-disable).
- **Where:** `src/modules/services/adapters/prisma-service-status.ts`, `src/shared/container.ts`
- **Depends on:** T029-1  ·  **Reuses:** `PrismaJobStatusRepository` (template), `ContentStatusRepository` port
- **Done when:** `loadStatus`/`updateStatus` operam sobre `services`; container resolve SERVICE fora do fixture.
- **Tests:** int `prisma-service-status.int.test.ts`: load/update com concorrência otimista (update falha se `from` mudou).
- **Gate:** `npm run test -- prisma-service-status`

### T029-4 — Fila de moderação inclui SERVICE
- **What:** `src/modules/moderation/queries/moderation-queue.ts`: adicionar 3ª fonte `prisma.service.findMany({ status: IN_MODERATION, authorPersonId:{not: viewer} })`, mapear `QueueRow{contentKind:SERVICE}`, merge/sort/slice (ver design §2.6).
- **Where:** `src/modules/moderation/queries/moderation-queue.ts`
- **Depends on:** T029-1  ·  **Reuses:** `viewModerationQueue`, `viewStaffPersonNames`
- **Done when:** serviço `IN_MODERATION` aparece na fila; autor≠moderador (P-005) preservado.
- **Tests:** int `moderation-queue.int.test.ts` (estender): serviço submetido aparece; autor não vê o próprio.
- **Gate:** `npm run test -- moderation-queue`

### T029-5 — Domínio + schemas Zod (`services/domain`, `services/schemas`)
- **What:** `domain/dedup.ts` (`isServiceDedupViolation`); `schemas/publish-service.schema.ts` (`draftServiceSchema` só título; `publishServiceSchema` com título/categoria/descrição/priceMin/priceMax/priceUnit/regionId/availability + superRefine priceMax>=priceMin; `submitServiceSchema` = union {serviceId}|publish; `editServiceSchema` USP-032, sem companyId); `schemas/lifecycle.schema.ts`; `schemas/photo.schema.ts`. Espelha `jobs/schemas/publish-job.schema.ts`.
- **Where:** `src/modules/services/domain/`, `src/modules/services/schemas/`
- **Depends on:** —  ·  **Reuses:** `jobs/schemas` como template
- **Done when:** schemas exportam input/output types; submit exige todos os campos AC-029-3.
- **Tests:** unit `submit-service.schema.test.ts`: submit sem cada campo obrigatório → issue; priceMax<priceMin → issue; draft só com título → ok.
- **Gate:** `npm run test -- submit-service.schema`

### T029-6 — Actions `createServiceDraft` + `submitServiceForModeration` + gate de autorização
- **What:** `server/require-service-authorization.ts` (papel PROVIDER + responsável-ativo quando companyId + `requireActiveConsent(SERVICE_OFFERING)`). `actions/create-service-draft.ts` e `actions/submit-service-for-moderation.ts` (ver design §4). Padrão canônico de Server Action; nunca `throw`.
- **Where:** `src/modules/services/server/`, `src/modules/services/actions/`
- **Depends on:** T029-3, T029-5  ·  **Reuses:** `getCurrentPerson`, `requireActiveConsent`, `withAudit`, `transitionContent`, `requireActiveResponsible` (replicado)
- **Done when:** submit persiste + transiciona a `IN_MODERATION`; gates negam sem papel/empresa/consent.
- **Tests (matriz de Server Action):** int `submit-service.int.test.ts` — happy (PF e Empresa) → status IN_MODERATION; Zod inválido → VALIDATION; **SVC029-MN-01** never-active-on-submit; **SVC029-MN-02** sem role PROVIDER → FORBIDDEN (0 linhas); **SVC029-MN-03** não-responsável → FORBIDDEN; consent ausente → CONSENT_REQUIRED; dedup concorrente → CONFLICT.
- **Gate:** `npm run test -- submit-service`

### T029-7 — Fotos: `uploadServicePhoto` + bucket + STORAGE_BUCKETS
- **What:** `actions/upload-service-photo.ts` (MIME real magic-bytes + ≤5MB + JPG/PNG/WEBP → bucket `provider-photos`, path `{personId}/{uuid}.{ext}`, retorna storagePath). Adicionar `PROVIDER_PHOTOS` a `STORAGE_BUCKETS` (`src/shared/lib/supabase/supabase-storage.ts`). Ajustar `supabase/config.toml` bucket `provider-photos` → `file_size_limit "5MiB"`, `allowed_mime_types += "image/webp"`. Persistência de `ServicePhoto` (máx 3) no create/submit.
- **Where:** `src/modules/services/actions/upload-service-photo.ts`, `src/shared/lib/supabase/supabase-storage.ts`, `supabase/config.toml`
- **Depends on:** T029-1  ·  **Reuses:** `cv-extraction/actions/upload-cv.ts` (template MIME real), `createSupabaseStorageClient`
- **Done when:** upload válido retorna storagePath; ≥4 fotos/MIME falso/>5MB rejeitados.
- **Tests:** int `upload-service-photo.int.test.ts` — **SVC029-MN-04**: PDF-renomeado-.jpg → VALIDATION; 6MB → VALIDATION; 4ª foto → rejeitada; JPG/PNG/WEBP válidos → ok.
- **Gate:** `npm run test -- upload-service-photo`

### T029-8 — UI: `ServiceForm` + rota `/prestador/servicos/nova`
- **What:** `components/service-form.tsx` (client, RHF+zod, PF vs Empresa X, campos AC-029-3, upload até 3 fotos, aviso de exposição de nome PF). Rota `src/app/(app)/prestador/servicos/nova/page.tsx` (`force-dynamic`, gate papel PROVIDER, carrega empresas/categorias/regiões). Query `queries/list-service-categories.ts` + reuso de `listActiveRegions` (replicar ou expor via services). Se sugerir categoria, escape-hatch `no-restricted-imports` (ADR-0017).
- **Where:** `src/modules/services/components/`, `src/modules/services/queries/list-service-categories.ts`, `src/app/(app)/prestador/servicos/nova/page.tsx`
- **Depends on:** T029-6, T029-7  ·  **Reuses:** `@/shared/ui` (DS AD-014), `JobForm` como referência de layout
- **Done when:** fluxo publish end-to-end monta; escolha PF/Empresa lista só empresas representadas.
- **Tests:** component `service-form.test.tsx` (AC-029-1: seletor PF/Empresa; validação client); page `nova/page.test.tsx` (gate sem papel PROVIDER → notFound/redirect).
- **Gate:** `npm run test -- service-form nova/page` + `npm run build` (NODE_ENV=production)

### T029-9 — Barrel + guarda de arquitetura
- **What:** `src/modules/services/index.ts` exportando APIs públicas. Confirmar guardas `no-deep-module-imports`/`closed-src-root` verdes (novo módulo dentro de `modules/`).
- **Where:** `src/modules/services/index.ts`
- **Depends on:** T029-1..8
- **Done when:** imports por `@/modules/services`; lint/typecheck verdes.
- **Gate:** `npm run lint && npm run typecheck`

---

## Test Matrix (USP-029)

| AC / MN | Tipo | Arquivo::caso | Mata a mutação |
| --- | --- | --- | --- |
| AC-029-1 | component | `service-form.test.tsx::seletor-pf-empresa` | seletor some / lista empresa não representada |
| AC-029-2 / MN-01 | int | `submit-service.int.test.ts::persist-in-moderation` | status vai a ACTIVE direto |
| AC-029-3 | unit | `submit-service.schema.test.ts::campos-obrigatorios` | campo obrigatório aceito vazio |
| AC-029-4 / MN-04 | int | `upload-service-photo.int.test.ts::reject-*` | aceita MIME/tamanho/quantidade inválidos |
| MN-02 | int | `submit-service.int.test.ts::no-provider-role` | publica sem papel PROVIDER |
| MN-03 | int | `submit-service.int.test.ts::not-responsible` | publica em nome de empresa alheia |
| infra | int | `moderation-queue.int.test.ts::service-in-queue` | serviço submetido não aparece à moderação |
| infra | unit | `event-type-for.test.ts::service-lifecycle` | SERVICE pause/archive → null → INTERNAL |

**E2E:** fluxo autenticado de publicação fica deferido ao padrão do repo (sem seed de sessão Supabase no Playwright — AD-019); cobertura autoritativa nos int/component. E2E público (busca/detalhe) é USP-030/031.
