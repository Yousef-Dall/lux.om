-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "availabilityDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "availabilityEndTime" TEXT,
ADD COLUMN     "availabilityStartTime" TEXT;
