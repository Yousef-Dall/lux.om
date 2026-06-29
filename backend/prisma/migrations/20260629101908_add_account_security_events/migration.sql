-- CreateEnum
CREATE TYPE "AccountSecurityEventType" AS ENUM ('PASSWORD_CHANGED', 'PASSWORD_RESET_COMPLETED', 'LOGOUT_ALL_SESSIONS', 'EMAIL_CHANGE_REQUESTED', 'EMAIL_CHANGE_CONFIRMED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ACCOUNT_SECURITY';

-- CreateTable
CREATE TABLE "AccountSecurityEvent" (
    "id" TEXT NOT NULL,
    "type" "AccountSecurityEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "userId" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountSecurityEvent_userId_createdAt_idx" ON "AccountSecurityEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountSecurityEvent_actorId_idx" ON "AccountSecurityEvent"("actorId");

-- CreateIndex
CREATE INDEX "AccountSecurityEvent_type_idx" ON "AccountSecurityEvent"("type");

-- CreateIndex
CREATE INDEX "AccountSecurityEvent_createdAt_idx" ON "AccountSecurityEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "AccountSecurityEvent" ADD CONSTRAINT "AccountSecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSecurityEvent" ADD CONSTRAINT "AccountSecurityEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
