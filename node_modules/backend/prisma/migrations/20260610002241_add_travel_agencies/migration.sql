-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "travelAgencyId" TEXT;

-- CreateTable
CREATE TABLE "TravelAgency" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "descriptionEn" TEXT,
    "descriptionAr" TEXT,
    "headquartersEn" TEXT,
    "headquartersAr" TEXT,
    "logo" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "establishedYear" INTEGER,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelAgency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TravelAgency_slug_key" ON "TravelAgency"("slug");

-- CreateIndex
CREATE INDEX "TravelAgency_verified_idx" ON "TravelAgency"("verified");

-- CreateIndex
CREATE INDEX "TravelAgency_featured_idx" ON "TravelAgency"("featured");

-- CreateIndex
CREATE INDEX "Activity_travelAgencyId_idx" ON "Activity"("travelAgencyId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_travelAgencyId_fkey" FOREIGN KEY ("travelAgencyId") REFERENCES "TravelAgency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
