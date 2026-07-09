-- CreateEnum
CREATE TYPE "income_bracket" AS ENUM ('NO_INCOME', 'UP_TO_1_MW', 'FROM_1_TO_2_MW', 'FROM_2_TO_3_MW', 'ABOVE_3_MW', 'UNDECLARED');

-- CreateEnum
CREATE TYPE "housing_situation" AS ENUM ('OWNED', 'RENTED', 'GRANTED', 'FAMILY', 'HOMELESS', 'OTHER');

-- CreateTable
CREATE TABLE "socioeconomic_records" (
    "person_id" UUID NOT NULL,
    "income_bracket" "income_bracket",
    "social_benefit" TEXT,
    "housing_situation" "housing_situation",
    "family_composition" TEXT,
    "updated_by_person_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "socioeconomic_records_pkey" PRIMARY KEY ("person_id")
);

-- AddForeignKey
ALTER TABLE "socioeconomic_records" ADD CONSTRAINT "socioeconomic_records_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
