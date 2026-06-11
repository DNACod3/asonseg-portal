-- USP-010 (#112) — ProviderProfile + expansão do enum CompanyType (ADR-0031).
-- CNPJ MEI do prestador PF passa a residir em `companies` via USP-012; o
-- `provider_profiles` NÃO tem campo de CNPJ. O enum `company_type` deixa de
-- ser {CNPJ_REGULAR, MEI} e passa a classificar o regime tributário.

-- AlterEnum: substitui company_type por {MEI, SIMPLES_NACIONAL, LUCRO_PRESUMIDO,
-- LUCRO_REAL, SA}, mapeando os registros existentes CNPJ_REGULAR -> SIMPLES_NACIONAL.
BEGIN;
CREATE TYPE "company_type_new" AS ENUM ('MEI', 'SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'LUCRO_REAL', 'SA');
ALTER TABLE "companies" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "companies" ALTER COLUMN "type" TYPE "company_type_new" USING (
  CASE "type"::text
    WHEN 'CNPJ_REGULAR' THEN 'SIMPLES_NACIONAL'
    ELSE "type"::text
  END
)::"company_type_new";
ALTER TYPE "company_type" RENAME TO "company_type_old";
ALTER TYPE "company_type_new" RENAME TO "company_type";
DROP TYPE "company_type_old";
ALTER TABLE "companies" ALTER COLUMN "type" SET DEFAULT 'SIMPLES_NACIONAL';
COMMIT;

-- CreateTable
CREATE TABLE "provider_profiles" (
    "person_id" UUID NOT NULL,
    "headline" TEXT,
    "description" TEXT,
    "photo_storage_path" TEXT,
    "region_id" UUID,
    "publication_status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("person_id")
);

-- CreateIndex
CREATE INDEX "provider_profiles_publication_status_idx" ON "provider_profiles"("publication_status");

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
