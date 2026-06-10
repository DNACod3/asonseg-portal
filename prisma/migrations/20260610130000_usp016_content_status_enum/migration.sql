-- USP-016 (#121) — máquina de estados de moderação (ADR-0011).
-- A USP-016 é a owner do enum `content_status` (GAP-2): USPs de conteúdo
-- (jobs/services/candidate_profiles) reusam, nunca redeclaram.

-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('DRAFT', 'IN_MODERATION', 'AWAITING_ADJUSTMENTS', 'ACTIVE', 'REJECTED', 'PAUSED', 'EXPIRED', 'ARCHIVED', 'INACTIVATED');
