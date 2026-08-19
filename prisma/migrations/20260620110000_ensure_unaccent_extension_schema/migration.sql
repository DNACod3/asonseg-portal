-- Pré-requisito para USP-021/028 (busca textual sem acento): garante que
-- `unaccent` e `pg_trgm` existam NO SCHEMA `extensions` ANTES de 20260620120000 /
-- 20260708150000 declararem `immutable_unaccent` (qualificada como
-- `extensions.unaccent(...)`) e construírem seus índices GIN/trgm.
--
-- POR QUE `extensions` (e não `public`): o Postgres resolve funções usadas em
-- EXPRESSÃO DE ÍNDICE sob um `search_path` sanitizado — a referência ao dicionário
-- `unaccent` dentro de `immutable_unaccent` só resolve se for TOTALMENTE QUALIFICADA
-- (`extensions.unaccent`). Verificado empiricamente: com o corpo NÃO qualificado, o
-- `CREATE INDEX` de 20260620120000 falha com 42883 em banco novo, sob QUALQUER
-- `search_path` de sessão e QUALQUER schema da extensão. Logo, o schema-qualify é
-- obrigatório e a extensão precisa morar exatamente onde a qualificação aponta:
-- `extensions` (mesma convenção do hotfix de runtime 20260722140000).
--
-- Relocate-or-create idempotente (mesma lógica de 20260722140000):
--   • banco novo               → cria em `extensions`;
--   • extensão em outro schema → move para `extensions`;
--   • já em `extensions` (prod)→ no-op.
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent') THEN
    CREATE EXTENSION unaccent WITH SCHEMA extensions;
  ELSIF (SELECT extnamespace FROM pg_extension WHERE extname = 'unaccent') <> 'extensions'::regnamespace THEN
    ALTER EXTENSION unaccent SET SCHEMA extensions;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE EXTENSION pg_trgm WITH SCHEMA extensions;
  ELSIF (SELECT extnamespace FROM pg_extension WHERE extname = 'pg_trgm') <> 'extensions'::regnamespace THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;
