import type { Prisma, Role, User } from '@prisma/client';

import { prisma } from './prisma';
import { getPmsPermissionKeys } from './pmsPermissions';
import { AppError } from '../utils/http';

const personalCrmRoles: Role[] = ['OWNER', 'ACTIVITY_PROVIDER', 'TRAVEL_AGENCY', 'DEVELOPER'];

type CrmCompanyWorkspace = {
  companyId: string;
  memberId: string;
  role: string;
  nameEn: string;
  nameAr: string | null;
  canView: boolean;
  canManage: boolean;
  propertyScope: {
    allProperties: boolean;
    propertyIds: string[];
  };
};

export type CrmAccess = {
  userId: string;
  isAdmin: boolean;
  personalWorkspace: {
    enabled: boolean;
    canView: boolean;
    canManage: boolean;
  };
  companyWorkspaces: CrmCompanyWorkspace[];
};

export async function getCrmAccess(user: Pick<User, 'id' | 'role'>): Promise<CrmAccess> {
  if (user.role === 'ADMIN') {
    const companies = await prisma.developerCompany.findMany({
      where: {
        OR: [
          { crmLeads: { some: {} } },
          { pmsEntitlement: { is: { status: { in: ['ACTIVE', 'TRIAL'] }, disabledAt: null } } }
        ]
      },
      select: { id: true, nameEn: true, nameAr: true },
      orderBy: { nameEn: 'asc' }
    });

    return {
      userId: user.id,
      isAdmin: true,
      personalWorkspace: { enabled: false, canView: true, canManage: true },
      companyWorkspaces: companies.map((company) => ({
        companyId: company.id,
        memberId: `admin:${company.id}`,
        role: 'ADMIN',
        nameEn: company.nameEn,
        nameAr: company.nameAr,
        canView: true,
        canManage: true,
        propertyScope: { allProperties: true, propertyIds: [] }
      }))
    };
  }

  const memberships = await prisma.pmsCompanyMember.findMany({
    where: {
      userId: user.id,
      active: true,
      company: {
        pmsEntitlement: {
          is: {
            status: { in: ['ACTIVE', 'TRIAL'] },
            disabledAt: null
          }
        }
      }
    },
    select: {
      id: true,
      role: true,
      permissions: {
        where: { active: true },
        select: { key: true }
      },
      propertyAccesses: {
        where: { active: true },
        select: { propertyId: true }
      },
      company: {
        select: { id: true, nameEn: true, nameAr: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const personalEnabled = personalCrmRoles.includes(user.role);

  return {
    userId: user.id,
    isAdmin: false,
    personalWorkspace: {
      enabled: personalEnabled,
      canView: personalEnabled,
      canManage: personalEnabled
    },
    companyWorkspaces: memberships.map((membership) => {
      const permissionKeys = new Set([
        ...getPmsPermissionKeys(membership.role),
        ...membership.permissions.map((permission) => permission.key)
      ]);
      const propertyIds = membership.propertyAccesses.map((scope) => scope.propertyId);

      return {
        companyId: membership.company.id,
        memberId: membership.id,
        role: membership.role,
        nameEn: membership.company.nameEn,
        nameAr: membership.company.nameAr,
        canView: permissionKeys.has('CRM_VIEW'),
        canManage: permissionKeys.has('CRM_MANAGE'),
        propertyScope: {
          allProperties: propertyIds.length === 0,
          propertyIds
        }
      };
    })
  };
}

export function hasAnyCrmAccess(access: CrmAccess) {
  return (
    access.isAdmin ||
    access.personalWorkspace.canView ||
    access.companyWorkspaces.some((workspace) => workspace.canView)
  );
}

export function assertHasAnyCrmAccess(access: CrmAccess) {
  if (!hasAnyCrmAccess(access)) {
    throw new AppError(403, 'CRM access is not enabled for this account.');
  }
}

function companyScopeWhere(workspace: CrmCompanyWorkspace): Prisma.CrmLeadWhereInput {
  if (workspace.propertyScope.allProperties) {
    return { companyId: workspace.companyId };
  }

  return {
    companyId: workspace.companyId,
    pmsPropertyId: { in: workspace.propertyScope.propertyIds }
  };
}

export function buildCrmLeadScope(
  access: CrmAccess,
  permission: 'view' | 'manage' = 'view'
): Prisma.CrmLeadWhereInput {
  if (access.isAdmin) return {};

  const scopes: Prisma.CrmLeadWhereInput[] = [];

  if (
    permission === 'view'
      ? access.personalWorkspace.canView
      : access.personalWorkspace.canManage
  ) {
    scopes.push({ ownerUserId: access.userId });
  }

  for (const workspace of access.companyWorkspaces) {
    const allowed = permission === 'view' ? workspace.canView : workspace.canManage;
    if (allowed) scopes.push(companyScopeWhere(workspace));
  }

  return scopes.length > 0 ? { OR: scopes } : { id: '__crm_no_access__' };
}

export function findCrmCompanyWorkspace(
  access: CrmAccess,
  companyId: string,
  permission: 'view' | 'manage' = 'view'
) {
  return access.companyWorkspaces.find(
    (workspace) =>
      workspace.companyId === companyId &&
      (permission === 'view' ? workspace.canView : workspace.canManage)
  );
}

export function assertCrmWorkspaceAccess(
  access: CrmAccess,
  workspace: { companyId?: string | null; ownerUserId?: string | null; pmsPropertyId?: string | null },
  permission: 'view' | 'manage' = 'view'
) {
  if (access.isAdmin) return;

  if (workspace.ownerUserId === access.userId) {
    const allowed =
      permission === 'view'
        ? access.personalWorkspace.canView
        : access.personalWorkspace.canManage;
    if (allowed) return;
  }

  if (workspace.companyId) {
    const companyWorkspace = findCrmCompanyWorkspace(access, workspace.companyId, permission);
    if (companyWorkspace) {
      if (companyWorkspace.propertyScope.allProperties) return;
      if (
        workspace.pmsPropertyId &&
        companyWorkspace.propertyScope.propertyIds.includes(workspace.pmsPropertyId)
      ) {
        return;
      }
    }
  }

  throw new AppError(403, permission === 'view' ? 'CRM record is outside your workspace.' : 'You cannot change this CRM record.');
}

export function assertCanCreateCrmLead(
  access: CrmAccess,
  workspace: { companyId?: string | null; ownerUserId?: string | null; pmsPropertyId?: string | null }
) {
  assertCrmWorkspaceAccess(access, workspace, 'manage');

  if (
    workspace.companyId &&
    !access.isAdmin &&
    !workspace.pmsPropertyId
  ) {
    const companyWorkspace = findCrmCompanyWorkspace(access, workspace.companyId, 'manage');
    if (companyWorkspace && !companyWorkspace.propertyScope.allProperties) {
      throw new AppError(400, 'Choose an assigned PMS property for this company CRM lead.');
    }
  }
}
