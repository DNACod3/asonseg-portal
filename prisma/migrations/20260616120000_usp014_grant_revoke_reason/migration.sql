-- USP-014 — motivo de negócio (opcional) da remoção de um responsável (D-014-B).
-- Completa o trio quando/quem/porquê na própria linha do vínculo
-- (revoked_at / revoked_by / revoke_reason), mantendo relatórios desacoplados
-- do audit_log. Nullable e sem backfill: grants revogados antes da USP-014
-- ficam com revoke_reason = NULL (append-only preservado).

-- AlterTable
ALTER TABLE "person_company_grants" ADD COLUMN     "revoke_reason" TEXT;
