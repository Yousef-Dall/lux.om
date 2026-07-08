-- PMS Stage 19: advanced permissions and property-scoped workspace controls.

CREATE TYPE "PmsPermissionKey" AS ENUM (
  'INVENTORY_VIEW',
  'INVENTORY_MANAGE',
  'TENANCY_VIEW',
  'TENANCY_MANAGE',
  'RENT_VIEW',
  'RENT_MANAGE',
  'ACCOUNTING_VIEW',
  'ACCOUNTING_MANAGE',
  'MAINTENANCE_VIEW',
  'MAINTENANCE_MANAGE',
  'REPORTS_VIEW',
  'SETTINGS_MANAGE',
  'COMMUNICATIONS_SEND',
  'DOCUMENTS_VIEW',
  'DOCUMENTS_MANAGE',
  'STAFF_MANAGE',
  'IMPORT_EXPORT'
);

CREATE TABLE "PmsPortfolio" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "companyId" TEXT NOT NULL,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PmsPortfolio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsPortfolioProperty" (
  "companyId" TEXT NOT NULL,
  "portfolioId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PmsPortfolioProperty_pkey" PRIMARY KEY ("portfolioId", "propertyId")
);

CREATE TABLE "PmsMemberPropertyAccess" (
  "id" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "companyId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PmsMemberPropertyAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PmsMemberPermission" (
  "id" TEXT NOT NULL,
  "key" "PmsPermissionKey" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "companyId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PmsMemberPermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PmsPortfolio_companyId_name_key" ON "PmsPortfolio"("companyId", "name");
CREATE INDEX "PmsPortfolio_companyId_active_idx" ON "PmsPortfolio"("companyId", "active");
CREATE INDEX "PmsPortfolio_createdById_idx" ON "PmsPortfolio"("createdById");
CREATE INDEX "PmsPortfolio_updatedById_idx" ON "PmsPortfolio"("updatedById");

CREATE INDEX "PmsPortfolioProperty_companyId_idx" ON "PmsPortfolioProperty"("companyId");
CREATE INDEX "PmsPortfolioProperty_propertyId_idx" ON "PmsPortfolioProperty"("propertyId");

CREATE UNIQUE INDEX "PmsMemberPropertyAccess_memberId_propertyId_key" ON "PmsMemberPropertyAccess"("memberId", "propertyId");
CREATE INDEX "PmsMemberPropertyAccess_companyId_active_idx" ON "PmsMemberPropertyAccess"("companyId", "active");
CREATE INDEX "PmsMemberPropertyAccess_memberId_active_idx" ON "PmsMemberPropertyAccess"("memberId", "active");
CREATE INDEX "PmsMemberPropertyAccess_propertyId_active_idx" ON "PmsMemberPropertyAccess"("propertyId", "active");

CREATE UNIQUE INDEX "PmsMemberPermission_memberId_key_key" ON "PmsMemberPermission"("memberId", "key");
CREATE INDEX "PmsMemberPermission_companyId_active_idx" ON "PmsMemberPermission"("companyId", "active");
CREATE INDEX "PmsMemberPermission_memberId_active_idx" ON "PmsMemberPermission"("memberId", "active");
CREATE INDEX "PmsMemberPermission_key_idx" ON "PmsMemberPermission"("key");

ALTER TABLE "PmsPortfolio" ADD CONSTRAINT "PmsPortfolio_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsPortfolio" ADD CONSTRAINT "PmsPortfolio_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PmsPortfolio" ADD CONSTRAINT "PmsPortfolio_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PmsPortfolioProperty" ADD CONSTRAINT "PmsPortfolioProperty_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsPortfolioProperty" ADD CONSTRAINT "PmsPortfolioProperty_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "PmsPortfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsPortfolioProperty" ADD CONSTRAINT "PmsPortfolioProperty_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PmsMemberPropertyAccess" ADD CONSTRAINT "PmsMemberPropertyAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsMemberPropertyAccess" ADD CONSTRAINT "PmsMemberPropertyAccess_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "PmsCompanyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsMemberPropertyAccess" ADD CONSTRAINT "PmsMemberPropertyAccess_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PmsMemberPermission" ADD CONSTRAINT "PmsMemberPermission_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsMemberPermission" ADD CONSTRAINT "PmsMemberPermission_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "PmsCompanyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
