-- Stage 10D: private PMS operations, maintenance, reports, communications, policies, and inspections.

CREATE TYPE "PmsMaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "PmsMaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_VENDOR', 'RESOLVED', 'CANCELLED');
CREATE TYPE "PmsCommunicationChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'SMS', 'INTERNAL');
CREATE TYPE "PmsPolicyCategory" AS ENUM ('GENERAL', 'RENT', 'MAINTENANCE', 'PAYMENT', 'MOVE_IN_OUT', 'SAFETY');
CREATE TYPE "PmsInspectionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'NEEDS_ACTION', 'CANCELLED');

CREATE TABLE "PmsWorkOrder" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "PmsMaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "PmsMaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToText" TEXT,
    "vendorText" TEXT,
    "cost" DECIMAL(12,3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "scheduledFor" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "documentUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "tenantId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsWorkOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsCommunicationTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "PmsCommunicationChannel" NOT NULL DEFAULT 'EMAIL',
    "type" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsCommunicationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsPolicy" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" "PmsPolicyCategory" NOT NULL DEFAULT 'GENERAL',
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsInspection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "PmsInspectionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "feedback" TEXT,
    "rating" INTEGER,
    "companyId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT,
    "tenantId" TEXT,
    "leaseId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsInspection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PmsWorkOrder_companyId_status_idx" ON "PmsWorkOrder"("companyId", "status");
CREATE INDEX "PmsWorkOrder_companyId_priority_idx" ON "PmsWorkOrder"("companyId", "priority");
CREATE INDEX "PmsWorkOrder_propertyId_idx" ON "PmsWorkOrder"("propertyId");
CREATE INDEX "PmsWorkOrder_unitId_idx" ON "PmsWorkOrder"("unitId");
CREATE INDEX "PmsWorkOrder_tenantId_idx" ON "PmsWorkOrder"("tenantId");
CREATE INDEX "PmsWorkOrder_createdById_idx" ON "PmsWorkOrder"("createdById");
CREATE INDEX "PmsWorkOrder_updatedById_idx" ON "PmsWorkOrder"("updatedById");

CREATE INDEX "PmsCommunicationTemplate_companyId_active_idx" ON "PmsCommunicationTemplate"("companyId", "active");
CREATE INDEX "PmsCommunicationTemplate_companyId_channel_idx" ON "PmsCommunicationTemplate"("companyId", "channel");
CREATE INDEX "PmsCommunicationTemplate_createdById_idx" ON "PmsCommunicationTemplate"("createdById");
CREATE INDEX "PmsCommunicationTemplate_updatedById_idx" ON "PmsCommunicationTemplate"("updatedById");

CREATE INDEX "PmsPolicy_companyId_active_idx" ON "PmsPolicy"("companyId", "active");
CREATE INDEX "PmsPolicy_companyId_category_idx" ON "PmsPolicy"("companyId", "category");
CREATE INDEX "PmsPolicy_createdById_idx" ON "PmsPolicy"("createdById");
CREATE INDEX "PmsPolicy_updatedById_idx" ON "PmsPolicy"("updatedById");

CREATE INDEX "PmsInspection_companyId_status_idx" ON "PmsInspection"("companyId", "status");
CREATE INDEX "PmsInspection_propertyId_idx" ON "PmsInspection"("propertyId");
CREATE INDEX "PmsInspection_unitId_idx" ON "PmsInspection"("unitId");
CREATE INDEX "PmsInspection_tenantId_idx" ON "PmsInspection"("tenantId");
CREATE INDEX "PmsInspection_leaseId_idx" ON "PmsInspection"("leaseId");
CREATE INDEX "PmsInspection_createdById_idx" ON "PmsInspection"("createdById");
CREATE INDEX "PmsInspection_updatedById_idx" ON "PmsInspection"("updatedById");

ALTER TABLE "PmsWorkOrder" ADD CONSTRAINT "PmsWorkOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsWorkOrder" ADD CONSTRAINT "PmsWorkOrder_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsWorkOrder" ADD CONSTRAINT "PmsWorkOrder_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsWorkOrder" ADD CONSTRAINT "PmsWorkOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsWorkOrder" ADD CONSTRAINT "PmsWorkOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsWorkOrder" ADD CONSTRAINT "PmsWorkOrder_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsCommunicationTemplate" ADD CONSTRAINT "PmsCommunicationTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsCommunicationTemplate" ADD CONSTRAINT "PmsCommunicationTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsCommunicationTemplate" ADD CONSTRAINT "PmsCommunicationTemplate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsPolicy" ADD CONSTRAINT "PmsPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsPolicy" ADD CONSTRAINT "PmsPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsPolicy" ADD CONSTRAINT "PmsPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsInspection" ADD CONSTRAINT "PmsInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsInspection" ADD CONSTRAINT "PmsInspection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsInspection" ADD CONSTRAINT "PmsInspection_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspection" ADD CONSTRAINT "PmsInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspection" ADD CONSTRAINT "PmsInspection_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "PmsLease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspection" ADD CONSTRAINT "PmsInspection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsInspection" ADD CONSTRAINT "PmsInspection_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
