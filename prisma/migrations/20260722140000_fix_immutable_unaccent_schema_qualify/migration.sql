-- Hotfix (incidente de produção 2026-07-21, P3018 "text search dictionary unaccent
-- does not exist"): a conexão usada em runtime (via pooler Supavisor) não resolve
-- `unaccent`/o dicionário homônimo por `search_path` de forma confiável.
-- `immutable_unaccent` (criada em 20260620120000_usp021_job_search_fields, reusada em
-- 20260708150000_usp028_candidate_search) precisa referenciar função e dicionário
-- totalmente qualificados por schema — mas a extensão nem sempre está no schema
-- `extensions`: a migration original rodou `CREATE EXTENSION IF NOT EXISTS unaccent`
-- sem `SCHEMA`, então ela foi parar no primeiro schema do `search_path` de quem
-- aplicou a migration (tipicamente `public`, confirmado localmente), não em
-- `extensions` como a convenção Supabase sugere. Este hotfix normaliza a extensão
-- para `extensions` (relocatable) em vez de assumir onde ela já está, e por isso
-- funciona tanto num ambiente já provisionado (relocaliza) quanto num Postgres
-- novo/shadow db (cria direto no schema certo).
--
-- Não editamos as duas migrations originais: elas já foram aplicadas em produção e
-- `prisma migrate deploy` nunca reexecuta uma migration já registrada em
-- `_prisma_migrations` (apenas aplica as pendentes) — editar o arquivo não teria
-- propagado o fix para nenhum ambiente já provisionado.
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

CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$ SELECT extensions.unaccent('extensions.unaccent', $1) $$;
