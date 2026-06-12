/*
  Warnings:

  - You are about to drop the column `featured` on the `Activity` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Activity_featured_idx";

-- DropIndex
DROP INDEX "Listing_featured_idx";

-- AlterTable
ALTER TABLE "Activity" DROP COLUMN "featured";
