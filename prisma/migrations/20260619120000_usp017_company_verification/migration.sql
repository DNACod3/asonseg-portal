-- USP-017 — verificação de Empresa na 1ª vaga aprovada (efeito colateral atômico
-- de transitionContent, ADR-0024). Os campos abaixo são preenchidos pelo
-- CompanyVerifyHook DENTRO do tx que ativa a vaga (E-002), nunca por rota externa
-- (P-005/AD-3). `isVerified` já existia (default false) e É o estado de "1ª vaga"
-- (AD-2): a detecção não conta jobs.
--
--  - verified_at / verified_by_person_id / verification_job_id: quem/quando/qual vaga (E-002, E-004).
--  - verified_snapshot: dados VIGENTES no instante da verificação (P-004 / L-002, ADR-0008).
--  - rejection_count: agregado de vagas rejeitadas enquanto não verificada (E-003 / F3);
--    o histórico detalhado (quando/quem/motivo) vive no audit_log (ADR-0023).
-- Tudo nullable / default — sem backfill (Empresas legadas ficam não verificadas).

-- AlterTable
ALTER TABLE "companies"
  ADD COLUMN "verified_at" TIMESTAMPTZ(6),
  ADD COLUMN "verified_by_person_id" UUID,
  ADD COLUMN "verification_job_id" UUID,
  ADD COLUMN "verified_snapshot" JSONB,
  ADD COLUMN "rejection_count" INTEGER NOT NULL DEFAULT 0;
