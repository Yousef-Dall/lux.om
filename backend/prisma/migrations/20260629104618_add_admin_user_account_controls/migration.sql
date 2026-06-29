-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AccountSecurityEventType" ADD VALUE 'ADMIN_USER_SUSPENDED';
ALTER TYPE "AccountSecurityEventType" ADD VALUE 'ADMIN_USER_UNSUSPENDED';
ALTER TYPE "AccountSecurityEventType" ADD VALUE 'ADMIN_EMAIL_VERIFIED';
ALTER TYPE "AccountSecurityEventType" ADD VALUE 'ADMIN_EMAIL_UNVERIFIED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedById" TEXT,
ADD COLUMN     "suspendedReason" TEXT;

-- CreateIndex
CREATE INDEX "User_suspendedAt_idx" ON "User"("suspendedAt");

-- CreateIndex
CREATE INDEX "User_suspendedById_idx" ON "User"("suspendedById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
