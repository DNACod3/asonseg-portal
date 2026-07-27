-- Pré-requisito para USP-021/028 (busca textual sem acento): garante que as
-- extensões `unaccent`/`pg_trgm` já existam no schema `extensions` (convenção
-- Supabase) e que o search_path desta sessão de migração as enxergue, ANTES da
-- migration seguinte (20260620120000) declarar `immutable_unaccent` com uma
-- chamada não qualificada a `unaccent(...)` — avaliada de imediato pelo
-- `CREATE INDEX ... USING gin(immutable_unaccent(...))`.
--
-- Sem isso, um banco novo (staging recém-criado, disaster recovery a partir
-- das migrations) falha ao aplicar 20260620120000 com "function unaccent
-- (unknown, text) does not exist" (42883) — a extensão termina em qualquer
-- schema que seja "current" no momento em que aquela migration roda
-- (`CREATE EXTENSION IF NOT EXISTS unaccent` sem SCHEMA), e o search_path
-- default de um Postgres novo pode não incluir esse schema. Mesma classe de
-- problema do hotfix de runtime em 20260722140000 (ali resolvido só para
-- bancos já provisionados, via `ALTER EXTENSION ... SET SCHEMA` depois do
-- fato) — aqui resolvido ANTES, em tempo de migration, para bancos novos.
--
-- Idempotente: em bancos onde as extensões já existem (local, staging já
-- provisionado, produção) os `IF NOT EXISTS` viram no-op.
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent') THEN
    CREATE EXTENSION unaccent WITH SCHEMA extensions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    CREATE EXTENSION pg_trgm WITH SCHEMA extensions;
  END IF;
END $$;

-- Cobre as duas hipóteses de como `prisma migrate deploy` executa as
-- migrations pendentes (mesma sessão para todas, ou reconexão por arquivo):
-- `SET` ajusta a sessão atual (resolve as migrations seguintes se a conexão
-- for reaproveitada); `ALTER DATABASE`/`ALTER ROLE` persistem para qualquer
-- nova conexão (resolve se houver reconexão entre migrations). Redundante de
-- propósito — o custo de rodar os três é zero, e não dependemos de nenhuma
-- suposição sobre o comportamento interno do Prisma.
SET search_path TO "$user", public, extensions;

DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET search_path TO %s',
    current_database(),
    '"$user", public, extensions'
  );
EXCEPTION WHEN insufficient_privilege THEN
  -- Role de migração sem privilégio de ALTER DATABASE (ex.: alguns setups
  -- gerenciados) — o SET de sessão acima já cobre esta mesma execução do
  -- `migrate deploy`; degrada sem falhar a migration.
  NULL;
END $$;

DO $$
BEGIN
  EXECUTE format('ALTER ROLE %I SET search_path TO %s', current_user, '"$user", public, extensions');
EXCEPTION WHEN insufficient_privilege THEN
  NULL;
END $$;
