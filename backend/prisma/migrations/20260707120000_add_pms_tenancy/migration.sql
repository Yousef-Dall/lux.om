-- Stage 10C: private PMS tenants, leases, and rent due lifecycle.

CREATE TYPE "PmsLeaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRING', 'ENDED', 'TERMINATED');
CREATE TYPE "PmsRentDueStatus" AS ENUM ('UNPAID', 'DUE_SOON', 'OVERDUE', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

CREATE TABLE "PmsTenant" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "nationality" TEXT,
    "nationalId" TEXT,
    "passportNumber" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactEmail" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsTenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsLease" (
    "id" TEXT NOT NULL,
    "status" "PmsLeaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "rentFrequency" "PaymentScheduleFrequency" NOT NULL DEFAULT 'MONTHLY',
    "rentAmount" DECIMAL(12,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "securityDeposit" DECIMAL(12,3),
    "dueDayOfMonth" INTEGER,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "contractDraftId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsLease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsRentDueItem" (
    "id" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "amount" DECIMAL(12,3) NOT NULL,
    "paidAmount" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "status" "PmsRentDueStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsRentDueItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PmsTenant_companyId_active_idx" ON "PmsTenant"("companyId", "active");
CREATE INDEX "PmsTenant_companyId_fullName_idx" ON "PmsTenant"("companyId", "fullName");
CREATE INDEX "PmsTenant_companyId_email_idx" ON "PmsTenant"("companyId", "email");
CREATE INDEX "PmsTenant_companyId_phone_idx" ON "PmsTenant"("companyId", "phone");
CREATE INDEX "PmsTenant_createdById_idx" ON "PmsTenant"("createdById");
CREATE INDEX "PmsTenant_updatedById_idx" ON "PmsTenant"("updatedById");

CREATE INDEX "PmsLease_companyId_status_idx" ON "PmsLease"("companyId", "status");
CREATE INDEX "PmsLease_tenantId_idx" ON "PmsLease"("tenantId");
CREATE INDEX "PmsLease_propertyId_idx" ON "PmsLease"("propertyId");
CREATE INDEX "PmsLease_unitId_idx" ON "PmsLease"("unitId");
CREATE INDEX "PmsLease_contractDraftId_idx" ON "PmsLease"("contractDraftId");
CREATE INDEX "PmsLease_startDate_idx" ON "PmsLease"("startDate");
CREATE INDEX "PmsLease_endDate_idx" ON "PmsLease"("endDate");
CREATE INDEX "PmsLease_createdById_idx" ON "PmsLease"("createdById");
CREATE INDEX "PmsLease_updatedById_idx" ON "PmsLease"("updatedById");

CREATE UNIQUE INDEX "PmsRentDueItem_leaseId_dueDate_key" ON "PmsRentDueItem"("leaseId", "dueDate");
CREATE INDEX "PmsRentDueItem_companyId_status_idx" ON "PmsRentDueItem"("companyId", "status");
CREATE INDEX "PmsRentDueItem_companyId_dueDate_idx" ON "PmsRentDueItem"("companyId", "dueDate");
CREATE INDEX "PmsRentDueItem_leaseId_idx" ON "PmsRentDueItem"("leaseId");
CREATE INDEX "PmsRentDueItem_tenantId_idx" ON "PmsRentDueItem"("tenantId");
CREATE INDEX "PmsRentDueItem_propertyId_idx" ON "PmsRentDueItem"("propertyId");
CREATE INDEX "PmsRentDueItem_unitId_idx" ON "PmsRentDueItem"("unitId");
CREATE INDEX "PmsRentDueItem_createdById_idx" ON "PmsRentDueItem"("createdById");
CREATE INDEX "PmsRentDueItem_updatedById_idx" ON "PmsRentDueItem"("updatedById");

ALTER TABLE "PmsTenant" ADD CONSTRAINT "PmsTenant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsTenant" ADD CONSTRAINT "PmsTenant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsTenant" ADD CONSTRAINT "PmsTenant_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsLease" ADD CONSTRAINT "PmsLease_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsLease" ADD CONSTRAINT "PmsLease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsLease" ADD CONSTRAINT "PmsLease_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsLease" ADD CONSTRAINT "PmsLease_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsLease" ADD CONSTRAINT "PmsLease_contractDraftId_fkey" FOREIGN KEY ("contractDraftId") REFERENCES "RentalContractDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsLease" ADD CONSTRAINT "PmsLease_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsLease" ADD CONSTRAINT "PmsLease_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsRentDueItem" ADD CONSTRAINT "PmsRentDueItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsRentDueItem" ADD CONSTRAINT "PmsRentDueItem_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "PmsLease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsRentDueItem" ADD CONSTRAINT "PmsRentDueItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsRentDueItem" ADD CONSTRAINT "PmsRentDueItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsRentDueItem" ADD CONSTRAINT "PmsRentDueItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "PmsUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsRentDueItem" ADD CONSTRAINT "PmsRentDueItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsRentDueItem" ADD CONSTRAINT "PmsRentDueItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
