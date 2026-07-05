-- Add first-class developer projects and connect listings as project units.
CREATE TYPE "DeveloperProjectStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "DeveloperProject" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameAr" TEXT,
  "descriptionEn" TEXT,
  "descriptionAr" TEXT,
  "locationEn" TEXT NOT NULL,
  "locationAr" TEXT,
  "completionStatus" TEXT,
  "handoverDate" TIMESTAMP(3),
  "totalUnits" INTEGER,
  "availableUnits" INTEGER,
  "bedroomsSummary" TEXT,
  "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "paymentPlan" TEXT,
  "brochureUrl" TEXT,
  "masterplanUrl" TEXT,
  "videoWalkthroughUrl" TEXT,
  "image" TEXT,
  "startingPriceAmount" DECIMAL(14,3),
  "priceCurrency" VARCHAR(3),
  "priceQualifier" "PriceQualifier" NOT NULL DEFAULT 'FROM',
  "status" "DeveloperProjectStatus" NOT NULL DEFAULT 'PENDING',
  "rejectedReason" TEXT,
  "developerId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "nearestLandmarkId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeveloperProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeveloperProjectImage" (
  "id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "altEn" TEXT,
  "altAr" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeveloperProjectImage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Listing" ADD COLUMN "developerProjectId" TEXT;

CREATE UNIQUE INDEX "DeveloperProject_slug_key" ON "DeveloperProject"("slug");
CREATE INDEX "DeveloperProject_status_createdAt_idx" ON "DeveloperProject"("status", "createdAt");
CREATE INDEX "DeveloperProject_developerId_idx" ON "DeveloperProject"("developerId");
CREATE INDEX "DeveloperProject_ownerId_idx" ON "DeveloperProject"("ownerId");
CREATE INDEX "DeveloperProject_nearestLandmarkId_idx" ON "DeveloperProject"("nearestLandmarkId");
CREATE INDEX "DeveloperProjectImage_projectId_idx" ON "DeveloperProjectImage"("projectId");
CREATE INDEX "Listing_developerProjectId_idx" ON "Listing"("developerProjectId");

ALTER TABLE "DeveloperProject" ADD CONSTRAINT "DeveloperProject_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperProject" ADD CONSTRAINT "DeveloperProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeveloperProject" ADD CONSTRAINT "DeveloperProject_nearestLandmarkId_fkey" FOREIGN KEY ("nearestLandmarkId") REFERENCES "Landmark"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DeveloperProjectImage" ADD CONSTRAINT "DeveloperProjectImage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "DeveloperProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_developerProjectId_fkey" FOREIGN KEY ("developerProjectId") REFERENCES "DeveloperProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
