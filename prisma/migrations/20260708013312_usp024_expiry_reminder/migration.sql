-- USP-024 — idempotência do lembrete D-3 (E-003 / U24-MN-07). Coluna nullable,
-- sem backfill: marcada na 1ª vez que o cron de expiração enfileira o aviso de
-- validade próxima na Outbox; permanece NULL até lá.
--
-- Nota: `prisma migrate dev` também propôs recriar `jobs_area_id_fkey` como
-- `ON DELETE SET NULL` (drift pré-existente entre schema.prisma — relação
-- opcional sem `onDelete` explícito — e a migração original `20260616205612`,
-- que fixou `ON DELETE RESTRICT`). Removido daqui deliberadamente: fora do
-- escopo desta US (migração single-purpose) e mudaria comportamento de
-- integridade referencial sem uma decisão própria.

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "expiry_reminder_sent_at" TIMESTAMPTZ(6);
