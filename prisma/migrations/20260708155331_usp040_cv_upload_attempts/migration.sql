-- DropForeignKey
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_area_id_fkey";

-- CreateTable
CREATE TABLE "cv_upload_attempts" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_upload_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cv_upload_attempts_person_id_created_at_idx" ON "cv_upload_attempts"("person_id", "created_at");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "job_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_upload_attempts" ADD CONSTRAINT "cv_upload_attempts_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
