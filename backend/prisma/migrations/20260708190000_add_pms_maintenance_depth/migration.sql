CREATE TYPE "PmsMaintenanceQuoteStatus" AS ENUM ('REQUESTED', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "PmsMaintenanceRecurrenceType" AS ENUM ('NONE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

CREATE TABLE "PmsVendor" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "trade" TEXT,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "companyId" TEXT NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsVendor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsMaintenanceQuote" (
  "id" TEXT NOT NULL,
  "amount" DECIMAL(12,3) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
  "description" TEXT,
  "status" "PmsMaintenanceQuoteStatus" NOT NULL DEFAULT 'REQUESTED',
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "notes" TEXT,
  "companyId" TEXT NOT NULL,
  "workOrderId" TEXT NOT NULL,
  "vendorId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsMaintenanceQuote_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PmsWorkOrder"
  ADD COLUMN "vendorId" TEXT,
  ADD COLUMN "targetDate" TIMESTAMP(3),
  ADD COLUMN "beforeImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "afterImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "beforeDocumentUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "afterDocumentUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "recurrenceType" "PmsMaintenanceRecurrenceType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "nextScheduledDate" TIMESTAMP(3),
  ADD COLUMN "generatedFromWorkOrderId" TEXT,
  ADD COLUMN "approvedQuoteId" TEXT,
  ADD COLUMN "tenantConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "tenantReopenedAt" TIMESTAMP(3),
  ADD COLUMN "tenantConfirmationNotes" TEXT;

CREATE INDEX "PmsVendor_companyId_active_idx" ON "PmsVendor"("companyId", "active");
CREATE INDEX "PmsVendor_companyId_trade_idx" ON "PmsVendor"("companyId", "trade");
CREATE INDEX "PmsVendor_companyId_name_idx" ON "PmsVendor"("companyId", "name");
CREATE INDEX "PmsVendor_createdById_idx" ON "PmsVendor"("createdById");
CREATE INDEX "PmsVendor_updatedById_idx" ON "PmsVendor"("updatedById");

CREATE INDEX "PmsMaintenanceQuote_companyId_status_idx" ON "PmsMaintenanceQuote"("companyId", "status");
CREATE INDEX "PmsMaintenanceQuote_workOrderId_status_idx" ON "PmsMaintenanceQuote"("workOrderId", "status");
CREATE INDEX "PmsMaintenanceQuote_vendorId_idx" ON "PmsMaintenanceQuote"("vendorId");
CREATE INDEX "PmsMaintenanceQuote_createdById_idx" ON "PmsMaintenanceQuote"("createdById");
CREATE INDEX "PmsMaintenanceQuote_updatedById_idx" ON "PmsMaintenanceQuote"("updatedById");
CREATE INDEX "PmsMaintenanceQuote_approvedById_idx" ON "PmsMaintenanceQuote"("approvedById");

CREATE INDEX "PmsWorkOrder_companyId_vendorId_idx" ON "PmsWorkOrder"("companyId", "vendorId");
CREATE INDEX "PmsWorkOrder_companyId_targetDate_idx" ON "PmsWorkOrder"("companyId", "targetDate");
CREATE INDEX "PmsWorkOrder_companyId_nextScheduledDate_idx" ON "PmsWorkOrder"("companyId", "nextScheduledDate");
CREATE INDEX "PmsWorkOrder_vendorId_idx" ON "PmsWorkOrder"("vendorId");
CREATE INDEX "PmsWorkOrder_generatedFromWorkOrderId_idx" ON "PmsWorkOrder"("generatedFromWorkOrderId");

ALTER TABLE "PmsVendor" ADD CONSTRAINT "PmsVendor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsVendor" ADD CONSTRAINT "PmsVendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsVendor" ADD CONSTRAINT "PmsVendor_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsMaintenanceQuote" ADD CONSTRAINT "PmsMaintenanceQuote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsMaintenanceQuote" ADD CONSTRAINT "PmsMaintenanceQuote_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "PmsWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsMaintenanceQuote" ADD CONSTRAINT "PmsMaintenanceQuote_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "PmsVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsMaintenanceQuote" ADD CONSTRAINT "PmsMaintenanceQuote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsMaintenanceQuote" ADD CONSTRAINT "PmsMaintenanceQuote_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsMaintenanceQuote" ADD CONSTRAINT "PmsMaintenanceQuote_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsWorkOrder" ADD CONSTRAINT "PmsWorkOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "PmsVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsWorkOrder" ADD CONSTRAINT "PmsWorkOrder_generatedFromWorkOrderId_fkey" FOREIGN KEY ("generatedFromWorkOrderId") REFERENCES "PmsWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
