-- USP-029 (AD-009): fundação do domínio de serviços — status-on-entity, espelha `jobs`
-- (USP-020), mas SEM `valid_until`/EXPIRED (serviço não expira) e SEM gate de
-- `company.isVerified` (verificação de Empresa é exclusiva de vagas).

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "author_person_id" UUID NOT NULL,
    "company_id" UUID,
    "category_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price_min" DECIMAL(10,2),
    "price_max" DECIMAL(10,2),
    "price_unit" TEXT,
    "region_id" UUID,
    "availability_description" TEXT,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "last_status_change_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_photos" (
    "id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "storage_path" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "services_status_idx" ON "services"("status");

-- CreateIndex
CREATE INDEX "services_author_person_id_idx" ON "services"("author_person_id");

-- CreateIndex
CREATE INDEX "services_category_id_region_id_status_idx" ON "services"("category_id", "region_id", "status");

-- CreateIndex
CREATE INDEX "service_photos_service_id_idx" ON "service_photos"("service_id");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_author_person_id_fkey" FOREIGN KEY ("author_person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_photos" ADD CONSTRAINT "service_photos_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dedup EXATA por autor (P-003-like, espelha ADR-0021): UNIQUE parcial sobre
-- (author_person_id, category_id, title) só para estados "vivos" (rascunho/
-- moderação/ativo/pausado). Diferente de `job_dedup_alive` (que usa company_id,
-- NOT NULL em Job): em Service o author_person_id é sempre presente (PF ou
-- Empresa), então a dedup é por publicador, não por empresa.
CREATE UNIQUE INDEX "service_dedup_alive"
  ON "services" ("author_person_id", "category_id", "title")
  WHERE "status" IN ('DRAFT', 'IN_MODERATION', 'AWAITING_ADJUSTMENTS', 'ACTIVE', 'PAUSED');
