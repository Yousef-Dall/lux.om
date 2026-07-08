-- Stage 15: PMS private documents, lease renewal chain, and move-in/move-out checklist foundation

ALTER TYPE "PmsLeaseStatus" ADD VALUE IF NOT EXISTS 'RENEWED';

CREATE TYPE "PmsDocumentType" AS ENUM (
  'TENANT_ID',
  'PASSPORT_RESIDENCY',
  'LEASE_AGREEMENT',
  'RENEWAL',
  'MOVE_IN_REPORT',
  'MOVE_OUT_REPORT',
  'DEPOSIT_RECEIPT',
  'INSPECTION_REPORT',
  'MAINTENANCE_INVOICE',
  'POLICY_NOTICE',
  'OTHER'
);

CREATE TYPE "PmsDocumentStatus" AS ENUM (
  'ACTIVE',
  'EXPIRING',
  'EXPIRED',
  'ARCHIVED'
);

CREATE TYPE "PmsMoveChecklistType" AS ENUM (
  'MOVE_IN',
  'MOVE_OUT'
);

CREATE TYPE "PmsMoveChecklistStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'WAIVED'
);

ALTER TABLE "PmsLease" ADD COLUMN "previousLeaseId" TEXT;

CREATE TABLE "PmsDocument" (
  "id" TEXT NOT NULL,
  "type" "PmsDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "status" "PmsDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiryDate" TIMESTAMP(3),
  "notes" TEXT,
  "companyId" TEXT NOT NULL,
  "propertyId" TEXT,
  "unitId" TEXT,
  "tenantId" TEXT,
  "leaseId" TEXT,
  "workOrderId" TEXT,
  "inspectionId" TEXT,
  "uploadedById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsMoveChecklistItem" (
  "id" TEXT NOT NULL,
  "type" "PmsMoveChecklistType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "PmsMoveChecklistStatus" NOT NULL DEFAULT 'PENDING',
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "companyId" TEXT NOT NULL,
  "leaseId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PmsMoveChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PmsLease_previousLeaseId_idx" ON "PmsLease"("previousLeaseId");
CREATE INDEX "PmsDocument_companyId_type_idx" ON "PmsDocument"("companyId", "type");
CREATE INDEX "PmsDocument_companyId_status_idx" ON "PmsDocument"("companyId", "status");
CREATE INDEX "PmsDocument_companyId_expiryDate_idx" ON "PmsDocument"("companyId", "expiryDate");
CREATE INDEX "PmsDocument_propertyId_idx" ON "PmsDocument"("propertyId");
CREATE INDEX "PmsDocument_unitId_idx" ON "PmsDocument"("unitId");
CREATE INDEX "PmsDocument_tenantId_idx" ON "PmsDocument"("tenantId");
CREATE INDEX "PmsDocument_leaseId_idx" ON "PmsDocument"("leaseId");
CREATE INDEX "PmsDocument_workOrderId_idx" ON "PmsDocument"("workOrderId");
CREATE INDEX "PmsDocument_inspectionId_idx" ON "PmsDocument"("inspectionId");
CREATE INDEX "PmsDocument_uploadedById_idx" ON "PmsDocument"("uploadedById");
CREATE INDEX "PmsDocument_updatedById_idx" ON "PmsDocument"("updatedById");
CREATE INDEX "PmsMoveChecklistItem_companyId_type_idx" ON "PmsMoveChecklistItem"("companyId", "type");
CREATE INDEX "PmsMoveChecklistItem_companyId_status_idx" ON "PmsMoveChecklistItem"("companyId", "status");
CREATE INDEX "PmsMoveChecklistItem_leaseId_idx" ON "PmsMoveChecklistItem"("leaseId");
CREATE INDEX "PmsMoveChecklistItem_propertyId_idx" ON "PmsMoveChecklistItem"("propertyId");
CREATE INDEX "PmsMoveChecklistItem_unitId_idx" ON "PmsMoveChecklistItem"("unitId");
CREATE INDEX "PmsMoveChecklistItem_tenantId_idx" ON "PmsMoveChecklistItem"("tenantId");
CREATE INDEX "PmsMoveChecklistItem_createdById_idx" ON "PmsMoveChecklistItem"("createdById");
CREATE INDEX "PmsMoveChecklistItem_updatedById_idx" ON "PmsMoveChecklistItem"("updatedById");

ALTER TABLE "PmsLease" ADD CONSTRAINT "PmsLease_previousLeaseId_fkey" FOREIGN KEY ("previousLeaseId") REFERENCES "PmsLease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "PmsLease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "PmsWorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PmsInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsDocument" ADD CONSTRAINT "PmsDocument_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsMoveChecklistItem" ADD CONSTRAINT "PmsMoveChecklistItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsMoveChecklistItem" ADD CONSTRAINT "PmsMoveChecklistItem_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "PmsLease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsMoveChecklistItem" ADD CONSTRAINT "PmsMoveChecklistItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsMoveChecklistItem" ADD CONSTRAINT "PmsMoveChecklistItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsMoveChecklistItem" ADD CONSTRAINT "PmsMoveChecklistItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsMoveChecklistItem" ADD CONSTRAINT "PmsMoveChecklistItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsMoveChecklistItem" ADD CONSTRAINT "PmsMoveChecklistItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
