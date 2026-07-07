import {
  AccountSecurityEventType,
  PaymentScheduleFrequency,
  PmsEntitlementStatus,
  PmsLeaseStatus,
  PmsMemberRole,
  PmsOccupancyStatus,
  PmsRentDueStatus,
  PmsUnitStatus,
  type Prisma,
} from "@prisma/client";
import { Router } from "express";
import { z } from "zod";

import { recordAccountSecurityEvent } from "../lib/accountSecurityEvents";
import { prisma } from "../lib/prisma";
import {
  ACTIVE_PMS_ENTITLEMENT_STATUSES,
  resolvePmsWorkspaceAccess,
} from "../lib/pmsAccess";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { AppError } from "../utils/http";

export const pmsRouter = Router();

const idParamsSchema = z.object({
  id: z.string().trim().min(1),
});

const companyParamsSchema = z.object({
  companyId: z.string().trim().min(1),
});

const pmsOverviewQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
});

const pmsPropertyListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  active: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsUnitListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  status: z
    .enum(["ALL", ...Object.values(PmsUnitStatus)] as [
      "ALL",
      ...PmsUnitStatus[],
    ])
    .default("ALL"),
  take: z.coerce.number().int().min(1).max(200).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsPropertyParamsSchema = z.object({
  propertyId: z.string().trim().min(1),
});

const pmsUnitParamsSchema = z.object({
  unitId: z.string().trim().min(1),
});

const nullableTrimmedString = (max = 500) =>
  z.string().trim().max(max).optional().nullable();
const nullableId = z.string().trim().min(1).optional().nullable();
const nullableLatitude = z.coerce
  .number()
  .min(-90)
  .max(90)
  .optional()
  .nullable();
const nullableLongitude = z.coerce
  .number()
  .min(-180)
  .max(180)
  .optional()
  .nullable();

const pmsPropertyCreateSchema = z
  .object({
    companyId: z.string().trim().min(1),
    name: z.string().trim().min(2).max(180),
    code: nullableTrimmedString(80),
    propertyType: nullableTrimmedString(80),
    description: nullableTrimmedString(2000),
    addressLine: nullableTrimmedString(240),
    city: nullableTrimmedString(120),
    area: nullableTrimmedString(120),
    notes: nullableTrimmedString(2000),
    active: z.boolean().default(true),
    mapPlaceLabel: nullableTrimmedString(180),
    mapAddress: nullableTrimmedString(260),
    mapGoogleUrl: nullableTrimmedString(600),
    latitude: nullableLatitude,
    longitude: nullableLongitude,
    developerProjectId: nullableId,
    publicListingId: nullableId,
  })
  .strict();

const pmsPropertyUpdateSchema = pmsPropertyCreateSchema
  .omit({ companyId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one PMS property field is required.",
  });

const pmsUnitCreateSchema = z
  .object({
    unitNumber: z.string().trim().min(1).max(80),
    unitName: nullableTrimmedString(160),
    floor: nullableTrimmedString(40),
    bedrooms: z.coerce.number().int().min(0).max(50).optional().nullable(),
    bathrooms: z.coerce.number().int().min(0).max(50).optional().nullable(),
    areaSqm: z.coerce.number().int().min(0).max(200000).optional().nullable(),
    status: z.nativeEnum(PmsUnitStatus).default(PmsUnitStatus.VACANT),
    occupancyStatus: z.nativeEnum(PmsOccupancyStatus).optional().nullable(),
    rentAmount: z.coerce.number().min(0).max(100000000).optional().nullable(),
    currency: z.string().trim().length(3).toUpperCase().default("OMR"),
    notes: nullableTrimmedString(2000),
    developerProjectId: nullableId,
    publicListingId: nullableId,
  })
  .strict();

const pmsUnitUpdateSchema = pmsUnitCreateSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one PMS unit field is required.",
  });

const pmsTenantListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  search: z.string().trim().max(120).optional(),
  active: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsLeaseListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  unitId: z.string().trim().min(1).optional(),
  status: z
    .enum(["ALL", ...Object.values(PmsLeaseStatus)] as [
      "ALL",
      ...PmsLeaseStatus[],
    ])
    .default("ALL"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsRentDueListQuerySchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  leaseId: z.string().trim().min(1).optional(),
  tenantId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).optional(),
  unitId: z.string().trim().min(1).optional(),
  status: z
    .enum(["ALL", ...Object.values(PmsRentDueStatus)] as [
      "ALL",
      ...PmsRentDueStatus[],
    ])
    .default("ALL"),
  take: z.coerce.number().int().min(1).max(200).default(100),
  skip: z.coerce.number().int().min(0).default(0),
});

const pmsTenantParamsSchema = z.object({
  tenantId: z.string().trim().min(1),
});

const pmsLeaseParamsSchema = z.object({
  leaseId: z.string().trim().min(1),
});

const pmsRentDueParamsSchema = z.object({
  rentDueItemId: z.string().trim().min(1),
});

const pmsTenantCreateSchema = z
  .object({
    companyId: z.string().trim().min(1),
    fullName: z.string().trim().min(2).max(180),
    phone: nullableTrimmedString(80),
    email: z.string().trim().email().optional().nullable(),
    nationality: nullableTrimmedString(120),
    nationalId: nullableTrimmedString(120),
    passportNumber: nullableTrimmedString(120),
    emergencyContactName: nullableTrimmedString(180),
    emergencyContactPhone: nullableTrimmedString(80),
    emergencyContactEmail: z.string().trim().email().optional().nullable(),
    notes: nullableTrimmedString(2000),
    active: z.boolean().default(true),
  })
  .strict();

const pmsTenantUpdateSchema = pmsTenantCreateSchema
  .omit({ companyId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one PMS tenant field is required.",
  });

const pmsLeaseCreateSchema = z
  .object({
    companyId: z.string().trim().min(1),
    tenantId: z.string().trim().min(1),
    propertyId: z.string().trim().min(1),
    unitId: z.string().trim().min(1),
    title: nullableTrimmedString(180),
    status: z.nativeEnum(PmsLeaseStatus).default(PmsLeaseStatus.ACTIVE),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().optional().nullable(),
    rentFrequency: z
      .nativeEnum(PaymentScheduleFrequency)
      .default(PaymentScheduleFrequency.MONTHLY),
    rentAmount: z.coerce.number().min(0).max(100000000),
    currency: z.string().trim().length(3).toUpperCase().default("OMR"),
    securityDeposit: z.coerce
      .number()
      .min(0)
      .max(100000000)
      .optional()
      .nullable(),
    dueDayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    contractDraftId: nullableId,
    notes: nullableTrimmedString(2000),
    generateRentDueItems: z.boolean().default(true),
  })
  .strict()
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    path: ["endDate"],
    message: "Lease end date must be after the start date.",
  });

const pmsLeaseUpdateSchema = z
  .object({
    title: nullableTrimmedString(180),
    status: z.nativeEnum(PmsLeaseStatus).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional().nullable(),
    rentFrequency: z.nativeEnum(PaymentScheduleFrequency).optional(),
    rentAmount: z.coerce.number().min(0).max(100000000).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    securityDeposit: z.coerce
      .number()
      .min(0)
      .max(100000000)
      .optional()
      .nullable(),
    dueDayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
    contractDraftId: nullableId,
    notes: nullableTrimmedString(2000),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one PMS lease field is required.",
  });

const pmsRentDueUpdateSchema = z
  .object({
    status: z.nativeEnum(PmsRentDueStatus).optional(),
    paidAmount: z.coerce.number().min(0).max(100000000).optional(),
    paidAt: z.coerce.date().optional().nullable(),
    notes: nullableTrimmedString(2000),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one rent due item field is required.",
  });

const adminPmsCompaniesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z
    .enum(["ALL", ...Object.values(PmsEntitlementStatus)] as [
      "ALL",
      ...PmsEntitlementStatus[],
    ])
    .default("ALL"),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

const entitlementUpdateSchema = z
  .object({
    status: z.nativeEnum(PmsEntitlementStatus),
    notes: z.string().trim().max(1000).optional(),
    trialEndsAt: z.coerce.date().optional().nullable(),
  })
  .strict();

const memberUpsertSchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    email: z.string().trim().email().toLowerCase().optional(),
    role: z.nativeEnum(PmsMemberRole),
    active: z.boolean().default(true),
  })
  .strict()
  .refine((data) => Boolean(data.userId || data.email), {
    path: ["userId"],
    message: "Provide a user id or email for the PMS member.",
  });

const memberUpdateSchema = z
  .object({
    role: z.nativeEnum(PmsMemberRole).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one member field is required.",
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
          deactivatedAt: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc" as const,
    },
  },
  _count: {
    select: {
      listings: true,
      projects: true,
      pmsMembers: true,
      pmsProperties: true,
    },
  },
};

type PmsCompanyWithAccess = Prisma.DeveloperCompanyGetPayload<{
  include: typeof pmsCompanyInclude;
}>;

function isEntitlementEnabledStatus(status: PmsEntitlementStatus) {
  return ACTIVE_PMS_ENTITLEMENT_STATUSES.includes(status);
}

function companyName(company: { nameEn: string; nameAr?: string | null }) {
  return company.nameEn || company.nameAr || "PMS company";
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
      ...input.metadata,
    } as Prisma.InputJsonObject,
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
      user: member.user,
    })),
    counts: {
      listings: company._count.listings,
      projects: company._count.projects,
      pmsMembers: company._count.pmsMembers,
      pmsProperties: company._count.pmsProperties,
    },
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

function buildAdminPmsCompaniesWhere(
  input: z.infer<typeof adminPmsCompaniesQuerySchema>,
) {
  const search = input.search?.trim();
  const where: Prisma.DeveloperCompanyWhereInput = {
    ...(input.status !== "ALL"
      ? {
          pmsEntitlement: {
            is: {
              status: input.status,
            },
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            {
              nameEn: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              nameAr: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              email: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              headquartersEn: {
                contains: search,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };

  return where;
}

pmsRouter.get(
  "/admin/companies",
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      const query = adminPmsCompaniesQuerySchema.parse(req.query);
      const where = buildAdminPmsCompaniesWhere(query);

      const [companies, total] = await prisma.$transaction([
        prisma.developerCompany.findMany({
          where,
          include: pmsCompanyInclude,
          orderBy: [
            {
              updatedAt: "desc",
            },
            {
              nameEn: "asc",
            },
          ],
          take: query.take,
          skip: query.skip,
        }),
        prisma.developerCompany.count({ where }),
      ]);

      res.json({
        companies: companies.map(pmsCompanyResponse),
        pagination: {
          take: query.take,
          skip: query.skip,
          count: companies.length,
          total,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.patch(
  "/admin/companies/:companyId/entitlement",
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { companyId } = companyParamsSchema.parse(req.params);
      const data = entitlementUpdateSchema.parse(req.body);
      const company = await prisma.developerCompany.findUnique({
        where: {
          id: companyId,
        },
        include: {
          pmsEntitlement: true,
        },
      });

      if (!company) {
        throw new AppError(404, "Developer company not found");
      }

      const now = new Date();
      const nextEnabled = isEntitlementEnabledStatus(data.status);
      const entitlement = await prisma.pmsCompanyEntitlement.upsert({
        where: {
          companyId,
        },
        create: {
          companyId,
          status: data.status,
          notes: data.notes,
          trialEndsAt: data.trialEndsAt?.toISOString() ?? null,
          enabledAt: nextEnabled ? now : null,
          disabledAt: nextEnabled ? null : now,
          createdById: req.user.id,
          updatedById: req.user.id,
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
          updatedById: req.user.id,
        },
      });

      await recordPmsAdminAudit({
        adminId: req.user.id,
        adminEmail: req.user.email,
        title: "PMS entitlement updated",
        message: `${companyName(company)} PMS entitlement changed to ${data.status}.`,
        metadata: {
          companyId,
          companyName: companyName(company),
          status: data.status,
          notes: data.notes ?? null,
          trialEndsAt: data.trialEndsAt?.toISOString() ?? null,
        },
      });

      const refreshed = await prisma.developerCompany.findUniqueOrThrow({
        where: {
          id: companyId,
        },
        include: pmsCompanyInclude,
      });

      res.json({
        entitlement,
        company: pmsCompanyResponse(refreshed),
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.post(
  "/admin/companies/:companyId/members",
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { companyId } = companyParamsSchema.parse(req.params);
      const data = memberUpsertSchema.parse(req.body);
      const company = await prisma.developerCompany.findUnique({
        where: {
          id: companyId,
        },
        include: {
          pmsEntitlement: true,
        },
      });

      if (!company) {
        throw new AppError(404, "Developer company not found");
      }

      if (!company.pmsEntitlement) {
        throw new AppError(
          400,
          "Enable PMS access for the company before adding staff.",
        );
      }

      const targetUser = await prisma.user.findFirst({
        where: data.userId
          ? {
              id: data.userId,
            }
          : {
              email: data.email,
            },
      });

      if (!targetUser) {
        throw new AppError(404, "User not found");
      }

      if (targetUser.suspendedAt || targetUser.deactivatedAt) {
        throw new AppError(
          400,
          "Suspended or deleted users cannot be added to PMS access.",
        );
      }

      const member = await prisma.pmsCompanyMember.upsert({
        where: {
          companyId_userId: {
            companyId,
            userId: targetUser.id,
          },
        },
        create: {
          companyId,
          userId: targetUser.id,
          invitedEmail: targetUser.email,
          role: data.role,
          active: data.active,
          createdById: req.user.id,
        },
        update: {
          invitedEmail: targetUser.email,
          role: data.role,
          active: data.active,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              suspendedAt: true,
              deactivatedAt: true,
            },
          },
        },
      });

      await recordPmsAdminAudit({
        adminId: req.user.id,
        adminEmail: req.user.email,
        targetUserId: targetUser.id,
        title: "PMS workspace access updated",
        message: `Your PMS access for ${companyName(company)} was updated to ${data.role}.`,
        metadata: {
          companyId,
          companyName: companyName(company),
          memberId: member.id,
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          role: data.role,
          active: data.active,
        },
      });

      res.status(201).json({
        member,
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.patch(
  "/admin/members/:id",
  requireAuth(),
  requireAdmin(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { id } = idParamsSchema.parse(req.params);
      const data = memberUpdateSchema.parse(req.body);
      const existingMember = await prisma.pmsCompanyMember.findUnique({
        where: {
          id,
        },
        include: {
          company: true,
          user: true,
        },
      });

      if (!existingMember) {
        throw new AppError(404, "PMS member not found");
      }

      const member = await prisma.pmsCompanyMember.update({
        where: {
          id,
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
              deactivatedAt: true,
            },
          },
        },
      });

      await recordPmsAdminAudit({
        adminId: req.user.id,
        adminEmail: req.user.email,
        targetUserId: existingMember.userId,
        title: "PMS workspace membership updated",
        message: `Your PMS workspace access for ${companyName(existingMember.company)} was updated.`,
        metadata: {
          companyId: existingMember.companyId,
          companyName: companyName(existingMember.company),
          memberId: existingMember.id,
          targetUserId: existingMember.userId,
          targetEmail: existingMember.user.email,
          role: member.role,
          active: member.active,
        },
      });

      res.json({
        member,
      });
    } catch (error) {
      next(error);
    }
  },
);

const pmsPropertyInclude = {
  developerProject: {
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      status: true,
    },
  },
  publicListing: {
    select: {
      id: true,
      slug: true,
      title: true,
      titleEn: true,
      status: true,
    },
  },
  _count: {
    select: {
      units: true,
    },
  },
};

type PmsPropertyWithRelations = Prisma.PmsPropertyGetPayload<{
  include: typeof pmsPropertyInclude;
}>;

const pmsUnitInclude = {
  property: {
    select: {
      id: true,
      name: true,
      code: true,
      companyId: true,
    },
  },
  developerProject: {
    select: {
      id: true,
      slug: true,
      nameEn: true,
      nameAr: true,
      status: true,
    },
  },
  publicListing: {
    select: {
      id: true,
      slug: true,
      title: true,
      titleEn: true,
      status: true,
    },
  },
};

type PmsUnitWithRelations = Prisma.PmsUnitGetPayload<{
  include: typeof pmsUnitInclude;
}>;

function decimalToString(value: Prisma.Decimal | null | undefined) {
  return value === null || value === undefined ? null : value.toString();
}

function normalizeNullableText(value: string | null | undefined) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function canManagePmsInventory(role: PmsMemberRole) {
  return role === "PMS_OWNER" || role === "PMS_MANAGER" || role === "PMS_AGENT";
}

function assertCanManagePmsInventory(role: PmsMemberRole) {
  if (!canManagePmsInventory(role)) {
    throw new AppError(
      403,
      "Your PMS role can view inventory but cannot change it.",
    );
  }
}

function canManagePmsTenancies(role: PmsMemberRole) {
  return (
    role === "PMS_OWNER" ||
    role === "PMS_MANAGER" ||
    role === "PMS_ACCOUNTANT" ||
    role === "PMS_AGENT"
  );
}

function assertCanManagePmsTenancies(role: PmsMemberRole) {
  if (!canManagePmsTenancies(role)) {
    throw new AppError(
      403,
      "Your PMS role can view tenancy records but cannot change them.",
    );
  }
}

function canCollectPmsRent(role: PmsMemberRole) {
  return (
    role === "PMS_OWNER" ||
    role === "PMS_MANAGER" ||
    role === "PMS_ACCOUNTANT"
  );
}

function assertCanCollectPmsRent(role: PmsMemberRole) {
  if (!canCollectPmsRent(role)) {
    throw new AppError(
      403,
      "Your PMS role cannot update rent collection records.",
    );
  }
}

function defaultOccupancyForUnitStatus(status: PmsUnitStatus) {
  if (status === PmsUnitStatus.OCCUPIED) return PmsOccupancyStatus.OCCUPIED;
  if (status === PmsUnitStatus.RESERVED) return PmsOccupancyStatus.RESERVED;
  if (status === PmsUnitStatus.VACANT) return PmsOccupancyStatus.VACANT;
  return PmsOccupancyStatus.UNKNOWN;
}

async function resolvePmsAccessOrThrow(input: {
  userId: string;
  companyId?: string;
}) {
  const access = await resolvePmsWorkspaceAccess(input);

  if (!access) {
    throw new AppError(403, "PMS access is not enabled for this workspace.");
  }

  return access;
}

async function assertOptionalLinksBelongToCompany(input: {
  companyId: string;
  developerProjectId?: string | null;
  publicListingId?: string | null;
}) {
  if (input.developerProjectId) {
    const project = await prisma.developerProject.findFirst({
      where: {
        id: input.developerProjectId,
        developerId: input.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new AppError(
        400,
        "Linked developer project must belong to the PMS company.",
      );
    }
  }

  if (input.publicListingId) {
    const listing = await prisma.listing.findFirst({
      where: {
        id: input.publicListingId,
        developerId: input.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!listing) {
      throw new AppError(
        400,
        "Linked public listing must belong to the PMS company.",
      );
    }
  }
}

function pmsPropertyResponse(property: PmsPropertyWithRelations) {
  return {
    id: property.id,
    companyId: property.companyId,
    name: property.name,
    code: property.code,
    propertyType: property.propertyType,
    description: property.description,
    addressLine: property.addressLine,
    city: property.city,
    area: property.area,
    notes: property.notes,
    active: property.active,
    mapPlaceLabel: property.mapPlaceLabel,
    mapAddress: property.mapAddress,
    mapGoogleUrl: property.mapGoogleUrl,
    latitude: decimalToString(property.latitude),
    longitude: decimalToString(property.longitude),
    developerProjectId: property.developerProjectId,
    developerProject: property.developerProject,
    publicListingId: property.publicListingId,
    publicListing: property.publicListing,
    counts: {
      units: property._count.units,
    },
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
  };
}

function pmsUnitResponse(unit: PmsUnitWithRelations) {
  return {
    id: unit.id,
    companyId: unit.companyId,
    propertyId: unit.propertyId,
    property: unit.property,
    unitNumber: unit.unitNumber,
    unitName: unit.unitName,
    floor: unit.floor,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    areaSqm: unit.areaSqm,
    status: unit.status,
    occupancyStatus: unit.occupancyStatus,
    rentAmount: decimalToString(unit.rentAmount),
    currency: unit.currency,
    notes: unit.notes,
    developerProjectId: unit.developerProjectId,
    developerProject: unit.developerProject,
    publicListingId: unit.publicListingId,
    publicListing: unit.publicListing,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}

const pmsTenantInclude = {
  _count: {
    select: {
      leases: true,
    },
  },
};

type PmsTenantWithRelations = Prisma.PmsTenantGetPayload<{
  include: typeof pmsTenantInclude;
}>;

const pmsLeaseInclude = {
  tenant: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      active: true,
    },
  },
  property: {
    select: {
      id: true,
      name: true,
      code: true,
      companyId: true,
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      unitName: true,
      status: true,
      occupancyStatus: true,
    },
  },
  contractDraft: {
    select: {
      id: true,
      title: true,
      status: true,
      registrationStatus: true,
    },
  },
  _count: {
    select: {
      rentDueItems: true,
    },
  },
};

type PmsLeaseWithRelations = Prisma.PmsLeaseGetPayload<{
  include: typeof pmsLeaseInclude;
}>;

const pmsRentDueItemInclude = {
  tenant: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
    },
  },
  property: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      unitName: true,
    },
  },
  lease: {
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      rentFrequency: true,
    },
  },
};

type PmsRentDueItemWithRelations = Prisma.PmsRentDueItemGetPayload<{
  include: typeof pmsRentDueItemInclude;
}>;

function pmsTenantResponse(tenant: PmsTenantWithRelations) {
  return {
    id: tenant.id,
    companyId: tenant.companyId,
    fullName: tenant.fullName,
    phone: tenant.phone,
    email: tenant.email,
    nationality: tenant.nationality,
    nationalId: tenant.nationalId,
    passportNumber: tenant.passportNumber,
    emergencyContactName: tenant.emergencyContactName,
    emergencyContactPhone: tenant.emergencyContactPhone,
    emergencyContactEmail: tenant.emergencyContactEmail,
    notes: tenant.notes,
    active: tenant.active,
    counts: {
      leases: tenant._count.leases,
    },
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

function pmsLeaseResponse(lease: PmsLeaseWithRelations) {
  return {
    id: lease.id,
    companyId: lease.companyId,
    tenantId: lease.tenantId,
    tenant: lease.tenant,
    propertyId: lease.propertyId,
    property: lease.property,
    unitId: lease.unitId,
    unit: lease.unit,
    contractDraftId: lease.contractDraftId,
    contractDraft: lease.contractDraft,
    title: lease.title,
    status: lease.status,
    startDate: lease.startDate,
    endDate: lease.endDate,
    rentFrequency: lease.rentFrequency,
    rentAmount: decimalToString(lease.rentAmount),
    currency: lease.currency,
    securityDeposit: decimalToString(lease.securityDeposit),
    dueDayOfMonth: lease.dueDayOfMonth,
    notes: lease.notes,
    counts: {
      rentDueItems: lease._count.rentDueItems,
    },
    createdAt: lease.createdAt,
    updatedAt: lease.updatedAt,
  };
}

function pmsRentDueItemResponse(item: PmsRentDueItemWithRelations) {
  return {
    id: item.id,
    companyId: item.companyId,
    leaseId: item.leaseId,
    lease: item.lease,
    tenantId: item.tenantId,
    tenant: item.tenant,
    propertyId: item.propertyId,
    property: item.property,
    unitId: item.unitId,
    unit: item.unit,
    dueDate: item.dueDate,
    periodStart: item.periodStart,
    periodEnd: item.periodEnd,
    amount: decimalToString(item.amount),
    paidAmount: decimalToString(item.paidAmount),
    currency: item.currency,
    status: item.status,
    paidAt: item.paidAt,
    notes: item.notes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function buildPmsPropertyWriteData(
  data: z.infer<typeof pmsPropertyUpdateSchema>,
  userId: string,
): Prisma.PmsPropertyUncheckedUpdateInput {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.code !== undefined
      ? { code: normalizeNullableText(data.code) }
      : {}),
    ...(data.propertyType !== undefined
      ? { propertyType: normalizeNullableText(data.propertyType) }
      : {}),
    ...(data.description !== undefined
      ? { description: normalizeNullableText(data.description) }
      : {}),
    ...(data.addressLine !== undefined
      ? { addressLine: normalizeNullableText(data.addressLine) }
      : {}),
    ...(data.city !== undefined
      ? { city: normalizeNullableText(data.city) }
      : {}),
    ...(data.area !== undefined
      ? { area: normalizeNullableText(data.area) }
      : {}),
    ...(data.notes !== undefined
      ? { notes: normalizeNullableText(data.notes) }
      : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
    ...(data.mapPlaceLabel !== undefined
      ? { mapPlaceLabel: normalizeNullableText(data.mapPlaceLabel) }
      : {}),
    ...(data.mapAddress !== undefined
      ? { mapAddress: normalizeNullableText(data.mapAddress) }
      : {}),
    ...(data.mapGoogleUrl !== undefined
      ? { mapGoogleUrl: normalizeNullableText(data.mapGoogleUrl) }
      : {}),
    ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
    ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
    ...(data.developerProjectId !== undefined
      ? { developerProjectId: data.developerProjectId }
      : {}),
    ...(data.publicListingId !== undefined
      ? { publicListingId: data.publicListingId }
      : {}),
    updatedById: userId,
  };
}

function buildPmsUnitWriteData(
  data: z.infer<typeof pmsUnitUpdateSchema>,
  userId: string,
): Prisma.PmsUnitUncheckedUpdateInput {
  const nextStatus = data.status;

  return {
    ...(data.unitNumber !== undefined ? { unitNumber: data.unitNumber } : {}),
    ...(data.unitName !== undefined
      ? { unitName: normalizeNullableText(data.unitName) }
      : {}),
    ...(data.floor !== undefined
      ? { floor: normalizeNullableText(data.floor) }
      : {}),
    ...(data.bedrooms !== undefined ? { bedrooms: data.bedrooms } : {}),
    ...(data.bathrooms !== undefined ? { bathrooms: data.bathrooms } : {}),
    ...(data.areaSqm !== undefined ? { areaSqm: data.areaSqm } : {}),
    ...(nextStatus !== undefined ? { status: nextStatus } : {}),
    ...(data.occupancyStatus !== undefined
      ? { occupancyStatus: data.occupancyStatus ?? PmsOccupancyStatus.UNKNOWN }
      : nextStatus !== undefined
        ? { occupancyStatus: defaultOccupancyForUnitStatus(nextStatus) }
        : {}),
    ...(data.rentAmount !== undefined ? { rentAmount: data.rentAmount } : {}),
    ...(data.currency !== undefined ? { currency: data.currency } : {}),
    ...(data.notes !== undefined
      ? { notes: normalizeNullableText(data.notes) }
      : {}),
    ...(data.developerProjectId !== undefined
      ? { developerProjectId: data.developerProjectId }
      : {}),
    ...(data.publicListingId !== undefined
      ? { publicListingId: data.publicListingId }
      : {}),
    updatedById: userId,
  };
}


function buildPmsTenantWriteData(
  data: z.infer<typeof pmsTenantUpdateSchema>,
  userId: string,
): Prisma.PmsTenantUncheckedUpdateInput {
  return {
    ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
    ...(data.phone !== undefined
      ? { phone: normalizeNullableText(data.phone) }
      : {}),
    ...(data.email !== undefined
      ? { email: normalizeNullableText(data.email) }
      : {}),
    ...(data.nationality !== undefined
      ? { nationality: normalizeNullableText(data.nationality) }
      : {}),
    ...(data.nationalId !== undefined
      ? { nationalId: normalizeNullableText(data.nationalId) }
      : {}),
    ...(data.passportNumber !== undefined
      ? { passportNumber: normalizeNullableText(data.passportNumber) }
      : {}),
    ...(data.emergencyContactName !== undefined
      ? { emergencyContactName: normalizeNullableText(data.emergencyContactName) }
      : {}),
    ...(data.emergencyContactPhone !== undefined
      ? { emergencyContactPhone: normalizeNullableText(data.emergencyContactPhone) }
      : {}),
    ...(data.emergencyContactEmail !== undefined
      ? { emergencyContactEmail: normalizeNullableText(data.emergencyContactEmail) }
      : {}),
    ...(data.notes !== undefined
      ? { notes: normalizeNullableText(data.notes) }
      : {}),
    ...(data.active !== undefined ? { active: data.active } : {}),
    updatedById: userId,
  };
}

function buildPmsLeaseWriteData(
  data: z.infer<typeof pmsLeaseUpdateSchema>,
  userId: string,
): Prisma.PmsLeaseUncheckedUpdateInput {
  return {
    ...(data.title !== undefined
      ? { title: normalizeNullableText(data.title) }
      : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
    ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
    ...(data.rentFrequency !== undefined
      ? { rentFrequency: data.rentFrequency }
      : {}),
    ...(data.rentAmount !== undefined ? { rentAmount: data.rentAmount } : {}),
    ...(data.currency !== undefined ? { currency: data.currency } : {}),
    ...(data.securityDeposit !== undefined
      ? { securityDeposit: data.securityDeposit }
      : {}),
    ...(data.dueDayOfMonth !== undefined
      ? { dueDayOfMonth: data.dueDayOfMonth }
      : {}),
    ...(data.contractDraftId !== undefined
      ? { contractDraftId: data.contractDraftId }
      : {}),
    ...(data.notes !== undefined
      ? { notes: normalizeNullableText(data.notes) }
      : {}),
    updatedById: userId,
  };
}

function addMonthsClamped(date: Date, months: number, preferredDay: number) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(preferredDay, lastDay));
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function normalizeDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function monthsForFrequency(frequency: PaymentScheduleFrequency) {
  if (frequency === PaymentScheduleFrequency.QUARTERLY) return 3;
  if (frequency === PaymentScheduleFrequency.YEARLY) return 12;
  if (frequency === PaymentScheduleFrequency.ONE_TIME) return 0;
  return 1;
}

function generatePmsRentDueItems(input: {
  companyId: string;
  leaseId: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  startDate: Date;
  endDate?: Date | null;
  frequency: PaymentScheduleFrequency;
  amount: number;
  currency: string;
  dueDayOfMonth?: number | null;
  createdById: string;
}): Prisma.PmsRentDueItemUncheckedCreateInput[] {
  const startDate = normalizeDateOnly(input.startDate);
  const endDate = input.endDate ? normalizeDateOnly(input.endDate) : null;
  const stepMonths = monthsForFrequency(input.frequency);
  const preferredDay = input.dueDayOfMonth ?? startDate.getUTCDate();
  const maxItems = input.frequency === PaymentScheduleFrequency.ONE_TIME ? 1 : 36;
  const items: Prisma.PmsRentDueItemUncheckedCreateInput[] = [];
  let periodStart = startDate;

  for (let index = 0; index < maxItems; index += 1) {
    const dueDate =
      input.frequency === PaymentScheduleFrequency.ONE_TIME
        ? startDate
        : addMonthsClamped(startDate, index * stepMonths, preferredDay);

    if (endDate && dueDate > endDate) break;

    const nextPeriodStart =
      input.frequency === PaymentScheduleFrequency.ONE_TIME
        ? endDate ?? startDate
        : addMonthsClamped(periodStart, stepMonths, periodStart.getUTCDate());
    const periodEnd = endDate && nextPeriodStart > endDate ? endDate : addDays(nextPeriodStart, -1);

    items.push({
      companyId: input.companyId,
      leaseId: input.leaseId,
      tenantId: input.tenantId,
      propertyId: input.propertyId,
      unitId: input.unitId,
      dueDate,
      periodStart,
      periodEnd,
      amount: input.amount,
      paidAmount: 0,
      currency: input.currency,
      status: PmsRentDueStatus.UNPAID,
      createdById: input.createdById,
      updatedById: input.createdById,
    });

    if (input.frequency === PaymentScheduleFrequency.ONE_TIME) break;
    periodStart = addDays(periodEnd, 1);
  }

  return items;
}

function getLeaseOccupancyStatus(status: PmsLeaseStatus) {
  return status === PmsLeaseStatus.ACTIVE || status === PmsLeaseStatus.EXPIRING;
}

pmsRouter.get("/tenants", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsTenantListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: query.companyId,
    });
    const search = query.search?.trim();
    const where: Prisma.PmsTenantWhereInput = {
      companyId: access.company.id,
      ...(query.active === "ACTIVE" ? { active: true } : {}),
      ...(query.active === "INACTIVE" ? { active: false } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { nationalId: { contains: search, mode: "insensitive" } },
              { passportNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [tenants, total] = await prisma.$transaction([
      prisma.pmsTenant.findMany({
        where,
        include: pmsTenantInclude,
        orderBy: [{ updatedAt: "desc" }, { fullName: "asc" }],
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsTenant.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      tenants: tenants.map(pmsTenantResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: tenants.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/tenants", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const data = pmsTenantCreateSchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: data.companyId,
    });
    assertCanManagePmsTenancies(access.member.role);

    const tenant = await prisma.pmsTenant.create({
      data: {
        companyId: access.company.id,
        fullName: data.fullName,
        phone: normalizeNullableText(data.phone),
        email: normalizeNullableText(data.email),
        nationality: normalizeNullableText(data.nationality),
        nationalId: normalizeNullableText(data.nationalId),
        passportNumber: normalizeNullableText(data.passportNumber),
        emergencyContactName: normalizeNullableText(data.emergencyContactName),
        emergencyContactPhone: normalizeNullableText(data.emergencyContactPhone),
        emergencyContactEmail: normalizeNullableText(data.emergencyContactEmail),
        notes: normalizeNullableText(data.notes),
        active: data.active,
        createdById: req.user.id,
        updatedById: req.user.id,
      },
      include: pmsTenantInclude,
    });

    res.status(201).json({ tenant: pmsTenantResponse(tenant) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/tenants/:tenantId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { tenantId } = pmsTenantParamsSchema.parse(req.params);
    const tenant = await prisma.pmsTenant.findUnique({
      where: { id: tenantId },
      include: pmsTenantInclude,
    });

    if (!tenant) {
      throw new AppError(404, "PMS tenant not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: tenant.companyId,
    });

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      tenant: pmsTenantResponse(tenant),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/tenants/:tenantId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { tenantId } = pmsTenantParamsSchema.parse(req.params);
    const data = pmsTenantUpdateSchema.parse(req.body);
    const existing = await prisma.pmsTenant.findUnique({
      where: { id: tenantId },
      select: { id: true, companyId: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS tenant not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: existing.companyId,
    });
    assertCanManagePmsTenancies(access.member.role);

    const tenant = await prisma.pmsTenant.update({
      where: { id: tenantId },
      data: buildPmsTenantWriteData(data, req.user.id),
      include: pmsTenantInclude,
    });

    res.json({ tenant: pmsTenantResponse(tenant) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/leases", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsLeaseListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: query.companyId,
    });
    const where: Prisma.PmsLeaseWhereInput = {
      companyId: access.company.id,
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
    };

    const [leases, total] = await prisma.$transaction([
      prisma.pmsLease.findMany({
        where,
        include: pmsLeaseInclude,
        orderBy: [{ updatedAt: "desc" }, { startDate: "desc" }],
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsLease.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      leases: leases.map(pmsLeaseResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: leases.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/leases", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const data = pmsLeaseCreateSchema.parse(req.body);
    const userId = req.user.id;
    const access = await resolvePmsAccessOrThrow({
      userId,
      companyId: data.companyId,
    });
    assertCanManagePmsTenancies(access.member.role);

    const [tenant, property, unit] = await Promise.all([
      prisma.pmsTenant.findFirst({
        where: { id: data.tenantId, companyId: access.company.id, active: true },
        select: { id: true },
      }),
      prisma.pmsProperty.findFirst({
        where: { id: data.propertyId, companyId: access.company.id, active: true },
        select: { id: true },
      }),
      prisma.pmsUnit.findFirst({
        where: {
          id: data.unitId,
          propertyId: data.propertyId,
          companyId: access.company.id,
        },
        select: { id: true, status: true },
      }),
    ]);

    if (!tenant) throw new AppError(400, "PMS tenant must belong to the selected company.");
    if (!property) throw new AppError(400, "PMS property must belong to the selected company.");
    if (!unit) throw new AppError(400, "PMS unit must belong to the selected property and company.");

    if (data.contractDraftId) {
      const contractDraft = await prisma.rentalContractDraft.findFirst({
        where: {
          id: data.contractDraftId,
          OR: [
            { createdById: userId },
            { listing: { developerId: access.company.id } },
          ],
        },
        select: { id: true },
      });

      if (!contractDraft) {
        throw new AppError(400, "Linked contract draft is not available for this PMS workspace.");
      }
    }

    const existingActiveLease = await prisma.pmsLease.findFirst({
      where: {
        unitId: data.unitId,
        status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] },
      },
      select: { id: true },
    });

    if (existingActiveLease && getLeaseOccupancyStatus(data.status)) {
      throw new AppError(409, "This unit already has an active PMS lease.");
    }

    const lease = await prisma.$transaction(async (tx) => {
      const createdLease = await tx.pmsLease.create({
        data: {
          companyId: access.company.id,
          tenantId: data.tenantId,
          propertyId: data.propertyId,
          unitId: data.unitId,
          title: normalizeNullableText(data.title),
          status: data.status,
          startDate: data.startDate,
          endDate: data.endDate ?? null,
          rentFrequency: data.rentFrequency,
          rentAmount: data.rentAmount,
          currency: data.currency,
          securityDeposit: data.securityDeposit ?? null,
          dueDayOfMonth: data.dueDayOfMonth ?? data.startDate.getUTCDate(),
          contractDraftId: data.contractDraftId ?? null,
          notes: normalizeNullableText(data.notes),
          createdById: userId,
          updatedById: userId,
        },
      });

      if (data.generateRentDueItems) {
        const dueItems = generatePmsRentDueItems({
          companyId: access.company.id,
          leaseId: createdLease.id,
          tenantId: data.tenantId,
          propertyId: data.propertyId,
          unitId: data.unitId,
          startDate: data.startDate,
          endDate: data.endDate,
          frequency: data.rentFrequency,
          amount: data.rentAmount,
          currency: data.currency,
          dueDayOfMonth: data.dueDayOfMonth ?? data.startDate.getUTCDate(),
          createdById: userId,
        });

        if (dueItems.length > 0) {
          await tx.pmsRentDueItem.createMany({ data: dueItems });
        }
      }

      if (getLeaseOccupancyStatus(data.status)) {
        await tx.pmsUnit.update({
          where: { id: data.unitId },
          data: {
            status: PmsUnitStatus.OCCUPIED,
            occupancyStatus: PmsOccupancyStatus.OCCUPIED,
            updatedById: userId,
          },
        });
      }

      return tx.pmsLease.findUniqueOrThrow({
        where: { id: createdLease.id },
        include: pmsLeaseInclude,
      });
    });

    res.status(201).json({ lease: pmsLeaseResponse(lease) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/leases/:leaseId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { leaseId } = pmsLeaseParamsSchema.parse(req.params);
    const lease = await prisma.pmsLease.findUnique({
      where: { id: leaseId },
      include: pmsLeaseInclude,
    });

    if (!lease) {
      throw new AppError(404, "PMS lease not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: lease.companyId,
    });

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      lease: pmsLeaseResponse(lease),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/leases/:leaseId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { leaseId } = pmsLeaseParamsSchema.parse(req.params);
    const data = pmsLeaseUpdateSchema.parse(req.body);
    const userId = req.user.id;
    const existing = await prisma.pmsLease.findUnique({
      where: { id: leaseId },
      select: { id: true, companyId: true, unitId: true, startDate: true, endDate: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS lease not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId,
      companyId: existing.companyId,
    });
    assertCanManagePmsTenancies(access.member.role);

    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      throw new AppError(400, "Lease end date must be after the start date.");
    }
    if (data.startDate && !data.endDate && existing.endDate && existing.endDate < data.startDate) {
      throw new AppError(400, "Lease end date must be after the start date.");
    }
    if (data.endDate && !data.startDate && data.endDate < existing.startDate) {
      throw new AppError(400, "Lease end date must be after the start date.");
    }

    const lease = await prisma.$transaction(async (tx) => {
      const updated = await tx.pmsLease.update({
        where: { id: leaseId },
        data: buildPmsLeaseWriteData(data, userId),
        include: pmsLeaseInclude,
      });

      if (data.status) {
        if (getLeaseOccupancyStatus(data.status)) {
          await tx.pmsUnit.update({
            where: { id: existing.unitId },
            data: {
              status: PmsUnitStatus.OCCUPIED,
              occupancyStatus: PmsOccupancyStatus.OCCUPIED,
              updatedById: userId,
            },
          });
        } else if (
          data.status === PmsLeaseStatus.ENDED ||
          data.status === PmsLeaseStatus.TERMINATED
        ) {
          const otherActiveLease = await tx.pmsLease.findFirst({
            where: {
              id: { not: leaseId },
              unitId: existing.unitId,
              status: { in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING] },
            },
            select: { id: true },
          });

          if (!otherActiveLease) {
            await tx.pmsUnit.update({
              where: { id: existing.unitId },
              data: {
                status: PmsUnitStatus.VACANT,
                occupancyStatus: PmsOccupancyStatus.VACANT,
                updatedById: userId,
              },
            });
          }
        }
      }

      return updated;
    });

    res.json({ lease: pmsLeaseResponse(lease) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/leases/:leaseId/rent-due", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { leaseId } = pmsLeaseParamsSchema.parse(req.params);
    const query = pmsRentDueListQuerySchema.omit({ leaseId: true }).parse(req.query);
    const lease = await prisma.pmsLease.findUnique({
      where: { id: leaseId },
      select: { id: true, companyId: true },
    });

    if (!lease) {
      throw new AppError(404, "PMS lease not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: lease.companyId,
    });
    const where: Prisma.PmsRentDueItemWhereInput = {
      companyId: access.company.id,
      leaseId,
      ...(query.status !== "ALL" ? { status: query.status } : {}),
    };

    const [rentDueItems, total] = await prisma.$transaction([
      prisma.pmsRentDueItem.findMany({
        where,
        include: pmsRentDueItemInclude,
        orderBy: [{ dueDate: "asc" }],
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsRentDueItem.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      rentDueItems: rentDueItems.map(pmsRentDueItemResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: rentDueItems.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/rent-due", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsRentDueListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: query.companyId,
    });
    const where: Prisma.PmsRentDueItemWhereInput = {
      companyId: access.company.id,
      ...(query.leaseId ? { leaseId: query.leaseId } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.status !== "ALL" ? { status: query.status } : {}),
    };

    const [rentDueItems, total] = await prisma.$transaction([
      prisma.pmsRentDueItem.findMany({
        where,
        include: pmsRentDueItemInclude,
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsRentDueItem.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      rentDueItems: rentDueItems.map(pmsRentDueItemResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: rentDueItems.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/rent-due/:rentDueItemId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { rentDueItemId } = pmsRentDueParamsSchema.parse(req.params);
    const data = pmsRentDueUpdateSchema.parse(req.body);
    const existing = await prisma.pmsRentDueItem.findUnique({
      where: { id: rentDueItemId },
      select: { id: true, companyId: true, amount: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS rent due item not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: existing.companyId,
    });
    assertCanCollectPmsRent(access.member.role);

    const paidAmount = data.paidAmount;
    const amountNumber = Number(existing.amount);
    const inferredStatus =
      paidAmount !== undefined
        ? paidAmount >= amountNumber
          ? PmsRentDueStatus.PAID
          : paidAmount > 0
            ? PmsRentDueStatus.PARTIALLY_PAID
            : PmsRentDueStatus.UNPAID
        : undefined;
    const nextStatus = data.status ?? inferredStatus;

    const rentDueItem = await prisma.pmsRentDueItem.update({
      where: { id: rentDueItemId },
      data: {
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(paidAmount !== undefined ? { paidAmount } : {}),
        ...(data.paidAt !== undefined
          ? { paidAt: data.paidAt }
          : nextStatus === PmsRentDueStatus.PAID
            ? { paidAt: new Date() }
            : {}),
        ...(data.notes !== undefined
          ? { notes: normalizeNullableText(data.notes) }
          : {}),
        updatedById: req.user.id,
      },
      include: pmsRentDueItemInclude,
    });

    res.json({ rentDueItem: pmsRentDueItemResponse(rentDueItem) });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/properties", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsPropertyListQuerySchema.parse(req.query);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: query.companyId,
    });
    const companyId = access.company.id;
    const search = query.search?.trim();
    const where: Prisma.PmsPropertyWhereInput = {
      companyId,
      ...(query.active === "ACTIVE" ? { active: true } : {}),
      ...(query.active === "INACTIVE" ? { active: false } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
              { area: { contains: search, mode: "insensitive" } },
              { addressLine: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [properties, total] = await prisma.$transaction([
      prisma.pmsProperty.findMany({
        where,
        include: pmsPropertyInclude,
        orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsProperty.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      properties: properties.map(pmsPropertyResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: properties.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.post("/properties", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const data = pmsPropertyCreateSchema.parse(req.body);
    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: data.companyId,
    });
    assertCanManagePmsInventory(access.member.role);
    await assertOptionalLinksBelongToCompany({
      companyId: access.company.id,
      developerProjectId: data.developerProjectId,
      publicListingId: data.publicListingId,
    });

    const property = await prisma.pmsProperty.create({
      data: {
        companyId: access.company.id,
        name: data.name,
        code: normalizeNullableText(data.code),
        propertyType: normalizeNullableText(data.propertyType),
        description: normalizeNullableText(data.description),
        addressLine: normalizeNullableText(data.addressLine),
        city: normalizeNullableText(data.city),
        area: normalizeNullableText(data.area),
        notes: normalizeNullableText(data.notes),
        active: data.active,
        mapPlaceLabel: normalizeNullableText(data.mapPlaceLabel),
        mapAddress: normalizeNullableText(data.mapAddress),
        mapGoogleUrl: normalizeNullableText(data.mapGoogleUrl),
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        developerProjectId: data.developerProjectId ?? null,
        publicListingId: data.publicListingId ?? null,
        createdById: req.user.id,
        updatedById: req.user.id,
      },
      include: pmsPropertyInclude,
    });

    res.status(201).json({
      property: pmsPropertyResponse(property),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get(
  "/properties/:propertyId",
  requireAuth(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { propertyId } = pmsPropertyParamsSchema.parse(req.params);
      const property = await prisma.pmsProperty.findUnique({
        where: { id: propertyId },
        include: pmsPropertyInclude,
      });

      if (!property) {
        throw new AppError(404, "PMS property not found");
      }

      const access = await resolvePmsAccessOrThrow({
        userId: req.user.id,
        companyId: property.companyId,
      });

      res.json({
        workspace: {
          company: access.company,
          member: access.member,
          entitlement: access.entitlement,
        },
        property: pmsPropertyResponse(property),
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.patch(
  "/properties/:propertyId",
  requireAuth(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { propertyId } = pmsPropertyParamsSchema.parse(req.params);
      const data = pmsPropertyUpdateSchema.parse(req.body);
      const existing = await prisma.pmsProperty.findUnique({
        where: { id: propertyId },
        select: { id: true, companyId: true },
      });

      if (!existing) {
        throw new AppError(404, "PMS property not found");
      }

      const access = await resolvePmsAccessOrThrow({
        userId: req.user.id,
        companyId: existing.companyId,
      });
      assertCanManagePmsInventory(access.member.role);
      await assertOptionalLinksBelongToCompany({
        companyId: existing.companyId,
        developerProjectId: data.developerProjectId,
        publicListingId: data.publicListingId,
      });

      const property = await prisma.pmsProperty.update({
        where: { id: propertyId },
        data: buildPmsPropertyWriteData(data, req.user.id),
        include: pmsPropertyInclude,
      });

      res.json({
        property: pmsPropertyResponse(property),
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.get(
  "/properties/:propertyId/units",
  requireAuth(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { propertyId } = pmsPropertyParamsSchema.parse(req.params);
      const query = pmsUnitListQuerySchema
        .omit({ propertyId: true })
        .parse(req.query);
      const property = await prisma.pmsProperty.findUnique({
        where: { id: propertyId },
        select: { id: true, companyId: true },
      });

      if (!property) {
        throw new AppError(404, "PMS property not found");
      }

      const access = await resolvePmsAccessOrThrow({
        userId: req.user.id,
        companyId: property.companyId,
      });
      const search = query.search?.trim();
      const where: Prisma.PmsUnitWhereInput = {
        propertyId,
        companyId: access.company.id,
        ...(query.status !== "ALL" ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                { unitNumber: { contains: search, mode: "insensitive" } },
                { unitName: { contains: search, mode: "insensitive" } },
                { floor: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const [units, total] = await prisma.$transaction([
        prisma.pmsUnit.findMany({
          where,
          include: pmsUnitInclude,
          orderBy: [{ unitNumber: "asc" }, { createdAt: "desc" }],
          take: query.take,
          skip: query.skip,
        }),
        prisma.pmsUnit.count({ where }),
      ]);

      res.json({
        workspace: {
          company: access.company,
          member: access.member,
          entitlement: access.entitlement,
        },
        units: units.map(pmsUnitResponse),
        pagination: {
          take: query.take,
          skip: query.skip,
          count: units.length,
          total,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.post(
  "/properties/:propertyId/units",
  requireAuth(),
  async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError(401, "Unauthorized");
      }

      const { propertyId } = pmsPropertyParamsSchema.parse(req.params);
      const data = pmsUnitCreateSchema.parse(req.body);
      const property = await prisma.pmsProperty.findUnique({
        where: { id: propertyId },
        select: {
          id: true,
          companyId: true,
          developerProjectId: true,
          publicListingId: true,
        },
      });

      if (!property) {
        throw new AppError(404, "PMS property not found");
      }

      const access = await resolvePmsAccessOrThrow({
        userId: req.user.id,
        companyId: property.companyId,
      });
      assertCanManagePmsInventory(access.member.role);

      const developerProjectId =
        data.developerProjectId ?? property.developerProjectId ?? null;
      const publicListingId =
        data.publicListingId ?? property.publicListingId ?? null;
      await assertOptionalLinksBelongToCompany({
        companyId: property.companyId,
        developerProjectId,
        publicListingId,
      });

      const unit = await prisma.pmsUnit.create({
        data: {
          propertyId: property.id,
          companyId: property.companyId,
          unitNumber: data.unitNumber,
          unitName: normalizeNullableText(data.unitName),
          floor: normalizeNullableText(data.floor),
          bedrooms: data.bedrooms ?? null,
          bathrooms: data.bathrooms ?? null,
          areaSqm: data.areaSqm ?? null,
          status: data.status,
          occupancyStatus:
            data.occupancyStatus ?? defaultOccupancyForUnitStatus(data.status),
          rentAmount: data.rentAmount ?? null,
          currency: data.currency,
          notes: normalizeNullableText(data.notes),
          developerProjectId,
          publicListingId,
          createdById: req.user.id,
          updatedById: req.user.id,
        },
        include: pmsUnitInclude,
      });

      res.status(201).json({
        unit: pmsUnitResponse(unit),
      });
    } catch (error) {
      next(error);
    }
  },
);

pmsRouter.get("/units", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsUnitListQuerySchema.parse(req.query);
    let companyId = query.companyId;

    if (query.propertyId) {
      const property = await prisma.pmsProperty.findUnique({
        where: { id: query.propertyId },
        select: { companyId: true },
      });

      if (!property) {
        throw new AppError(404, "PMS property not found");
      }

      companyId = property.companyId;
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId,
    });
    const search = query.search?.trim();
    const where: Prisma.PmsUnitWhereInput = {
      companyId: access.company.id,
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.status !== "ALL" ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { unitNumber: { contains: search, mode: "insensitive" } },
              { unitName: { contains: search, mode: "insensitive" } },
              { floor: { contains: search, mode: "insensitive" } },
              { property: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [units, total] = await prisma.$transaction([
      prisma.pmsUnit.findMany({
        where,
        include: pmsUnitInclude,
        orderBy: [{ updatedAt: "desc" }, { unitNumber: "asc" }],
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsUnit.count({ where }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      units: units.map(pmsUnitResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: units.length,
        total,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/units/:unitId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { unitId } = pmsUnitParamsSchema.parse(req.params);
    const unit = await prisma.pmsUnit.findUnique({
      where: { id: unitId },
      include: pmsUnitInclude,
    });

    if (!unit) {
      throw new AppError(404, "PMS unit not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: unit.companyId,
    });

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      unit: pmsUnitResponse(unit),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.patch("/units/:unitId", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const { unitId } = pmsUnitParamsSchema.parse(req.params);
    const data = pmsUnitUpdateSchema.parse(req.body);
    const existing = await prisma.pmsUnit.findUnique({
      where: { id: unitId },
      select: { id: true, companyId: true },
    });

    if (!existing) {
      throw new AppError(404, "PMS unit not found");
    }

    const access = await resolvePmsAccessOrThrow({
      userId: req.user.id,
      companyId: existing.companyId,
    });
    assertCanManagePmsInventory(access.member.role);
    await assertOptionalLinksBelongToCompany({
      companyId: existing.companyId,
      developerProjectId: data.developerProjectId,
      publicListingId: data.publicListingId,
    });

    const unit = await prisma.pmsUnit.update({
      where: { id: unitId },
      data: buildPmsUnitWriteData(data, req.user.id),
      include: pmsUnitInclude,
    });

    res.json({
      unit: pmsUnitResponse(unit),
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/overview", requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) {
      throw new AppError(401, "Unauthorized");
    }

    const query = pmsOverviewQuerySchema.parse(req.query);
    const access = await resolvePmsWorkspaceAccess({
      userId: req.user.id,
      companyId: query.companyId,
    });

    if (!access) {
      throw new AppError(403, "PMS access is not enabled for this account.");
    }

    const companyId = access.company.id;
    const now = new Date();
    const expiringWindowEnd = new Date(now);
    expiringWindowEnd.setDate(expiringWindowEnd.getDate() + 60);

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
      activeTransactions,
      totalPmsProperties,
      totalPmsUnits,
      vacantPmsUnits,
      occupiedPmsUnits,
      maintenancePmsUnits,
      totalPmsTenants,
      activePmsLeases,
      expiringPmsLeases,
      unpaidPmsRentDueItems,
      overduePmsRentDueItems,
      partiallyPaidPmsRentDueItems,
      paidPmsRentDueItems,
      pmsRentDueAggregate,
      pmsRentCollectedAggregate,
      expiringPmsLeaseAlerts,
    ] = await prisma.$transaction([
      prisma.pmsCompanyMember.findMany({
        where: {
          userId: req.user.id,
          active: true,
          company: {
            pmsEntitlement: {
              is: {
                status: {
                  in: ACTIVE_PMS_ENTITLEMENT_STATUSES,
                },
                disabledAt: null,
              },
            },
          },
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
                  trialEndsAt: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.listing.count({
        where: {
          developerId: companyId,
        },
      }),
      prisma.listing.count({
        where: {
          developerId: companyId,
          status: "APPROVED",
        },
      }),
      prisma.developerProject.count({
        where: {
          developerId: companyId,
        },
      }),
      prisma.developerProject.count({
        where: {
          developerId: companyId,
          status: "APPROVED",
        },
      }),
      prisma.rentPaymentSchedule.count({
        where: {
          active: true,
          listing: {
            developerId: companyId,
          },
        },
      }),
      prisma.rentalContractDraft.count({
        where: {
          status: {
            not: "ARCHIVED",
          },
          listing: {
            developerId: companyId,
          },
        },
      }),
      prisma.rentPaymentDueItem.count({
        where: {
          status: {
            in: ["PENDING", "DUE_SOON"],
          },
          schedule: {
            listing: {
              developerId: companyId,
            },
          },
        },
      }),
      prisma.rentPaymentDueItem.count({
        where: {
          status: "OVERDUE",
          schedule: {
            listing: {
              developerId: companyId,
            },
          },
        },
      }),
      prisma.marketplaceTransaction.count({
        where: {
          status: {
            in: ["DRAFT", "ACTIVE", "DISPUTED"],
          },
          listing: {
            developerId: companyId,
          },
        },
      }),
      prisma.pmsProperty.count({
        where: {
          companyId,
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId,
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId,
          status: PmsUnitStatus.VACANT,
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId,
          status: PmsUnitStatus.OCCUPIED,
        },
      }),
      prisma.pmsUnit.count({
        where: {
          companyId,
          status: PmsUnitStatus.MAINTENANCE,
        },
      }),
      prisma.pmsTenant.count({
        where: {
          companyId,
          active: true,
        },
      }),
      prisma.pmsLease.count({
        where: {
          companyId,
          status: {
            in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING],
          },
        },
      }),
      prisma.pmsLease.count({
        where: {
          companyId,
          status: {
            in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING],
          },
          endDate: {
            gte: now,
            lte: expiringWindowEnd,
          },
        },
      }),
      prisma.pmsRentDueItem.count({
        where: {
          companyId,
          status: {
            in: [PmsRentDueStatus.UNPAID, PmsRentDueStatus.DUE_SOON],
          },
        },
      }),
      prisma.pmsRentDueItem.count({
        where: {
          companyId,
          OR: [
            { status: PmsRentDueStatus.OVERDUE },
            {
              dueDate: { lt: now },
              status: {
                in: [
                  PmsRentDueStatus.UNPAID,
                  PmsRentDueStatus.DUE_SOON,
                  PmsRentDueStatus.PARTIALLY_PAID,
                ],
              },
            },
          ],
        },
      }),
      prisma.pmsRentDueItem.count({
        where: {
          companyId,
          status: PmsRentDueStatus.PARTIALLY_PAID,
        },
      }),
      prisma.pmsRentDueItem.count({
        where: {
          companyId,
          status: PmsRentDueStatus.PAID,
        },
      }),
      prisma.pmsRentDueItem.aggregate({
        where: {
          companyId,
          status: {
            notIn: [PmsRentDueStatus.PAID, PmsRentDueStatus.CANCELLED],
          },
        },
        _sum: {
          amount: true,
        },
      }),
      prisma.pmsRentDueItem.aggregate({
        where: {
          companyId,
          status: {
            in: [PmsRentDueStatus.PAID, PmsRentDueStatus.PARTIALLY_PAID],
          },
        },
        _sum: {
          paidAmount: true,
        },
      }),
      prisma.pmsLease.findMany({
        where: {
          companyId,
          status: {
            in: [PmsLeaseStatus.ACTIVE, PmsLeaseStatus.EXPIRING],
          },
          endDate: {
            gte: now,
            lte: expiringWindowEnd,
          },
        },
        include: pmsLeaseInclude,
        orderBy: {
          endDate: "asc",
        },
        take: 5,
      }),
    ]);

    res.json({
      workspace: {
        company: access.company,
        member: access.member,
        entitlement: access.entitlement,
      },
      companies: companies.map((member) => ({
        memberId: member.id,
        role: member.role,
        company: member.company,
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
        activeTransactions,
        totalPmsProperties,
        totalPmsUnits,
        vacantPmsUnits,
        occupiedPmsUnits,
        maintenancePmsUnits,
        totalPmsTenants,
        activePmsLeases,
        expiringPmsLeases,
        unpaidPmsRentDueItems,
        overduePmsRentDueItems,
        partiallyPaidPmsRentDueItems,
        paidPmsRentDueItems,
        pmsRentDueAmount: decimalToString(pmsRentDueAggregate._sum.amount),
        pmsRentCollectedAmount: decimalToString(
          pmsRentCollectedAggregate._sum.paidAmount,
        ),
        pmsOccupancyRate:
          totalPmsUnits > 0
            ? Math.round((occupiedPmsUnits / totalPmsUnits) * 1000) / 10
            : 0,
      },
      alerts: {
        expiringLeases: expiringPmsLeaseAlerts.map(pmsLeaseResponse),
      },
      emptyStates: {
        properties: totalPmsProperties === 0,
        tenants: totalPmsTenants === 0,
        marketplaceListings: totalListings === 0,
        rentals: activePmsLeases === 0,
        contracts: openContracts === 0,
        accounting:
          unpaidPmsRentDueItems + overduePmsRentDueItems + partiallyPaidPmsRentDueItems === 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

pmsRouter.get("/", requireAuth(), async (req, res, next) => {
  req.url = `/overview${req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : ""}`;
  pmsRouter(req, res, next);
});
