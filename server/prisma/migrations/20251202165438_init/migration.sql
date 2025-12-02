-- CreateTable
CREATE TABLE "SeismicReading" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "frequency" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeismicReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeismicReading_date_idx" ON "SeismicReading"("date");
