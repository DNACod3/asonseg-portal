-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "via_encaminhamento" BOOLEAN NOT NULL DEFAULT false;

-- Unicidade da candidatura ATIVA por (candidato, vaga) — ADR-0021 / P-004.
-- Prisma não expressa índice parcial no schema → SQL bruto. cancelled_at IS NULL = ativa.
-- Permite recandidatura após cancelar (linha cancelada sai do índice). 2º insert concorrente → P2002 → CONFLICT.
CREATE UNIQUE INDEX "uq_application_active"
  ON "applications" ("candidate_person_id", "job_id")
  WHERE "cancelled_at" IS NULL;
