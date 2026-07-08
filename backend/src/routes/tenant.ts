import {
  AccountSecurityEventType,
  NotificationType,
  PmsDocumentStatus,
  PmsDocumentType,
  PmsMaintenancePriority,
  PmsMaintenanceStatus,
  PmsRentDueStatus,
  PmsRentPaymentMethod,
  PmsRentPaymentStatus,
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
import {
  assertCanApplyRentPayment,
  callThawani,
  createCheckoutUrl,
  createPmsRentPaymentReference,
  createPmsRentReceiptNumber,
  createTenantRentReturnUrl,
  decimalToNumber as rentDecimalToNumber,
  getPaidRentStatus,
  mapThawaniPaymentStatus,
  RENT_PAYMENT_PROVIDER,
  roundMoney,
  toBaisa,
  type ThawaniCreateSessionData,
  type ThawaniRetrieveSessionData
} from '../lib/pmsRentPayments';
import { recordAccountSecurityEvent } from '../lib/accountSecurityEvents';
import { requireAuth } from '../middleware/auth';
import { AppError } from '../utils/http';

export const tenantRouter = Router();

const tenantAccessQuerySchema = z.object({
  accessId: z.string().trim().min(1).optional()
});

const tenantDocumentFileSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((value) => value.startsWith('/uploads/') || /^https?:\/\//i.test(value), {
    message: 'Document file must be an uploaded file path or a HTTPS URL.'
  });

const tenantDocumentCreateSchema = z
  .object({
    leaseId: z.string().trim().min(1).optional(),
    type: z.enum([PmsDocumentType.TENANT_ID, PmsDocumentType.PASSPORT_RESIDENCY, PmsDocumentType.OTHER] as const).default(PmsDocumentType.OTHER),
    title: z.string().trim().min(2).max(180),
    fileUrl: tenantDocumentFileSchema,
    expiryDate: z.coerce.date().optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable()
  })
  .strict();

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

const tenantRentDueParamsSchema = z.object({
  rentDueItemId: z.string().trim().min(1)
});

const tenantRentPaymentParamsSchema = z.object({
  rentPaymentId: z.string().trim().min(1)
});

const tenantOnlineRentPaymentSchema = z
  .object({
    amount: z.coerce.number().min(0.001).max(100000000).optional()
  })
  .strict();

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

const tenantMaintenanceActionParamsSchema = z.object({
  workOrderId: z.string().trim().min(1)
});

const tenantMaintenanceConfirmationSchema = z
  .object({
    notes: z.string().trim().max(1000).optional().nullable()
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


const tenantDocumentInclude = {
  property: { select: { id: true, name: true, code: true } },
  unit: { select: { id: true, unitNumber: true, unitName: true } },
  lease: { select: { id: true, title: true, status: true, startDate: true, endDate: true } },
  workOrder: { select: { id: true, title: true, status: true } },
  inspection: { select: { id: true, title: true, status: true, scheduledFor: true } }
} satisfies Prisma.PmsDocumentInclude;

type TenantDocumentWithRelations = Prisma.PmsDocumentGetPayload<{
  include: typeof tenantDocumentInclude;
}>;

const tenantRentPaymentInclude = {
  rentDueItem: {
    include: tenantRentDueInclude
  },
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
} satisfies Prisma.PmsRentPaymentInclude;

type TenantRentPaymentWithRelations = Prisma.PmsRentPaymentGetPayload<{
  include: typeof tenantRentPaymentInclude;
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
    balanceAmount: String(Math.max(roundMoney(rentDecimalToNumber(item.amount) - rentDecimalToNumber(item.paidAmount)), 0)),
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
    targetDate: workOrder.targetDate,
    imageUrls: workOrder.imageUrls,
    documentUrls: workOrder.documentUrls,
    beforeImageUrls: workOrder.beforeImageUrls,
    afterImageUrls: workOrder.afterImageUrls,
    beforeDocumentUrls: workOrder.beforeDocumentUrls,
    afterDocumentUrls: workOrder.afterDocumentUrls,
    tenantConfirmedAt: workOrder.tenantConfirmedAt,
    tenantReopenedAt: workOrder.tenantReopenedAt,
    tenantConfirmationNotes: workOrder.tenantConfirmationNotes,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt
  };
}

function tenantDocumentResponse(document: TenantDocumentWithRelations) {
  return {
    id: document.id,
    companyId: document.companyId,
    propertyId: document.propertyId,
    property: document.property,
    unitId: document.unitId,
    unit: document.unit,
    tenantId: document.tenantId,
    leaseId: document.leaseId,
    lease: document.lease,
    workOrderId: document.workOrderId,
    workOrder: document.workOrder,
    inspectionId: document.inspectionId,
    inspection: document.inspection,
    type: document.type,
    title: document.title,
    fileUrl: document.fileUrl,
    status: document.status,
    expiryDate: document.expiryDate,
    notes: document.notes,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

function tenantRentPaymentResponse(payment: TenantRentPaymentWithRelations) {
  return {
    id: payment.id,
    companyId: payment.companyId,
    rentDueItemId: payment.rentDueItemId,
    rentDueItem: tenantRentDueResponse(payment.rentDueItem),
    leaseId: payment.leaseId,
    lease: payment.lease,
    tenantId: payment.tenantId,
    propertyId: payment.propertyId,
    property: payment.property,
    unitId: payment.unitId,
    unit: payment.unit,
    amount: decimalToString(payment.amount),
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    referenceNumber: payment.referenceNumber,
    paidAt: payment.paidAt,
    receiptNumber: payment.receiptNumber,
    provider: payment.provider,
    providerReference: payment.providerReference,
    providerSessionId: payment.providerSessionId,
    checkoutUrl: payment.checkoutUrl,
    confirmedAt: payment.confirmedAt,
    cancelledAt: payment.cancelledAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  };
}

function tenantRentReceiptResponse(payment: TenantRentPaymentWithRelations) {
  return {
    receiptNumber: payment.receiptNumber,
    paymentId: payment.id,
    rentDueItemId: payment.rentDueItemId,
    status: payment.status,
    method: payment.method,
    amount: decimalToString(payment.amount),
    currency: payment.currency,
    referenceNumber: payment.referenceNumber,
    providerReference: payment.providerReference,
    paidAt: payment.paidAt,
    confirmedAt: payment.confirmedAt,
    issuedAt: payment.updatedAt,
    property: payment.property,
    unit: payment.unit,
    lease: payment.lease,
    rentDueItem: tenantRentDueResponse(payment.rentDueItem)
  };
}

function tenantOnlineRentPaymentEnabled() {
  return Boolean(
    process.env.THAWANI_SECRET_KEY?.trim() &&
      process.env.THAWANI_PUBLISHABLE_KEY?.trim()
  );
}

async function syncTenantRentDueItemFromConfirmedPayments(
  tx: Prisma.TransactionClient,
  input: { rentDueItemId: string; updatedById?: string | null }
) {
  const rentDueItem = await tx.pmsRentDueItem.findUniqueOrThrow({
    where: { id: input.rentDueItemId },
    select: {
      id: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
      status: true
    }
  });

  const [aggregate, latestConfirmedPayment] = await Promise.all([
    tx.pmsRentPayment.aggregate({
      where: {
        rentDueItemId: input.rentDueItemId,
        status: PmsRentPaymentStatus.CONFIRMED
      },
      _sum: { amount: true }
    }),
    tx.pmsRentPayment.findFirst({
      where: {
        rentDueItemId: input.rentDueItemId,
        status: PmsRentPaymentStatus.CONFIRMED
      },
      orderBy: [{ paidAt: 'desc' }, { updatedAt: 'desc' }],
      select: { paidAt: true, confirmedAt: true, updatedAt: true }
    })
  ]);

  const paidAmount = roundMoney(rentDecimalToNumber(aggregate._sum.amount));
  const status = getPaidRentStatus({ rentDueItem, paidAmount });

  return tx.pmsRentDueItem.update({
    where: { id: input.rentDueItemId },
    data: {
      paidAmount,
      status,
      paidAt:
        status === PmsRentDueStatus.PAID
          ? (latestConfirmedPayment?.paidAt ??
            latestConfirmedPayment?.confirmedAt ??
            latestConfirmedPayment?.updatedAt ??
            new Date())
          : null,
      ...(input.updatedById !== undefined ? { updatedById: input.updatedById } : {})
    },
    include: tenantRentDueInclude
  });
}

async function createTenantThawaniRentCheckoutSession(input: {
  accessId: string;
  rentDueItem: TenantRentDueWithRelations;
  paymentId: string;
  reference: string;
  amount: number;
  tenantEmail?: string | null;
  tenantPhone?: string | null;
}) {
  if (input.amount <= 0 || toBaisa(input.amount) < 100) {
    throw new AppError(400, 'Rent payment amount is below the minimum Thawani amount.');
  }

  const session = await callThawani<ThawaniCreateSessionData>('/checkout/session', {
    method: 'POST',
    body: JSON.stringify({
      client_reference_id: input.reference,
      mode: 'payment',
      products: [
        {
          name: `Rent ${input.rentDueItem.unit.unitNumber}`.slice(0, 40),
          quantity: 1,
          unit_amount: toBaisa(input.amount)
        }
      ],
      success_url: createTenantRentReturnUrl({
        accessId: input.accessId,
        rentDueItemId: input.rentDueItem.id,
        paymentReference: input.reference,
        result: 'success'
      }),
      cancel_url: createTenantRentReturnUrl({
        accessId: input.accessId,
        rentDueItemId: input.rentDueItem.id,
        paymentReference: input.reference,
        result: 'cancel'
      }),
      metadata: {
        pms_rent_payment_id: input.paymentId,
        pms_rent_due_item_id: input.rentDueItem.id,
        customer_name: input.rentDueItem.lease.title ?? 'Tenant rent',
        customer_email: input.tenantEmail ?? '',
        customer_phone: input.tenantPhone ?? ''
      }
    })
  });

  if (!session.session_id) {
    throw new AppError(502, 'Thawani did not return a checkout session id.');
  }

  return {
    sessionId: session.session_id,
    checkoutUrl: createCheckoutUrl(session.session_id)
  };
}

function assertTenantThawaniRentSessionMatchesPayment(
  session: ThawaniRetrieveSessionData,
  payment: { id: string; providerSessionId: string | null; providerReference: string | null; rentDueItemId: string }
) {
  if (session.session_id !== payment.providerSessionId) {
    throw new AppError(502, 'Thawani rent payment session mismatch.');
  }

  if (session.client_reference_id && payment.providerReference && session.client_reference_id !== payment.providerReference) {
    throw new AppError(502, 'Thawani rent payment reference mismatch.');
  }

  if (session.metadata?.pms_rent_payment_id && session.metadata.pms_rent_payment_id !== payment.id) {
    throw new AppError(502, 'Thawani rent payment metadata mismatch.');
  }

  if (session.metadata?.pms_rent_due_item_id && session.metadata.pms_rent_due_item_id !== payment.rentDueItemId) {
    throw new AppError(502, 'Thawani rent due metadata mismatch.');
  }
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

function getTenantMaintenanceTargetDate(priority: PmsMaintenancePriority) {
  const target = new Date();
  const days = priority === PmsMaintenancePriority.URGENT ? 1 : priority === PmsMaintenancePriority.HIGH ? 2 : priority === PmsMaintenancePriority.MEDIUM ? 5 : 10;
  target.setUTCDate(target.getUTCDate() + days);
  return target;
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
        onlineRentPaymentEnabled: tenantOnlineRentPaymentEnabled(),
        note: tenantOnlineRentPaymentEnabled()
          ? 'Online rent checkout is available for unpaid or partially paid rent.'
          : 'Online rent checkout requires Thawani rent payment configuration. Manual receipts remain visible here.'
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
        onlineRentPaymentEnabled: tenantOnlineRentPaymentEnabled(),
        note: tenantOnlineRentPaymentEnabled()
          ? 'Online rent checkout is available for unpaid or partially paid rent.'
          : 'Online rent checkout requires Thawani rent payment configuration. Manual receipts remain visible here.'
      }
    });
  } catch (error) {
    next(error);
  }
});

tenantRouter.get('/rent/:rentDueItemId/payments', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const { rentDueItemId } = tenantRentDueParamsSchema.parse(req.params);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });

    const rentDueItem = await prisma.pmsRentDueItem.findFirst({
      where: {
        id: rentDueItemId,
        companyId: access.company.id,
        tenantId: access.tenant.id
      },
      include: tenantRentDueInclude
    });

    if (!rentDueItem) {
      throw new AppError(404, 'Tenant rent due item not found.');
    }

    const payments = await prisma.pmsRentPayment.findMany({
      where: {
        companyId: access.company.id,
        tenantId: access.tenant.id,
        rentDueItemId
      },
      include: tenantRentPaymentInclude,
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }]
    });

    res.json({
      workspace: tenantWorkspaceResponse(access),
      rentDueItem: tenantRentDueResponse(rentDueItem),
      payments: payments.map(tenantRentPaymentResponse)
    });
  } catch (error) {
    next(error);
  }
});

tenantRouter.post('/rent/:rentDueItemId/payments/session', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const { rentDueItemId } = tenantRentDueParamsSchema.parse(req.params);
    const data = tenantOnlineRentPaymentSchema.parse(req.body);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });

    const rentDueItem = await prisma.pmsRentDueItem.findFirst({
      where: {
        id: rentDueItemId,
        companyId: access.company.id,
        tenantId: access.tenant.id
      },
      include: tenantRentDueInclude
    });

    if (!rentDueItem) {
      throw new AppError(404, 'Tenant rent due item not found.');
    }

    if (!tenantOnlineRentPaymentEnabled()) {
      throw new AppError(503, 'Online rent checkout requires Thawani rent payment configuration.');
    }

    const existingPendingPayment = await prisma.pmsRentPayment.findFirst({
      where: {
        companyId: access.company.id,
        tenantId: access.tenant.id,
        rentDueItemId,
        method: PmsRentPaymentMethod.ONLINE_GATEWAY,
        status: PmsRentPaymentStatus.PENDING,
        providerSessionId: { not: null },
        checkoutUrl: { not: null }
      },
      include: tenantRentPaymentInclude,
      orderBy: { createdAt: 'desc' }
    });

    if (existingPendingPayment?.checkoutUrl) {
      res.json({
        workspace: tenantWorkspaceResponse(access),
        rentDueItem: tenantRentDueResponse(rentDueItem),
        payment: tenantRentPaymentResponse(existingPendingPayment),
        checkoutUrl: existingPendingPayment.checkoutUrl
      });
      return;
    }

    const confirmedAggregate = await prisma.pmsRentPayment.aggregate({
      where: {
        rentDueItemId,
        status: PmsRentPaymentStatus.CONFIRMED
      },
      _sum: { amount: true }
    });
    const confirmedAmount = roundMoney(rentDecimalToNumber(confirmedAggregate._sum.amount));
    const remainingAmount = roundMoney(rentDecimalToNumber(rentDueItem.amount) - confirmedAmount);
    const paymentAmount = data.amount ?? remainingAmount;

    assertCanApplyRentPayment({
      rentDueItem,
      paymentAmount,
      existingConfirmedAmount: confirmedAmount
    });

    const reference = createPmsRentPaymentReference();
    const createdPayment = await prisma.pmsRentPayment.create({
      data: {
        companyId: access.company.id,
        rentDueItemId: rentDueItem.id,
        leaseId: rentDueItem.leaseId,
        tenantId: rentDueItem.tenantId,
        propertyId: rentDueItem.propertyId,
        unitId: rentDueItem.unitId,
        amount: paymentAmount,
        currency: rentDueItem.currency,
        method: PmsRentPaymentMethod.ONLINE_GATEWAY,
        status: PmsRentPaymentStatus.PENDING,
        provider: RENT_PAYMENT_PROVIDER,
        providerReference: reference,
        recordedById: req.user.id
      },
      include: tenantRentPaymentInclude
    });

    try {
      const session = await createTenantThawaniRentCheckoutSession({
        accessId: access.access.id,
        rentDueItem,
        paymentId: createdPayment.id,
        reference,
        amount: paymentAmount,
        tenantEmail: access.tenant.email,
        tenantPhone: access.tenant.phone
      });

      const payment = await prisma.pmsRentPayment.update({
        where: { id: createdPayment.id },
        data: {
          providerSessionId: session.sessionId,
          checkoutUrl: session.checkoutUrl
        },
        include: tenantRentPaymentInclude
      });

      await recordAccountSecurityEvent(prisma, {
        userId: req.user.id,
        actorId: req.user.id,
        type: AccountSecurityEventType.ADMIN_PMS_ACCESS_UPDATED,
        title: 'PMS tenant rent checkout created',
        message: `${req.user.email} created an online rent checkout session.`,
        metadata: {
          action: 'create',
          resourceType: 'pmsRentPayment',
          companyId: access.company.id,
          rentPaymentId: payment.id,
          rentDueItemId: payment.rentDueItemId,
          tenantId: payment.tenantId,
          provider: payment.provider,
          status: payment.status
        }
      });

      res.status(201).json({
        workspace: tenantWorkspaceResponse(access),
        rentDueItem: tenantRentDueResponse(rentDueItem),
        payment: tenantRentPaymentResponse(payment),
        checkoutUrl: session.checkoutUrl
      });
    } catch (checkoutError) {
      await prisma.pmsRentPayment.update({
        where: { id: createdPayment.id },
        data: { status: PmsRentPaymentStatus.FAILED, cancelledAt: new Date() }
      });
      throw checkoutError;
    }
  } catch (error) {
    next(error);
  }
});

tenantRouter.post('/rent-payments/:rentPaymentId/sync', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const { rentPaymentId } = tenantRentPaymentParamsSchema.parse(req.params);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });

    const payment = await prisma.pmsRentPayment.findFirst({
      where: {
        id: rentPaymentId,
        companyId: access.company.id,
        tenantId: access.tenant.id
      },
      include: tenantRentPaymentInclude
    });

    if (!payment) {
      throw new AppError(404, 'Tenant rent payment not found.');
    }

    if (!payment.providerSessionId) {
      throw new AppError(400, 'Rent payment checkout session has not been created yet.');
    }

    if (payment.status === PmsRentPaymentStatus.CONFIRMED) {
      res.json({
        workspace: tenantWorkspaceResponse(access),
        rentDueItem: tenantRentDueResponse(payment.rentDueItem),
        payment: tenantRentPaymentResponse(payment),
        receipt: payment.receiptNumber ? tenantRentReceiptResponse(payment) : null
      });
      return;
    }

    const thawaniSession = await callThawani<ThawaniRetrieveSessionData>(`/checkout/session/${payment.providerSessionId}`);
    assertTenantThawaniRentSessionMatchesPayment(thawaniSession, payment);
    const nextStatus = mapThawaniPaymentStatus(thawaniSession.payment_status);

    if (nextStatus === PmsRentPaymentStatus.CONFIRMED) {
      const confirmedAggregate = await prisma.pmsRentPayment.aggregate({
        where: {
          rentDueItemId: payment.rentDueItemId,
          status: PmsRentPaymentStatus.CONFIRMED
        },
        _sum: { amount: true }
      });
      assertCanApplyRentPayment({
        rentDueItem: payment.rentDueItem,
        paymentAmount: rentDecimalToNumber(payment.amount),
        existingConfirmedAmount: roundMoney(rentDecimalToNumber(confirmedAggregate._sum.amount))
      });
    }

    const { updatedPayment, updatedRentDueItem } = await prisma.$transaction(async (tx) => {
      const changedPayment = await tx.pmsRentPayment.update({
        where: { id: payment.id },
        data: {
          status: nextStatus,
          ...(nextStatus === PmsRentPaymentStatus.CONFIRMED
            ? {
                confirmedAt: new Date(),
                paidAt: payment.paidAt ?? new Date(),
                receiptNumber: payment.receiptNumber ?? createPmsRentReceiptNumber()
              }
            : {}),
          ...(nextStatus === PmsRentPaymentStatus.FAILED
            ? { cancelledAt: new Date() }
            : {})
        },
        include: tenantRentPaymentInclude
      });

      const refreshedRentDueItem =
        nextStatus === PmsRentPaymentStatus.CONFIRMED
          ? await syncTenantRentDueItemFromConfirmedPayments(tx, {
              rentDueItemId: payment.rentDueItemId,
              updatedById: req.user!.id
            })
          : payment.rentDueItem;

      return { updatedPayment: changedPayment, updatedRentDueItem: refreshedRentDueItem };
    });

    await recordAccountSecurityEvent(prisma, {
      userId: req.user.id,
      actorId: req.user.id,
      type: AccountSecurityEventType.ADMIN_PMS_ACCESS_UPDATED,
      title: 'PMS tenant rent payment synced',
      message: `${req.user.email} synced an online rent payment status.`,
      metadata: {
        action: 'sync',
        resourceType: 'pmsRentPayment',
        companyId: access.company.id,
        rentPaymentId: updatedPayment.id,
        rentDueItemId: updatedPayment.rentDueItemId,
        tenantId: updatedPayment.tenantId,
        provider: updatedPayment.provider,
        status: updatedPayment.status
      }
    });

    res.json({
      workspace: tenantWorkspaceResponse(access),
      rentDueItem: tenantRentDueResponse(updatedRentDueItem),
      payment: tenantRentPaymentResponse(updatedPayment),
      receipt:
        updatedPayment.status === PmsRentPaymentStatus.CONFIRMED
          ? tenantRentReceiptResponse(updatedPayment)
          : null
    });
  } catch (error) {
    next(error);
  }
});

tenantRouter.get('/rent-payments/:rentPaymentId/receipt', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const { rentPaymentId } = tenantRentPaymentParamsSchema.parse(req.params);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });

    const payment = await prisma.pmsRentPayment.findFirst({
      where: {
        id: rentPaymentId,
        companyId: access.company.id,
        tenantId: access.tenant.id
      },
      include: tenantRentPaymentInclude
    });

    if (!payment) {
      throw new AppError(404, 'Tenant rent payment receipt not found.');
    }

    if (payment.status !== PmsRentPaymentStatus.CONFIRMED) {
      throw new AppError(400, 'Only confirmed rent payments have printable receipts.');
    }

    res.json({
      workspace: tenantWorkspaceResponse(access),
      receipt: tenantRentReceiptResponse(payment)
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
        targetDate: getTenantMaintenanceTargetDate(data.priority),
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

tenantRouter.post('/maintenance/:workOrderId/confirm-resolved', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const { workOrderId } = tenantMaintenanceActionParamsSchema.parse(req.params);
    const data = tenantMaintenanceConfirmationSchema.parse(req.body);
    const access = await resolveTenantAccessOrThrow({ userId: req.user.id, accessId: query.accessId });

    const existing = await prisma.pmsWorkOrder.findFirst({
      where: { id: workOrderId, companyId: access.company.id, tenantId: access.tenant.id },
      select: { id: true, status: true }
    });
    if (!existing) throw new AppError(404, 'Tenant maintenance request not found.');
    if (existing.status !== PmsMaintenanceStatus.RESOLVED) {
      throw new AppError(400, 'Only resolved maintenance requests can be confirmed.');
    }

    const workOrder = await prisma.pmsWorkOrder.update({
      where: { id: workOrderId },
      data: {
        tenantConfirmedAt: new Date(),
        tenantConfirmationNotes: normalizeNullableText(data.notes),
        tenantReopenedAt: null,
        updatedById: req.user.id
      },
      include: tenantWorkOrderInclude
    });

    res.json({ workspace: tenantWorkspaceResponse(access), workOrder: tenantWorkOrderResponse(workOrder) });
  } catch (error) {
    next(error);
  }
});

tenantRouter.post('/maintenance/:workOrderId/reopen', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const { workOrderId } = tenantMaintenanceActionParamsSchema.parse(req.params);
    const data = tenantMaintenanceConfirmationSchema.parse(req.body);
    const access = await resolveTenantAccessOrThrow({ userId: req.user.id, accessId: query.accessId });

    const existing = await prisma.pmsWorkOrder.findFirst({
      where: { id: workOrderId, companyId: access.company.id, tenantId: access.tenant.id },
      select: { id: true, status: true }
    });
    if (!existing) throw new AppError(404, 'Tenant maintenance request not found.');
    if (existing.status !== PmsMaintenanceStatus.RESOLVED) {
      throw new AppError(400, 'Only resolved maintenance requests can be reopened by tenants.');
    }

    const workOrder = await prisma.pmsWorkOrder.update({
      where: { id: workOrderId },
      data: {
        status: PmsMaintenanceStatus.IN_PROGRESS,
        tenantReopenedAt: new Date(),
        tenantConfirmedAt: null,
        tenantConfirmationNotes: normalizeNullableText(data.notes),
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

    res.json({ workspace: tenantWorkspaceResponse(access), workOrder: tenantWorkOrderResponse(workOrder) });
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

    const documents = await prisma.pmsDocument.findMany({
      where: {
        companyId: access.company.id,
        tenantId: access.tenant.id,
        status: { not: PmsDocumentStatus.ARCHIVED }
      },
      include: tenantDocumentInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
    });

    res.json({
      workspace: tenantWorkspaceResponse(access),
      documents: documents.map(tenantDocumentResponse),
      foundation: {
        enabled: true,
        note: 'Tenant documents are private and scoped to this tenant record.'
      }
    });
  } catch (error) {
    next(error);
  }
});

tenantRouter.post('/documents', requireAuth(), async (req, res, next) => {
  try {
    if (!req.user) throw new AppError(401, 'Unauthorized');

    const query = tenantAccessQuerySchema.parse(req.query);
    const data = tenantDocumentCreateSchema.parse(req.body);
    const access = await resolveTenantAccessOrThrow({
      userId: req.user.id,
      accessId: query.accessId
    });

    const activeLease = data.leaseId
      ? await prisma.pmsLease.findFirst({
          where: {
            id: data.leaseId,
            companyId: access.company.id,
            tenantId: access.tenant.id
          },
          select: { id: true, propertyId: true, unitId: true }
        })
      : await prisma.pmsLease.findFirst({
          where: activeTenantLeaseWhere({ companyId: access.company.id, tenantId: access.tenant.id }),
          select: { id: true, propertyId: true, unitId: true },
          orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }]
        });

    const document = await prisma.pmsDocument.create({
      data: {
        companyId: access.company.id,
        tenantId: access.tenant.id,
        leaseId: activeLease?.id ?? null,
        propertyId: activeLease?.propertyId ?? null,
        unitId: activeLease?.unitId ?? null,
        type: data.type,
        title: data.title,
        fileUrl: data.fileUrl,
        status: PmsDocumentStatus.ACTIVE,
        expiryDate: data.expiryDate ?? null,
        notes: normalizeNullableText(data.notes),
        uploadedById: req.user.id,
        updatedById: req.user.id
      },
      include: tenantDocumentInclude
    });

    res.status(201).json({
      workspace: tenantWorkspaceResponse(access),
      document: tenantDocumentResponse(document)
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
