-- USP-021 (AD-011): estende `jobs` ao contrato canônico do TD §4.5 p/ os 6 filtros da
-- busca pública (E-002) + habilita busca textual sem acento (E-003) e índices on-read (L-001).
-- Colunas novas opcionais/com default → não quebram vagas existentes (mesmo padrão da USP-020).

-- AlterTable: campos canônicos do TD §4.5
ALTER TABLE "jobs"
  ADD COLUMN "education_level_required" TEXT,
  ADD COLUMN "contract_type" TEXT,
  ADD COLUMN "salary_min" DECIMAL(10,2),
  ADD COLUMN "salary_max" DECIMAL(10,2),
  ADD COLUMN "salary_visible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "region_id" UUID;

-- CreateIndex: on-read (status + validade) e filtros combinados (área/região/status) — L-001/RP-009
CREATE INDEX "jobs_status_valid_until_idx" ON "jobs"("status", "valid_until");
CREATE INDEX "jobs_area_id_region_id_status_idx" ON "jobs"("area_id", "region_id", "status");

-- AddForeignKey: Region (opcional; ON DELETE SET NULL = remover região não apaga vagas)
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_region_id_fkey"
  FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Busca textual sem acento, case-insensitive (E-003) ───────────────────────────
-- `unaccent(text)` (1 arg) NÃO é IMMUTABLE (faz lookup do dicionário no catálogo) → não
-- pode entrar em índice funcional. O wrapper abaixo fixa o dicionário e é marcado
-- IMMUTABLE — gotcha canônico do Postgres. A query de busca (USP-021/T2) usa a MESMA
-- função em ambos os lados (coluna e termo), respeitando o índice GIN/trgm.
--
-- IMPORTANTE (correção do provisionamento de banco novo — ver 20260620110000): a
-- referência ao dicionário DENTRO de `immutable_unaccent` é TOTALMENTE QUALIFICADA
-- (`extensions.unaccent('extensions.unaccent', ...)`), porque o Postgres avalia funções
-- de expressão de índice sob um `search_path` sanitizado — a forma não qualificada falha
-- com 42883 no `CREATE INDEX`. E o `search_path` desta migration inclui `extensions`
-- para que o operator class `gin_trgm_ops` (do pg_trgm, em `extensions`) resolva no
-- `CREATE INDEX`. As extensões já foram criadas em `extensions` por 20260620110000.
SET search_path TO public, extensions;

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$ SELECT extensions.unaccent('extensions.unaccent', $1) $$;

-- Índice funcional GIN/trgm sobre título + descrição + requisitos (normalizados sem acento)
CREATE INDEX "job_search_trgm" ON "jobs"
  USING gin (
    immutable_unaccent(
      lower(coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("requirements", ''))
    ) gin_trgm_ops
  );
