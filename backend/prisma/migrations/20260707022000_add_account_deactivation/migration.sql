ALTER TYPE "AccountSecurityEventType" ADD VALUE 'ACCOUNT_DEACTIVATED';

ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deactivationReason" TEXT;

CREATE INDEX "User_deactivatedAt_idx" ON "User"("deactivatedAt");
