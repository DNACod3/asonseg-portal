-- CreateTable
CREATE TABLE "candidate_profiles" (
    "person_id" UUID NOT NULL,
    "headline" TEXT,
    "primary_area_of_interest_id" UUID,
    "education_level" TEXT,
    "education_area" TEXT,
    "experience_text" TEXT,
    "skills_text" TEXT,
    "courses_text" TEXT,
    "availability" TEXT,
    "cv_storage_path" TEXT,
    "cv_sha256" TEXT,
    "cv_uploaded_at" TIMESTAMPTZ(6),
    "cv_last_confirmed_at" TIMESTAMPTZ(6),
    "publication_status" "content_status" NOT NULL DEFAULT 'DRAFT',
    "last_status_change_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "candidate_profiles_pkey" PRIMARY KEY ("person_id")
);

-- CreateIndex
CREATE INDEX "candidate_profiles_publication_status_idx" ON "candidate_profiles"("publication_status");

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_primary_area_of_interest_id_fkey" FOREIGN KEY ("primary_area_of_interest_id") REFERENCES "job_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

