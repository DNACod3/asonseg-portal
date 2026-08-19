-- USP-030 (AD-011): busca textual sem acento sobre serviços (AC-030-3). As
-- extensões `unaccent`/`pg_trgm` e a função `immutable_unaccent` já existem
-- (criadas em `..._usp021_job_search_fields`). Só o índice funcional é novo.
--
-- QUALIFICAÇÃO OBRIGATÓRIA (AD-029, revisão pós-#295): esta migration não tinha `SET
-- search_path` próprio e resolvia `gin_trgm_ops` (operator class de `pg_trgm`, em
-- `extensions`) apenas por herdar, na mesma sessão/conexão, o `SET` de sessão deixado
-- por `20260708150000_usp028_candidate_search`. Isso amarrava a garantia ao
-- comportamento interno de reuso de conexão do Prisma: reconexão entre arquivos, ou
-- aplicação individual (`psql -f`, runbook de DR), falha com 42704 (operator class
-- "gin_trgm_ops" does not exist). Edição in-place desta migration já aplicada (mesmo
-- raciocínio de 20260620110000/20260620120000/20260708150000: o `CREATE INDEX` avalia a
-- expressão sob `search_path` sanitizado no parse, então nenhuma migration posterior
-- poderia corrigir isso à distância) — qualifica `public.immutable_unaccent` e
-- `extensions.gin_trgm_ops` diretamente, sem depender de `search_path` de nenhuma
-- migration vizinha.
CREATE INDEX "service_search_trgm" ON "services"
  USING gin (
    public.immutable_unaccent(
      lower(coalesce("title", '') || ' ' || coalesce("description", ''))
    ) extensions.gin_trgm_ops
  );
