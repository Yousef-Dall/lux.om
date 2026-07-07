import {
  AccountSecurityEventType,
  PmsEntitlementStatus,
  PmsMemberRole,
  type Prisma
} from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { recordAccountSecurityEvent } from '../lib/accountSecurityEvents';
import { prisma } from '../lib/prisma';
import {
  ACTIVE_PMS_ENTITLEMENT_STATUSES,
  resolvePmsWorkspaceAccess
} from '../lib/pmsAccess';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { AppError } from '../utils/http';

export const pmsRouter = Router();

const idParamsSchema = z.object({
  id: z.string().trim().min(1)
});

const companyParamsSchema = z.object({
  companyId: z.string().trim().min(1)
});

const pmsOverviewQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional()
});

const adminPmsCompaniesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z
    .enum(['ALL', ...Object.values(PmsEntitlementStatus)] as [
      'ALL',
      ...PmsEntitlementStatus[]
    ])
    .default('ALL'),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0)
});

const entitlementUpdateSchema = z
  .object({
    status: z.nativeEnum(PmsEntitlementStatus),
    notes: z.string().trim().max(1000).optional(),
    trialEndsAt: z.coerce.date().optional().nullable()
  })
  .strict();

const memberUpsertSchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    email: z.string().trim().email().toLowerCase().optional(),
    role: z.nativeEnum(PmsMemberRole),
    active: z.boolean().default(true)
  })
  .strict()
  .refine((data) => Boolean(data.userId || data.email), {
    path: ['userId'],
    message: 'Provide a user id or email for the PMS member.'
  });

const memberUpdateSchema = z
  .object({
    role: z.nativeEnum(PmsMemberRole).optional(),
    active: z.boolean().optional()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one member field is required.'
  });

const pmsCompanyInclude = {
  pmsEntitlement: true,
  pmsMembers: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          suspendedAt: true,
          deactivatedAt: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc' as const
    }
  },
  _count: {
    select: {
      listings: true,
      projects: true,
      pmsMembers: true
    }
  }
};

type PmsCompanyWithAccess = Prisma.DeveloperCompanyGetPayload<{
  include: typeof pmsCompanyInclude;
}>;

function isEntitlementEnabledStatus(status: PmsEntitlementStatus) {
  return ACTIVE_PMS_ENTITLEMENT_STATUSES.includes(status);
}

function companyName(company: { nameEn: string; nameAr?: string | null }) {
  return company.nameEn || company.nameAr || 'PMS company';
}

async function recordPmsAdminAudit(input: {
  adminId: string;
  adminEmail: string;
  title: string;
  message: string;
  metadata: Prisma.InputJsonObject;
  targetUserId?: string;
}) {
  await recordAccountSecurityEvent(prisma, {
    userId: input.targetUserId ?? input.adminId,
    actorId: input.adminId,
    type: AccountSecurityEventType.ADMIN_PMS_ACCESS_UPDATED,
    title: input.title,
    message: input.message,
    metadata: {
      adminId: input.adminId,
      adminEmail: input.adminEmail,
      ...input.metadata
    } as Prisma.InputJsonObject
  });
}

function pmsCompanyResponse(company: PmsCompanyWithAccess) {
  return {
    id: company.id,
    slug: company.slug,
    nameEn: company.nameEn,
    nameAr: company.nameAr,
    headquartersEn: company.headquartersEn,
    headquartersAr: company.headquartersAr,
    email: company.email,
    verified: company.verified,
    featured: company.featured,
    pmsEntitlement: company.pmsEntitlement,
    pmsMembers: company.pmsMembers.map((member) => ({
      id: member.id,
      role: member.role,
      active: member.active,
      invitedEmail: member.invitedEmail,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      user: member.user
    })),
    counts: {
      listings: company._count.listings,
      projects: company._count.projects,
      pmsMembers: company._count.pmsMembers
    },
    createdAt: company.createdAt,
    updatedAt: company.updatedAt
  };
}

function buildAdminPmsCompaniesWhere(input: z.infer<typeof adminPmsCompaniesQuerySchema>) {
  const search = input.search?.trim();
  const where: Prisma.DeveloperCompanyWhereInput = {
    ...(input.status !== 'ALL'
      ? {
          pmsEntitlement: {
            is: {
              status: input.status
            }
          }
        }
      : {}),
    ...(search
      ? {
          OR: [
            {
              nameEn: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              nameAr: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              email: {
                contains: search,
                mode: 'insensitive'
              }
            },
            {
              headquartersEn: {
                contains: search,
                mode: 'insensitive'
              }
            }
          ]
        }
      : {})
  };

  return where;
}

pmsRouter.get('/admin/companies', requireAuth(), requireAdmin(), async (req, res, next) => {
  try {
    const query = adminPmsCompaniesQuerySchema.parse(req.query);
    const where = buildAdminPmsCompaniesWhere(query);

    const [companies, total] = await prisma.$transaction([
      prisma.developerCompany.findMany({
        where,
        include: pmsCompanyInclude,
        orderBy: [
          {
            updatedAt: 'desc'
          },
          {
            nameEn: 'asc'
          }
        ],
        take: query.take,
        skip: query.skip
      }),
      prisma.developerCompany.count({ where })
    ]);

    res.json({
      companies: companies.map(pmsCompanyResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: companies.length,
        total
      }
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch(
  '/admin/companies/:companyId/entitlement',
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'Unauthorized');
      }

      const { companyId } = companyParamsSchema.parse(req.params);
      const data = entitlementUpdateSchema.parse(req.body);
      const company = await prisma.developerCompany.findUnique({
        where: {
          id: companyId
        },
        include: {
          pmsEntitlement: true
        }
      });

      if (!company) {
        throw new AppError(404, 'Developer company not found');
      }

      const now = new Date();
      const nextEnabled = isEntitlementEnabledStatus(data.status);
      const entitlement = await prisma.pmsCompanyEntitlement.upsert({
        where: {
          companyId
        },
        create: {
          companyId,
          status: data.status,
          notes: data.notes,
          trialEndsAt: data.trialEndsAt?.toISOString() ?? null,
          enabledAt: nextEnabled ? now : null,
          disabledAt: nextEnabled ? null : now,
          createdById: req.user.id,
          updatedById: req.user.id
        },
        update: {
          status: data.status,
          notes: data.notes,
          trialEndsAt: data.trialEndsAt?.toISOString() ?? null,
          enabledAt:
            nextEnabled && !company.pmsEntitlement?.enabledAt
              ? now
              : company.pmsEntitlement?.enabledAt,
          disabledAt: nextEnabled ? null : now,
          updatedById: req.user.id
        }
      });

      await recordPmsAdminAudit({
        adminId: req.user.id,
        adminEmail: req.user.email,
        title: 'PMS entitlement updated',
        message: `${companyName(company)} PMS entitlement changed to ${data.status}.`,
        metadata: {
          companyId,
          companyName: companyName(company),
          status: data.status,
          notes: data.notes ?? null,
          trialEndsAt: data.trialEndsAt?.toISOString() ?? null
        }
      });

      const refreshed = await prisma.developerCompany.findUniqueOrThrow({
        where: {
          id: companyId
        },
        include: pmsCompanyInclude
      });

      res.json({
        entitlement,
        company: pmsCompanyResponse(refreshed)
      });
    } catch (error) {
      next(error);
    }
  }
);

pmsRouter.post(
  '/admin/companies/:companyId/members',
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, 'Unauthorized');
      }

      const { companyId } = companyParamsSchema.parse(req.params);
      const data = memberUpsertSchema.parse(req.body);
      const company = await prisma.developerCompany.findUnique({
        where: {
          id: companyId
        },
        include: {
          pmsEntitlement: true
        }
      });

      if (!company) {
        throw new AppError(404, 'Developer company not found');
      }

      if (!company.pmsEntitlement) {
        throw new AppError(400, 'Enable PMS access for the company before adding staff.');
      }

      const targetUser = await prisma.user.findFirst({
        where: data.userId
          ? {
              id: data.userId
            }
          : {
              email: data.email
            }
      });

      if (!targetUser) {
        throw new AppError(404, 'User not found');
      }

      if (targetUser.suspendedAt || targetUser.deactivatedAt) {
        throw new AppError(400, 'Suspended or deleted users cannot be added to PMS access.');
      }

      const member = await prisma.pmsCompanyMember.upsert({
        where: {
          companyId_userId: {
            companyId,
            userId: targetUser.id
          }
        },
        create: {
          companyId,
          userId: targetUser.id,
          invitedEmail: targetUser.email,
          role: data.role,
          active: data.active,
          createdById: req.user.id
        },
        update: {
          invitedEmail: targetUser.email,
          role: data.role,
          active: data.active
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              suspendedAt: true,
              deactivatedAt: true
            }
          }
        }
      });

      await recordPmsAdminAudit({
        adminId: req.user.id,
        adminEmail: req.user.email,
        targetUserId: targetUser.id,
        title: 'PMS workspace access updated',
        message: `Your PMS access for ${companyName(company)} was updated to ${data.role}.`,
        metadata: {
          companyId,
          companyName: companyName(company),
          memberId: member.id,
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          role: data.role,
          active: data.active
        }
      });

      res.status(201).json({
        member
      });
    } catch (error) {
      next(error);
    }
  }
);

pmsRouter.patch('/admin/members/:id', requireAuth(), requireAdmin(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized');
    }

    const { id } = idParamsSchema.parse(req.params);
    const data = memberUpdateSchema.parse(req.body);
    const existingMember = await prisma.pmsCompanyMember.findUnique({
      where: {
        id
      },
      include: {
        company: true,
        user: true
      }
    });

    if (!existingMember) {
      throw new AppError(404, 'PMS member not found');
    }

    const member = await prisma.pmsCompanyMember.update({
      where: {
        id
      },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            suspendedAt: true,
            deactivatedAt: true
          }
        }
      }
    });

    await recordPmsAdminAudit({
      adminId: req.user.id,
      adminEmail: req.user.email,
      targetUserId: existingMember.userId,
      title: 'PMS workspace membership updated',
      message: `Your PMS workspace access for ${companyName(existingMember.company)} was updated.`,
      metadata: {
        companyId: existingMember.companyId,
        companyName: companyName(existingMember.company),
        memberId: existingMember.id,
        targetUserId: existingMember.userId,
        targetEmail: existingMember.user.email,
        role: member.role,
        active: member.active
      }
    });

    res.json({
      member
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get('/overview', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, 'Unauthorized');
    }

    const query = pmsOverviewQuerySchema.parse(req.query);
    const access = await resolvePmsWorkspaceAccess({
      userId: req.user.id,
      companyId: query.companyId
    });

    if (!access) {
      throw new AppError(403, 'PMS access is not enabled for this account.');
    }

    const companyId = access.company.id;
    const [
      companies,
      totalListings,
      approvedListings,
      totalProjects,
      approvedProjects,
      activeRentSchedules,
      openContracts,
      pendingRentDueItems,
      overdueRentDueItems,
      activeTransactions
    ] = await prisma.$transaction([
      prisma.pmsCompanyMember.findMany({
        where: {
          userId: req.user.id,
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
      }),
      prisma.listing.count({
        where: {
          developerId: companyId
        }
      }),
      prisma.listing.count({
        where: {
          developerId: companyId,
          status: 'APPROVED'
        }
      }),
      prisma.developerProject.count({
        where: {
          developerId: companyId
        }
      }),
      prisma.developerProject.count({
        where: {
          developerId: companyId,
          status: 'APPROVED'
        }
      }),
      prisma.rentPaymentSchedule.count({
        where: {
          active: true,
          listing: {
            developerId: companyId
          }
        }
      }),
      prisma.rentalContractDraft.count({
        where: {
          status: {
            not: 'ARCHIVED'
          },
          listing: {
            developerId: companyId
          }
        }
      }),
      prisma.rentPaymentDueItem.count({
        where: {
          status: {
            in: ['PENDING', 'DUE_SOON']
          },
          schedule: {
            listing: {
              developerId: companyId
            }
          }
        }
      }),
      prisma.rentPaymentDueItem.count({
        where: {
          status: 'OVERDUE',
          schedule: {
            listing: {
              developerId: companyId
            }
          }
        }
      }),
      prisma.marketplaceTransaction.count({
        where: {
          status: {
            in: ['DRAFT', 'ACTIVE', 'DISPUTED']
          },
          listing: {
            developerId: companyId
          }
        }
      })
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement
      },
      companies: companies.map((member) => ({
        memberId: member.id,
        role: member.role,
        company: member.company
      })),
      metrics: {
        totalListings,
        approvedListings,
        draftOrPendingListings: Math.max(totalListings - approvedListings, 0),
        totalProjects,
        approvedProjects,
        draftOrPendingProjects: Math.max(totalProjects - approvedProjects, 0),
        activeRentSchedules,
        openContracts,
        pendingRentDueItems,
        overdueRentDueItems,
        activeTransactions
      },
      emptyStates: {
        properties: totalListings === 0,
        rentals: activeRentSchedules === 0,
        contracts: openContracts === 0,
        accounting: pendingRentDueItems + overdueRentDueItems === 0
      }
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get('/', requireAuth(), async (req, res, next) => {
  req.url = `/overview${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  pmsRouter(req, res, next);
});
