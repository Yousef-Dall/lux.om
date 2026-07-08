import { PmsLeaseStatus, type PmsTenantPortalAccess } from '@prisma/client';

import {
  ACTIVE_PMS_ENTITLEMENT_STATUSES,
  isPmsEntitlementUsable
} from './pmsAccess';
import { prisma } from './prisma';

export type TenantPortalAccessSummary = {
  hasAccess: boolean;
  tenancies: Array<{
    accessId: string;
    active: boolean;
    company: {
      id: string;
      slug: string;
      nameEn: string;
      nameAr: string | null;
      logo: string | null;
    };
    tenant: {
      id: string;
      fullName: string;
      email: string | null;
      phone: string | null;
    };
  }>;
};

export type TenantPortalWorkspaceAccess = {
  access: Pick<PmsTenantPortalAccess, 'id' | 'companyId' | 'tenantId' | 'userId' | 'active'>;
  company: {
    id: string;
    slug: string;
    nameEn: string;
    nameAr: string | null;
    logo: string | null;
  };
  tenant: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactEmail: string | null;
    active: boolean;
  };
};

const tenantPortalAccessSelect = {
  id: true,
  companyId: true,
  tenantId: true,
  userId: true,
  active: true,
  company: {
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      logo: true,
      pmsEntitlement: {
        select: {
          status: true,
          disabledAt: true
        }
      }
    }
  },
  tenant: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactEmail: true,
      active: true
    }
  }
} as const;

export async function getUserTenantPortalAccessSummary(
  userId: string
): Promise<TenantPortalAccessSummary> {
  const accesses = await prisma.pmsTenantPortalAccess.findMany({
    where: {
      userId,
      active: true,
      tenant: {
        active: true
      },
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
    select: tenantPortalAccessSelect,
    orderBy: {
      createdAt: 'asc'
    }
  });

  const tenancies = accesses
    .filter((access) =>
      access.company.pmsEntitlement
        ? isPmsEntitlementUsable(
            access.company.pmsEntitlement.status,
            access.company.pmsEntitlement.disabledAt
          )
        : false
    )
    .map((access) => ({
      accessId: access.id,
      active: access.active,
      company: {
        id: access.company.id,
        slug: access.company.slug,
        nameEn: access.company.nameEn,
        nameAr: access.company.nameAr,
        logo: access.company.logo
      },
      tenant: {
        id: access.tenant.id,
        fullName: access.tenant.fullName,
        email: access.tenant.email,
        phone: access.tenant.phone
      }
    }));

  return {
    hasAccess: tenancies.length > 0,
    tenancies
  };
}

export async function resolveTenantPortalAccess(input: {
  userId: string;
  accessId?: string;
}): Promise<TenantPortalWorkspaceAccess | null> {
  const access = await prisma.pmsTenantPortalAccess.findFirst({
    where: {
      userId: input.userId,
      active: true,
      ...(input.accessId ? { id: input.accessId } : {}),
      tenant: {
        active: true
      },
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
    select: tenantPortalAccessSelect,
    orderBy: {
      createdAt: 'asc'
    }
  });

  if (!access?.company.pmsEntitlement) {
    return null;
  }

  if (
    !isPmsEntitlementUsable(
      access.company.pmsEntitlement.status,
      access.company.pmsEntitlement.disabledAt
    )
  ) {
    return null;
  }

  return {
    access: {
      id: access.id,
      companyId: access.companyId,
      tenantId: access.tenantId,
      userId: access.userId,
      active: access.active
    },
    company: {
      id: access.company.id,
      slug: access.company.slug,
      nameEn: access.company.nameEn,
      nameAr: access.company.nameAr,
      logo: access.company.logo
    },
    tenant: access.tenant
  };
}

export function activeTenantLeaseWhere(input: {
  companyId: string;
  tenantId: string;
}) {
  return {
    companyId: input.companyId,
    tenantId: input.tenantId,
    status: {
      in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING]
    }
  };
}
