-- Stage 21E: PMS/CRM privacy, finance, lease, document, statement, and audit hardening.
ALTER TYPE "PmsPermissionKey" ADD VALUE IF NOT EXISTS 'SENSITIVE_DATA_VIEW';
ALTER TYPE "PmsPermissionKey" ADD VALUE IF NOT EXISTS 'SENSITIVE_DATA_EXPORT';

CREATE TYPE "PmsUnitOperationalStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'MAINTENANCE', 'UNAVAILABLE');
CREATE TYPE "PmsDocumentStorageDriver" AS ENUM ('LOCAL_PRIVATE', 'OBJECT_STORAGE', 'LEGACY_REFERENCE');
CREATE TYPE "PmsDocumentScanStatus" AS ENUM ('NOT_CONFIGURED', 'PENDING', 'CLEAN', 'QUARANTINED', 'FAILED');
CREATE TYPE "PmsOwnerStatementStatus" AS ENUM ('DRAFT', 'GENERATED', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED', 'VOID');
CREATE TYPE "DomainAuditDomain" AS ENUM ('PMS', 'CRM');
CREATE TYPE "DomainAuditOrigin" AS ENUM ('MANUAL', 'SYSTEM', 'AUTOMATION');

ALTER TABLE "PmsUnit" ADD COLUMN "operationalStatus" "PmsUnitOperationalStatus" NOT NULL DEFAULT 'AVAILABLE';
UPDATE "PmsUnit"
SET "operationalStatus" = CASE
  WHEN "status" = 'RESERVED' THEN 'RESERVED'::"PmsUnitOperationalStatus"
  WHEN "status" = 'MAINTENANCE' THEN 'MAINTENANCE'::"PmsUnitOperationalStatus"
  WHEN "status" = 'UNAVAILABLE' THEN 'UNAVAILABLE'::"PmsUnitOperationalStatus"
  ELSE 'AVAILABLE'::"PmsUnitOperationalStatus"
END;
CREATE INDEX "PmsUnit_companyId_operationalStatus_idx" ON "PmsUnit"("companyId", "operationalStatus");

ALTER TABLE "PmsDocument"
  ADD COLUMN "storageDriver" "PmsDocumentStorageDriver" NOT NULL DEFAULT 'LEGACY_REFERENCE',
  ADD COLUMN "storageKey" TEXT,
  ADD COLUMN "originalFilename" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "sizeBytes" INTEGER,
  ADD COLUMN "checksumSha256" TEXT,
  ADD COLUMN "scanStatus" "PmsDocumentScanStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
  ADD COLUMN "quarantineReason" TEXT,
  ADD COLUMN "fileVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "fileUploadedAt" TIMESTAMP(3),
  ADD COLUMN "fileReplacedAt" TIMESTAMP(3);
CREATE INDEX "PmsDocument_companyId_storageDriver_idx" ON "PmsDocument"("companyId", "storageDriver");
CREATE INDEX "PmsDocument_storageKey_idx" ON "PmsDocument"("storageKey");
CREATE INDEX "PmsDocument_fileUrl_idx" ON "PmsDocument"("fileUrl");

CREATE TABLE "PmsOwnerStatement" (
  "id" TEXT NOT NULL,
  "status" "PmsOwnerStatementStatus" NOT NULL DEFAULT 'GENERATED',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "ownerReference" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "includedRentPaymentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "includedAccountingEntryIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "includedMaintenanceWorkOrderIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "openingBalance" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "income" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "expenses" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "adjustments" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "closingBalance" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "snapshot" JSONB NOT NULL,
  "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3),
  "companyId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "revisionOfId" TEXT,
  "generatedById" TEXT,
  "reviewedById" TEXT,
  "approvedById" TEXT,
  "publishedById" TEXT,
  "voidedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsOwnerStatement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PmsOwnerStatement_companyId_status_idx" ON "PmsOwnerStatement"("companyId", "status");
CREATE INDEX "PmsOwnerStatement_companyId_propertyId_periodStart_periodEnd_currency_idx" ON "PmsOwnerStatement"("companyId", "propertyId", "periodStart", "periodEnd", "currency");
CREATE INDEX "PmsOwnerStatement_propertyId_periodStart_periodEnd_idx" ON "PmsOwnerStatement"("propertyId", "periodStart", "periodEnd");
CREATE INDEX "PmsOwnerStatement_revisionOfId_idx" ON "PmsOwnerStatement"("revisionOfId");
CREATE UNIQUE INDEX "PmsOwnerStatement_active_period_currency_unique"
  ON "PmsOwnerStatement"("companyId", "propertyId", "periodStart", "periodEnd", "currency")
  WHERE "status" <> 'VOID';

CREATE TABLE "DomainAuditEvent" (
  "id" TEXT NOT NULL,
  "domain" "DomainAuditDomain" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "action" TEXT NOT NULL,
  "origin" "DomainAuditOrigin" NOT NULL DEFAULT 'MANUAL',
  "changedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "beforeMetadata" JSONB,
  "afterMetadata" JSONB,
  "metadata" JSONB,
  "requestId" TEXT,
  "sourceIp" TEXT,
  "userAgent" TEXT,
  "companyId" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DomainAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DomainAuditEvent_companyId_domain_createdAt_idx" ON "DomainAuditEvent"("companyId", "domain", "createdAt");
CREATE INDEX "DomainAuditEvent_companyId_entityType_entityId_idx" ON "DomainAuditEvent"("companyId", "entityType", "entityId");
CREATE INDEX "DomainAuditEvent_actorId_createdAt_idx" ON "DomainAuditEvent"("actorId", "createdAt");
CREATE INDEX "DomainAuditEvent_action_createdAt_idx" ON "DomainAuditEvent"("action", "createdAt");

ALTER TABLE "PmsOwnerStatement" ADD CONSTRAINT "PmsOwnerStatement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerStatement" ADD CONSTRAINT "PmsOwnerStatement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerStatement" ADD CONSTRAINT "PmsOwnerStatement_revisionOfId_fkey" FOREIGN KEY ("revisionOfId") REFERENCES "PmsOwnerStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerStatement" ADD CONSTRAINT "PmsOwnerStatement_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerStatement" ADD CONSTRAINT "PmsOwnerStatement_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerStatement" ADD CONSTRAINT "PmsOwnerStatement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerStatement" ADD CONSTRAINT "PmsOwnerStatement_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsOwnerStatement" ADD CONSTRAINT "PmsOwnerStatement_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DomainAuditEvent" ADD CONSTRAINT "DomainAuditEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DomainAuditEvent" ADD CONSTRAINT "DomainAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fail with a clear remediation message instead of creating an invalid constraint
-- when legacy data already contains conflicting active/expiring leases.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PmsLease"
    WHERE "status" IN ('ACTIVE', 'EXPIRING')
    GROUP BY "unitId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Stage 21E migration blocked: reconcile units with multiple ACTIVE/EXPIRING leases before applying the unique lease guard.';
  END IF;
END $$;

-- Database-level final guard against concurrent ACTIVE/EXPIRING leases.
CREATE UNIQUE INDEX "PmsLease_one_active_per_unit"
  ON "PmsLease"("unitId")
  WHERE "status" IN ('ACTIVE', 'EXPIRING');
