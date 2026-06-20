-- USP-022 (AD-012): tabela `applications` na forma MÍNIMA capaz apenas de CONTAR
-- candidaturas ativas (contador E-003 do detalhe da vaga). O caminho de escrita
-- (candidatar/cancelar) + unicidade + encaminhamento são da USP-025/044 (AD-012).
-- `cancelled_at = NULL` ⇒ candidatura ativa (soft-cancel).

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "candidato_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: contagem on-read do contador de candidaturas ativas (E-003)
CREATE INDEX "applications_job_id_cancelled_at_idx" ON "applications"("job_id", "cancelled_at");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_candidato_id_fkey"
    FOREIGN KEY ("candidato_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
