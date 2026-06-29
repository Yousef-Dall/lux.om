-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailBookingUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailMarketingUpdates" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emailSavedSearchUpdates" BOOLEAN NOT NULL DEFAULT true;
