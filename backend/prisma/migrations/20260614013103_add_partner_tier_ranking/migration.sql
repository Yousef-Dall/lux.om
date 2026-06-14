-- Add derived partner ranking tiers.
--
-- 3 = featured verified linked partner
-- 2 = verified linked partner
-- 1 = unverified linked partner or manual partner
-- 0 = no partner

-- Featured partners must always be verified.
UPDATE "DeveloperCompany"
SET "verified" = TRUE
WHERE "featured" = TRUE
  AND "verified" = FALSE;

UPDATE "TravelAgency"
SET "verified" = TRUE
WHERE "featured" = TRUE
  AND "verified" = FALSE;

-- Add tier columns.
ALTER TABLE "Listing"
ADD COLUMN "partnerTier" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Activity"
ADD COLUMN "partnerTier" INTEGER NOT NULL DEFAULT 0;

-- Backfill listing tiers.
UPDATE "Listing" AS listing
SET "partnerTier" =
  CASE
    WHEN listing."developerId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "DeveloperCompany" AS developer
        WHERE developer."id" = listing."developerId"
          AND developer."featured" = TRUE
          AND developer."verified" = TRUE
      )
      THEN 3

    WHEN listing."developerId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "DeveloperCompany" AS developer
        WHERE developer."id" = listing."developerId"
          AND developer."verified" = TRUE
      )
      THEN 2

    WHEN listing."developerId" IS NOT NULL
      THEN 1

    WHEN NULLIF(BTRIM(COALESCE(listing."developerNameEn", '')), '') IS NOT NULL
      OR NULLIF(BTRIM(COALESCE(listing."developerNameAr", '')), '') IS NOT NULL
      THEN 1

    ELSE 0
  END;

-- Backfill activity tiers.
UPDATE "Activity" AS activity
SET "partnerTier" =
  CASE
    WHEN activity."travelAgencyId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "TravelAgency" AS agency
        WHERE agency."id" = activity."travelAgencyId"
          AND agency."featured" = TRUE
          AND agency."verified" = TRUE
      )
      THEN 3

    WHEN activity."travelAgencyId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM "TravelAgency" AS agency
        WHERE agency."id" = activity."travelAgencyId"
          AND agency."verified" = TRUE
      )
      THEN 2

    WHEN activity."travelAgencyId" IS NOT NULL
      THEN 1

    WHEN NULLIF(BTRIM(COALESCE(activity."providerEn", '')), '') IS NOT NULL
      OR NULLIF(BTRIM(COALESCE(activity."providerAr", '')), '') IS NOT NULL
      THEN 1

    ELSE 0
  END;

-- Support ranked approved-result queries before pagination.
CREATE INDEX "Listing_status_partnerTier_createdAt_idx"
ON "Listing"("status", "partnerTier", "createdAt");

CREATE INDEX "Activity_status_partnerTier_createdAt_idx"
ON "Activity"("status", "partnerTier", "createdAt");
