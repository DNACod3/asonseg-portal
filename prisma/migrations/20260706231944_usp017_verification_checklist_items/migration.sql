-- CreateTable
CREATE TABLE "verification_checklist_items" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "guidance" TEXT,
    "is_blocking" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verification_checklist_items_code_key" ON "verification_checklist_items"("code");
