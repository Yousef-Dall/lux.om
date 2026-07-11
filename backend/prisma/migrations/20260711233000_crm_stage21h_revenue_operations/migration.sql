-- Stage 21H: CRM accounts, configurable pipelines, durable scoring, governed ingestion and communications.
-- Additive migration. Existing Stage 21C/21D lead status and activity history remain intact.

CREATE TYPE "CrmAccountType" AS ENUM ('INDIVIDUAL','COMPANY','DEVELOPER','TRAVEL_AGENCY','ACTIVITY_PROVIDER','PROPERTY_OWNER','INVESTOR','VENDOR','TENANT_ORGANIZATION','GOVERNMENT','INSTITUTIONAL_PARTNER','OTHER');
CREATE TYPE "CrmDealOutcome" AS ENUM ('OPEN','WON','LOST');
CREATE TYPE "CrmForecastCategory" AS ENUM ('PIPELINE','BEST_CASE','COMMIT','CLOSED','OMITTED');
CREATE TYPE "CrmPipelineStageType" AS ENUM ('OPEN','WON','LOST');
CREATE TYPE "CrmScoreBand" AS ENUM ('COLD','WARM','HOT');
CREATE TYPE "CrmScoreTrend" AS ENUM ('RISING','STABLE','FALLING');
CREATE TYPE "CrmContactIdentityType" AS ENUM ('EMAIL','PHONE');
CREATE TYPE "CrmContactMergeStatus" AS ENUM ('PREVIEWED','COMPLETED','CANCELLED');
CREATE TYPE "CrmSourceEventType" AS ENUM ('LISTING_INQUIRY','PROJECT_INQUIRY','DEVELOPER_PROFILE_INQUIRY','TRAVEL_AGENCY_INQUIRY','ACTIVITY_INQUIRY','BOOKING_APPROVED','BOOKING_CONFIRMED','BOOKING_PAID','VALUATION_REQUEST','INVESTOR_WATCHLIST','HIGH_INTENT_SAVED_SEARCH','PMS_OWNER_ONBOARDING','PMS_TENANT_ONBOARDING','PMS_VENDOR_ONBOARDING','MANUAL');
CREATE TYPE "CrmContactConsentStatus" AS ENUM ('UNKNOWN','CONSENTED','LEGITIMATE_INTEREST','OPTED_OUT','BLOCKED');
CREATE TYPE "CrmCommunicationChannel" AS ENUM ('EMAIL','WHATSAPP','PHONE');
CREATE TYPE "CrmSuppressionReason" AS ENUM ('OPT_OUT','BOUNCE','COMPLAINT','INVALID_DESTINATION','MANUAL','LEGAL');
CREATE TYPE "CrmDeliveryProvider" AS ENUM ('DRAFT_ONLY','VERIFIED_EMAIL','WHATSAPP_BUSINESS');
CREATE TYPE "CrmDeliveryStatus" AS ENUM ('DRAFT','QUEUED','PROCESSING','SUBMITTED','DELIVERED','FAILED','BOUNCED','BLOCKED','CANCELLED');

ALTER TABLE "CrmContact"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "accountId" TEXT,
  ADD COLUMN "mergedIntoContactId" TEXT;

ALTER TABLE "CrmLead"
  ADD COLUMN "pipelineId" TEXT,
  ADD COLUMN "stageId" TEXT,
  ADD COLUMN "outcome" "CrmDealOutcome" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "wonAt" TIMESTAMP(3),
  ADD COLUMN "lostAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "reopenedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "convertedAccountId" TEXT,
  ADD COLUMN "convertedDealId" TEXT,
  ADD COLUMN "convertedAt" TIMESTAMP(3),
  ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scoreBand" "CrmScoreBand" NOT NULL DEFAULT 'COLD',
  ADD COLUMN "scoringVersion" TEXT NOT NULL DEFAULT 'crm-deterministic-v1',
  ADD COLUMN "scoreCalculatedAt" TIMESTAMP(3);

ALTER TABLE "CrmActivity" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "CrmActivity"
  ADD COLUMN "accountId" TEXT,
  ADD COLUMN "dealId" TEXT,
  ADD COLUMN "contactId" TEXT;

CREATE TABLE "CrmAccount" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "type" "CrmAccountType" NOT NULL DEFAULT 'INDIVIDUAL',
  "name" TEXT NOT NULL,
  "legalName" TEXT,
  "registrationNumber" TEXT,
  "taxNumber" TEXT,
  "website" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "industry" TEXT,
  "notes" TEXT,
  "archivedAt" TIMESTAMP(3),
  "pmsPropertyId" TEXT,
  "parentAccountId" TEXT,
  "ownerUserId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmAccountTeamMember" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmAccountTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmPipeline" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmPipeline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmPipelineStage" (
  "id" TEXT NOT NULL,
  "pipelineId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "type" "CrmPipelineStageType" NOT NULL DEFAULT 'OPEN',
  "defaultProbability" INTEGER NOT NULL DEFAULT 10,
  "requiredFields" JSONB,
  "slaHours" INTEGER,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmPipelineStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmDeal" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "accountId" TEXT NOT NULL,
  "primaryContactId" TEXT,
  "sourceLeadId" TEXT,
  "pipelineId" TEXT NOT NULL,
  "stageId" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "expectedValue" DECIMAL(14,3),
  "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
  "probability" INTEGER NOT NULL DEFAULT 10,
  "forecastCategory" "CrmForecastCategory" NOT NULL DEFAULT 'PIPELINE',
  "expectedCloseDate" TIMESTAMP(3),
  "outcome" "CrmDealOutcome" NOT NULL DEFAULT 'OPEN',
  "wonAt" TIMESTAMP(3),
  "lostAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "lostReason" TEXT,
  "wonReason" TEXT,
  "reopenedCount" INTEGER NOT NULL DEFAULT 0,
  "pmsPropertyId" TEXT,
  "sourceType" "CrmSourceEventType",
  "sourceRecordId" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmDeal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmDealTeamMember" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmDealTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmStageHistory" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "pipelineId" TEXT NOT NULL,
  "fromStageId" TEXT,
  "toStageId" TEXT NOT NULL,
  "fromOutcome" "CrmDealOutcome" NOT NULL,
  "toOutcome" "CrmDealOutcome" NOT NULL,
  "reason" TEXT,
  "reopened" BOOLEAN NOT NULL DEFAULT false,
  "changedById" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmStageHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmScoreSnapshot" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "leadId" TEXT,
  "dealId" TEXT,
  "score" INTEGER NOT NULL,
  "band" "CrmScoreBand" NOT NULL,
  "version" TEXT NOT NULL,
  "reasons" JSONB NOT NULL,
  "signals" JSONB NOT NULL,
  "previousScore" INTEGER,
  "trend" "CrmScoreTrend" NOT NULL DEFAULT 'STABLE',
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "jobKey" TEXT,
  CONSTRAINT "CrmScoreSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmContactIdentity" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "type" "CrmContactIdentityType" NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "rawValue" TEXT NOT NULL,
  "primary" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmContactIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmContactMerge" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "primaryContactId" TEXT NOT NULL,
  "duplicateContactId" TEXT NOT NULL,
  "status" "CrmContactMergeStatus" NOT NULL DEFAULT 'PREVIEWED',
  "preview" JSONB NOT NULL,
  "conflicts" JSONB NOT NULL,
  "mergedAt" TIMESTAMP(3),
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmContactMerge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmSourceEvent" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "type" "CrmSourceEventType" NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "ruleKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "consentStatus" "CrmContactConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "contactId" TEXT,
  "leadId" TEXT,
  "accountId" TEXT,
  "dealId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmSourceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmContactChannelPreference" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "channel" "CrmCommunicationChannel" NOT NULL,
  "status" "CrmContactConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "lawfulBasis" TEXT,
  "preferred" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursStart" INTEGER,
  "quietHoursEnd" INTEGER,
  "timezone" TEXT,
  "optedOutAt" TIMESTAMP(3),
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmContactChannelPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmSuppressionEntry" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "channel" "CrmCommunicationChannel" NOT NULL,
  "normalizedDestination" TEXT NOT NULL,
  "reason" "CrmSuppressionReason" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "source" TEXT,
  "notes" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmSuppressionEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmCommunicationTemplate" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "channel" "CrmCommunicationChannel" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmCommunicationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmCommunicationTemplateVersion" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmCommunicationTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmWorkspaceCommunicationPolicy" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Muscat',
  "quietHoursStart" INTEGER NOT NULL DEFAULT 1200,
  "quietHoursEnd" INTEGER NOT NULL DEFAULT 480,
  "hourlyRateLimit" INTEGER NOT NULL DEFAULT 50,
  "retentionDays" INTEGER NOT NULL DEFAULT 365,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrmWorkspaceCommunicationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmDeliveryAttempt" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "leadId" TEXT,
  "dealId" TEXT,
  "activityId" TEXT,
  "templateVersionId" TEXT,
  "channel" "CrmCommunicationChannel" NOT NULL,
  "provider" "CrmDeliveryProvider" NOT NULL,
  "status" "CrmDeliveryStatus" NOT NULL DEFAULT 'DRAFT',
  "destination" TEXT NOT NULL,
  "normalizedDestination" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "claimToken" TEXT,
  "submittedAt" TIMESTAMP(3),
  "providerConfirmedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "bouncedAt" TIMESTAMP(3),
  "blockedAt" TIMESTAMP(3),
  "createdById" TEXT,
  CONSTRAINT "CrmDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- Domain checks keep configurable CRM data within safe financial and scheduling bounds.
ALTER TABLE "CrmPipelineStage" ADD CONSTRAINT "CrmPipelineStage_defaultProbability_check" CHECK ("defaultProbability" BETWEEN 0 AND 100);
ALTER TABLE "CrmPipelineStage" ADD CONSTRAINT "CrmPipelineStage_position_check" CHECK ("position" > 0);
ALTER TABLE "CrmPipelineStage" ADD CONSTRAINT "CrmPipelineStage_slaHours_check" CHECK ("slaHours" IS NULL OR "slaHours" > 0);
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_probability_check" CHECK ("probability" BETWEEN 0 AND 100);
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_expectedValue_check" CHECK ("expectedValue" IS NULL OR "expectedValue" >= 0);
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');
ALTER TABLE "CrmScoreSnapshot" ADD CONSTRAINT "CrmScoreSnapshot_score_check" CHECK ("score" BETWEEN 0 AND 100);
ALTER TABLE "CrmScoreSnapshot" ADD CONSTRAINT "CrmScoreSnapshot_target_check" CHECK (num_nonnulls("leadId", "dealId") = 1);
ALTER TABLE "CrmContactChannelPreference" ADD CONSTRAINT "CrmContactChannelPreference_quietHoursStart_check" CHECK ("quietHoursStart" IS NULL OR "quietHoursStart" BETWEEN 0 AND 1439);
ALTER TABLE "CrmContactChannelPreference" ADD CONSTRAINT "CrmContactChannelPreference_quietHoursEnd_check" CHECK ("quietHoursEnd" IS NULL OR "quietHoursEnd" BETWEEN 0 AND 1439);
ALTER TABLE "CrmWorkspaceCommunicationPolicy" ADD CONSTRAINT "CrmWorkspaceCommunicationPolicy_quietHoursStart_check" CHECK ("quietHoursStart" BETWEEN 0 AND 1439);
ALTER TABLE "CrmWorkspaceCommunicationPolicy" ADD CONSTRAINT "CrmWorkspaceCommunicationPolicy_quietHoursEnd_check" CHECK ("quietHoursEnd" BETWEEN 0 AND 1439);
ALTER TABLE "CrmWorkspaceCommunicationPolicy" ADD CONSTRAINT "CrmWorkspaceCommunicationPolicy_hourlyRateLimit_check" CHECK ("hourlyRateLimit" BETWEEN 1 AND 1000);
ALTER TABLE "CrmWorkspaceCommunicationPolicy" ADD CONSTRAINT "CrmWorkspaceCommunicationPolicy_retentionDays_check" CHECK ("retentionDays" BETWEEN 30 AND 3650);
ALTER TABLE "CrmDeliveryAttempt" ADD CONSTRAINT "CrmDeliveryAttempt_processingClaim_check" CHECK (("status" = 'PROCESSING' AND "claimedAt" IS NOT NULL AND "claimToken" IS NOT NULL) OR ("status" <> 'PROCESSING' AND "claimedAt" IS NULL AND "claimToken" IS NULL));

-- Unique constraints and indexes.
CREATE UNIQUE INDEX "CrmAccountTeamMember_accountId_userId_key" ON "CrmAccountTeamMember"("accountId","userId");
CREATE UNIQUE INDEX "CrmPipeline_workspaceId_name_key" ON "CrmPipeline"("workspaceId","name");
CREATE UNIQUE INDEX "CrmPipelineStage_pipelineId_key_key" ON "CrmPipelineStage"("pipelineId","key");
CREATE UNIQUE INDEX "CrmPipelineStage_pipelineId_position_key" ON "CrmPipelineStage"("pipelineId","position");
CREATE UNIQUE INDEX "CrmDeal_sourceLeadId_key" ON "CrmDeal"("sourceLeadId");
CREATE UNIQUE INDEX "CrmDealTeamMember_dealId_userId_key" ON "CrmDealTeamMember"("dealId","userId");
CREATE UNIQUE INDEX "CrmContactIdentity_workspaceId_type_normalizedValue_key" ON "CrmContactIdentity"("workspaceId","type","normalizedValue");
CREATE UNIQUE INDEX "CrmSourceEvent_workspaceId_type_sourceRecordId_ruleKey_key" ON "CrmSourceEvent"("workspaceId","type","sourceRecordId","ruleKey");
CREATE UNIQUE INDEX "CrmContactChannelPreference_contactId_channel_key" ON "CrmContactChannelPreference"("contactId","channel");
CREATE UNIQUE INDEX "CrmSuppressionEntry_workspaceId_channel_normalizedDestination_key" ON "CrmSuppressionEntry"("workspaceId","channel","normalizedDestination");
CREATE UNIQUE INDEX "CrmCommunicationTemplate_workspaceId_key_key" ON "CrmCommunicationTemplate"("workspaceId","key");
CREATE UNIQUE INDEX "CrmCommunicationTemplateVersion_templateId_version_key" ON "CrmCommunicationTemplateVersion"("templateId","version");
CREATE UNIQUE INDEX "CrmWorkspaceCommunicationPolicy_workspaceId_key" ON "CrmWorkspaceCommunicationPolicy"("workspaceId");
CREATE UNIQUE INDEX "CrmDeliveryAttempt_workspaceId_idempotencyKey_key" ON "CrmDeliveryAttempt"("workspaceId","idempotencyKey");
CREATE UNIQUE INDEX "CrmLead_convertedDealId_key" ON "CrmLead"("convertedDealId");

CREATE INDEX "CrmAccount_workspaceId_name_idx" ON "CrmAccount"("workspaceId","name");
CREATE INDEX "CrmAccount_workspaceId_type_archivedAt_idx" ON "CrmAccount"("workspaceId","type","archivedAt");
CREATE INDEX "CrmAccount_ownerUserId_idx" ON "CrmAccount"("ownerUserId");
CREATE INDEX "CrmAccount_parentAccountId_idx" ON "CrmAccount"("parentAccountId");
CREATE INDEX "CrmAccount_pmsPropertyId_idx" ON "CrmAccount"("pmsPropertyId");
CREATE INDEX "CrmAccountTeamMember_userId_active_idx" ON "CrmAccountTeamMember"("userId","active");
CREATE INDEX "CrmPipeline_workspaceId_isDefault_active_idx" ON "CrmPipeline"("workspaceId","isDefault","active");
CREATE INDEX "CrmPipelineStage_pipelineId_type_active_idx" ON "CrmPipelineStage"("pipelineId","type","active");
CREATE INDEX "CrmDeal_workspaceId_pipelineId_stageId_outcome_idx" ON "CrmDeal"("workspaceId","pipelineId","stageId","outcome");
CREATE INDEX "CrmDeal_workspaceId_ownerUserId_expectedCloseDate_idx" ON "CrmDeal"("workspaceId","ownerUserId","expectedCloseDate");
CREATE INDEX "CrmDeal_workspaceId_currency_outcome_idx" ON "CrmDeal"("workspaceId","currency","outcome");
CREATE INDEX "CrmDeal_accountId_idx" ON "CrmDeal"("accountId");
CREATE INDEX "CrmDeal_primaryContactId_idx" ON "CrmDeal"("primaryContactId");
CREATE INDEX "CrmDeal_pmsPropertyId_idx" ON "CrmDeal"("pmsPropertyId");
CREATE INDEX "CrmDealTeamMember_userId_active_idx" ON "CrmDealTeamMember"("userId","active");
CREATE INDEX "CrmStageHistory_dealId_changedAt_idx" ON "CrmStageHistory"("dealId","changedAt");
CREATE INDEX "CrmStageHistory_workspaceId_changedAt_idx" ON "CrmStageHistory"("workspaceId","changedAt");
CREATE UNIQUE INDEX "CrmScoreSnapshot_leadId_jobKey_key" ON "CrmScoreSnapshot"("leadId","jobKey");
CREATE INDEX "CrmScoreSnapshot_workspaceId_band_score_idx" ON "CrmScoreSnapshot"("workspaceId","band","score");
CREATE INDEX "CrmScoreSnapshot_leadId_calculatedAt_idx" ON "CrmScoreSnapshot"("leadId","calculatedAt");
CREATE INDEX "CrmScoreSnapshot_dealId_calculatedAt_idx" ON "CrmScoreSnapshot"("dealId","calculatedAt");
CREATE INDEX "CrmScoreSnapshot_version_calculatedAt_idx" ON "CrmScoreSnapshot"("version","calculatedAt");
CREATE INDEX "CrmContactIdentity_contactId_active_idx" ON "CrmContactIdentity"("contactId","active");
CREATE INDEX "CrmContactMerge_workspaceId_status_createdAt_idx" ON "CrmContactMerge"("workspaceId","status","createdAt");
CREATE INDEX "CrmContactMerge_primaryContactId_idx" ON "CrmContactMerge"("primaryContactId");
CREATE INDEX "CrmContactMerge_duplicateContactId_idx" ON "CrmContactMerge"("duplicateContactId");
CREATE INDEX "CrmSourceEvent_workspaceId_type_occurredAt_idx" ON "CrmSourceEvent"("workspaceId","type","occurredAt");
CREATE INDEX "CrmSourceEvent_contactId_idx" ON "CrmSourceEvent"("contactId");
CREATE INDEX "CrmSourceEvent_leadId_idx" ON "CrmSourceEvent"("leadId");
CREATE INDEX "CrmContactChannelPreference_workspaceId_status_channel_idx" ON "CrmContactChannelPreference"("workspaceId","status","channel");
CREATE INDEX "CrmSuppressionEntry_workspaceId_active_channel_idx" ON "CrmSuppressionEntry"("workspaceId","active","channel");
CREATE INDEX "CrmSuppressionEntry_expiresAt_idx" ON "CrmSuppressionEntry"("expiresAt");
CREATE INDEX "CrmCommunicationTemplate_workspaceId_channel_active_idx" ON "CrmCommunicationTemplate"("workspaceId","channel","active");
CREATE INDEX "CrmCommunicationTemplateVersion_templateId_active_version_idx" ON "CrmCommunicationTemplateVersion"("templateId","active","version");
CREATE INDEX "CrmDeliveryAttempt_workspaceId_status_attemptedAt_idx" ON "CrmDeliveryAttempt"("workspaceId","status","attemptedAt");
CREATE INDEX "CrmDeliveryAttempt_contactId_attemptedAt_idx" ON "CrmDeliveryAttempt"("contactId","attemptedAt");
CREATE INDEX "CrmDeliveryAttempt_provider_providerMessageId_idx" ON "CrmDeliveryAttempt"("provider","providerMessageId");
CREATE INDEX "CrmContact_workspaceId_accountId_createdAt_idx" ON "CrmContact"("workspaceId","accountId","createdAt");
CREATE INDEX "CrmContact_workspaceId_archivedAt_idx" ON "CrmContact"("workspaceId","archivedAt");
CREATE INDEX "CrmLead_workspaceId_pipelineId_stageId_outcome_idx" ON "CrmLead"("workspaceId","pipelineId","stageId","outcome");
CREATE INDEX "CrmLead_workspaceId_scoreBand_score_idx" ON "CrmLead"("workspaceId","scoreBand","score");
CREATE INDEX "CrmLead_convertedAccountId_idx" ON "CrmLead"("convertedAccountId");
CREATE INDEX "CrmActivity_accountId_createdAt_idx" ON "CrmActivity"("accountId","createdAt");
CREATE INDEX "CrmActivity_dealId_createdAt_idx" ON "CrmActivity"("dealId","createdAt");
CREATE INDEX "CrmActivity_contactId_createdAt_idx" ON "CrmActivity"("contactId","createdAt");

-- Foreign keys.
ALTER TABLE "CrmAccount" ADD CONSTRAINT "CrmAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmAccount" ADD CONSTRAINT "CrmAccount_parentAccountId_fkey" FOREIGN KEY ("parentAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmAccount" ADD CONSTRAINT "CrmAccount_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmAccountTeamMember" ADD CONSTRAINT "CrmAccountTeamMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmAccountTeamMember" ADD CONSTRAINT "CrmAccountTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmPipeline" ADD CONSTRAINT "CrmPipeline_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmPipelineStage" ADD CONSTRAINT "CrmPipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "CrmPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "CrmPipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "CrmPipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmDeal" ADD CONSTRAINT "CrmDeal_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmDealTeamMember" ADD CONSTRAINT "CrmDealTeamMember_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmDealTeamMember" ADD CONSTRAINT "CrmDealTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmStageHistory" ADD CONSTRAINT "CrmStageHistory_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmStageHistory" ADD CONSTRAINT "CrmStageHistory_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmStageHistory" ADD CONSTRAINT "CrmStageHistory_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "CrmPipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmStageHistory" ADD CONSTRAINT "CrmStageHistory_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "CrmPipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmStageHistory" ADD CONSTRAINT "CrmStageHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmScoreSnapshot" ADD CONSTRAINT "CrmScoreSnapshot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmScoreSnapshot" ADD CONSTRAINT "CrmScoreSnapshot_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmScoreSnapshot" ADD CONSTRAINT "CrmScoreSnapshot_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmContactIdentity" ADD CONSTRAINT "CrmContactIdentity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmContactIdentity" ADD CONSTRAINT "CrmContactIdentity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmContactMerge" ADD CONSTRAINT "CrmContactMerge_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmContactMerge" ADD CONSTRAINT "CrmContactMerge_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "CrmContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmContactMerge" ADD CONSTRAINT "CrmContactMerge_duplicateContactId_fkey" FOREIGN KEY ("duplicateContactId") REFERENCES "CrmContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmSourceEvent" ADD CONSTRAINT "CrmSourceEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmSourceEvent" ADD CONSTRAINT "CrmSourceEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmSourceEvent" ADD CONSTRAINT "CrmSourceEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmSourceEvent" ADD CONSTRAINT "CrmSourceEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmSourceEvent" ADD CONSTRAINT "CrmSourceEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmContactChannelPreference" ADD CONSTRAINT "CrmContactChannelPreference_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmContactChannelPreference" ADD CONSTRAINT "CrmContactChannelPreference_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmSuppressionEntry" ADD CONSTRAINT "CrmSuppressionEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmCommunicationTemplate" ADD CONSTRAINT "CrmCommunicationTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmCommunicationTemplateVersion" ADD CONSTRAINT "CrmCommunicationTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CrmCommunicationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmWorkspaceCommunicationPolicy" ADD CONSTRAINT "CrmWorkspaceCommunicationPolicy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmDeliveryAttempt" ADD CONSTRAINT "CrmDeliveryAttempt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmDeliveryAttempt" ADD CONSTRAINT "CrmDeliveryAttempt_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CrmDeliveryAttempt" ADD CONSTRAINT "CrmDeliveryAttempt_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmDeliveryAttempt" ADD CONSTRAINT "CrmDeliveryAttempt_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmDeliveryAttempt" ADD CONSTRAINT "CrmDeliveryAttempt_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "CrmActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmDeliveryAttempt" ADD CONSTRAINT "CrmDeliveryAttempt_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "CrmCommunicationTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_mergedIntoContactId_fkey" FOREIGN KEY ("mergedIntoContactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "CrmPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "CrmPipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_convertedAccountId_fkey" FOREIGN KEY ("convertedAccountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_convertedDealId_fkey" FOREIGN KEY ("convertedDealId") REFERENCES "CrmDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Deterministic default pipeline and stage backfill for every existing workspace.
INSERT INTO "CrmPipeline" ("id","workspaceId","name","description","isDefault","active","createdAt","updatedAt")
SELECT 'crm_pipeline_' || md5(w."id"), w."id", 'Default revenue pipeline', 'Stage 21H compatibility pipeline', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Workspace" w
ON CONFLICT ("workspaceId","name") DO NOTHING;

INSERT INTO "CrmPipelineStage" ("id","pipelineId","key","name","position","type","defaultProbability","slaHours","active","createdAt","updatedAt")
SELECT 'crm_stage_' || md5(p."workspaceId" || ':' || s.key), p."id", s.key, s.name, s.position, s.type::"CrmPipelineStageType", s.probability, s.sla, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "CrmPipeline" p
CROSS JOIN (VALUES
  ('NEW','New',10,'OPEN',5,24),
  ('CONTACTED','Contacted',20,'OPEN',15,48),
  ('QUALIFIED','Qualified',30,'OPEN',30,72),
  ('VIEWING_SCHEDULED','Viewing scheduled',40,'OPEN',45,96),
  ('PROPOSAL_SENT','Proposal sent',50,'OPEN',60,120),
  ('NEGOTIATION','Negotiation',60,'OPEN',75,168),
  ('WON','Won',70,'WON',100,NULL),
  ('LOST','Lost',80,'LOST',0,NULL)
) AS s(key,name,position,type,probability,sla)
WHERE p."isDefault" = true
ON CONFLICT ("pipelineId","key") DO NOTHING;

WITH lead_commercial_state AS (
  SELECT l."id",
         CASE
           WHEN l."status" <> 'ARCHIVED' THEN l."status"::text
           ELSE COALESCE((
             SELECT CASE split_part(a."body", ' → ', 1)
               WHEN 'WON' THEN 'WON'
               WHEN 'LOST' THEN 'LOST'
               WHEN 'NEGOTIATION' THEN 'NEGOTIATION'
               WHEN 'PROPOSAL_SENT' THEN 'PROPOSAL_SENT'
               WHEN 'VIEWING_SCHEDULED' THEN 'VIEWING_SCHEDULED'
               WHEN 'QUALIFIED' THEN 'QUALIFIED'
               WHEN 'CONTACTED' THEN 'CONTACTED'
               WHEN 'NEW' THEN 'NEW'
               ELSE NULL
             END
             FROM "CrmActivity" a
             WHERE a."leadId" = l."id"
               AND a."type" = 'STATUS_CHANGE'
               AND a."body" LIKE '% → ARCHIVED'
             ORDER BY a."createdAt" DESC
             LIMIT 1
           ), 'NEW')
         END AS "commercialStage"
  FROM "CrmLead" l
)
UPDATE "CrmLead" l
SET "pipelineId" = p."id",
    "stageId" = s."id",
    "outcome" = CASE WHEN state."commercialStage" = 'WON' THEN 'WON'::"CrmDealOutcome" WHEN state."commercialStage" = 'LOST' THEN 'LOST'::"CrmDealOutcome" ELSE 'OPEN'::"CrmDealOutcome" END,
    "wonAt" = CASE WHEN state."commercialStage" = 'WON' THEN l."updatedAt" ELSE NULL END,
    "lostAt" = CASE WHEN state."commercialStage" = 'LOST' THEN l."updatedAt" ELSE NULL END,
    "closedAt" = CASE WHEN state."commercialStage" IN ('WON','LOST') THEN l."updatedAt" ELSE NULL END,
    "scoreCalculatedAt" = CURRENT_TIMESTAMP
FROM lead_commercial_state state, "CrmPipeline" p, "CrmPipelineStage" s
WHERE state."id" = l."id"
  AND p."workspaceId" = l."workspaceId"
  AND p."isDefault" = true
  AND s."pipelineId" = p."id"
  AND s."key" = state."commercialStage";

INSERT INTO "CrmContactIdentity" ("id","workspaceId","contactId","type","normalizedValue","rawValue","primary","active","createdAt","updatedAt")
SELECT 'crm_identity_email_' || md5(c."id"), c."workspaceId", c."id", 'EMAIL', c."normalizedEmail", COALESCE(c."email",c."normalizedEmail"), true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "CrmContact" c WHERE c."normalizedEmail" IS NOT NULL
ON CONFLICT ("workspaceId","type","normalizedValue") DO NOTHING;

INSERT INTO "CrmContactIdentity" ("id","workspaceId","contactId","type","normalizedValue","rawValue","primary","active","createdAt","updatedAt")
SELECT 'crm_identity_phone_' || md5(c."id"), c."workspaceId", c."id", 'PHONE', c."normalizedPhone", COALESCE(c."phone",c."normalizedPhone"), true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "CrmContact" c WHERE c."normalizedPhone" IS NOT NULL
ON CONFLICT ("workspaceId","type","normalizedValue") DO NOTHING;

INSERT INTO "CrmScoreSnapshot" ("id","workspaceId","leadId","score","band","version","reasons","signals","trend","calculatedAt","jobKey")
SELECT 'crm_score_migration_' || md5(l."id"), l."workspaceId", l."id", 0, 'COLD', 'crm-stage21h-migration-baseline',
       '[{"key":"migration_baseline","label":"Pending deterministic recalculation","points":0}]'::jsonb,
       '{"migrationBaseline":true}'::jsonb, 'STABLE', CURRENT_TIMESTAMP, 'stage21h:migration:' || l."id"
FROM "CrmLead" l
WHERE NOT EXISTS (SELECT 1 FROM "CrmScoreSnapshot" s WHERE s."leadId" = l."id");

INSERT INTO "CrmWorkspaceCommunicationPolicy" ("id","workspaceId","timezone","quietHoursStart","quietHoursEnd","hourlyRateLimit","retentionDays","createdAt","updatedAt")
SELECT 'crm_policy_' || md5(w."id"), w."id", 'Asia/Muscat', 1200, 480, 50, 365, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Workspace" w ON CONFLICT ("workspaceId") DO NOTHING;

INSERT INTO "CrmSourceEvent" ("id","workspaceId","type","sourceRecordId","ruleKey","occurredAt","consentStatus","contactId","leadId","metadata","createdAt")
SELECT 'crm_source_legacy_' || md5(l."id"), l."workspaceId",
       CASE
         WHEN l."source" = 'LISTING_INQUIRY' THEN 'LISTING_INQUIRY'::"CrmSourceEventType"
         WHEN l."source" = 'PROJECT_INQUIRY' THEN 'PROJECT_INQUIRY'::"CrmSourceEventType"
         WHEN l."source" = 'DEVELOPER_PROFILE' THEN 'DEVELOPER_PROFILE_INQUIRY'::"CrmSourceEventType"
         WHEN l."source" = 'TRAVEL_AGENCY_PROFILE' THEN 'TRAVEL_AGENCY_INQUIRY'::"CrmSourceEventType"
         WHEN l."source" = 'ACTIVITY_INQUIRY' THEN 'ACTIVITY_INQUIRY'::"CrmSourceEventType"
         WHEN l."source" = 'ACTIVITY_BOOKING' THEN 'BOOKING_APPROVED'::"CrmSourceEventType"
         WHEN l."source" = 'VALUATION_REQUEST' THEN 'VALUATION_REQUEST'::"CrmSourceEventType"
         WHEN l."source" = 'INVESTOR_WATCHLIST' THEN 'INVESTOR_WATCHLIST'::"CrmSourceEventType"
         WHEN l."source" = 'SAVED_SEARCH' THEN 'HIGH_INTENT_SAVED_SEARCH'::"CrmSourceEventType"
         WHEN l."source" = 'PMS_OWNER' THEN 'PMS_OWNER_ONBOARDING'::"CrmSourceEventType"
         WHEN l."source" = 'PMS_TENANT' THEN 'PMS_TENANT_ONBOARDING'::"CrmSourceEventType"
         WHEN l."source" = 'PMS_MAINTENANCE_VENDOR' THEN 'PMS_VENDOR_ONBOARDING'::"CrmSourceEventType"
         ELSE 'MANUAL'::"CrmSourceEventType" END,
       COALESCE(l."inquiryId",l."bookingId",l."valuationRequestId",l."watchlistItemId",l."savedSearchId",l."pmsTenantId",l."pmsVendorId",l."id"),
       'legacy-lead-backfill', l."createdAt", 'UNKNOWN', l."contactId", l."id", jsonb_build_object('legacySource',l."source"::text), CURRENT_TIMESTAMP
FROM "CrmLead" l
ON CONFLICT ("workspaceId","type","sourceRecordId","ruleKey") DO NOTHING;

-- Immutable history and workspace/delivery integrity guards.
CREATE OR REPLACE FUNCTION crm_stage_history_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CRM stage history is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "CrmStageHistory_immutable_update" BEFORE UPDATE ON "CrmStageHistory" FOR EACH ROW EXECUTE FUNCTION crm_stage_history_immutable();
CREATE TRIGGER "CrmStageHistory_immutable_delete" BEFORE DELETE ON "CrmStageHistory" FOR EACH ROW EXECUTE FUNCTION crm_stage_history_immutable();

CREATE OR REPLACE FUNCTION crm_score_snapshot_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CRM score snapshots are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "CrmScoreSnapshot_immutable_update" BEFORE UPDATE ON "CrmScoreSnapshot" FOR EACH ROW EXECUTE FUNCTION crm_score_snapshot_immutable();
CREATE TRIGGER "CrmScoreSnapshot_immutable_delete" BEFORE DELETE ON "CrmScoreSnapshot" FOR EACH ROW EXECUTE FUNCTION crm_score_snapshot_immutable();

CREATE OR REPLACE FUNCTION crm_template_version_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CRM communication template versions are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "CrmCommunicationTemplateVersion_immutable_update" BEFORE UPDATE ON "CrmCommunicationTemplateVersion" FOR EACH ROW EXECUTE FUNCTION crm_template_version_immutable();
CREATE TRIGGER "CrmCommunicationTemplateVersion_immutable_delete" BEFORE DELETE ON "CrmCommunicationTemplateVersion" FOR EACH ROW EXECUTE FUNCTION crm_template_version_immutable();

CREATE OR REPLACE FUNCTION crm_contact_merge_workspace_guard() RETURNS trigger AS $$
DECLARE primary_workspace TEXT; duplicate_workspace TEXT;
BEGIN
  SELECT "workspaceId" INTO primary_workspace FROM "CrmContact" WHERE id = NEW."primaryContactId";
  SELECT "workspaceId" INTO duplicate_workspace FROM "CrmContact" WHERE id = NEW."duplicateContactId";
  IF primary_workspace IS DISTINCT FROM NEW."workspaceId" OR duplicate_workspace IS DISTINCT FROM NEW."workspaceId" THEN
    RAISE EXCEPTION 'CRM contacts cannot be merged across workspaces';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "CrmContactMerge_workspace_guard" BEFORE INSERT OR UPDATE ON "CrmContactMerge" FOR EACH ROW EXECUTE FUNCTION crm_contact_merge_workspace_guard();

CREATE OR REPLACE FUNCTION crm_delivery_confirmation_guard() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'DELIVERED' AND NEW."providerConfirmedAt" IS NULL THEN
    RAISE EXCEPTION 'CRM delivery cannot be marked delivered without provider confirmation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "CrmDeliveryAttempt_confirmation_guard" BEFORE INSERT OR UPDATE ON "CrmDeliveryAttempt" FOR EACH ROW EXECUTE FUNCTION crm_delivery_confirmation_guard();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "CrmLead" WHERE "pipelineId" IS NULL OR "stageId" IS NULL) THEN
    RAISE EXCEPTION 'Stage 21H migration blocked: one or more CRM leads could not be mapped to a default pipeline stage';
  END IF;
END $$;
