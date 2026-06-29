-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('LOGGED', 'SENT', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "EmailDeliveryEvent" (
    "id" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL,
    "deliveryMode" TEXT NOT NULL,
    "notificationType" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "recipientEmail" TEXT,
    "actionUrl" TEXT,
    "preferencesUrl" TEXT,
    "messageId" TEXT,
    "reason" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailDeliveryEvent_status_createdAt_idx" ON "EmailDeliveryEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDeliveryEvent_recipientUserId_createdAt_idx" ON "EmailDeliveryEvent"("recipientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailDeliveryEvent_recipientEmail_idx" ON "EmailDeliveryEvent"("recipientEmail");

-- CreateIndex
CREATE INDEX "EmailDeliveryEvent_notificationType_createdAt_idx" ON "EmailDeliveryEvent"("notificationType", "createdAt");
