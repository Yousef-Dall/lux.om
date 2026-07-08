import {
  NotificationType,
  PmsMaintenancePriority,
  PmsMaintenanceStatus,
  PmsRentDueStatus,
  type Prisma
} from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import {
  activeTenantLeaseWhere,
  resolveTenantPortalAccess,
  type TenantPortalWorkspaceAccess
} from '../lib/tenantPortalAccess';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../utils/http';

export const tenantRouter = Router();

const tenantAccessQuerySchema = z.object({
  accessId: z.string().trim().min(1).optional()
});

const tenantRentQuerySchema = tenantAccessQuerySchema.extend({
  status: z
    .enum(['ALL', ...Object.values(PmsRentDueStatus)] as [
      'ALL',
      ...PmsRentDueStatus[]
    ])
    .default('ALL'),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0)
});

const tenantMaintenanceQuerySchema = tenantAccessQuerySchema.extend({
  status: z
    .enum(['ALL', ...Object.values(PmsMaintenanceStatus)] as [
      'ALL',
      ...PmsMaintenanceStatus[]
    ])
    .default('ALL'),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0)
});

const tenantMaintenanceCreateSchema = z
  .object({
    leaseId: z.string().trim().min(1).optional(),
    title: z.string().trim().min(2).max(180),
    description: z.string().trim().max(4000).optional().nullable(),
    priority: z.nativeEnum(PmsMaintenancePriority).default(PmsMaintenancePriority.MEDIUM),
    imageUrls: z.array(z.string().trim().url().max(1000)).max(20).optional(),
    documentUrls: z.array(z.string().trim().url().max(1000)).max(20).optional()
  })
  .strict();

const tenantProfileUpdateSchema = z
  .object({
    phone: z.string().trim().max(80).optional().nullable(),
    email: z.string().trim().email().optional().nullable(),
    emergencyContactName: z.string().trim().max(180).optional().nullable(),
    emergencyContactPhone: z.string().trim().max(80).optional().nullable(),
    emergencyContactEmail: z.string().trim().email().optional().nullable()
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one tenant profile field is required.'
  });

const tenantLeaseInclude = {
  property: {
    select: {
      id: true,
      name: true,
      code: true,
      addressLine: true,
      city: true,
      area: true
    }
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      unitName: true,
      floor: true,
      bedrooms: true,
      bathrooms: true,
      areaSqm: true
    }
  },
  _count: {
    select: {
      rentDueItems: true
    }
  }
} satisfies Prisma.PmsLeaseInclude;

type TenantLeaseWithRelations = Prisma.PmsLeaseGetPayload<{
  include: typeof tenantLeaseInclude;
}>;

const tenantRentDueInclude = {
  property: {
    select: {
      id: true,
      name: true,
      code: true
    }
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      unitName: true
    }
  },
  lease: {
    select: {
      id: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      rentFrequency: true
    }
  }
} satisfies Prisma.PmsRentDueItemInclude;

type TenantRentDueWithRelations = Prisma.PmsRentDueItemGetPayload<{
  include: typeof tenantRentDueInclude;
}>;

const tenantWorkOrderInclude = {
  property: {
    select: {
      id: true,
      name: true,
      code: true
    }
  },
  unit: {
    select: {
      id: true,
      unitNumber: true,
      unitName: true
    }
  }
} satisfies Prisma.PmsWorkOrderInclude;

type TenantWorkOrderWithRelations = Prisma.PmsWorkOrderGetPayload<{
  include: typeof tenantWorkOrderInclude;
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

async function resolveTenantAccessOrThrow(input: {
  userId: string;
  accessId?: string;
}) {
  const access = await resolveTenantPortalAccess(input);

  if (!access) {
    throw new AppError(403, 'Tenant portal access is not enabled for this account.');
  }

  return access;
}

function tenantWorkspaceResponse(access: TenantPortalWorkspaceAccess) {
  return {
    access: access.access,
    company: access.company,
    tenant: access.tenant
  };
}

function tenantLeaseResponse(lease: TenantLeaseWithRelations) {
  return {
    id: lease.id,
    companyId: lease.companyId,
    tenantId: lease.tenantId,
    propertyId: lease.propertyId,
    property: lease.property,
    unitId: lease.unitId,
    unit: lease.unit,
    title: lease.title,
    status: lease.status,
    startDate: lease.startDate,
    endDate: lease.endDate,
    rentFrequency: lease.rentFrequency,
    rentAmount: decimalToString(lease.rentAmount),
    currency: lease.currency,
    securityDeposit: decimalToString(lease.securityDeposit),
    dueDayOfMonth: lease.dueDayOfMonth,
    notes: null,
    counts: {
      rentDueItems: lease._count.rentDueItems
    },
    createdAt: lease.createdAt,
    updatedAt: lease.updatedAt
  };
}

function tenantRentDueResponse(item: TenantRentDueWithRelations) {
  return {
    id: item.id,
    companyId: item.companyId,
    leaseId: item.leaseId,
    lease: item.lease,
    tenantId: item.tenantId,
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
    notes: null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function tenantWorkOrderResponse(workOrder: TenantWorkOrderWithRelations) {
  return {
    id: workOrder.id,
    companyId: workOrder.companyId,
    propertyId: workOrder.propertyId,
    property: workOrder.property,
    unitId: workOrder.unitId,
    unit: workOrder.unit,
    tenantId: workOrder.tenantId,
    title: workOrder.title,
    description: workOrder.description,
    priority: workOrder.priority,
    status: workOrder.status,
    currency: workOrder.currency,
    scheduledFor: workOrder.scheduledFor,
    resolvedAt: workOrder.resolvedAt,
    imageUrls: workOrder.imageUrls,
    documentUrls: workOrder.documentUrls,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt
  };
}

async function getTenantLeaseForMaintenance(input: {
  access: TenantPortalWorkspaceAccess;
  leaseId?: string;
}) {
  const lease = await prisma.pmsLease.findFirst({
    where: {
      ...(input.leaseId
        ? {
            id: input.leaseId,
            companyId: input.access.company.id,
            tenantId: input.access.tenant.id
          }
        : activeTenantLeaseWhere({
            companyId: input.access.company.id,
            tenantId: input.access.tenant.id
          }))
    },
    include: tenantLeaseInclude,
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }]
  });

  if (!lease) {
    throw new AppError(
      400,
      'No active tenant lease is available for this maintenance request.'
    );
  }

  return lease;
}

async function notifyPmsStaffOfTenantMaintenance(input: {
  companyId: string;
  workOrderId: string;
  title: string;
  tenantName: string;
  propertyName: string;
  unitNumber?: string | null;
}) {
  const recipients = await prisma.pmsCompanyMember.findMany({
    where: {
      companyId: input.companyId,
      active: true,
      role: {
        in: ['PMS_OWNER', 'PMS_MANAGER', 'PMS_MAINTENANCE', 'PMS_AGENT']
      },
      user: {
        suspendedAt: null,
        deactivatedAt: null
      }
    },
    select: {
      userId: true
    }
  });

  if (recipients.length === 0) {
    return;
  }

  const unitSuffix = input.unitNumber ? `, unit ${input.unitNumber}` : '';

  await prisma.notification.createMany({
    data: recipients.map((recipient) => ({
      userId: recipient.userId,
      type: NotificationType.PMS_MAINTENANCE_REQUEST_CREATED,
      title: 'Tenant maintenance request created',
      message: `${input.tenantName} submitted “${input.title}” for ${input.propertyName}${unitSuffix}.`
    }))
  });
}

tenantRouter.get('/overview', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });

    const now = new Date();
    const soon = new Date(now);
    soon.setUTCDate(soon.getUTCDate() + 14);

    const [activeLease, unpaidRentCount, overdueRentCount, dueSoonRentCount, openMaintenanceCount, latestRentDue, latestMaintenance] =
      await prisma.$transaction([
        prisma.pmsLease.findFirst({
          where: activeTenantLeaseWhere({
            companyId: access.company.id,
            tenantId: access.tenant.id
          }),
          include: tenantLeaseInclude,
          orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }]
        }),
        prisma.pmsRentDueItem.count({
          where: {
            companyId: access.company.id,
            tenantId: access.tenant.id,
            status: {
              in: [
                PmsRentDueStatus.UNPAID,
                PmsRentDueStatus.DUE_SOON,
                PmsRentDueStatus.PARTIALLY_PAID
              ]
            }
          }
        }),
        prisma.pmsRentDueItem.count({
          where: {
            companyId: access.company.id,
            tenantId: access.tenant.id,
            OR: [
              { status: PmsRentDueStatus.OVERDUE },
              {
                dueDate: { lt: now },
                status: {
                  in: [
                    PmsRentDueStatus.UNPAID,
                    PmsRentDueStatus.DUE_SOON,
                    PmsRentDueStatus.PARTIALLY_PAID
                  ]
                }
              }
            ]
          }
        }),
        prisma.pmsRentDueItem.count({
          where: {
            companyId: access.company.id,
            tenantId: access.tenant.id,
            dueDate: { gte: now, lte: soon },
            status: {
              in: [PmsRentDueStatus.UNPAID, PmsRentDueStatus.DUE_SOON]
            }
          }
        }),
        prisma.pmsWorkOrder.count({
          where: {
            companyId: access.company.id,
            tenantId: access.tenant.id,
            status: {
              notIn: [PmsMaintenanceStatus.RESOLVED, PmsMaintenanceStatus.CANCELLED]
            }
          }
        }),
        prisma.pmsRentDueItem.findFirst({
          where: {
            companyId: access.company.id,
            tenantId: access.tenant.id,
            status: { not: PmsRentDueStatus.CANCELLED }
          },
          include: tenantRentDueInclude,
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }]
        }),
        prisma.pmsWorkOrder.findFirst({
          where: {
            companyId: access.company.id,
            tenantId: access.tenant.id
          },
          include: tenantWorkOrderInclude,
          orderBy: { createdAt: 'desc' }
        })
      ]);

    res.json({
      workspace: tenantWorkspaceResponse(access),
      activeLease: activeLease ? tenantLeaseResponse(activeLease) : null,
      metrics: {
        unpaidRentCount,
        overdueRentCount,
        dueSoonRentCount,
        openMaintenanceCount
      },
      latest: {
        rentDueItem: latestRentDue ? tenantRentDueResponse(latestRentDue) : null,
        maintenanceRequest: latestMaintenance
          ? tenantWorkOrderResponse(latestMaintenance)
          : null
      },
      paymentFoundation: {
        onlineRentPaymentEnabled: false,
        note: 'Online rent checkout is not enabled in this tenant portal stage.'
      }
    });
  } catch (error) {
    next(error);
  }
});

tenantRouter.get('/lease', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });

    const leases = await prisma.pmsLease.findMany({
      where: {
        companyId: access.company.id,
        tenantId: access.tenant.id
      },
      include: tenantLeaseInclude,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }]
    });

    const activeLease = leases.find((lease) => ['ACTIVE', 'EXPIRING'].includes(lease.status));

    res.json({
      workspace: tenantWorkspaceResponse(access),
      activeLease: activeLease ? tenantLeaseResponse(activeLease) : null,
      leases: leases.map(tenantLeaseResponse)
    });
  } catch (error) {
    next(error);
  }
});

tenantRouter.get('/rent', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantRentQuerySchema.parse(req.query);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });
    const where: Prisma.PmsRentDueItemWhereInput = {
      companyId: access.company.id,
      tenantId: access.tenant.id,
      ...(query.status !== 'ALL' ? { status: query.status } : {})
    };

    const [rentDueItems, total] = await prisma.$transaction([
      prisma.pmsRentDueItem.findMany({
        where,
        include: tenantRentDueInclude,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        take: query.take,
        skip: query.skip
      }),
      prisma.pmsRentDueItem.count({ where })
    ]);

    res.json({
      workspace: tenantWorkspaceResponse(access),
      rentDueItems: rentDueItems.map(tenantRentDueResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: rentDueItems.length,
        total
      },
      paymentFoundation: {
        onlineRentPaymentEnabled: false,
        note: 'Rent payments and receipts are reserved for the next payment stage.'
      }
    });
  } catch (error) {
    next(error);
  }
});

tenantRouter.get('/maintenance', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantMaintenanceQuerySchema.parse(req.query);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });
    const where: Prisma.PmsWorkOrderWhereInput = {
      companyId: access.company.id,
      tenantId: access.tenant.id,
      ...(query.status !== 'ALL' ? { status: query.status } : {})
    };

    const [workOrders, total] = await prisma.$transaction([
      prisma.pmsWorkOrder.findMany({
        where,
        include: tenantWorkOrderInclude,
        orderBy: [{ createdAt: 'desc' }],
        take: query.take,
        skip: query.skip
      }),
      prisma.pmsWorkOrder.count({ where })
    ]);

    res.json({
      workspace: tenantWorkspaceResponse(access),
      workOrders: workOrders.map(tenantWorkOrderResponse),
      pagination: {
        take: query.take,
        skip: query.skip,
        count: workOrders.length,
        total
      }
    });
  } catch (error) {
    next(error);
  }
});

tenantRouter.post('/maintenance', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const data = tenantMaintenanceCreateSchema.parse(req.body);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });
    const lease = await getTenantLeaseForMaintenance({
      access,
      leaseId: data.leaseId
    });

    const workOrder = await prisma.pmsWorkOrder.create({
      data: {
        companyId: access.company.id,
        propertyId: lease.propertyId,
        unitId: lease.unitId,
        tenantId: access.tenant.id,
        title: data.title,
        description: normalizeNullableText(data.description),
        priority: data.priority,
        status: PmsMaintenanceStatus.OPEN,
        currency: lease.currency,
        imageUrls: data.imageUrls ?? [],
        documentUrls: data.documentUrls ?? [],
        createdById: req.user.id,
        updatedById: req.user.id
      },
      include: tenantWorkOrderInclude
    });

    await notifyPmsStaffOfTenantMaintenance({
      companyId: access.company.id,
      workOrderId: workOrder.id,
      title: workOrder.title,
      tenantName: access.tenant.fullName,
      propertyName: workOrder.property.name,
      unitNumber: workOrder.unit?.unitNumber
    });

    res.status(201).json({
      workspace: tenantWorkspaceResponse(access),
      workOrder: tenantWorkOrderResponse(workOrder)
    });
  } catch (error) {
    next(error);
  }
});

tenantRouter.get('/documents', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });

    res.json({
      workspace: tenantWorkspaceResponse(access),
      documents: [],
      foundation: {
        enabled: false,
        note: 'Tenant document publishing is reserved for a future document stage.'
      }
    });
  } catch (error) {
    next(error);
  }
});

tenantRouter.get('/profile', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });

    res.json({
      workspace: tenantWorkspaceResponse(access),
      profile: access.tenant
    });
  } catch (error) {
    next(error);
  }
});

tenantRouter.patch('/profile', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const data = tenantProfileUpdateSchema.parse(req.body);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });

    const tenant = await prisma.pmsTenant.update({
      where: {
        id: access.tenant.id
      },
      data: {
        ...(data.phone !== undefined ? { phone: normalizeNullableText(data.phone) } : {}),
        ...(data.email !== undefined ? { email: normalizeNullableText(data.email) } : {}),
        ...(data.emergencyContactName !== undefined
          ? { emergencyContactName: normalizeNullableText(data.emergencyContactName) }
          : {}),
        ...(data.emergencyContactPhone !== undefined
          ? { emergencyContactPhone: normalizeNullableText(data.emergencyContactPhone) }
          : {}),
        ...(data.emergencyContactEmail !== undefined
          ? { emergencyContactEmail: normalizeNullableText(data.emergencyContactEmail) }
          : {}),
        updatedById: req.user.id
      },
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
    });

    res.json({
      workspace: {
        ...tenantWorkspaceResponse(access),
        tenant
      },
      profile: tenant
    });
  } catch (error) {
    next(error);
  }
});

tenantRouter.get('/', requireAuth(), async (req, res, next) => {
  req.url = `/overview${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
  tenantRouter(req, res, next);
});
