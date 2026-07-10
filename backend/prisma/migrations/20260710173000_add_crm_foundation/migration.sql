-- Stage 21C: company-aware CRM foundation shared by marketplace and PMS workspaces.

CREATE TYPE "CrmLeadStatus" AS ENUM (
  'NEW', 'CONTACTED', 'QUALIFIED', 'VIEWING_SCHEDULED', 'PROPOSAL_SENT',
  'NEGOTIATION', 'WON', 'LOST', 'ARCHIVED'
);

CREATE TYPE "CrmLeadPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TYPE "CrmLeadSource" AS ENUM (
  'LISTING_INQUIRY', 'PROJECT_INQUIRY', 'DEVELOPER_PROFILE',
  'TRAVEL_AGENCY_PROFILE', 'ACTIVITY_INQUIRY', 'ACTIVITY_BOOKING',
  'MAP_DISCOVERY', 'CONTACT_FORM', 'INVESTOR_WATCHLIST',
  'VALUATION_REQUEST', 'SAVED_SEARCH', 'PMS_OWNER', 'PMS_TENANT',
  'PMS_MAINTENANCE_VENDOR', 'MANUAL', 'ADMIN_CREATED'
);

CREATE TYPE "CrmActivityType" AS ENUM (
  'NOTE', 'TASK', 'CALL', 'EMAIL', 'MEETING', 'STATUS_CHANGE', 'ASSIGNMENT'
);

CREATE TYPE "CrmActivityStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

ALTER TYPE "PmsPermissionKey" ADD VALUE IF NOT EXISTS 'CRM_VIEW';
ALTER TYPE "PmsPermissionKey" ADD VALUE IF NOT EXISTS 'CRM_MANAGE';

CREATE TABLE "CrmContact" (
  "id" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "normalizedEmail" TEXT,
  "normalizedPhone" TEXT,
  "notes" TEXT,
  "companyId" TEXT,
  "ownerUserId" TEXT,
  "userId" TEXT,
  "pmsTenantId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmLead" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "CrmLeadStatus" NOT NULL DEFAULT 'NEW',
  "priority" "CrmLeadPriority" NOT NULL DEFAULT 'MEDIUM',
  "source" "CrmLeadSource" NOT NULL DEFAULT 'MANUAL',
  "sourceLabel" TEXT,
  "expectedValue" DECIMAL(14,3),
  "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
  "nextFollowUpAt" TIMESTAMP(3),
  "lostReason" TEXT,
  "archivedAt" TIMESTAMP(3),
  "contactId" TEXT NOT NULL,
  "companyId" TEXT,
  "ownerUserId" TEXT,
  "assignedToId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "inquiryId" TEXT,
  "bookingId" TEXT,
  "listingId" TEXT,
  "activityId" TEXT,
  "developerProjectId" TEXT,
  "valuationRequestId" TEXT,
  "savedSearchId" TEXT,
  "watchlistItemId" TEXT,
  "pmsTenantId" TEXT,
  "pmsPropertyId" TEXT,
  "pmsVendorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmActivity" (
  "id" TEXT NOT NULL,
  "type" "CrmActivityType" NOT NULL,
  "status" "CrmActivityStatus" NOT NULL DEFAULT 'OPEN',
  "subject" TEXT NOT NULL,
  "body" TEXT,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "leadId" TEXT NOT NULL,
  "createdById" TEXT,
  "assignedToId" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmLead_inquiryId_key" ON "CrmLead"("inquiryId");
CREATE UNIQUE INDEX "CrmLead_bookingId_key" ON "CrmLead"("bookingId");
CREATE UNIQUE INDEX "CrmLead_valuationRequestId_key" ON "CrmLead"("valuationRequestId");

CREATE INDEX "CrmContact_companyId_normalizedEmail_idx" ON "CrmContact"("companyId", "normalizedEmail");
CREATE INDEX "CrmContact_companyId_normalizedPhone_idx" ON "CrmContact"("companyId", "normalizedPhone");
CREATE INDEX "CrmContact_ownerUserId_normalizedEmail_idx" ON "CrmContact"("ownerUserId", "normalizedEmail");
CREATE INDEX "CrmContact_ownerUserId_normalizedPhone_idx" ON "CrmContact"("ownerUserId", "normalizedPhone");
CREATE INDEX "CrmContact_userId_idx" ON "CrmContact"("userId");
CREATE INDEX "CrmContact_pmsTenantId_idx" ON "CrmContact"("pmsTenantId");
CREATE INDEX "CrmContact_createdAt_idx" ON "CrmContact"("createdAt");

CREATE INDEX "CrmLead_companyId_status_updatedAt_idx" ON "CrmLead"("companyId", "status", "updatedAt");
CREATE INDEX "CrmLead_ownerUserId_status_updatedAt_idx" ON "CrmLead"("ownerUserId", "status", "updatedAt");
CREATE INDEX "CrmLead_assignedToId_status_nextFollowUpAt_idx" ON "CrmLead"("assignedToId", "status", "nextFollowUpAt");
CREATE INDEX "CrmLead_contactId_idx" ON "CrmLead"("contactId");
CREATE INDEX "CrmLead_source_idx" ON "CrmLead"("source");
CREATE INDEX "CrmLead_priority_idx" ON "CrmLead"("priority");
CREATE INDEX "CrmLead_createdAt_idx" ON "CrmLead"("createdAt");
CREATE INDEX "CrmLead_listingId_idx" ON "CrmLead"("listingId");
CREATE INDEX "CrmLead_activityId_idx" ON "CrmLead"("activityId");
CREATE INDEX "CrmLead_developerProjectId_idx" ON "CrmLead"("developerProjectId");
CREATE INDEX "CrmLead_savedSearchId_idx" ON "CrmLead"("savedSearchId");
CREATE INDEX "CrmLead_watchlistItemId_idx" ON "CrmLead"("watchlistItemId");
CREATE INDEX "CrmLead_pmsTenantId_idx" ON "CrmLead"("pmsTenantId");
CREATE INDEX "CrmLead_pmsPropertyId_idx" ON "CrmLead"("pmsPropertyId");
CREATE INDEX "CrmLead_pmsVendorId_idx" ON "CrmLead"("pmsVendorId");

CREATE INDEX "CrmActivity_leadId_createdAt_idx" ON "CrmActivity"("leadId", "createdAt");
CREATE INDEX "CrmActivity_leadId_status_dueAt_idx" ON "CrmActivity"("leadId", "status", "dueAt");
CREATE INDEX "CrmActivity_assignedToId_status_dueAt_idx" ON "CrmActivity"("assignedToId", "status", "dueAt");
CREATE INDEX "CrmActivity_type_idx" ON "CrmActivity"("type");

ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_pmsTenantId_fkey" FOREIGN KEY ("pmsTenantId") REFERENCES "PmsTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_developerProjectId_fkey" FOREIGN KEY ("developerProjectId") REFERENCES "DeveloperProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_valuationRequestId_fkey" FOREIGN KEY ("valuationRequestId") REFERENCES "ValuationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_watchlistItemId_fkey" FOREIGN KEY ("watchlistItemId") REFERENCES "InvestorWatchlistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_pmsTenantId_fkey" FOREIGN KEY ("pmsTenantId") REFERENCES "PmsTenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_pmsPropertyId_fkey" FOREIGN KEY ("pmsPropertyId") REFERENCES "PmsProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_pmsVendorId_fkey" FOREIGN KEY ("pmsVendorId") REFERENCES "PmsVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
