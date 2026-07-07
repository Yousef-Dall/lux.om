import { PmsEntitlementStatus, type PmsCompanyMember, type PmsMemberRole } from '@prisma/client';

import { prisma } from './prisma';

export const ACTIVE_PMS_ENTITLEMENT_STATUSES: PmsEntitlementStatus[] = [
  PmsEntitlementStatus.ACTIVE,
  PmsEntitlementStatus.TRIAL
];

export type PmsWorkspaceAccess = {
  member: Pick<PmsCompanyMember, 'id' | 'companyId' | 'userId' | 'role' | 'active'>;
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

  return {
    member: {
      id: member.id,
      companyId: member.companyId,
      userId: member.userId,
      role: member.role,
      active: member.active
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
    workspaces: workspaces.map((workspace) => ({
      memberId: workspace.id,
      role: workspace.role,
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
    }))
  };
}
