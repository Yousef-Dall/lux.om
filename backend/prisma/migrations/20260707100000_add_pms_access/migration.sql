-- Stage 10A: company-scoped PMS entitlement and staff access foundation.

ALTER TYPE "AccountSecurityEventType" ADD VALUE IF NOT EXISTS 'ADMIN_PMS_ACCESS_UPDATED';

CREATE TYPE "PmsEntitlementStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'EXPIRED');

CREATE TYPE "PmsMemberRole" AS ENUM (
  'PMS_OWNER',
  'PMS_MANAGER',
  'PMS_ACCOUNTANT',
  'PMS_MAINTENANCE',
  'PMS_AGENT',
  'PMS_VIEWER'
);

CREATE TABLE "PmsCompanyEntitlement" (
  "id" TEXT NOT NULL,
  "status" "PmsEntitlementStatus" NOT NULL DEFAULT 'TRIAL',
  "notes" TEXT,
  "enabledAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "companyId" TEXT NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PmsCompanyEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsCompanyMember" (
  "id" TEXT NOT NULL,
  "role" "PmsMemberRole" NOT NULL DEFAULT 'PMS_VIEWER',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "invitedEmail" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PmsCompanyMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PmsCompanyEntitlement_companyId_key" ON "PmsCompanyEntitlement"("companyId");
CREATE INDEX "PmsCompanyEntitlement_status_idx" ON "PmsCompanyEntitlement"("status");
CREATE INDEX "PmsCompanyEntitlement_createdById_idx" ON "PmsCompanyEntitlement"("createdById");
CREATE INDEX "PmsCompanyEntitlement_updatedById_idx" ON "PmsCompanyEntitlement"("updatedById");

CREATE UNIQUE INDEX "PmsCompanyMember_companyId_userId_key" ON "PmsCompanyMember"("companyId", "userId");
CREATE INDEX "PmsCompanyMember_companyId_active_idx" ON "PmsCompanyMember"("companyId", "active");
CREATE INDEX "PmsCompanyMember_userId_active_idx" ON "PmsCompanyMember"("userId", "active");
CREATE INDEX "PmsCompanyMember_role_idx" ON "PmsCompanyMember"("role");
CREATE INDEX "PmsCompanyMember_createdById_idx" ON "PmsCompanyMember"("createdById");

ALTER TABLE "PmsCompanyEntitlement"
  ADD CONSTRAINT "PmsCompanyEntitlement_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PmsCompanyEntitlement"
  ADD CONSTRAINT "PmsCompanyEntitlement_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsCompanyEntitlement"
  ADD CONSTRAINT "PmsCompanyEntitlement_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsCompanyMember"
  ADD CONSTRAINT "PmsCompanyMember_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PmsCompanyMember"
  ADD CONSTRAINT "PmsCompanyMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PmsCompanyMember"
  ADD CONSTRAINT "PmsCompanyMember_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
