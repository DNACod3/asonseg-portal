-- CreateEnum
CREATE TYPE "company_grant_status" AS ENUM ('PENDING', 'ACTIVE');

-- AlterTable
ALTER TABLE "person_company_grants" ADD COLUMN     "accepted_at" TIMESTAMPTZ(6),
ADD COLUMN     "pending_at" TIMESTAMPTZ(6),
ADD COLUMN     "status" "company_grant_status" NOT NULL DEFAULT 'ACTIVE';

-- UNIQUE parcial: no máximo 1 vínculo não-removido (PENDING ou ACTIVE) por par
-- (person_id, company_id). Garante a unicidade sob concorrência da USP-013/P-004
-- (ADR-0021) — o 2º insert concorrente recebe violação determinística (P2002 → 409).
-- Vínculos removidos (revoked_at != null) ficam fora do índice (append-only preservado).
CREATE UNIQUE INDEX "uq_person_company_active"
  ON "person_company_grants" ("person_id", "company_id")
  WHERE "revoked_at" IS NULL;
