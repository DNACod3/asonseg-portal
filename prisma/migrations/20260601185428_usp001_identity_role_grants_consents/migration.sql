-- USP-001: expandir persons + PersonRoleGrant + Consent
-- Adds: supabase_user_id, full_name, cpf, email_login (rename from email),
--       enums Role / RoleGrantStatus / ConsentPurpose,
--       tables person_role_grants, consents.

-- 1. Renomear coluna email → email_login (mesma semântica, novo campo canônico)
ALTER TABLE "persons" RENAME COLUMN "email" TO "email_login";

-- O índice único é recriado automaticamente pelo Prisma; como estamos gerenciando
-- manualmente, dropar o antigo e criar o novo com o nome correto.
DROP INDEX IF EXISTS "persons_email_key";
CREATE UNIQUE INDEX "persons_email_login_key" ON "persons"("email_login");

-- 2. Adicionar novas colunas ao persons
ALTER TABLE "persons"
  ADD COLUMN "supabase_user_id" UUID,
  ADD COLUMN "full_name"                   TEXT NOT NULL DEFAULT '',
  ADD COLUMN "cpf"                         TEXT,
  ADD COLUMN "cpf_exception_justification" TEXT,
  ADD COLUMN "phone"                       TEXT,
  ADD COLUMN "birth_date"                  DATE,
  ADD COLUMN "full_address"                TEXT,
  ADD COLUMN "must_change_password"        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "inactivated_at"              TIMESTAMPTZ(6),
  ADD COLUMN "inactivated_by_person_id"    UUID,
  ADD COLUMN "inactivation_reason"         TEXT,
  ADD COLUMN "created_by_person_id"        UUID;

-- Remover default de full_name (era só para a migration não quebrar linhas existentes)
ALTER TABLE "persons" ALTER COLUMN "full_name" DROP DEFAULT;

-- Unique constraints para cpf e supabase_user_id
CREATE UNIQUE INDEX "persons_supabase_user_id_key" ON "persons"("supabase_user_id");
CREATE UNIQUE INDEX "persons_cpf_key"              ON "persons"("cpf");

-- 3. Enums
CREATE TYPE "role" AS ENUM (
  'CANDIDATE',
  'PROVIDER',
  'CLIENT',
  'COMPANY_RESPONSIBLE',
  'VOLUNTEER',
  'COORDINATOR',
  'SOCIAL_ASSISTANT',
  'BOARD',
  'BENEFICIARY',
  'FAMILY_RESPONSIBLE'
);

CREATE TYPE "role_grant_status" AS ENUM (
  'ACTIVE',
  'REVOKED',
  'AWAITING_CONSENT',
  'INACTIVE'
);

CREATE TYPE "consent_purpose" AS ENUM (
  'PORTAL_ACCESS',
  'JOB_APPLICATION',
  'SERVICE_OFFERING',
  'SERVICE_HIRING',
  'COMPANY_REPRESENTATION',
  'SOCIAL_ASSISTANCE',
  'CV_AI_EXTRACTION',
  'SOCIAL_REFERRAL_TO_JOB'
);

-- 4. Tabela person_role_grants
CREATE TABLE "person_role_grants" (
  "id"               UUID            NOT NULL,
  "person_id"        UUID            NOT NULL,
  "role"             "role"          NOT NULL,
  "status"           "role_grant_status" NOT NULL DEFAULT 'AWAITING_CONSENT',
  "activated_at"     TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activated_by"     UUID,
  "revoked_at"       TIMESTAMPTZ(6),
  "revoked_by"       UUID,
  "revocation_reason" TEXT,

  CONSTRAINT "person_role_grants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "person_role_grants_person_id_role_activated_at_key"
  ON "person_role_grants"("person_id", "role", "activated_at");

CREATE INDEX "person_role_grants_person_id_status_idx"
  ON "person_role_grants"("person_id", "status");

CREATE INDEX "person_role_grants_role_status_idx"
  ON "person_role_grants"("role", "status");

ALTER TABLE "person_role_grants"
  ADD CONSTRAINT "person_role_grants_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "persons"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Tabela consents
CREATE TABLE "consents" (
  "id"               UUID            NOT NULL,
  "person_id"        UUID            NOT NULL,
  "purpose"          "consent_purpose" NOT NULL,
  "term_version"     TEXT            NOT NULL,
  "term_content_hash" TEXT           NOT NULL,
  "accepted_at"      TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "accepted_ip"      INET,
  "user_agent"       TEXT,
  "revoked_at"       TIMESTAMPTZ(6),
  "revoked_reason"   TEXT,
  "context"          JSONB,

  CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consents_person_id_purpose_accepted_at_key"
  ON "consents"("person_id", "purpose", "accepted_at");

CREATE INDEX "consents_person_id_purpose_revoked_at_idx"
  ON "consents"("person_id", "purpose", "revoked_at");

ALTER TABLE "consents"
  ADD CONSTRAINT "consents_person_id_fkey"
  FOREIGN KEY ("person_id") REFERENCES "persons"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
