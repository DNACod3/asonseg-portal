-- CreateTable
CREATE TABLE "service_interests" (
    "id" UUID NOT NULL,
    "client_person_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),
    "interested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT,

    CONSTRAINT "service_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_interests_service_id_cancelled_at_idx" ON "service_interests"("service_id", "cancelled_at");

-- AddForeignKey
ALTER TABLE "service_interests" ADD CONSTRAINT "service_interests_client_person_id_fkey" FOREIGN KEY ("client_person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_interests" ADD CONSTRAINT "service_interests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unicidade da manifestação ATIVA por (cliente, serviço) — USP-033 / AD-020.
-- Prisma não expressa índice parcial no schema → SQL bruto. cancelled_at IS NULL = ativa.
-- Permite re-manifestar após cancelar (linha cancelada sai do índice). 2º insert concorrente → P2002 → CONFLICT.
CREATE UNIQUE INDEX "uq_service_interest_active"
  ON "service_interests" ("client_person_id", "service_id")
  WHERE "cancelled_at" IS NULL;
