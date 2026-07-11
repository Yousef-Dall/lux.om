import {
  PmsEntitlementStatus,
  type PmsCompanyMember,
  type PmsMemberRole,
  type PmsPermissionKey,
} from '@prisma/client';

import { getDefaultPmsPermissionKeys } from './permissions';
import { prisma } from '../../../lib/prisma';

export const ACTIVE_PMS_ENTITLEMENT_STATUSES: PmsEntitlementStatus[] = [
  PmsEntitlementStatus.ACTIVE,
  PmsEntitlementStatus.TRIAL
];

export type PmsWorkspaceAccess = {
  member: Pick<PmsCompanyMember, 'id' | 'companyId' | 'userId' | 'role' | 'active'> & {
    permissionKeys: PmsPermissionKey[];
    propertyScope: {
      allProperties: boolean;
      propertyIds: string[];
    };
  };
  company: {
    id: string;
    slug: string;
    nameEn: string;
    nameAr: string | null;
    logo: string | null;
  };
  entitlement: {
    id: string;
    status: PmsEntitlementStatus;
    trialEndsAt: Date | null;
    enabledAt: Date | null;
    disabledAt: Date | null;
  };
};

export function isPmsEntitlementUsable(status: PmsEntitlementStatus, disabledAt?: Date | null) {
  return ACTIVE_PMS_ENTITLEMENT_STATUSES.includes(status) && !disabledAt;
}

export function canManagePmsWorkspace(role: PmsMemberRole) {
  return role === 'PMS_OWNER' || role === 'PMS_MANAGER';
}

export async function resolvePmsWorkspaceAccess(input: {
  userId: string;
  companyId?: string;
}): Promise<PmsWorkspaceAccess | null> {
  const member = await prisma.pmsCompanyMember.findFirst({
    where: {
      userId: input.userId,
      active: true,
      ...(input.companyId ? { companyId: input.companyId } : {}),
      company: {
        pmsEntitlement: {
          is: {
            status: {
              in: ACTIVE_PMS_ENTITLEMENT_STATUSES
            },
            disabledAt: null
          }
        }
      }
    },
    include: {
      permissions: {
        where: { active: true },
        select: { key: true },
        orderBy: { key: 'asc' },
      },
      propertyAccesses: {
        where: { active: true },
        select: { propertyId: true },
        orderBy: { propertyId: 'asc' },
      },
      company: {
        select: {
          id: true,
          slug: true,
          nameEn: true,
          nameAr: true,
          logo: true,
          pmsEntitlement: {
            select: {
              id: true,
              status: true,
              trialEndsAt: true,
              enabledAt: true,
              disabledAt: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  if (!member?.company.pmsEntitlement) {
    return null;
  }

  const propertyIds = member.propertyAccesses.map((scope) => scope.propertyId);

  return {
    member: {
      id: member.id,
      companyId: member.companyId,
      userId: member.userId,
      role: member.role,
      active: member.active,
      permissionKeys: Array.from(new Set([
        ...getDefaultPmsPermissionKeys(member.role),
        ...member.permissions.map((permission) => permission.key),
      ])),
      propertyScope: {
        allProperties: propertyIds.length === 0,
        propertyIds,
      },
    },
    company: {
      id: member.company.id,
      slug: member.company.slug,
      nameEn: member.company.nameEn,
      nameAr: member.company.nameAr,
      logo: member.company.logo
    },
    entitlement: member.company.pmsEntitlement
  };
}

export async function getUserPmsAccessSummary(userId: string) {
  const workspaces = await prisma.pmsCompanyMember.findMany({
    where: {
      userId,
      active: true,
      company: {
        pmsEntitlement: {
          is: {
            status: {
              in: ACTIVE_PMS_ENTITLEMENT_STATUSES
            },
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
        select: { key: true },
        orderBy: { key: 'asc' },
      },
      propertyAccesses: {
        where: { active: true },
        select: { propertyId: true },
        orderBy: { propertyId: 'asc' },
      },
      company: {
        select: {
          id: true,
          slug: true,
          nameEn: true,
          nameAr: true,
          pmsEntitlement: {
            select: {
              id: true,
              status: true,
              trialEndsAt: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  return {
    hasAccess: workspaces.length > 0,
    workspaces: workspaces.map((workspace) => {
      const propertyIds = workspace.propertyAccesses.map((scope) => scope.propertyId);
      return {
        memberId: workspace.id,
        role: workspace.role,
        permissionKeys: Array.from(new Set([
          ...getDefaultPmsPermissionKeys(workspace.role),
          ...workspace.permissions.map((permission) => permission.key),
        ])),
        propertyScope: {
          allProperties: propertyIds.length === 0,
          propertyIds,
        },
        company: {
          id: workspace.company.id,
          slug: workspace.company.slug,
          nameEn: workspace.company.nameEn,
          nameAr: workspace.company.nameAr
        },
        entitlement: workspace.company.pmsEntitlement
          ? {
              status: workspace.company.pmsEntitlement.status,
              trialEndsAt: workspace.company.pmsEntitlement.trialEndsAt
            }
          : null
      };
    })
  };
}
