-- USP-040 / CVE-07 — rate limit durável de EXTRAÇÃO de CV (custo LLM).
-- Espelha `cv_upload_attempts`, mas gateando a chamada à IA: uma linha por
-- extração solicitada; a contagem diária (America/Sao_Paulo) barra invocações
-- em loop de `extractCvFromUpload`, que sem isto poderia gerar chamadas
-- Anthropic pagas ilimitadas sobre o mesmo upload.

-- CreateTable
CREATE TABLE "cv_extraction_attempts" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_extraction_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cv_extraction_attempts_person_id_created_at_idx" ON "cv_extraction_attempts"("person_id", "created_at");

-- AddForeignKey
ALTER TABLE "cv_extraction_attempts" ADD CONSTRAINT "cv_extraction_attempts_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
