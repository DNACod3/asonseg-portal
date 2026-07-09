-- USP-030 (AD-011): busca textual sem acento sobre serviços (AC-030-3). As
-- extensões `unaccent`/`pg_trgm` e a função `immutable_unaccent` já existem
-- (criadas em `..._usp021_job_search_fields`). Só o índice funcional é novo.

CREATE INDEX "service_search_trgm" ON "services"
  USING gin (
    immutable_unaccent(
      lower(coalesce("title", '') || ' ' || coalesce("description", ''))
    ) gin_trgm_ops
  );
