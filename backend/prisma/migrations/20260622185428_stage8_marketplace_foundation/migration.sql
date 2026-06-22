/*
  Warnings:

  - A unique constraint covering the columns `[receiptNumber]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('IMAGE', 'VIDEO_WALKTHROUGH', 'TOUR_360', 'VIRTUAL_TOUR', 'FLOOR_PLAN', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaQualityStatus" AS ENUM ('NOT_CHECKED', 'NEEDS_REVIEW', 'ACCEPTABLE', 'EXCELLENT', 'BLOCKED');

-- CreateEnum
CREATE TYPE "EnhancementStatus" AS ENUM ('NOT_REQUESTED', 'NOT_CONFIGURED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'SUBMITTED', 'ADMIN_VERIFIED', 'EXTERNALLY_VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VerificationSource" AS ENUM ('LUX_OM_ADMIN_REVIEW', 'OWNER_DOCUMENT_SUBMISSION', 'FUTURE_MOLUP_API', 'FUTURE_MUNICIPALITY_REGISTRATION', 'FUTURE_THIRD_PARTY_PROVIDER');

-- CreateEnum
CREATE TYPE "VerificationTargetType" AS ENUM ('LISTING', 'ACTIVITY', 'DEVELOPER', 'TRAVEL_AGENCY', 'USER', 'CONTRACT', 'TRANSACTION');

-- CreateEnum
CREATE TYPE "ContractDraftStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'SIGNED_EXTERNALLY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContractRegistrationStatus" AS ENUM ('NOT_STARTED', 'PREPARED_FOR_REGISTRATION', 'DRAFT_READY_FOR_SUBMISSION', 'SUBMITTED_EXTERNALLY', 'REGISTERED_EXTERNALLY', 'REJECTED', 'NEEDS_CHANGES');

-- CreateEnum
CREATE TYPE "PaymentScheduleFrequency" AS ENUM ('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "RentPaymentStatus" AS ENUM ('PENDING', 'DUE_SOON', 'OVERDUE', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketplaceTransactionType" AS ENUM ('PROPERTY_SALE', 'PROPERTY_RENTAL', 'ACTIVITY_BOOKING', 'PROVIDER_PAYOUT', 'OTHER');

-- CreateEnum
CREATE TYPE "MarketplaceTransactionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TransactionParticipantRole" AS ENUM ('BUYER', 'SELLER', 'LANDLORD', 'TENANT', 'PROVIDER', 'ADMIN');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('NOT_STARTED', 'PENDING_DEPOSIT', 'HELD', 'RELEASE_REQUESTED', 'RELEASED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ESCROW_STATUS_CHANGED', 'DOCUMENT_ADDED', 'PAYMENT_LINK_CREATED', 'ADMIN_NOTE', 'REVIEWED');

-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('LISTING', 'ACTIVITY', 'TRAVEL_AGENCY', 'DEVELOPER', 'REVIEW', 'USER', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('MISLEADING_INFO', 'SUSPECTED_FRAUD', 'DUPLICATE', 'INAPPROPRIATE_CONTENT', 'WRONG_PRICE', 'UNAVAILABLE', 'SAFETY_CONCERN', 'OTHER');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('ACTIVITY', 'TRAVEL_AGENCY', 'DEVELOPER', 'LISTING');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SavedSearchAlertFrequency" AS ENUM ('NONE', 'DASHBOARD_ONLY', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "ValuationStatus" AS ENUM ('REQUESTED', 'LOW_DATA_READY', 'ESTIMATE_READY', 'NEEDS_REVIEW', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ValuationConfidence" AS ENUM ('LOW_DATA', 'MEDIUM_DATA', 'HIGH_DATA');

-- CreateEnum
CREATE TYPE "ValuationReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_MORE_DATA');

-- CreateEnum
CREATE TYPE "DocumentChecklistStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ListingBuyerEligibility" ADD VALUE 'EXPAT_BUYABLE';
ALTER TYPE "ListingBuyerEligibility" ADD VALUE 'ITC';
ALTER TYPE "ListingBuyerEligibility" ADD VALUE 'GOLDEN_VISA_ELIGIBLE';
ALTER TYPE "ListingBuyerEligibility" ADD VALUE 'OMR_250K_RESIDENCY_ELIGIBLE';
ALTER TYPE "ListingBuyerEligibility" ADD VALUE 'OMR_500K_RESIDENCY_ELIGIBLE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'RENT_PAYMENT_DUE';
ALTER TYPE "NotificationType" ADD VALUE 'TRANSACTION_STATUS_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_STATUS_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'VERIFICATION_STATUS_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'SAVED_SEARCH_MATCH';

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "enhancedImageUrl" TEXT,
ADD COLUMN     "enhancementNotes" TEXT,
ADD COLUMN     "enhancementProvider" TEXT,
ADD COLUMN     "enhancementStatus" "EnhancementStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN     "mediaQualityNotes" TEXT,
ADD COLUMN     "mediaQualityStatus" "MediaQualityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
ADD COLUMN     "tour360Url" TEXT,
ADD COLUMN     "verificationDate" TIMESTAMP(3),
ADD COLUMN     "verificationExpiryDate" TIMESTAMP(3),
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationReviewedById" TEXT,
ADD COLUMN     "verificationSource" "VerificationSource",
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "videoWalkthroughUrl" TEXT,
ADD COLUMN     "virtualTourUrl" TEXT;

-- AlterTable
ALTER TABLE "DeveloperCompany" ADD COLUMN     "verificationDate" TIMESTAMP(3),
ADD COLUMN     "verificationExpiryDate" TIMESTAMP(3),
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationReviewedById" TEXT,
ADD COLUMN     "verificationSource" "VerificationSource",
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "adminVerificationNotes" TEXT,
ADD COLUMN     "eligibilityDisclaimer" TEXT,
ADD COLUMN     "eligibilityMarkedById" TEXT,
ADD COLUMN     "eligibilityNotes" TEXT,
ADD COLUMN     "enhancedImageUrl" TEXT,
ADD COLUMN     "enhancementNotes" TEXT,
ADD COLUMN     "enhancementProvider" TEXT,
ADD COLUMN     "enhancementStatus" "EnhancementStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN     "floorPlanUrl" TEXT,
ADD COLUMN     "investorHighlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mediaQualityNotes" TEXT,
ADD COLUMN     "mediaQualityStatus" "MediaQualityStatus" NOT NULL DEFAULT 'NOT_CHECKED',
ADD COLUMN     "tour360Url" TEXT,
ADD COLUMN     "verificationDate" TIMESTAMP(3),
ADD COLUMN     "verificationExpiryDate" TIMESTAMP(3),
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationReviewedById" TEXT,
ADD COLUMN     "verificationSource" "VerificationSource",
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
ADD COLUMN     "videoWalkthroughUrl" TEXT,
ADD COLUMN     "virtualTourUrl" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
ADD COLUMN     "providerPayoutAmount" DECIMAL(10,2),
ADD COLUMN     "receiptNumber" TEXT;

-- AlterTable
ALTER TABLE "TravelAgency" ADD COLUMN     "verificationDate" TIMESTAMP(3),
ADD COLUMN     "verificationExpiryDate" TIMESTAMP(3),
ADD COLUMN     "verificationNotes" TEXT,
ADD COLUMN     "verificationReviewedById" TEXT,
ADD COLUMN     "verificationSource" "VerificationSource",
ADD COLUMN     "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';

-- CreateTable
CREATE TABLE "PremiumMediaAsset" (
    "id" TEXT NOT NULL,
    "type" "MediaAssetType" NOT NULL,
    "url" TEXT NOT NULL,
    "provider" TEXT,
    "titleEn" TEXT,
    "titleAr" TEXT,
    "altEn" TEXT,
    "altAr" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "listingId" TEXT,
    "activityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiumMediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalContractDraft" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ContractDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "landlordName" TEXT NOT NULL,
    "landlordEmail" TEXT,
    "landlordPhone" TEXT,
    "tenantName" TEXT NOT NULL,
    "tenantEmail" TEXT,
    "tenantPhone" TEXT,
    "propertyTitle" TEXT NOT NULL,
    "propertyAddress" TEXT NOT NULL,
    "propertyType" TEXT,
    "propertyNotes" TEXT,
    "rentAmount" DECIMAL(12,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "securityDeposit" DECIMAL(12,3),
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "paymentSchedule" TEXT,
    "utilitiesResponsibility" TEXT,
    "maintenanceTerms" TEXT,
    "noticePeriod" TEXT,
    "additionalClauses" TEXT,
    "attachmentsNotes" TEXT,
    "registrationStatus" "ContractRegistrationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "registrationReference" TEXT,
    "registrationDocumentUrl" TEXT,
    "registrationNotes" TEXT,
    "adminRegistrationNotes" TEXT,
    "registrationChecklist" JSONB,
    "preparedForRegistrationAt" TIMESTAMP(3),
    "submittedExternallyAt" TIMESTAMP(3),
    "registeredExternallyAt" TIMESTAMP(3),
    "listingId" TEXT,
    "createdById" TEXT NOT NULL,
    "landlordUserId" TEXT,
    "tenantUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalContractDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentPaymentSchedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "frequency" "PaymentScheduleFrequency" NOT NULL DEFAULT 'MONTHLY',
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "dueDayOfMonth" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "contractDraftId" TEXT,
    "listingId" TEXT,
    "createdById" TEXT NOT NULL,
    "landlordUserId" TEXT,
    "tenantUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentPaymentSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentPaymentDueItem" (
    "id" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "status" "RentPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentProvider" TEXT,
    "paymentReference" TEXT,
    "providerSessionId" TEXT,
    "checkoutUrl" TEXT,
    "receiptNumber" TEXT,
    "notes" TEXT,
    "scheduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentPaymentDueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceTransaction" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MarketplaceTransactionType" NOT NULL DEFAULT 'OTHER',
    "status" "MarketplaceTransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "escrowStatus" "EscrowStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "amount" DECIMAL(14,3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "adminNotes" TEXT,
    "documentChecklist" JSONB,
    "externalProvider" TEXT,
    "providerReference" TEXT,
    "listingId" TEXT,
    "activityId" TEXT,
    "bookingId" TEXT,
    "contractDraftId" TEXT,
    "rentDueItemId" TEXT,
    "buyerId" TEXT,
    "sellerId" TEXT,
    "landlordId" TEXT,
    "tenantId" TEXT,
    "providerId" TEXT,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionParticipant" (
    "id" TEXT NOT NULL,
    "role" "TransactionParticipantRole" NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionAuditEvent" (
    "id" TEXT NOT NULL,
    "type" "TransactionEventType" NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "transactionId" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplacePaymentLedger" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,3) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "commission" DECIMAL(12,3),
    "providerPayoutAmount" DECIMAL(12,3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "reference" TEXT,
    "providerSessionId" TEXT,
    "checkoutUrl" TEXT,
    "receiptNumber" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "bookingId" TEXT,
    "rentDueItemId" TEXT,
    "transactionId" TEXT,
    "payerId" TEXT,
    "payeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplacePaymentLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketInsightSnapshot" (
    "id" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "locationKey" TEXT NOT NULL,
    "transaction" TEXT,
    "propertyType" TEXT,
    "sampleSizeSale" INTEGER NOT NULL DEFAULT 0,
    "sampleSizeRent" INTEGER NOT NULL DEFAULT 0,
    "avgAskingPrice" DECIMAL(14,3),
    "avgRent" DECIMAL(14,3),
    "avgPricePerSqm" DECIMAL(14,3),
    "estimatedRentalYield" DECIMAL(8,4),
    "notEnoughData" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketInsightSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValuationRequest" (
    "id" TEXT NOT NULL,
    "status" "ValuationStatus" NOT NULL DEFAULT 'REQUESTED',
    "confidence" "ValuationConfidence" NOT NULL DEFAULT 'LOW_DATA',
    "reviewStatus" "ValuationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "propertyType" TEXT,
    "location" TEXT NOT NULL,
    "sqm" INTEGER,
    "beds" INTEGER,
    "baths" INTEGER,
    "askingPrice" DECIMAL(14,3),
    "rentEstimate" DECIMAL(14,3),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'OMR',
    "estimateLow" DECIMAL(14,3),
    "estimateHigh" DECIMAL(14,3),
    "comparableSnapshots" JSONB,
    "generatedNotes" TEXT,
    "reviewNotes" TEXT,
    "disclaimer" TEXT,
    "listingId" TEXT,
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValuationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRecord" (
    "id" TEXT NOT NULL,
    "targetType" "VerificationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "source" "VerificationSource" NOT NULL,
    "notes" TEXT,
    "documentChecklist" JSONB,
    "verificationDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "submittedById" TEXT,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChecklistItem" (
    "id" TEXT NOT NULL,
    "targetType" "VerificationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "notes" TEXT,
    "documentUrl" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" "DocumentChecklistStatus" NOT NULL DEFAULT 'REQUIRED',
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustReport" (
    "id" TEXT NOT NULL,
    "targetType" "ModerationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "message" TEXT,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "reporterName" TEXT,
    "reporterEmail" TEXT,
    "reporterPhone" TEXT,
    "reporterId" TEXT,
    "reviewedById" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrustReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "targetType" "ReviewTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "activityId" TEXT,
    "travelAgencyId" TEXT,
    "developerId" TEXT,
    "listingId" TEXT,
    "reviewerId" TEXT NOT NULL,
    "moderatedById" TEXT,
    "moderationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "query" TEXT,
    "filters" JSONB NOT NULL,
    "alertFrequency" "SavedSearchAlertFrequency" NOT NULL DEFAULT 'DASHBOARD_ONLY',
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastMatchedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorWatchlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT,
    "valuationRequestId" TEXT,
    "notes" TEXT,
    "targetPrice" DECIMAL(14,3),
    "alertOnPriceChange" BOOLEAN NOT NULL DEFAULT true,
    "alertOnNewComparables" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorWatchlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PremiumMediaAsset_type_idx" ON "PremiumMediaAsset"("type");

-- CreateIndex
CREATE INDEX "PremiumMediaAsset_listingId_sortOrder_idx" ON "PremiumMediaAsset"("listingId", "sortOrder");

-- CreateIndex
CREATE INDEX "PremiumMediaAsset_activityId_sortOrder_idx" ON "PremiumMediaAsset"("activityId", "sortOrder");

-- CreateIndex
CREATE INDEX "RentalContractDraft_status_idx" ON "RentalContractDraft"("status");

-- CreateIndex
CREATE INDEX "RentalContractDraft_registrationStatus_idx" ON "RentalContractDraft"("registrationStatus");

-- CreateIndex
CREATE INDEX "RentalContractDraft_listingId_idx" ON "RentalContractDraft"("listingId");

-- CreateIndex
CREATE INDEX "RentalContractDraft_createdById_idx" ON "RentalContractDraft"("createdById");

-- CreateIndex
CREATE INDEX "RentalContractDraft_landlordUserId_idx" ON "RentalContractDraft"("landlordUserId");

-- CreateIndex
CREATE INDEX "RentalContractDraft_tenantUserId_idx" ON "RentalContractDraft"("tenantUserId");

-- CreateIndex
CREATE INDEX "RentPaymentSchedule_active_idx" ON "RentPaymentSchedule"("active");

-- CreateIndex
CREATE INDEX "RentPaymentSchedule_contractDraftId_idx" ON "RentPaymentSchedule"("contractDraftId");

-- CreateIndex
CREATE INDEX "RentPaymentSchedule_listingId_idx" ON "RentPaymentSchedule"("listingId");

-- CreateIndex
CREATE INDEX "RentPaymentSchedule_createdById_idx" ON "RentPaymentSchedule"("createdById");

-- CreateIndex
CREATE INDEX "RentPaymentSchedule_landlordUserId_idx" ON "RentPaymentSchedule"("landlordUserId");

-- CreateIndex
CREATE INDEX "RentPaymentSchedule_tenantUserId_idx" ON "RentPaymentSchedule"("tenantUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RentPaymentDueItem_paymentReference_key" ON "RentPaymentDueItem"("paymentReference");

-- CreateIndex
CREATE UNIQUE INDEX "RentPaymentDueItem_providerSessionId_key" ON "RentPaymentDueItem"("providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "RentPaymentDueItem_receiptNumber_key" ON "RentPaymentDueItem"("receiptNumber");

-- CreateIndex
CREATE INDEX "RentPaymentDueItem_scheduleId_idx" ON "RentPaymentDueItem"("scheduleId");

-- CreateIndex
CREATE INDEX "RentPaymentDueItem_dueDate_idx" ON "RentPaymentDueItem"("dueDate");

-- CreateIndex
CREATE INDEX "RentPaymentDueItem_status_idx" ON "RentPaymentDueItem"("status");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_type_idx" ON "MarketplaceTransaction"("type");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_status_idx" ON "MarketplaceTransaction"("status");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_escrowStatus_idx" ON "MarketplaceTransaction"("escrowStatus");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_listingId_idx" ON "MarketplaceTransaction"("listingId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_activityId_idx" ON "MarketplaceTransaction"("activityId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_bookingId_idx" ON "MarketplaceTransaction"("bookingId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_contractDraftId_idx" ON "MarketplaceTransaction"("contractDraftId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_rentDueItemId_idx" ON "MarketplaceTransaction"("rentDueItemId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_buyerId_idx" ON "MarketplaceTransaction"("buyerId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_sellerId_idx" ON "MarketplaceTransaction"("sellerId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_landlordId_idx" ON "MarketplaceTransaction"("landlordId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_tenantId_idx" ON "MarketplaceTransaction"("tenantId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_providerId_idx" ON "MarketplaceTransaction"("providerId");

-- CreateIndex
CREATE INDEX "MarketplaceTransaction_adminId_idx" ON "MarketplaceTransaction"("adminId");

-- CreateIndex
CREATE INDEX "TransactionParticipant_transactionId_idx" ON "TransactionParticipant"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionParticipant_userId_idx" ON "TransactionParticipant"("userId");

-- CreateIndex
CREATE INDEX "TransactionParticipant_role_idx" ON "TransactionParticipant"("role");

-- CreateIndex
CREATE INDEX "TransactionAuditEvent_transactionId_createdAt_idx" ON "TransactionAuditEvent"("transactionId", "createdAt");

-- CreateIndex
CREATE INDEX "TransactionAuditEvent_actorId_idx" ON "TransactionAuditEvent"("actorId");

-- CreateIndex
CREATE INDEX "TransactionAuditEvent_type_idx" ON "TransactionAuditEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePaymentLedger_reference_key" ON "MarketplacePaymentLedger"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePaymentLedger_providerSessionId_key" ON "MarketplacePaymentLedger"("providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplacePaymentLedger_receiptNumber_key" ON "MarketplacePaymentLedger"("receiptNumber");

-- CreateIndex
CREATE INDEX "MarketplacePaymentLedger_status_idx" ON "MarketplacePaymentLedger"("status");

-- CreateIndex
CREATE INDEX "MarketplacePaymentLedger_bookingId_idx" ON "MarketplacePaymentLedger"("bookingId");

-- CreateIndex
CREATE INDEX "MarketplacePaymentLedger_rentDueItemId_idx" ON "MarketplacePaymentLedger"("rentDueItemId");

-- CreateIndex
CREATE INDEX "MarketplacePaymentLedger_transactionId_idx" ON "MarketplacePaymentLedger"("transactionId");

-- CreateIndex
CREATE INDEX "MarketplacePaymentLedger_payerId_idx" ON "MarketplacePaymentLedger"("payerId");

-- CreateIndex
CREATE INDEX "MarketplacePaymentLedger_payeeId_idx" ON "MarketplacePaymentLedger"("payeeId");

-- CreateIndex
CREATE INDEX "MarketplacePaymentLedger_paidAt_idx" ON "MarketplacePaymentLedger"("paidAt");

-- CreateIndex
CREATE INDEX "MarketInsightSnapshot_locationKey_idx" ON "MarketInsightSnapshot"("locationKey");

-- CreateIndex
CREATE INDEX "MarketInsightSnapshot_transaction_idx" ON "MarketInsightSnapshot"("transaction");

-- CreateIndex
CREATE INDEX "MarketInsightSnapshot_propertyType_idx" ON "MarketInsightSnapshot"("propertyType");

-- CreateIndex
CREATE INDEX "MarketInsightSnapshot_generatedAt_idx" ON "MarketInsightSnapshot"("generatedAt");

-- CreateIndex
CREATE INDEX "ValuationRequest_status_idx" ON "ValuationRequest"("status");

-- CreateIndex
CREATE INDEX "ValuationRequest_confidence_idx" ON "ValuationRequest"("confidence");

-- CreateIndex
CREATE INDEX "ValuationRequest_reviewStatus_idx" ON "ValuationRequest"("reviewStatus");

-- CreateIndex
CREATE INDEX "ValuationRequest_listingId_idx" ON "ValuationRequest"("listingId");

-- CreateIndex
CREATE INDEX "ValuationRequest_requestedById_idx" ON "ValuationRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ValuationRequest_reviewedById_idx" ON "ValuationRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "ValuationRequest_location_idx" ON "ValuationRequest"("location");

-- CreateIndex
CREATE INDEX "VerificationRecord_targetType_targetId_idx" ON "VerificationRecord"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "VerificationRecord_status_idx" ON "VerificationRecord"("status");

-- CreateIndex
CREATE INDEX "VerificationRecord_source_idx" ON "VerificationRecord"("source");

-- CreateIndex
CREATE INDEX "VerificationRecord_submittedById_idx" ON "VerificationRecord"("submittedById");

-- CreateIndex
CREATE INDEX "VerificationRecord_reviewedById_idx" ON "VerificationRecord"("reviewedById");

-- CreateIndex
CREATE INDEX "VerificationRecord_expiryDate_idx" ON "VerificationRecord"("expiryDate");

-- CreateIndex
CREATE INDEX "DocumentChecklistItem_targetType_targetId_idx" ON "DocumentChecklistItem"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "DocumentChecklistItem_status_idx" ON "DocumentChecklistItem"("status");

-- CreateIndex
CREATE INDEX "DocumentChecklistItem_reviewedById_idx" ON "DocumentChecklistItem"("reviewedById");

-- CreateIndex
CREATE INDEX "TrustReport_targetType_targetId_idx" ON "TrustReport"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "TrustReport_reason_idx" ON "TrustReport"("reason");

-- CreateIndex
CREATE INDEX "TrustReport_status_idx" ON "TrustReport"("status");

-- CreateIndex
CREATE INDEX "TrustReport_reporterId_idx" ON "TrustReport"("reporterId");

-- CreateIndex
CREATE INDEX "TrustReport_reviewedById_idx" ON "TrustReport"("reviewedById");

-- CreateIndex
CREATE INDEX "TrustReport_createdAt_idx" ON "TrustReport"("createdAt");

-- CreateIndex
CREATE INDEX "Review_targetType_targetId_idx" ON "Review"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE INDEX "Review_activityId_idx" ON "Review"("activityId");

-- CreateIndex
CREATE INDEX "Review_travelAgencyId_idx" ON "Review"("travelAgencyId");

-- CreateIndex
CREATE INDEX "Review_developerId_idx" ON "Review"("developerId");

-- CreateIndex
CREATE INDEX "Review_listingId_idx" ON "Review"("listingId");

-- CreateIndex
CREATE INDEX "Review_reviewerId_idx" ON "Review"("reviewerId");

-- CreateIndex
CREATE INDEX "Review_moderatedById_idx" ON "Review"("moderatedById");

-- CreateIndex
CREATE INDEX "SavedListing_userId_idx" ON "SavedListing"("userId");

-- CreateIndex
CREATE INDEX "SavedListing_listingId_idx" ON "SavedListing"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedListing_userId_listingId_key" ON "SavedListing"("userId", "listingId");

-- CreateIndex
CREATE INDEX "SavedActivity_userId_idx" ON "SavedActivity"("userId");

-- CreateIndex
CREATE INDEX "SavedActivity_activityId_idx" ON "SavedActivity"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedActivity_userId_activityId_key" ON "SavedActivity"("userId", "activityId");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- CreateIndex
CREATE INDEX "SavedSearch_category_idx" ON "SavedSearch"("category");

-- CreateIndex
CREATE INDEX "SavedSearch_alertFrequency_idx" ON "SavedSearch"("alertFrequency");

-- CreateIndex
CREATE INDEX "InvestorWatchlistItem_userId_idx" ON "InvestorWatchlistItem"("userId");

-- CreateIndex
CREATE INDEX "InvestorWatchlistItem_listingId_idx" ON "InvestorWatchlistItem"("listingId");

-- CreateIndex
CREATE INDEX "InvestorWatchlistItem_valuationRequestId_idx" ON "InvestorWatchlistItem"("valuationRequestId");

-- CreateIndex
CREATE INDEX "Activity_verificationStatus_idx" ON "Activity"("verificationStatus");

-- CreateIndex
CREATE INDEX "Activity_mediaQualityStatus_idx" ON "Activity"("mediaQualityStatus");

-- CreateIndex
CREATE INDEX "DeveloperCompany_verificationStatus_idx" ON "DeveloperCompany"("verificationStatus");

-- CreateIndex
CREATE INDEX "DeveloperCompany_verificationReviewedById_idx" ON "DeveloperCompany"("verificationReviewedById");

-- CreateIndex
CREATE INDEX "Listing_eligibilityMarkedById_idx" ON "Listing"("eligibilityMarkedById");

-- CreateIndex
CREATE INDEX "Listing_verificationStatus_idx" ON "Listing"("verificationStatus");

-- CreateIndex
CREATE INDEX "Listing_mediaQualityStatus_idx" ON "Listing"("mediaQualityStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");

-- CreateIndex
CREATE INDEX "TravelAgency_verificationStatus_idx" ON "TravelAgency"("verificationStatus");

-- CreateIndex
CREATE INDEX "TravelAgency_verificationReviewedById_idx" ON "TravelAgency"("verificationReviewedById");

-- AddForeignKey
ALTER TABLE "DeveloperCompany" ADD CONSTRAINT "DeveloperCompany_verificationReviewedById_fkey" FOREIGN KEY ("verificationReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TravelAgency" ADD CONSTRAINT "TravelAgency_verificationReviewedById_fkey" FOREIGN KEY ("verificationReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_eligibilityMarkedById_fkey" FOREIGN KEY ("eligibilityMarkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_verificationReviewedById_fkey" FOREIGN KEY ("verificationReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_verificationReviewedById_fkey" FOREIGN KEY ("verificationReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumMediaAsset" ADD CONSTRAINT "PremiumMediaAsset_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiumMediaAsset" ADD CONSTRAINT "PremiumMediaAsset_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContractDraft" ADD CONSTRAINT "RentalContractDraft_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContractDraft" ADD CONSTRAINT "RentalContractDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContractDraft" ADD CONSTRAINT "RentalContractDraft_landlordUserId_fkey" FOREIGN KEY ("landlordUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalContractDraft" ADD CONSTRAINT "RentalContractDraft_tenantUserId_fkey" FOREIGN KEY ("tenantUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPaymentSchedule" ADD CONSTRAINT "RentPaymentSchedule_contractDraftId_fkey" FOREIGN KEY ("contractDraftId") REFERENCES "RentalContractDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPaymentSchedule" ADD CONSTRAINT "RentPaymentSchedule_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPaymentSchedule" ADD CONSTRAINT "RentPaymentSchedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPaymentSchedule" ADD CONSTRAINT "RentPaymentSchedule_landlordUserId_fkey" FOREIGN KEY ("landlordUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPaymentSchedule" ADD CONSTRAINT "RentPaymentSchedule_tenantUserId_fkey" FOREIGN KEY ("tenantUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentPaymentDueItem" ADD CONSTRAINT "RentPaymentDueItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "RentPaymentSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_contractDraftId_fkey" FOREIGN KEY ("contractDraftId") REFERENCES "RentalContractDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_rentDueItemId_fkey" FOREIGN KEY ("rentDueItemId") REFERENCES "RentPaymentDueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceTransaction" ADD CONSTRAINT "MarketplaceTransaction_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionParticipant" ADD CONSTRAINT "TransactionParticipant_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "MarketplaceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionParticipant" ADD CONSTRAINT "TransactionParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAuditEvent" ADD CONSTRAINT "TransactionAuditEvent_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "MarketplaceTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAuditEvent" ADD CONSTRAINT "TransactionAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePaymentLedger" ADD CONSTRAINT "MarketplacePaymentLedger_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePaymentLedger" ADD CONSTRAINT "MarketplacePaymentLedger_rentDueItemId_fkey" FOREIGN KEY ("rentDueItemId") REFERENCES "RentPaymentDueItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePaymentLedger" ADD CONSTRAINT "MarketplacePaymentLedger_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "MarketplaceTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePaymentLedger" ADD CONSTRAINT "MarketplacePaymentLedger_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplacePaymentLedger" ADD CONSTRAINT "MarketplacePaymentLedger_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValuationRequest" ADD CONSTRAINT "ValuationRequest_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValuationRequest" ADD CONSTRAINT "ValuationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValuationRequest" ADD CONSTRAINT "ValuationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRecord" ADD CONSTRAINT "VerificationRecord_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRecord" ADD CONSTRAINT "VerificationRecord_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChecklistItem" ADD CONSTRAINT "DocumentChecklistItem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustReport" ADD CONSTRAINT "TrustReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustReport" ADD CONSTRAINT "TrustReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_travelAgencyId_fkey" FOREIGN KEY ("travelAgencyId") REFERENCES "TravelAgency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedListing" ADD CONSTRAINT "SavedListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedActivity" ADD CONSTRAINT "SavedActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedActivity" ADD CONSTRAINT "SavedActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorWatchlistItem" ADD CONSTRAINT "InvestorWatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorWatchlistItem" ADD CONSTRAINT "InvestorWatchlistItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorWatchlistItem" ADD CONSTRAINT "InvestorWatchlistItem_valuationRequestId_fkey" FOREIGN KEY ("valuationRequestId") REFERENCES "ValuationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
