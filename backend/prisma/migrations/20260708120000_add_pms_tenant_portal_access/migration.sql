-- Stage 12: tenant-facing PMS portal access foundation.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PMS_MAINTENANCE_REQUEST_CREATED';

CREATE TABLE "PmsTenantPortalAccess" (
    "id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "companyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmsTenantPortalAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PmsTenantPortalAccess_tenantId_userId_key" ON "PmsTenantPortalAccess"("tenantId", "userId");
CREATE INDEX "PmsTenantPortalAccess_companyId_active_idx" ON "PmsTenantPortalAccess"("companyId", "active");
CREATE INDEX "PmsTenantPortalAccess_tenantId_active_idx" ON "PmsTenantPortalAccess"("tenantId", "active");
CREATE INDEX "PmsTenantPortalAccess_userId_active_idx" ON "PmsTenantPortalAccess"("userId", "active");
CREATE INDEX "PmsTenantPortalAccess_createdById_idx" ON "PmsTenantPortalAccess"("createdById");

ALTER TABLE "PmsTenantPortalAccess" ADD CONSTRAINT "PmsTenantPortalAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsTenantPortalAccess" ADD CONSTRAINT "PmsTenantPortalAccess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "PmsTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsTenantPortalAccess" ADD CONSTRAINT "PmsTenantPortalAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PmsTenantPortalAccess" ADD CONSTRAINT "PmsTenantPortalAccess_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
