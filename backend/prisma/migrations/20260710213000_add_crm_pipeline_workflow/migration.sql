-- Stage 21D: CRM pipeline intelligence, prioritized tasks, and communication history metadata.

ALTER TYPE "CrmActivityType" ADD VALUE IF NOT EXISTS 'WHATSAPP';
ALTER TYPE "CrmActivityType" ADD VALUE IF NOT EXISTS 'SYSTEM_NOTIFICATION';

CREATE TYPE "CrmActivityPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "CrmCommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');
CREATE TYPE "CrmCommunicationOutcome" AS ENUM ('DRAFT_OPENED', 'SENT_EXTERNALLY', 'NO_ANSWER', 'CONNECTED', 'REPLIED');

ALTER TABLE "CrmActivity"
  ADD COLUMN "priority" "CrmActivityPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN "communicationDirection" "CrmCommunicationDirection",
  ADD COLUMN "communicationOutcome" "CrmCommunicationOutcome",
  ADD COLUMN "templateKey" TEXT;

CREATE INDEX "CrmActivity_leadId_type_createdAt_idx" ON "CrmActivity"("leadId", "type", "createdAt");
CREATE INDEX "CrmActivity_priority_status_dueAt_idx" ON "CrmActivity"("priority", "status", "dueAt");
