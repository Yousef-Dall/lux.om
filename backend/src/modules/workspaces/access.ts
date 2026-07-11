import type { Prisma, User, WorkspacePermissionKey } from '@prisma/client';

import { prisma } from '../../lib/prisma';
import { AppError } from '../../utils/http';
import { syncPmsMemberToWorkspace } from './provisioning';

const personalCrmRoles = ['OWNER', 'ACTIVITY_PROVIDER', 'TRAVEL_AGENCY', 'DEVELOPER'] as const;

export type WorkspaceAccessItem = {
  workspaceId: string;
  type: 'PERSONAL' | 'COMPANY' | 'PLATFORM';
  companyId: string | null;
  personalOwnerUserId: string | null;
  memberId: string | null;
  role: string;
  nameEn: string;
  nameAr: string | null;
  permissions: WorkspacePermissionKey[];
  canView: boolean;
  canManage: boolean;
  canAssign: boolean;
  canManageWorkspace: boolean;
  propertyScope: { allProperties: boolean; propertyIds: string[] };
};

export type CrmAccess = {
  userId: string;
  isAdmin: boolean;
  personalWorkspace: { enabled: boolean; canView: boolean; canManage: boolean; workspaceId?: string };
  companyWorkspaces: WorkspaceAccessItem[];
  platformWorkspace?: WorkspaceAccessItem;
  workspaces: WorkspaceAccessItem[];
};

const roleDefaults: Record<string, WorkspacePermissionKey[]> = {
  OWNER: ['CRM_VIEW', 'CRM_MANAGE', 'CRM_ASSIGN', 'WORKSPACE_MANAGE'],
  MANAGER: ['CRM_VIEW', 'CRM_MANAGE', 'CRM_ASSIGN', 'WORKSPACE_MANAGE'],
  MEMBER: ['CRM_VIEW', 'CRM_MANAGE'],
  VIEWER: ['CRM_VIEW']
};

function permissionsFor(member: { role: string; permissions: Array<{ key: WorkspacePermissionKey }> }) {
  return [...new Set([...(roleDefaults[member.role] ?? []), ...member.permissions.map((item) => item.key)])];
}

export async function getCrmAccess(user: Pick<User, 'id' | 'role'>): Promise<CrmAccess> {
  const personalEnabled = personalCrmRoles.includes(user.role as never);
  await prisma.$transaction(async (tx) => {
    if (personalEnabled) {
      const account = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { id: true, name: true } });
      const workspace = await tx.workspace.upsert({
        where: { personalOwnerUserId: user.id },
        update: { active: true },
        create: { type: 'PERSONAL', name: `${account.name} CRM`, personalOwnerUserId: user.id }
      });
      const member = await tx.workspaceMember.upsert({
        where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
        update: { active: true, role: 'OWNER' },
        create: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' }
      });
      for (const key of ['CRM_VIEW', 'CRM_MANAGE', 'CRM_ASSIGN', 'WORKSPACE_MANAGE'] as const) {
        await tx.workspacePermission.upsert({ where: { memberId_key: { memberId: member.id, key } }, update: { active: true }, create: { memberId: member.id, key } });
      }
    }
    const pmsMemberships = await tx.pmsCompanyMember.findMany({
      where: { userId: user.id },
      select: { id: true, companyId: true, userId: true, role: true, active: true, createdById: true, company: { select: { nameEn: true } } }
    });
    for (const membership of pmsMemberships) {
      await syncPmsMemberToWorkspace(tx, membership, membership.company.nameEn);
    }
  });

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id, active: true, workspace: { active: true } },
    select: {
      id: true,
      role: true,
      permissions: { where: { active: true }, select: { key: true } },
      propertyScopes: { where: { active: true }, select: { propertyId: true } },
      workspace: {
        select: {
          id: true,
          type: true,
          name: true,
          companyId: true,
          personalOwnerUserId: true,
          company: { select: { nameEn: true, nameAr: true } }
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const items: WorkspaceAccessItem[] = memberships.map((membership) => {
    const permissions = permissionsFor(membership);
    const propertyIds = membership.propertyScopes.map((scope) => scope.propertyId);
    return {
      workspaceId: membership.workspace.id,
      type: membership.workspace.type,
      companyId: membership.workspace.companyId,
      personalOwnerUserId: membership.workspace.personalOwnerUserId,
      memberId: membership.id,
      role: membership.role,
      nameEn: membership.workspace.company?.nameEn ?? membership.workspace.name,
      nameAr: membership.workspace.company?.nameAr ?? null,
      permissions,
      canView: permissions.includes('CRM_VIEW'),
      canManage: permissions.includes('CRM_MANAGE'),
      canAssign: permissions.includes('CRM_ASSIGN'),
      canManageWorkspace: permissions.includes('WORKSPACE_MANAGE'),
      propertyScope: { allProperties: propertyIds.length === 0, propertyIds }
    };
  });

  let platformWorkspace: WorkspaceAccessItem | undefined;
  let adminCompanyWorkspaces: WorkspaceAccessItem[] = [];
  if (user.role === 'ADMIN') {
    const companies = await prisma.workspace.findMany({
      where: { type: 'COMPANY', active: true },
      select: { id: true, companyId: true, name: true, company: { select: { nameEn: true, nameAr: true } } },
      orderBy: { name: 'asc' }
    });
    adminCompanyWorkspaces = companies.map((workspace) => ({
      workspaceId: workspace.id,
      type: 'COMPANY',
      companyId: workspace.companyId,
      personalOwnerUserId: null,
      memberId: null,
      role: 'ADMIN',
      nameEn: workspace.company?.nameEn ?? workspace.name,
      nameAr: workspace.company?.nameAr ?? null,
      permissions: ['CRM_VIEW', 'CRM_MANAGE', 'CRM_ASSIGN', 'WORKSPACE_MANAGE'],
      canView: true,
      canManage: true,
      canAssign: true,
      canManageWorkspace: true,
      propertyScope: { allProperties: true, propertyIds: [] }
    }));
    const platform = await prisma.workspace.findUnique({ where: { platformKey: 'CRM' } });
    if (platform) {
      platformWorkspace = {
        workspaceId: platform.id, type: 'PLATFORM', companyId: null, personalOwnerUserId: null,
        memberId: null, role: 'ADMIN', nameEn: platform.name, nameAr: null,
        permissions: ['CRM_VIEW', 'CRM_MANAGE', 'CRM_ASSIGN', 'WORKSPACE_MANAGE'],
        canView: true, canManage: true, canAssign: true, canManageWorkspace: true,
        propertyScope: { allProperties: true, propertyIds: [] }
      };
    }
  }

  const personal = items.find((item) => item.type === 'PERSONAL' && item.personalOwnerUserId === user.id);
  return {
    userId: user.id,
    isAdmin: user.role === 'ADMIN',
    personalWorkspace: {
      enabled: personalEnabled,
      canView: Boolean(personal?.canView && personalEnabled),
      canManage: Boolean(personal?.canManage && personalEnabled),
      workspaceId: personal?.workspaceId
    },
    companyWorkspaces: user.role === 'ADMIN' ? adminCompanyWorkspaces : items.filter((item) => item.type === 'COMPANY'),
    platformWorkspace,
    workspaces: [...items, ...adminCompanyWorkspaces, ...(platformWorkspace ? [platformWorkspace] : [])]
  };
}

export function hasAnyCrmAccess(access: CrmAccess) {
  return access.workspaces.some((workspace) => workspace.canView);
}
export function assertHasAnyCrmAccess(access: CrmAccess) {
  if (!hasAnyCrmAccess(access)) throw new AppError(403, 'CRM access is not enabled for this account.');
}
export function buildCrmLeadScope(access: CrmAccess, permission: 'view' | 'manage' = 'view'): Prisma.CrmLeadWhereInput {
  if (access.isAdmin) return {};
  const scopes = access.workspaces.filter((workspace) => permission === 'view' ? workspace.canView : workspace.canManage).map((workspace) => {
    if (workspace.type === 'COMPANY' && !workspace.propertyScope.allProperties) {
      return { workspaceId: workspace.workspaceId, pmsPropertyId: { in: workspace.propertyScope.propertyIds } } satisfies Prisma.CrmLeadWhereInput;
    }
    return { workspaceId: workspace.workspaceId } satisfies Prisma.CrmLeadWhereInput;
  });
  return scopes.length ? { OR: scopes } : { id: '__crm_no_access__' };
}
export function findCrmCompanyWorkspace(access: CrmAccess, companyId: string, permission: 'view' | 'manage' = 'view') {
  return access.companyWorkspaces.find((workspace) => workspace.companyId === companyId && (permission === 'view' ? workspace.canView : workspace.canManage));
}
export function findWorkspaceByLegacyOwner(access: CrmAccess, owner: { companyId?: string | null; ownerUserId?: string | null }) {
  if (owner.companyId) return access.companyWorkspaces.find((workspace) => workspace.companyId === owner.companyId);
  if (owner.ownerUserId === access.userId) return access.workspaces.find((workspace) => workspace.type === 'PERSONAL' && workspace.personalOwnerUserId === access.userId);
  if (access.isAdmin) return access.platformWorkspace;
  return undefined;
}
export function assertCrmWorkspaceAccess(access: CrmAccess, record: { workspaceId?: string | null; companyId?: string | null; ownerUserId?: string | null; pmsPropertyId?: string | null }, permission: 'view' | 'manage' = 'view') {
  if (access.isAdmin) return;
  const workspace = record.workspaceId ? access.workspaces.find((item) => item.workspaceId === record.workspaceId) : findWorkspaceByLegacyOwner(access, record);
  const allowed = workspace && (permission === 'view' ? workspace.canView : workspace.canManage);
  if (allowed && (workspace.type !== 'COMPANY' || workspace.propertyScope.allProperties || Boolean(record.pmsPropertyId && workspace.propertyScope.propertyIds.includes(record.pmsPropertyId)))) return;
  throw new AppError(403, permission === 'view' ? 'CRM record is outside your workspace.' : 'You cannot change this CRM record.');
}
export function assertCanCreateCrmLead(access: CrmAccess, record: { workspaceId?: string | null; companyId?: string | null; ownerUserId?: string | null; pmsPropertyId?: string | null }) {
  assertCrmWorkspaceAccess(access, record, 'manage');
}
