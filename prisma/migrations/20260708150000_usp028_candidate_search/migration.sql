-- USP-028 (AD-018): localização estruturada do candidato (`candidate_profiles.region_id`,
-- espelha `provider_profiles.region_id`) + índice de busca textual sem acento para a
-- busca ativa de candidatos pela Empresa. Coluna nullable + índice não bloqueiam
-- candidatos existentes (mesmo padrão da USP-021).

-- AlterTable
ALTER TABLE "candidate_profiles" ADD COLUMN "region_id" UUID;

-- CreateIndex: filtro por localização (USP028-02)
CREATE INDEX "candidate_profiles_region_id_idx" ON "candidate_profiles"("region_id");

-- AddForeignKey (opcional; ON DELETE SET NULL = remover região não apaga o perfil)
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_region_id_fkey"
  FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Busca textual sem acento (USP028-02) — reusa `immutable_unaccent` da USP-021 ──
-- Idempotente (CREATE OR REPLACE / IF NOT EXISTS): seguro mesmo se a extensão/função
-- já existirem no ambiente (mesma função, um único dicionário fixado).
--
-- Dicionário TOTALMENTE QUALIFICADO + `search_path` com `extensions`, pelas mesmas
-- razões de 20260620120000: em banco novo o `CREATE INDEX` avalia a função sob
-- `search_path` sanitizado (exige `extensions.unaccent`), e `gin_trgm_ops` do pg_trgm
-- (em `extensions`) precisa estar no path. Extensões criadas por 20260620110000.
SET search_path TO public, extensions;

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$ SELECT extensions.unaccent('extensions.unaccent', $1) $$;

-- Índice funcional GIN/trgm sobre headline + skills + courses + experience (não sensíveis)
CREATE INDEX "candidate_search_trgm" ON "candidate_profiles"
  USING gin (
    immutable_unaccent(
      lower(
        coalesce("headline", '') || ' ' ||
        coalesce("skills_text", '') || ' ' ||
        coalesce("courses_text", '') || ' ' ||
        coalesce("experience_text", '')
      )
    ) gin_trgm_ops
  );
