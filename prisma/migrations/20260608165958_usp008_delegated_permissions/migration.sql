-- CreateEnum
CREATE TYPE "permission_id" AS ENUM ('MODERATE_JOB', 'MODERATE_CV', 'MODERATE_SERVICE', 'VALIDATE_COMPANY_FIRST_JOB', 'INACTIVATE_PUBLISHED_CONTENT', 'REFER_PERSON_TO_JOB', 'APPROVE_CATEGORY_SUGGESTION', 'REGISTER_REFERRAL_RESULT', 'APPROVE_CREDENTIAL_CLAIM');

-- CreateTable
CREATE TABLE "delegated_permissions" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "permission" "permission_id" NOT NULL,
    "scope_area" TEXT,
    "granted_by" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" UUID,

    CONSTRAINT "delegated_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delegated_permissions_person_id_revoked_at_idx" ON "delegated_permissions"("person_id", "revoked_at");

-- CreateIndex
CREATE INDEX "delegated_permissions_person_id_permission_revoked_at_idx" ON "delegated_permissions"("person_id", "permission", "revoked_at");

-- AddForeignKey
ALTER TABLE "delegated_permissions" ADD CONSTRAINT "delegated_permissions_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
