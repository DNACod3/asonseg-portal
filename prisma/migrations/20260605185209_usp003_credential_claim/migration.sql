-- CreateEnum
CREATE TYPE "credential_verification_method" AS ENUM ('IN_PERSON', 'AS_CONFIRMATION', 'CODE_BY_MAIL');

-- CreateEnum
CREATE TYPE "credential_claim_status" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "credential_claims" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "requested_email" TEXT NOT NULL,
    "verification_method" "credential_verification_method" NOT NULL,
    "status" "credential_claim_status" NOT NULL DEFAULT 'PENDING',
    "verified_by_person_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "rejected_reason" TEXT,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credential_claims_status_requested_at_idx" ON "credential_claims"("status", "requested_at");

-- CreateIndex
CREATE INDEX "credential_claims_person_id_idx" ON "credential_claims"("person_id");

-- AddForeignKey
ALTER TABLE "credential_claims" ADD CONSTRAINT "credential_claims_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
