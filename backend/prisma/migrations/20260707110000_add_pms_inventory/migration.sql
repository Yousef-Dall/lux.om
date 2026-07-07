-- Stage 10B: private PMS property and unit inventory.

CREATE TYPE "PmsUnitStatus" AS ENUM ('VACANT', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'UNAVAILABLE');
CREATE TYPE "PmsOccupancyStatus" AS ENUM ('VACANT', 'OCCUPIED', 'RESERVED', 'UNKNOWN');

CREATE TABLE "PmsProperty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "propertyType" TEXT,
    "description" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "area" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mapPlaceLabel" TEXT,
    "mapAddress" TEXT,
    "mapGoogleUrl" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "companyId" TEXT NOT NULL,
    "developerProjectId" TEXT,
    "publicListingId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsProperty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsUnit" (
    "id" TEXT NOT NULL,
    "unitNumber" TEXT NOT NULL,
    "unitName" TEXT,
    "floor" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "areaSqm" INTEGER,
    "status" "PmsUnitStatus" NOT NULL DEFAULT 'VACANT',
    "occupancyStatus" "PmsOccupancyStatus" NOT NULL DEFAULT 'VACANT',
    "rentAmount" DECIMAL(12,3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "notes" TEXT,
    "propertyId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "developerProjectId" TEXT,
    "publicListingId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PmsProperty_companyId_code_key" ON "PmsProperty"("companyId", "code");
CREATE INDEX "PmsProperty_companyId_active_idx" ON "PmsProperty"("companyId", "active");
CREATE INDEX "PmsProperty_companyId_name_idx" ON "PmsProperty"("companyId", "name");
CREATE INDEX "PmsProperty_developerProjectId_idx" ON "PmsProperty"("developerProjectId");
CREATE INDEX "PmsProperty_publicListingId_idx" ON "PmsProperty"("publicListingId");
CREATE INDEX "PmsProperty_latitude_longitude_idx" ON "PmsProperty"("latitude", "longitude");
CREATE INDEX "PmsProperty_createdById_idx" ON "PmsProperty"("createdById");
CREATE INDEX "PmsProperty_updatedById_idx" ON "PmsProperty"("updatedById");

CREATE UNIQUE INDEX "PmsUnit_propertyId_unitNumber_key" ON "PmsUnit"("propertyId", "unitNumber");
CREATE INDEX "PmsUnit_companyId_status_idx" ON "PmsUnit"("companyId", "status");
CREATE INDEX "PmsUnit_companyId_occupancyStatus_idx" ON "PmsUnit"("companyId", "occupancyStatus");
CREATE INDEX "PmsUnit_propertyId_status_idx" ON "PmsUnit"("propertyId", "status");
CREATE INDEX "PmsUnit_developerProjectId_idx" ON "PmsUnit"("developerProjectId");
CREATE INDEX "PmsUnit_publicListingId_idx" ON "PmsUnit"("publicListingId");
CREATE INDEX "PmsUnit_createdById_idx" ON "PmsUnit"("createdById");
CREATE INDEX "PmsUnit_updatedById_idx" ON "PmsUnit"("updatedById");

ALTER TABLE "PmsProperty" ADD CONSTRAINT "PmsProperty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsProperty" ADD CONSTRAINT "PmsProperty_developerProjectId_fkey" FOREIGN KEY ("developerProjectId") REFERENCES "DeveloperProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsProperty" ADD CONSTRAINT "PmsProperty_publicListingId_fkey" FOREIGN KEY ("publicListingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsProperty" ADD CONSTRAINT "PmsProperty_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsProperty" ADD CONSTRAINT "PmsProperty_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsUnit" ADD CONSTRAINT "PmsUnit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsUnit" ADD CONSTRAINT "PmsUnit_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsUnit" ADD CONSTRAINT "PmsUnit_developerProjectId_fkey" FOREIGN KEY ("developerProjectId") REFERENCES "DeveloperProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsUnit" ADD CONSTRAINT "PmsUnit_publicListingId_fkey" FOREIGN KEY ("publicListingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsUnit" ADD CONSTRAINT "PmsUnit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsUnit" ADD CONSTRAINT "PmsUnit_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
