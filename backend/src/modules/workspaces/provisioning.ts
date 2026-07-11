import type { Prisma, WorkspaceMemberRole, WorkspacePermissionKey } from '@prisma/client';

const roleMap: Record<string, WorkspaceMemberRole> = {
  PMS_OWNER: 'OWNER',
  PMS_MANAGER: 'MANAGER',
  PMS_ACCOUNTANT: 'MEMBER',
  PMS_MAINTENANCE: 'MEMBER',
  PMS_AGENT: 'MEMBER',
  PMS_VIEWER: 'VIEWER'
};

function defaultPermissions(role: WorkspaceMemberRole): WorkspacePermissionKey[] {
  if (role === 'OWNER' || role === 'MANAGER') return ['CRM_VIEW', 'CRM_MANAGE', 'CRM_ASSIGN', 'WORKSPACE_MANAGE'];
  if (role === 'MEMBER') return ['CRM_VIEW', 'CRM_MANAGE'];
  return ['CRM_VIEW'];
}

export async function ensureCompanyWorkspace(
  tx: Prisma.TransactionClient,
  company: { id: string; nameEn: string }
) {
  return tx.workspace.upsert({
    where: { companyId: company.id },
    update: { name: `${company.nameEn} CRM`, active: true },
    create: { type: 'COMPANY', name: `${company.nameEn} CRM`, companyId: company.id }
  });
}

export async function ensurePersonalWorkspace(
  tx: Prisma.TransactionClient,
  user: { id: string; name: string }
) {
  const workspace = await tx.workspace.upsert({
    where: { personalOwnerUserId: user.id },
    update: { name: `${user.name} CRM`, active: true },
    create: { type: 'PERSONAL', name: `${user.name} CRM`, personalOwnerUserId: user.id }
  });
  const member = await tx.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    update: { role: 'OWNER', active: true },
    create: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' }
  });
  await Promise.all(defaultPermissions('OWNER').map((key) => tx.workspacePermission.upsert({
    where: { memberId_key: { memberId: member.id, key } },
    update: { active: true },
    create: { memberId: member.id, key }
  })));
  return workspace;
}

export async function syncPmsMemberToWorkspace(
  tx: Prisma.TransactionClient,
  input: { id: string; companyId: string; userId: string; role: string; active: boolean; createdById?: string | null },
  companyName: string
) {
  const workspace = await ensureCompanyWorkspace(tx, { id: input.companyId, nameEn: companyName });
  const role = roleMap[input.role] ?? 'MEMBER';
  const member = await tx.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: input.userId } },
    update: { role, active: input.active },
    create: { workspaceId: workspace.id, userId: input.userId, role, active: input.active, createdById: input.createdById ?? null }
  });
  await Promise.all(defaultPermissions(role).map((key) => tx.workspacePermission.upsert({
    where: { memberId_key: { memberId: member.id, key } },
    update: { active: true },
    create: { memberId: member.id, key }
  })));
  const legacyScopes = await tx.pmsMemberPropertyAccess.findMany({
    where: { memberId: input.id, active: true },
    select: { propertyId: true }
  });
  await tx.workspacePropertyScope.deleteMany({ where: { memberId: member.id } });
  if (legacyScopes.length > 0) {
    await tx.workspacePropertyScope.createMany({
      data: legacyScopes.map((scope) => ({ memberId: member.id, propertyId: scope.propertyId })),
      skipDuplicates: true
    });
  }
  return { workspace, member };
}
