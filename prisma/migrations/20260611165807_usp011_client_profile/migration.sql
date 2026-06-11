-- CreateTable
CREATE TABLE "client_profiles" (
    "person_id" UUID NOT NULL,
    "city_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("person_id")
);

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
