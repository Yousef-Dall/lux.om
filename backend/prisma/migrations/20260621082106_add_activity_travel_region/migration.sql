-- CreateEnum
CREATE TYPE "ActivityTravelRegion" AS ENUM ('INSIDE_OMAN', 'OUTSIDE_OMAN');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "travelRegion" "ActivityTravelRegion" NOT NULL DEFAULT 'INSIDE_OMAN';

-- CreateIndex
CREATE INDEX "Activity_travelRegion_idx" ON "Activity"("travelRegion");
