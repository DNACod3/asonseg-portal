-- USP-037/038 (SOC-03..05): agregado `Referral` (encaminhamento institucional a vaga).
-- Cria o enum `referral_result` e a tabela `referrals`, com as colunas de
-- RESULTADO (result/result_observation/result_registered_by/result_registered_at)
-- já nascendo NULLABLE nesta migração — USP-038 só as escreve, sem re-migrar
-- (agregado planejado coeso). Adiciona `applications.via_referral_id` (FK 1:1
-- ao Referral que originou a candidatura), mantendo `via_encaminhamento`
-- (boolean já existente, lido pelo badge da USP-027) sem re-migração.
-- Nenhum índice de `applications`/`uq_application_active` é tocado.

-- CreateEnum
CREATE TYPE "referral_result" AS ENUM ('HIRED', 'NOT_SELECTED', 'UNDER_REVIEW', 'NO_RESPONSE');

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "referrer_person_id" UUID NOT NULL,
    "justification" TEXT,
    "professional_summary" TEXT,
    "result" "referral_result",
    "result_observation" TEXT,
    "result_registered_by" UUID,
    "result_registered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referrals_person_id_idx" ON "referrals"("person_id");

-- CreateIndex
CREATE INDEX "referrals_job_id_idx" ON "referrals"("job_id");

-- CreateIndex
CREATE INDEX "referrals_referrer_person_id_idx" ON "referrals"("referrer_person_id");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_person_id_fkey" FOREIGN KEY ("referrer_person_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: FK 1:1 autoritativa Application -> Referral (invariante: via_referral_id != null <=> via_encaminhamento = true).
ALTER TABLE "applications" ADD COLUMN "via_referral_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "applications_via_referral_id_key" ON "applications"("via_referral_id");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_via_referral_id_fkey" FOREIGN KEY ("via_referral_id") REFERENCES "referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
