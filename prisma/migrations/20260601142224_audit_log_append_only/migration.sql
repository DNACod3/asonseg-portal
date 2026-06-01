-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_person_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "context" JSONB,
    "ip" INET,
    "user_agent" TEXT,
    "justification" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_person_id_occurred_at_idx" ON "audit_log"("actor_person_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_action_occurred_at_idx" ON "audit_log"("action", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_retention_idx" ON "audit_log"("occurred_at");

-- ─────────────────────────────────────────────────────────────────────────────
-- Append-only (ADR-T-0004). Duas camadas:
--   1. REVOKE UPDATE, DELETE das roles da aplicação (enforcement por GRANT).
--   2. Trigger BEFORE UPDATE/DELETE que bloqueia mesmo o owner da tabela —
--      necessário porque a app conecta como owner no ambiente local e o GRANT
--      sozinho não barra o owner. O único DELETE permitido é o job mensal de
--      purge de retenção, que sinaliza intenção via `SET LOCAL app.audit_purge`.
-- O hardening de role dedicada de menor privilégio em produção é tratado no
-- follow-up de infra (issue #205).
-- ─────────────────────────────────────────────────────────────────────────────

-- Camada 1 — REVOKE por role (best-effort: não falha se a role não existir).
DO $$
BEGIN
  REVOKE UPDATE, DELETE ON TABLE "audit_log" FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE UPDATE, DELETE ON TABLE "audit_log" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE UPDATE, DELETE ON TABLE "audit_log" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE UPDATE, DELETE ON TABLE "audit_log" FROM service_role;
  END IF;
END $$;

-- Camada 2 — trigger guard (à prova de owner).
CREATE OR REPLACE FUNCTION audit_log_prevent_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- DELETE só é permitido sob a flag explícita do job de purge de retenção.
    IF current_setting('app.audit_purge', true) = 'on' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_log e append-only: DELETE bloqueado (ADR-T-0004)';
  END IF;
  RAISE EXCEPTION 'audit_log e append-only: UPDATE bloqueado (ADR-T-0004)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_prevent_mutation();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION audit_log_prevent_mutation();
