/*
  Warnings:

  - A unique constraint covering the columns `[passwordResetTokenHash]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetTokenHash" TEXT,
ADD COLUMN     "passwordResetUsedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OauthLoginCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "returnTo" TEXT NOT NULL DEFAULT '/dashboard',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OauthLoginCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OauthLoginCode_codeHash_key" ON "OauthLoginCode"("codeHash");

-- CreateIndex
CREATE INDEX "OauthLoginCode_userId_idx" ON "OauthLoginCode"("userId");

-- CreateIndex
CREATE INDEX "OauthLoginCode_expiresAt_idx" ON "OauthLoginCode"("expiresAt");

-- CreateIndex
CREATE INDEX "OauthLoginCode_usedAt_idx" ON "OauthLoginCode"("usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_passwordResetTokenHash_key" ON "User"("passwordResetTokenHash");

-- CreateIndex
CREATE INDEX "User_passwordResetExpiresAt_idx" ON "User"("passwordResetExpiresAt");

-- CreateIndex
CREATE INDEX "User_passwordResetUsedAt_idx" ON "User"("passwordResetUsedAt");

-- AddForeignKey
ALTER TABLE "OauthLoginCode" ADD CONSTRAINT "OauthLoginCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
