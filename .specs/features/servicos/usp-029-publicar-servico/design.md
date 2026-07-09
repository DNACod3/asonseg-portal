# USP-029 — Publicar serviço (design)

Espelha `src/modules/jobs` (USP-020/023). Todo caminho mirror é **NET-NEW** salvo indicação.

## 1. Schema Prisma — `Service` + `ServicePhoto` (status-on-entity, AD-009)

Adicionar a `prisma/schema.prisma`. Espelha `Job`; **sem `validUntil`** (serviço não expira — USP-024 fora de escopo) e **sem gate de `company.isVerified`**.

```prisma
model Service {
  id                      String        @id @default(uuid()) @db.Uuid
  authorPersonId          String        @map("author_person_id") @db.Uuid   // quem publica/executa (provider)
  companyId               String?       @map("company_id") @db.Uuid          // null = PF; setado = em nome da Empresa X
  categoryId              String?       @map("category_id") @db.Uuid          // FK ServiceCategory (nullable p/ rascunho; exigido no submit via Zod)
  title                   String                                             // único NOT NULL de conteúdo
  description             String?       @db.Text
  priceMin                Decimal?      @map("price_min") @db.Decimal(10, 2)
  priceMax                Decimal?      @map("price_max") @db.Decimal(10, 2)
  priceUnit               String?       @map("price_unit")                   // "por hora/diária/serviço" (freetext MVP; enum quando D-007 fechar)
  regionId                String?       @map("region_id") @db.Uuid           // FK Region (single-region MVP)
  availabilityDescription String?       @map("availability_description")     // dias/horários (freetext)
  status                  ContentStatus @default(DRAFT)
  publishedAt             DateTime?     @map("published_at") @db.Timestamptz(6) // 1ª ativação (ordena a busca AC-030-1)
  lastStatusChangeAt      DateTime      @default(now()) @map("last_status_change_at") @db.Timestamptz(6)
  createdAt               DateTime      @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt               DateTime      @updatedAt @map("updated_at") @db.Timestamptz(6)

  author   Person           @relation(fields: [authorPersonId], references: [id], onDelete: Restrict)
  company  Company?         @relation(fields: [companyId], references: [id], onDelete: Restrict)
  category ServiceCategory? @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  region   Region?          @relation(fields: [regionId], references: [id], onDelete: SetNull)
  photos   ServicePhoto[]

  @@index([status])
  @@index([authorPersonId])
  @@index([categoryId, regionId, status])   // filtros combinados (USP-030)
  @@map("services")
}

model ServicePhoto {
  id          String   @id @default(uuid()) @db.Uuid
  serviceId   String   @map("service_id") @db.Uuid
  storagePath String   @map("storage_path")
  position    Int      @default(0)                  // ordem 0..2
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@index([serviceId])
  @@map("service_photos")
}
```

**Back-relations a adicionar** (Prisma exige o lado inverso): `services Service[]` em `ServiceCategory`, `Region`, `Company` e `Person` (nomear `authoredServices Service[]` em `Person` p/ não colidir).

### Decisões de modelagem (ADR-worthy)

- **`authorPersonId` (não `personId` do TD §2.6)** — nomeado como em `Job.authorPersonId` para casar com a fila de moderação (`viewModerationQueue` filtra `authorPersonId: { not: viewerPersonId }` — P-005 autor≠moderador). Divergência declarada de TD §2.6 (que chama `personId`).
- **`priceMin`/`priceMax` + `priceUnit`** — "valor" do PRD como **faixa** (habilita o filtro "faixa de preço" da USP-030, mesmo overlap de `salaryMin/Max`) + unidade freetext (enum quando o catálogo D-007 fechar; mesmo padrão de `Job.contractType`). Divergência do TD §2.6 (só `priceMin/priceMax`, sem unidade) resolvida a favor do PRD AC-029-3.
- **`regionId` single-region** — o PRD diz "região(ões)" (plural), mas TD §2.6, `ProviderProfile` e `Job` usam FK única. **Assumption documentada:** MVP = região única (mesmo padrão de todo o repo); multi-região é follow-up. O filtro "região" da USP-030 é single-select (como vagas).
- **Sem `validUntil`/`EXPIRED`** — serviço fica ativo até pausar/arquivar (épico Out-of-Scope). `TRANSITIONS[SERVICE]` (=`SHARED_TRANSITIONS`) já não inclui `EXPIRED`.
- **Dedup por autor** — `authorPersonId` é sempre presente (PF ou empresa); dedup em `(author_person_id, category_id, title)` (não `company_id` como vagas, que é NOT NULL lá) impede 2 serviços idênticos vivos do mesmo publicador.

### Migração `20260708170000_usp029_service`

Criar tabelas `services` e `service_photos`, FKs, índices, e o **índice único parcial** (SQL bruto — Prisma não expressa `WHERE`; espelha `job_dedup_alive`):

```sql
CREATE UNIQUE INDEX "service_dedup_alive"
  ON "services" ("author_person_id", "category_id", "title")
  WHERE "status" IN ('DRAFT', 'IN_MODERATION', 'AWAITING_ADJUSTMENTS', 'ACTIVE', 'PAUSED');
```

(O índice trgm de busca textual é da USP-030, não desta migração.)

## 2. Wiring da moderação (compartilhado — 029 é dono da fundação)

1. **`ContentKind.SERVICE`** — já existe (`src/modules/moderation/domain/content-status.ts`). Nada a fazer.
2. **`TRANSITIONS[SERVICE]`** — já = `SHARED_TRANSITIONS`. Nada a fazer.
3. **`PrismaServiceStatusRepository`** (NET-NEW) — `src/modules/services/adapters/prisma-service-status.ts`, template = `PrismaJobStatusRepository` (SQL bruto com `published_at = COALESCE(published_at, now())` na ativação, pois serviços ordenam por `published_at` — AC-030-1). Trocar `UPDATE jobs`→`UPDATE services`.
4. **Container** — `src/shared/container.ts`: adicionar deep-import (dentro do bloco `eslint-disable no-restricted-imports`) `import { PrismaServiceStatusRepository } from '@/modules/services/adapters/prisma-service-status';` e a linha `[ContentKind.SERVICE]: new PrismaServiceStatusRepository(),` no `byKind`.
5. **`eventTypeFor`** (`src/modules/moderation/actions/transition-content.ts`) — **CRÍTICO**: hoje `PAUSED`/`ARCHIVED`/unpause retornam `null` para não-JOB → `transitionContent` falharia com `INTERNAL`. Estender (espelhando JOB):
   - `case PAUSED`: `contentKind === SERVICE && trigger === 'AUTHOR_ACTION' ? SERVICE_PAUSED : ...`
   - `case ARCHIVED`: idem → `SERVICE_ARCHIVED`
   - `case ACTIVE` (unpause `PAUSED→ACTIVE` AUTHOR_ACTION): `contentKind === SERVICE && from === PAUSED ? SERVICE_UNPAUSED : ...`
   As decisões de moderador (`CONTENT_APPROVED`/`REJECTED`/`RETURNED_FOR_ADJUSTMENTS`/`SUBMITTED_TO_MODERATION`/`INACTIVATED`) já funcionam para SERVICE (branches genéricos). *(Nota: pause/unpause/archive são exercitados pela USP-032, mas a extensão de `eventTypeFor` é da 029 por ser fundação; sem ela até o submit→ACTIVE por moderador funciona, mas o ciclo de vida quebra.)*
6. **Fila de moderação** (`src/modules/moderation/queries/moderation-queue.ts`) — adicionar 3ª fonte ao `Promise.all`: `prisma.service.findMany({ where: { status: IN_MODERATION, authorPersonId: { not: viewerPersonId } }, select: { id, title, authorPersonId, lastStatusChangeAt }, orderBy: { lastStatusChangeAt: 'asc' }, take: QUEUE_PAGE_SIZE })`, mapear para `QueueRow` com `contentKind: SERVICE` (sem `companyUnverified`/`companyId` — serviços não verificam Empresa), incluir no merge/sort/slice. Sem essa união o moderador não vê serviços submetidos.
7. **Aprovação/rejeição** — reusar `approveContent`/`rejectContent`/`returnForAdjustments` de `@/modules/moderation` (genéricos por `ContentKind`). Verificar que aceitam `ContentKind.SERVICE` (devem, por design). Sem action nova de aprovação.
8. **Cache/ISR** — `transitionContent` dispara `CacheInvalidation`; garantir que transições SERVICE revalidam `/servicos` e `/servicos/[id]` (espelhar JOB→`/vagas`). Resolver o alvo por `ContentKind.SERVICE` no adapter `NextCacheInvalidation` (ou seu mapa de targets). *(A rota `/servicos` só existe a partir da USP-030; o alvo pode ser adicionado aqui e a rota pousa na 030.)*

## 3. Eventos de auditoria (`src/modules/audit/events.ts`)

Já existem: `SERVICE_PUBLISHED`, `SERVICE_PAUSED`, `SERVICE_ARCHIVED`, `PROVIDER_ROLE_ACTIVATED`, `CONTENT_*`.
**Adicionar (NET-NEW):** `SERVICE_DRAFT_SAVED` (create/save de rascunho), `SERVICE_UNPAUSED` (USP-032), `SERVICE_EDITED_AFTER_APPROVAL` (USP-032). Adicionar `SERVICE_EDITED_AFTER_APPROVAL` ao conjunto **NÃO exige justificativa** (espelha `JOB_EDITED_AFTER_APPROVAL`, events.ts ~L127).

## 4. Módulo `src/modules/services/` (NET-NEW) — estrutura mirror

```
src/modules/services/
├── domain/dedup.ts            # isServiceDedupViolation(err) — P2002 (espelha jobs/domain/dedup.ts)
├── schemas/publish-service.schema.ts   # draftServiceSchema, publishServiceSchema, submitServiceSchema, editServiceSchema (+consts de tamanho)
├── schemas/lifecycle.schema.ts         # serviceIdSchema, pauseServiceSchema, archiveServiceSchema, resumeServiceSchema (USP-032)
├── schemas/photo.schema.ts             # uploadServicePhoto input (mime/size)
├── actions/create-service-draft.ts     # createServiceDraft → SERVICE_DRAFT_SAVED, status DRAFT
├── actions/submit-service-for-moderation.ts  # submitServiceForModeration → transitionContent(SERVICE, IN_MODERATION)
├── actions/upload-service-photo.ts     # uploadServicePhoto (MIME real + ≤5MB + JPG/PNG/WEBP → provider-photos bucket)
├── actions/edit-service.ts             # editService (USP-032 — exceção atômica conteúdo+status)
├── actions/pause-service.ts | resume-service.ts | archive-service.ts   # USP-032
├── adapters/prisma-service-status.ts   # PrismaServiceStatusRepository
├── server/require-service-authorization.ts  # gate provider-role + responsável-ativo
├── queries/... (USP-030/031/032)
├── views/... (USP-031)
├── components/service-form.tsx (client) + service-list.tsx / service-card.tsx (USP-030) + ...
├── __tests__/
└── index.ts                            # barrel
```

### Precondição de publicação (`server/require-service-authorization.ts`, NET-NEW)

Regra (mirror `requireActiveResponsible`, mas para prestador):
- **Papel:** `getCurrentPerson()` retorna `roles: string[]` (de `person.roleGrants.map(g=>g.role)`, ativos). Exigir `person.roles.includes('PROVIDER')` (enum `Role.PROVIDER`). Se ausente → `FORBIDDEN` (SVC029-MN-02).
- **Empresa (quando `companyId` setado):** exigir `requireActiveResponsible(person.id, companyId)` (reusar de `@/modules/jobs` via barrel, OU replicar o `personCompanyGrant.findFirst` localmente — **recomendado replicar** p/ não acoplar `services`→`jobs`; a query é ~10 linhas). Se falso → `FORBIDDEN` (SVC029-MN-03).
- **Consentimento:** `requireActiveConsent(person.id, 'SERVICE_OFFERING')` (defense-in-depth; o papel PROVIDER ativo já implica o consentimento — revogá-lo derruba o papel, ADR-0008). Ausente → `CONSENT_REQUIRED`.

### `submitServiceForModeration` (mirror `submitJobForModeration`)

Input: `z.union([{ serviceId }, publishServiceSchema])`. Sequência:
1. Zod `safeParse` → `VALIDATION`.
2. `getCurrentPerson()` → `UNAUTHENTICATED`.
3. **Gate de autorização ANTES de qualquer escrita** (anti-bypass): `require-service-authorization` (papel + empresa + consent).
4. Se `{serviceId}`: carregar rascunho (`findUnique select {id, authorPersonId, companyId}`), `NOT_FOUND` se ausente, re-checar ownership; senão criar via `withAudit(SERVICE_DRAFT_SAVED, tx.service.create({...status:'DRAFT'}))` (dedup catch → `CONFLICT`).
5. `transitionContent({ contentKind: SERVICE, contentId: serviceId, to: IN_MODERATION, trigger: 'AUTHOR_ACTION', actorPersonId })`; propagar erro se `!ok`. → status persistido `IN_MODERATION` (AC-029-2 / SVC029-MN-01).

### `createServiceDraft` (mirror `createJobDraft`)

Zod `draftServiceSchema` (só `title` obrigatório) → sessão → gate autorização → `withAudit(SERVICE_DRAFT_SAVED, tx.service.create({...status:'DRAFT'}))` → dedup catch → `CONFLICT`. Nunca `throw`.

### Fotos — `uploadServicePhoto` (mirror `cv-extraction/actions/upload-cv.ts`)

- Bucket `provider-photos` (**já declarado** em `supabase/config.toml:129`, `public=true`). **Ajustar config:** `file_size_limit "2MiB"→"5MiB"` e `allowed_mime_types` += `"image/webp"` (hoje só jpeg/png).
- Adicionar `PROVIDER_PHOTOS: 'provider-photos'` a `STORAGE_BUCKETS` em `src/shared/lib/supabase/supabase-storage.ts`.
- Validação **MIME real** (magic bytes via `file-type`, padrão cv-extraction) + ≤5MB + JPG/PNG/WEBP; caminho `{personId}/{uuid}.{ext}`. Retorna `{ storagePath }`.
- **Máx. 3 fotos** por serviço: enforçado no persist (contagem de `ServicePhoto` do serviço) e no client (SVC029-MN-04).
- O `ServiceForm` sobe cada foto via esta action e passa os `storagePath` ao submit; `submit`/`create` persiste linhas `ServicePhoto` (position 0..2). Serviço publica sem fotos se nenhuma (opcional).

## 5. UI

- Rota publish: `src/app/(app)/prestador/servicos/nova/page.tsx` (`dynamic='force-dynamic'`). Gate `requireActivePerson()` + papel PROVIDER. Carrega: empresas em que é responsável ativo (para AC-029-1), `listServiceCategories()`, `listActiveRegions()`. Renderiza `<ServiceForm>`.
- `ServiceForm` (client, RHF + zod resolver com `publishServiceSchema`): seletor PF vs Empresa X; campos AC-029-3; upload de até 3 fotos; **aviso de exposição pública do nome** para PF. Import de Server Actions via `../actions/...` (relativo — padrão client/action). Se usar `suggestTaxonomy` (sugerir categoria), replicar o escape-hatch `// eslint-disable-next-line no-restricted-imports import ... '@/modules/moderation/actions/suggest-taxonomy'` (ADR-0017, como `job-form.tsx`).
- Painel de gestão (`/prestador/servicos`) e edição são da **USP-032**.

## 6. Barrel `src/modules/services/index.ts`

Exportar tudo por barrel (`@/modules/services`). Nada importa caminho profundo (exceto o container e os Client Components que importam actions relativas — padrão do repo).

## Knowledge chain

Codebase (jobs/moderation/prisma/container) = fonte primária, resolvida. Sem incerteza pendente para o Implementer além de: (a) confirmar que `person.roles` só contém grants ACTIVE (session.ts:74 — provável); (b) confirmar `approveContent` genérico por kind aceita SERVICE.
