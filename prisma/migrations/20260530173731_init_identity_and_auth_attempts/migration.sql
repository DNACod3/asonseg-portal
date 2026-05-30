-- CreateEnum
CREATE TYPE "person_status" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "auth_outcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "persons" (
    "id" UUID NOT NULL,
    "status" "person_status" NOT NULL DEFAULT 'ATIVO',
    "email" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "primeiro_acesso" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_attempts" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "outcome" "auth_outcome" NOT NULL,
    "attempted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "persons_email_key" ON "persons"("email");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_person_id_key" ON "credentials"("person_id");

-- CreateIndex
CREATE INDEX "auth_attempts_lockout_idx" ON "auth_attempts"("email", "ip", "attempted_at");

-- CreateIndex
CREATE INDEX "auth_attempts_retention_idx" ON "auth_attempts"("attempted_at");

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
