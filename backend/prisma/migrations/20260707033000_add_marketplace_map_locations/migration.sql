-- Add optional map-discovery fields for approved listing and developer-project pins.
ALTER TABLE "Listing"
  ADD COLUMN "mapPlaceLabel" TEXT,
  ADD COLUMN "mapAddress" TEXT,
  ADD COLUMN "mapGoogleUrl" TEXT,
  ADD COLUMN "latitude" DECIMAL(10, 7),
  ADD COLUMN "longitude" DECIMAL(10, 7);

ALTER TABLE "DeveloperProject"
  ADD COLUMN "mapPlaceLabel" TEXT,
  ADD COLUMN "mapAddress" TEXT,
  ADD COLUMN "mapGoogleUrl" TEXT,
  ADD COLUMN "latitude" DECIMAL(10, 7),
  ADD COLUMN "longitude" DECIMAL(10, 7);

CREATE INDEX "Listing_latitude_longitude_idx" ON "Listing"("latitude", "longitude");
CREATE INDEX "DeveloperProject_latitude_longitude_idx" ON "DeveloperProject"("latitude", "longitude");
