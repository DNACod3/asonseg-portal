-- CreateTable
CREATE TABLE "_health_check" (
    "id" TEXT NOT NULL,
    "checkedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "_health_check_pkey" PRIMARY KEY ("id")
);
