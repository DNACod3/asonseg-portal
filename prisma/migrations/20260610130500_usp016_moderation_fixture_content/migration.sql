-- USP-016 (#122) — store transitório de conteúdo moderável (GAP-8).
-- Backing store mínimo para transitionContent + fila até os models reais aterrissarem.
-- CreateTable
CREATE TABLE "_moderation_fixture" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "content_status" NOT NULL DEFAULT 'IN_MODERATION',
    "title" TEXT NOT NULL,
    "author_person_id" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "_moderation_fixture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "_moderation_fixture_status_submitted_at_idx" ON "_moderation_fixture"("status", "submitted_at");
