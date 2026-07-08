CREATE TYPE "PmsCommunicationLogStatus" AS ENUM ('DRAFT', 'LOGGED', 'SENT', 'FAILED', 'SKIPPED');
CREATE TYPE "PmsReminderType" AS ENUM ('RENT_DUE_SOON', 'OVERDUE_RENT', 'LEASE_EXPIRY', 'MAINTENANCE_STATUS');

CREATE TABLE "PmsCommunicationLog" (
  "id" TEXT NOT NULL,
  "channel" "PmsCommunicationChannel" NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "status" "PmsCommunicationLogStatus" NOT NULL DEFAULT 'LOGGED',
  "deliveryMetadata" JSONB,
  "sentAt" TIMESTAMP(3),
  "notes" TEXT,
  "companyId" TEXT NOT NULL,
  "templateId" TEXT,
  "tenantId" TEXT,
  "leaseId" TEXT,
  "rentDueItemId" TEXT,
  "workOrderId" TEXT,
  "createdById" TEXT,
  "sentById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsCommunicationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PmsCommunicationLog_companyId_createdAt_idx" ON "PmsCommunicationLog"("companyId", "createdAt");
CREATE INDEX "PmsCommunicationLog_companyId_channel_idx" ON "PmsCommunicationLog"("companyId", "channel");
CREATE INDEX "PmsCommunicationLog_companyId_status_idx" ON "PmsCommunicationLog"("companyId", "status");
CREATE INDEX "PmsCommunicationLog_templateId_idx" ON "PmsCommunicationLog"("templateId");
CREATE INDEX "PmsCommunicationLog_tenantId_idx" ON "PmsCommunicationLog"("tenantId");
CREATE INDEX "PmsCommunicationLog_leaseId_idx" ON "PmsCommunicationLog"("leaseId");
CREATE INDEX "PmsCommunicationLog_rentDueItemId_idx" ON "PmsCommunicationLog"("rentDueItemId");
CREATE INDEX "PmsCommunicationLog_workOrderId_idx" ON "PmsCommunicationLog"("workOrderId");
CREATE INDEX "PmsCommunicationLog_createdById_idx" ON "PmsCommunicationLog"("createdById");
CREATE INDEX "PmsCommunicationLog_sentById_idx" ON "PmsCommunicationLog"("sentById");

ALTER TABLE "PmsCommunicationLog" ADD CONSTRAINT "PmsCommunicationLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsCommunicationLog" ADD CONSTRAINT "PmsCommunicationLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PmsCommunicationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCommunicationLog" ADD CONSTRAINT "PmsCommunicationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCommunicationLog" ADD CONSTRAINT "PmsCommunicationLog_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "PmsLease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCommunicationLog" ADD CONSTRAINT "PmsCommunicationLog_rentDueItemId_fkey" FOREIGN KEY ("rentDueItemId") REFERENCES "PmsRentDueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCommunicationLog" ADD CONSTRAINT "PmsCommunicationLog_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "PmsWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCommunicationLog" ADD CONSTRAINT "PmsCommunicationLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCommunicationLog" ADD CONSTRAINT "PmsCommunicationLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
