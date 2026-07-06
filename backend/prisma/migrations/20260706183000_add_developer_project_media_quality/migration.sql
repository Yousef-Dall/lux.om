-- Add media-quality operations fields to developer projects so admin media review can cover project pages truthfully.
ALTER TABLE "DeveloperProject"
  ADD COLUMN "mediaQualityStatus" "MediaQualityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
  ADD COLUMN "mediaQualityNotes" TEXT,
  ADD COLUMN "enhancedImageUrl" TEXT,
  ADD COLUMN "enhancementStatus" "EnhancementStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN "enhancementProvider" TEXT,
  ADD COLUMN "enhancementNotes" TEXT;

CREATE INDEX "DeveloperProject_mediaQualityStatus_idx" ON "DeveloperProject"("mediaQualityStatus");
