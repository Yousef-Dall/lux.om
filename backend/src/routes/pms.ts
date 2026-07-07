import {
  AccountSecurityEventType,
  PmsEntitlementStatus,
  PmsMemberRole,
  PmsOccupancyStatus,
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
        pmsOccupancyRate:
          totalPmsUnits > 0
            ? Math.round((occupiedPmsUnits / totalPmsUnits) * 1000) / 10
            : 0,
      },
      emptyStates: {
        properties: totalPmsProperties === 0,
        marketplaceListings: totalListings === 0,
        rentals: activeRentSchedules === 0,
        contracts: openContracts === 0,
        accounting: pendingRentDueItems + overdueRentDueItems === 0,
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
