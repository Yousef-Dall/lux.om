CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'COMPANY', 'PLATFORM');
CREATE TYPE "WorkspaceMemberRole" AS ENUM ('OWNER', 'MANAGER', 'MEMBER', 'VIEWER');
CREATE TYPE "WorkspacePermissionKey" AS ENUM ('CRM_VIEW', 'CRM_MANAGE', 'CRM_ASSIGN', 'WORKSPACE_MANAGE');

CREATE TABLE "Workspace" (
  "id" TEXT NOT NULL,
  "type" "WorkspaceType" NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "platformKey" TEXT,
  "companyId" TEXT,
  "personalOwnerUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Workspace_platformKey_key" ON "Workspace"("platformKey");
CREATE UNIQUE INDEX "Workspace_companyId_key" ON "Workspace"("companyId");
CREATE UNIQUE INDEX "Workspace_personalOwnerUserId_key" ON "Workspace"("personalOwnerUserId");
CREATE INDEX "Workspace_type_active_idx" ON "Workspace"("type", "active");
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "DeveloperCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_personalOwnerUserId_fkey" FOREIGN KEY ("personalOwnerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_owner_shape_check" CHECK (
  ("type" = 'PERSONAL' AND "personalOwnerUserId" IS NOT NULL AND "companyId" IS NULL AND "platformKey" IS NULL) OR
  ("type" = 'COMPANY' AND "companyId" IS NOT NULL AND "personalOwnerUserId" IS NULL AND "platformKey" IS NULL) OR
  ("type" = 'PLATFORM' AND "platformKey" IS NOT NULL AND "personalOwnerUserId" IS NULL AND "companyId" IS NULL)
);

CREATE TABLE "WorkspaceMember" (
  "id" TEXT NOT NULL,
  "role" "WorkspaceMemberRole" NOT NULL DEFAULT 'MEMBER',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "workspaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");
CREATE INDEX "WorkspaceMember_userId_active_idx" ON "WorkspaceMember"("userId", "active");
CREATE INDEX "WorkspaceMember_workspaceId_active_idx" ON "WorkspaceMember"("workspaceId", "active");
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "WorkspacePermission" (
  "id" TEXT NOT NULL,
  "key" "WorkspacePermissionKey" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "memberId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspacePermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspacePermission_memberId_key_key" ON "WorkspacePermission"("memberId", "key");
CREATE INDEX "WorkspacePermission_key_active_idx" ON "WorkspacePermission"("key", "active");
ALTER TABLE "WorkspacePermission" ADD CONSTRAINT "WorkspacePermission_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WorkspacePropertyScope" (
  "id" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "memberId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspacePropertyScope_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspacePropertyScope_memberId_propertyId_key" ON "WorkspacePropertyScope"("memberId", "propertyId");
CREATE INDEX "WorkspacePropertyScope_propertyId_active_idx" ON "WorkspacePropertyScope"("propertyId", "active");
ALTER TABLE "WorkspacePropertyScope" ADD CONSTRAINT "WorkspacePropertyScope_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkspaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspacePropertyScope" ADD CONSTRAINT "WorkspacePropertyScope_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "PmsProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "Workspace" ("id", "type", "name", "platformKey", "updatedAt") VALUES ('workspace_platform_crm', 'PLATFORM', 'lux.om Platform CRM', 'CRM', CURRENT_TIMESTAMP);
INSERT INTO "Workspace" ("id", "type", "name", "personalOwnerUserId", "updatedAt")
SELECT 'workspace_personal_' || u."id", 'PERSONAL', u."name" || ' CRM', u."id", CURRENT_TIMESTAMP
FROM "User" u
WHERE u."id" IN (SELECT "ownerUserId" FROM "CrmContact" WHERE "ownerUserId" IS NOT NULL UNION SELECT "ownerUserId" FROM "CrmLead" WHERE "ownerUserId" IS NOT NULL);
INSERT INTO "Workspace" ("id", "type", "name", "companyId", "updatedAt")
SELECT 'workspace_company_' || c."id", 'COMPANY', c."nameEn" || ' CRM', c."id", CURRENT_TIMESTAMP FROM "DeveloperCompany" c;

INSERT INTO "WorkspaceMember" ("id", "role", "workspaceId", "userId", "updatedAt")
SELECT 'workspace_member_personal_' || w."personalOwnerUserId", 'OWNER', w."id", w."personalOwnerUserId", CURRENT_TIMESTAMP FROM "Workspace" w WHERE w."type" = 'PERSONAL';
INSERT INTO "WorkspaceMember" ("id", "role", "active", "workspaceId", "userId", "createdById", "updatedAt")
SELECT 'workspace_member_pms_' || m."id",
  CASE WHEN m."role" = 'PMS_OWNER' THEN 'OWNER'::"WorkspaceMemberRole" WHEN m."role" = 'PMS_MANAGER' THEN 'MANAGER'::"WorkspaceMemberRole" WHEN m."role" = 'PMS_VIEWER' THEN 'VIEWER'::"WorkspaceMemberRole" ELSE 'MEMBER'::"WorkspaceMemberRole" END,
  m."active", 'workspace_company_' || m."companyId", m."userId", m."createdById", CURRENT_TIMESTAMP
FROM "PmsCompanyMember" m ON CONFLICT ("workspaceId", "userId") DO NOTHING;

INSERT INTO "WorkspacePermission" ("id", "key", "memberId", "updatedAt")
SELECT 'workspace_permission_view_' || wm."id", 'CRM_VIEW', wm."id", CURRENT_TIMESTAMP FROM "WorkspaceMember" wm;
INSERT INTO "WorkspacePermission" ("id", "key", "memberId", "updatedAt")
SELECT 'workspace_permission_manage_' || wm."id", 'CRM_MANAGE', wm."id", CURRENT_TIMESTAMP
FROM "WorkspaceMember" wm WHERE wm."role" IN ('OWNER', 'MANAGER', 'MEMBER');
INSERT INTO "WorkspacePermission" ("id", "key", "memberId", "updatedAt")
SELECT 'workspace_permission_assign_' || wm."id", 'CRM_ASSIGN', wm."id", CURRENT_TIMESTAMP
FROM "WorkspaceMember" wm WHERE wm."role" IN ('OWNER', 'MANAGER');
INSERT INTO "WorkspacePermission" ("id", "key", "memberId", "updatedAt")
SELECT 'workspace_permission_manage_workspace_' || wm."id", 'WORKSPACE_MANAGE', wm."id", CURRENT_TIMESTAMP
FROM "WorkspaceMember" wm WHERE wm."role" IN ('OWNER', 'MANAGER');

INSERT INTO "WorkspacePropertyScope" ("id", "memberId", "propertyId", "active", "updatedAt")
SELECT 'workspace_scope_' || a."id", 'workspace_member_pms_' || a."memberId", a."propertyId", a."active", CURRENT_TIMESTAMP
FROM "PmsMemberPropertyAccess" a
WHERE EXISTS (SELECT 1 FROM "WorkspaceMember" wm WHERE wm."id" = 'workspace_member_pms_' || a."memberId");

ALTER TABLE "CrmContact" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "CrmLead" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "CrmActivity" ADD COLUMN "workspaceId" TEXT;
UPDATE "CrmContact" SET "workspaceId" = CASE WHEN "companyId" IS NOT NULL THEN 'workspace_company_' || "companyId" WHEN "ownerUserId" IS NOT NULL THEN 'workspace_personal_' || "ownerUserId" ELSE 'workspace_platform_crm' END;
UPDATE "CrmLead" SET "workspaceId" = CASE WHEN "companyId" IS NOT NULL THEN 'workspace_company_' || "companyId" WHEN "ownerUserId" IS NOT NULL THEN 'workspace_personal_' || "ownerUserId" ELSE 'workspace_platform_crm' END;
UPDATE "CrmActivity" a SET "workspaceId" = l."workspaceId" FROM "CrmLead" l WHERE l."id" = a."leadId";
ALTER TABLE "CrmContact" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "CrmLead" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "CrmActivity" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "CrmContact"
    WHERE "normalizedEmail" IS NOT NULL
    GROUP BY "workspaceId", "normalizedEmail"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Stage 21F migration blocked: duplicate CRM normalizedEmail values exist inside one workspace. Merge or correct duplicate contacts, restore from backup if needed, then rerun prisma migrate deploy.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "CrmContact"
    WHERE "normalizedPhone" IS NOT NULL
    GROUP BY "workspaceId", "normalizedPhone"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Stage 21F migration blocked: duplicate CRM normalizedPhone values exist inside one workspace. Merge or correct duplicate contacts, restore from backup if needed, then rerun prisma migrate deploy.';
  END IF;
END $$;

CREATE UNIQUE INDEX "CrmContact_workspaceId_normalizedEmail_key" ON "CrmContact"("workspaceId", "normalizedEmail");
CREATE UNIQUE INDEX "CrmContact_workspaceId_normalizedPhone_key" ON "CrmContact"("workspaceId", "normalizedPhone");
CREATE INDEX "CrmContact_workspaceId_createdAt_idx" ON "CrmContact"("workspaceId", "createdAt");
CREATE INDEX "CrmLead_workspaceId_status_updatedAt_idx" ON "CrmLead"("workspaceId", "status", "updatedAt");
CREATE INDEX "CrmActivity_workspaceId_createdAt_idx" ON "CrmActivity"("workspaceId", "createdAt");
