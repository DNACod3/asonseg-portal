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
-- Nota (2026-08-18, AD-029 pós-PR #295): quando este hotfix foi escrito, a política do
-- projeto era não editar migration já aplicada — daí este arquivo, no fim da fila, em
-- vez de tocar as duas migrations originais. Essa política mudou: a PR #295 e sua
-- remediação EDITARAM in-place as migrations originais (`20260620120000`,
-- `20260708150000`, `20260708170500`) para qualificar `public.immutable_unaccent` e
-- `extensions.gin_trgm_ops` por schema — porque uma correção "no fim da fila" não ajuda
-- um `migrate deploy` que aborta ANTES de chegar a ela num banco novo (o motivo real de
-- existir o AD-029). Ver `20260620110000_ensure_unaccent_extension_schema` (linhas 6-13)
-- e a Emenda 2026-08-18 do AD-029 em `.specs/project/STATE.md`.
--
-- Este arquivo permanece intocado (é migration já aplicada) e hoje é **no-op** em banco
-- novo — `20260620110000`/`20260620120000`/`20260708150000` já normalizam tudo antes dele
-- na ordem de timestamp. Ele continua sendo o ÚNICO caminho que corrige o incidente de
-- runtime de 2026-07-21 em qualquer ambiente que já tenha aplicado as migrations
-- originais antes desta correção (produção, notavelmente — ver STATE.md, blocker B-005):
-- `migrate deploy` nunca reexecuta uma migration já registrada em `_prisma_migrations`
-- (só aplica as pendentes), então só este hotfix alcança esses ambientes.
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
