-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "author_person_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "area_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "benefits" TEXT,
    "salary" TEXT,
    "work_regime" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "valid_until" DATE NOT NULL,
    "status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMPTZ(6),
    "last_status_change_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_company_id_idx" ON "jobs"("company_id");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "job_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_author_person_id_fkey" FOREIGN KEY ("author_person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Dedup EXATA (P-003 / ADR-0021): UNIQUE parcial sobre (company_id, area_id, title)
-- só para estados "vivos" (rascunho/moderação/ativo/pausado). Vaga arquivada/rejeitada/
-- expirada/inativada não bloqueia republicação. Prisma não expressa índice parcial no
-- schema → SQL bruto na migration (mesmo padrão de `uq_person_company_active`, USP-013).
-- O 2º insert idêntico concorrente recebe violação determinística (P2002 → CONFLICT/409).
CREATE UNIQUE INDEX "job_dedup_alive"
  ON "jobs" ("company_id", "area_id", "title")
  WHERE "status" IN ('DRAFT', 'IN_MODERATION', 'AWAITING_ADJUSTMENTS', 'ACTIVE', 'PAUSED');
