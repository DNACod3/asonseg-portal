-- CreateEnum
CREATE TYPE "company_type" AS ENUM ('CNPJ_REGULAR', 'MEI');

-- CreateEnum
CREATE TYPE "company_grant_type" AS ENUM ('RESPONSIBLE');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "cnpj" TEXT NOT NULL,
    "type" "company_type" NOT NULL DEFAULT 'CNPJ_REGULAR',
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "descricao" TEXT,
    "endereco" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_company_grants" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "grant_type" "company_grant_type" NOT NULL DEFAULT 'RESPONSIBLE',
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" UUID,

    CONSTRAINT "person_company_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_cnpj_key" ON "companies"("cnpj");

-- CreateIndex
CREATE INDEX "companies_cnpj_idx" ON "companies"("cnpj");

-- CreateIndex
CREATE INDEX "person_company_grants_person_id_revoked_at_idx" ON "person_company_grants"("person_id", "revoked_at");

-- CreateIndex
CREATE INDEX "person_company_grants_company_id_grant_type_revoked_at_idx" ON "person_company_grants"("company_id", "grant_type", "revoked_at");

-- AddForeignKey
ALTER TABLE "person_company_grants" ADD CONSTRAINT "person_company_grants_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_company_grants" ADD CONSTRAINT "person_company_grants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

