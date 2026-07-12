import { DomainAuditDomain, Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { recordDomainAuditEvent, requestAuditContext } from '../../../lib/domainAudit';
import { prisma } from '../../../lib/prisma';
import { createPmsRentReceiptNumber } from '../../../lib/pmsRentPayments';
import { requireAuth } from '../../../middleware/auth';
import {
  assertCanCollectPmsRent,
  assertCanManagePmsAccounting,
  assertCanViewPmsAccounting,
} from '../access';
import { AppError } from '../../../utils/http';
import {
  assertPmsPropertyScope,
  assertPmsScopeLinks,
  propertyScopeWhere,
  requirePmsRouteAccess,
} from '../shared/routeAccess';
import { assertFinancialPeriodOpen } from './periods';
import { assertPositiveMoney, assertSameCurrency, money } from './money';
import {
  allocatePayment,
  allocatePaymentBatch,
  getPaymentAvailability,
  lockFinanceRows,
  paymentBalanceResponse,
  postDepositTransaction,
  postPaymentAdjustment,
  recomputeCharge,
  reverseAllocation,
  transitionDepositTransaction,
} from './service';

export const pmsFinanceRouter = Router();

const companyQuery = z.object({ companyId: z.string().trim().min(1).optional() });
const idParams = z.object({ id: z.string().trim().min(1) });
const allocationParams = z.object({ id: z.string().trim().min(1), allocationId: z.string().trim().min(1) });
const depositTransactionParams = z.object({ id: z.string().trim().min(1), transactionId: z.string().trim().min(1) });
const chargeLineSchema = z.object({
  category: z.enum(['RENT', 'UTILITIES', 'SERVICE_CHARGE', 'LATE_FEE', 'MAINTENANCE', 'DEPOSIT_DEDUCTION', 'DISCOUNT', 'MANUAL_ADJUSTMENT', 'OTHER']),
  description: z.string().trim().min(1).max(300),
  quantity: z.coerce.number().positive().max(1_000_000).default(1),
  unitAmount: z.coerce.number().positive().max(1_000_000_000),
  servicePeriodStart: z.coerce.date().optional(),
  servicePeriodEnd: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const createChargeSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1),
  unitId: z.string().trim().min(1).nullable().optional(),
  leaseId: z.string().trim().min(1).nullable().optional(),
  tenantId: z.string().trim().min(1).nullable().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  dueDate: z.coerce.date(),
  servicePeriodStart: z.coerce.date().nullable().optional(),
  servicePeriodEnd: z.coerce.date().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(chargeLineSchema).min(1).max(100),
});
const adjustmentSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  type: z.enum(['DISCOUNT', 'WRITE_OFF', 'REVERSAL', 'MANUAL']),
  amount: z.coerce.number().min(-1_000_000_000).max(1_000_000_000).refine((value) => value !== 0, 'Amount cannot be zero.'),
  reason: z.string().trim().min(3).max(1000),
});
const creditNoteSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  amount: z.coerce.number().positive().max(1_000_000_000),
  reason: z.string().trim().min(3).max(1000),
});
const creditNoteTransitionSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  action: z.enum(['APPROVE', 'APPLY', 'VOID']),
  reason: z.string().trim().min(3).max(1000).optional(),
});
const createPaymentSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1),
  unitId: z.string().trim().min(1),
  leaseId: z.string().trim().min(1),
  tenantId: z.string().trim().min(1),
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD_MANUAL', 'CHEQUE', 'ONLINE_GATEWAY', 'OTHER']),
  paidAt: z.coerce.date().default(() => new Date()),
  referenceNumber: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
});
const allocationSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  chargeId: z.string().trim().min(1),
  amount: z.coerce.number().positive().max(1_000_000_000),
  idempotencyKey: z.string().trim().min(8).max(200),
});
const allocationBatchSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
  allocations: z.array(z.object({
    chargeId: z.string().trim().min(1),
    amount: z.coerce.number().positive().max(1_000_000_000),
  })).min(1).max(100),
});
const financeListPagination = {
  take: z.coerce.number().int().min(1).max(100).default(25),
  skip: z.coerce.number().int().min(0).default(0),
};
const reverseSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(3).max(1000),
});
const paymentAdjustmentSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  allocationId: z.string().trim().min(1).nullable().optional(),
  type: z.enum(['REFUND', 'REVERSAL', 'CHARGEBACK', 'WRITE_OFF']),
  amount: z.coerce.number().positive().max(1_000_000_000),
  reason: z.string().trim().min(3).max(1000),
  idempotencyKey: z.string().trim().min(8).max(200),
  referenceNumber: z.string().trim().max(200).nullable().optional(),
});
const createDepositSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  leaseId: z.string().trim().min(1),
  expectedAmount: z.coerce.number().nonnegative().max(1_000_000_000),
});
const depositTransactionSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  type: z.enum(['COLLECTION', 'DEDUCTION', 'REFUND', 'CONVERSION_TO_INCOME', 'ADJUSTMENT']),
  amount: z.coerce.number().positive().max(1_000_000_000),
  reason: z.string().trim().max(1000).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
  paymentId: z.string().trim().min(1).nullable().optional(),
  chargeId: z.string().trim().min(1).nullable().optional(),
});
const depositTransitionSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  action: z.enum(['APPROVE', 'POST', 'VOID']),
  reason: z.string().trim().min(3).max(1000).optional(),
});
const periodSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  propertyId: z.string().trim().min(1).nullable().optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});
const periodTransitionSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  action: z.enum(['REVIEW', 'CLOSE', 'REOPEN']),
  reason: z.string().trim().min(3).max(1000),
});
const reconciliationSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  source: z.enum(['BANK', 'PAYMENT_PROVIDER', 'CASHBOOK', 'MANUAL']),
  externalReference: z.string().trim().min(1).max(300),
  amount: z.coerce.number().positive().max(1_000_000_000),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  transactionDate: z.coerce.date(),
  propertyId: z.string().trim().min(1).nullable().optional(),
  payerReference: z.string().trim().max(300).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
const reconciliationMatchSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  paymentId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(1000),
});
const payoutSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  ownerUserId: z.string().trim().min(1),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  managementFeeAmount: z.coerce.number().nonnegative().default(0),
  reservedAmount: z.coerce.number().nonnegative().default(0),
  notes: z.string().trim().max(2000).nullable().optional(),
  lines: z.array(z.object({
    propertyId: z.string().trim().min(1),
    statementId: z.string().trim().min(1).nullable().optional(),
    incomeAmount: z.coerce.number().nonnegative(),
    expenseAmount: z.coerce.number().nonnegative(),
    managementFeeAmount: z.coerce.number().nonnegative().default(0),
    reservedAmount: z.coerce.number().nonnegative().default(0),
  })).min(1).max(500),
});
const payoutTransitionSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  action: z.enum(['APPROVE', 'START_PROCESSING', 'MARK_PAID_MANUAL', 'FAIL', 'CANCEL']),
  reason: z.string().trim().min(3).max(1000).optional(),
  payoutReference: z.string().trim().max(300).optional(),
  paymentMethodNote: z.string().trim().max(500).optional(),
});

function audit(req: Parameters<typeof requestAuditContext>[0], input: Parameters<typeof recordDomainAuditEvent>[1]) {
  return recordDomainAuditEvent(prisma, { ...input, ...requestAuditContext(req) });
}

function chargeResponse(charge: Record<string, unknown>) {
  return charge;
}

type ChargeSortField = 'dueDate' | 'createdAt' | 'updatedAt' | 'chargeNumber' | 'balanceAmount' | 'status';
type PaymentSortField = 'paidAt' | 'createdAt' | 'updatedAt' | 'amount' | 'receiptNumber' | 'status';
type SortDirection = 'asc' | 'desc';

function chargeOrderBy(sortBy: ChargeSortField, direction: SortDirection): Prisma.PmsChargeOrderByWithRelationInput[] {
  switch (sortBy) {
    case 'createdAt': return [{ createdAt: direction }, { id: 'desc' }];
    case 'updatedAt': return [{ updatedAt: direction }, { id: 'desc' }];
    case 'chargeNumber': return [{ chargeNumber: direction }, { id: 'desc' }];
    case 'balanceAmount': return [{ balanceAmount: direction }, { id: 'desc' }];
    case 'status': return [{ status: direction }, { id: 'desc' }];
    default: return [{ dueDate: direction }, { id: 'desc' }];
  }
}

function paymentOrderBy(sortBy: PaymentSortField, direction: SortDirection): Prisma.PmsRentPaymentOrderByWithRelationInput[] {
  switch (sortBy) {
    case 'createdAt': return [{ createdAt: direction }, { id: 'desc' }];
    case 'updatedAt': return [{ updatedAt: direction }, { id: 'desc' }];
    case 'amount': return [{ amount: direction }, { id: 'desc' }];
    case 'receiptNumber': return [{ receiptNumber: direction }, { id: 'desc' }];
    case 'status': return [{ status: direction }, { id: 'desc' }];
    default: return [{ paidAt: direction }, { id: 'desc' }];
  }
}

const chargeListInclude = {
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, unitNumber: true } },
  tenant: { select: { id: true, fullName: true } },
  _count: { select: { allocations: true, adjustments: true, creditNotes: true } },
} satisfies Prisma.PmsChargeInclude;

const paymentListInclude = {
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, unitNumber: true } },
  tenant: { select: { id: true, fullName: true } },
  lease: { select: { id: true, title: true } },
  allocations: {
    select: { id: true, amount: true, status: true, chargeId: true },
    orderBy: { createdAt: 'asc' as const },
  },
  adjustments: {
    select: { id: true, amount: true, status: true, type: true },
    orderBy: { createdAt: 'asc' as const },
  },
  securityDepositTransactions: {
    where: { status: 'POSTED' as const, type: 'COLLECTION' as const },
    select: { amount: true },
  },
} satisfies Prisma.PmsRentPaymentInclude;

function paymentListResponse(payment: Prisma.PmsRentPaymentGetPayload<{ include: typeof paymentListInclude }>) {
  const allocatedAmount = payment.allocations
    .filter((allocation) => allocation.status === 'ACTIVE')
    .reduce((sum, allocation) => sum.plus(allocation.amount), new Prisma.Decimal(0));
  const adjustedAmount = payment.adjustments
    .filter((adjustment) => adjustment.status === 'POSTED')
    .reduce((sum, adjustment) => sum.plus(adjustment.amount), new Prisma.Decimal(0));
  const depositAllocatedAmount = payment.securityDepositTransactions
    .reduce((sum, transaction) => sum.plus(transaction.amount), new Prisma.Decimal(0));
  const availableAmount = Prisma.Decimal.max(
    new Prisma.Decimal(0),
    payment.amount.minus(adjustedAmount).minus(allocatedAmount).minus(depositAllocatedAmount),
  );
  return {
    ...payment,
    allocatedAmount: allocatedAmount.toString(),
    adjustedAmount: adjustedAmount.toString(),
    depositAllocatedAmount: depositAllocatedAmount.toString(),
    availableAmount: availableAmount.toString(),
  };
}

pmsFinanceRouter.get('/charges', requireAuth(), async (req, res, next) => {
  try {
    const query = companyQuery.extend({
      propertyId: z.string().trim().min(1).optional(),
      status: z.enum(['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID']).optional(),
      openOnly: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
      tenantId: z.string().trim().min(1).optional(),
      currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
      search: z.string().trim().max(160).optional(),
      dueFrom: z.coerce.date().optional(),
      dueTo: z.coerce.date().optional(),
      sortBy: z.enum(['dueDate', 'createdAt', 'updatedAt', 'chargeNumber', 'balanceAmount', 'status']).default('dueDate'),
      direction: z.enum(['asc', 'desc']).default('desc'),
      ...financeListPagination,
    }).parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);
    const where: Prisma.PmsChargeWhereInput = {
      companyId: access.company.id,
      ...propertyScopeWhere(access),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.openOnly ? { status: { in: ['ISSUED', 'PARTIALLY_PAID'] }, balanceAmount: { gt: 0 } } : query.status ? { status: query.status } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...((query.dueFrom || query.dueTo) ? {
        dueDate: {
          ...(query.dueFrom ? { gte: query.dueFrom } : {}),
          ...(query.dueTo ? { lte: query.dueTo } : {}),
        },
      } : {}),
      ...(query.search ? {
        OR: [
          { chargeNumber: { contains: query.search, mode: 'insensitive' } },
          { notes: { contains: query.search, mode: 'insensitive' } },
          { property: { name: { contains: query.search, mode: 'insensitive' } } },
          { unit: { unitNumber: { contains: query.search, mode: 'insensitive' } } },
          { tenant: { fullName: { contains: query.search, mode: 'insensitive' } } },
        ],
      } : {}),
    };
    const [charges, total, totalsByCurrency] = await prisma.$transaction([
      prisma.pmsCharge.findMany({
        where,
        include: chargeListInclude,
        orderBy: chargeOrderBy(query.sortBy, query.direction),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsCharge.count({ where }),
      prisma.pmsCharge.groupBy({
        by: ['currency'],
        where,
        _sum: { totalAmount: true, paidAmount: true, creditedAmount: true, balanceAmount: true },
        _count: { _all: true },
        orderBy: { currency: 'asc' },
      }),
    ]);
    res.json({
      charges: charges.map(chargeResponse),
      pagination: { take: query.take, skip: query.skip, count: charges.length, total },
      totalsByCurrency: totalsByCurrency.map((item) => ({
        currency: item.currency,
        count: item._count._all,
        totalAmount: item._sum.totalAmount?.toString() ?? '0',
        paidAmount: item._sum.paidAmount?.toString() ?? '0',
        creditedAmount: item._sum.creditedAmount?.toString() ?? '0',
        balanceAmount: item._sum.balanceAmount?.toString() ?? '0',
      })),
    });
  } catch (error) { next(error); }
});

pmsFinanceRouter.get('/charges/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = companyQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    const charge = await prisma.pmsCharge.findFirst({
      where: { id, companyId: access.company.id },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
        tenant: { select: { id: true, fullName: true } },
        lease: { select: { id: true, title: true, currency: true } },
        lines: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
        adjustments: { include: { createdBy: { select: { id: true, name: true } }, reversedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
        creditNotes: { include: { createdBy: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
        allocations: {
          include: {
            payment: { select: { id: true, receiptNumber: true, paidAt: true, amount: true, method: true } },
            createdBy: { select: { id: true, name: true } },
            reversedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        documents: { select: { id: true, title: true, type: true, status: true, createdAt: true } },
      },
    });
    if (!charge) throw new AppError(404, 'Charge not found.');
    assertPmsPropertyScope(access, charge.propertyId);
    res.json({ charge });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/charges', requireAuth(), async (req, res, next) => {
  try {
    const data = createChargeSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const links = await assertPmsScopeLinks({ access, propertyId: data.propertyId, unitId: data.unitId, leaseId: data.leaseId, tenantId: data.tenantId });
    if (links.lease) assertSameCurrency(data.currency, links.lease.currency);
    if (data.servicePeriodStart && data.servicePeriodEnd && data.servicePeriodEnd < data.servicePeriodStart) {
      throw new AppError(400, 'Service period end must not be before its start.');
    }
    const charge = await prisma.$transaction(async (tx) => {
      const sequence = await tx.pmsCharge.count({ where: { companyId: access.company.id } });
      const created = await tx.pmsCharge.create({
        data: {
          companyId: access.company.id,
          propertyId: data.propertyId,
          unitId: data.unitId ?? null,
          leaseId: data.leaseId ?? null,
          tenantId: data.tenantId ?? null,
          chargeNumber: `CHG-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(sequence + 1).padStart(6, '0')}`,
          currency: data.currency,
          dueDate: data.dueDate,
          servicePeriodStart: data.servicePeriodStart ?? null,
          servicePeriodEnd: data.servicePeriodEnd ?? null,
          notes: data.notes ?? null,
          createdById: req.user!.id,
          lines: {
            create: data.lines.map((line, position) => ({
              companyId: access.company.id,
              category: line.category,
              description: line.description,
              quantity: money(line.quantity),
              unitAmount: money(line.unitAmount),
              amount: money(line.quantity).mul(money(line.unitAmount)),
              position,
              servicePeriodStart: line.servicePeriodStart ?? null,
              servicePeriodEnd: line.servicePeriodEnd ?? null,
              metadata: line.metadata as Prisma.InputJsonValue | undefined,
            })),
          },
        },
      });
      return recomputeCharge(tx, created.id);
    });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsCharge', entityId: charge.id, action: 'PMS_CHARGE_CREATED', actorId: req.user!.id, afterMetadata: { chargeNumber: charge.chargeNumber, propertyId: charge.propertyId, totalAmount: charge.totalAmount.toString(), currency: charge.currency } });
    res.status(201).json({ charge });
  } catch (error) { next(error); }
});

pmsFinanceRouter.patch('/charges/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = createChargeSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const current = await prisma.pmsCharge.findFirst({
      where: { id, companyId: access.company.id },
      include: { allocations: { where: { status: 'ACTIVE' } }, creditNotes: { where: { status: { not: 'VOID' } } } },
    });
    if (!current) throw new AppError(404, 'Charge not found.');
    assertPmsPropertyScope(access, current.propertyId);
    if (current.status !== 'DRAFT') throw new AppError(409, 'Only draft charges can be edited.');
    if (current.allocations.length > 0 || current.creditNotes.length > 0) {
      throw new AppError(409, 'Draft charge cannot be edited after allocations or credit notes exist.');
    }
    const links = await assertPmsScopeLinks({
      access,
      propertyId: data.propertyId,
      unitId: data.unitId,
      leaseId: data.leaseId,
      tenantId: data.tenantId,
    });
    if (links.lease) assertSameCurrency(data.currency, links.lease.currency);
    if (data.servicePeriodStart && data.servicePeriodEnd && data.servicePeriodEnd < data.servicePeriodStart) {
      throw new AppError(400, 'Service period end must not be before its start.');
    }
    const charge = await prisma.$transaction(async (tx) => {
      await lockFinanceRows(tx, 'PmsCharge', [current.id]);
      const locked = await tx.pmsCharge.findUnique({
        where: { id: current.id },
        include: { allocations: { where: { status: 'ACTIVE' } }, creditNotes: { where: { status: { not: 'VOID' } } } },
      });
      if (!locked || locked.companyId !== access.company.id) throw new AppError(404, 'Charge not found.');
      if (locked.status !== 'DRAFT') throw new AppError(409, 'Only draft charges can be edited.');
      if (locked.allocations.length > 0 || locked.creditNotes.length > 0) {
        throw new AppError(409, 'Draft charge cannot be edited after allocations or credit notes exist.');
      }
      await tx.pmsChargeLine.deleteMany({ where: { chargeId: current.id } });
      await tx.pmsCharge.update({
        where: { id: current.id },
        data: {
          propertyId: data.propertyId,
          unitId: data.unitId ?? null,
          leaseId: data.leaseId ?? null,
          tenantId: data.tenantId ?? null,
          currency: data.currency,
          dueDate: data.dueDate,
          servicePeriodStart: data.servicePeriodStart ?? null,
          servicePeriodEnd: data.servicePeriodEnd ?? null,
          notes: data.notes ?? null,
          lines: {
            create: data.lines.map((line, position) => ({
              companyId: access.company.id,
              category: line.category,
              description: line.description,
              quantity: money(line.quantity),
              unitAmount: money(line.unitAmount),
              amount: money(line.quantity).mul(money(line.unitAmount)),
              position,
              servicePeriodStart: line.servicePeriodStart ?? null,
              servicePeriodEnd: line.servicePeriodEnd ?? null,
              metadata: line.metadata as Prisma.InputJsonValue | undefined,
            })),
          },
        },
      });
      return recomputeCharge(tx, current.id);
    });
    await audit(req, {
      companyId: access.company.id,
      domain: DomainAuditDomain.PMS,
      entityType: 'PmsCharge',
      entityId: current.id,
      action: 'PMS_CHARGE_DRAFT_UPDATED',
      actorId: req.user!.id,
      changedFields: ['propertyId', 'unitId', 'leaseId', 'tenantId', 'currency', 'dueDate', 'servicePeriodStart', 'servicePeriodEnd', 'notes', 'lines'],
      beforeMetadata: { propertyId: current.propertyId, currency: current.currency, dueDate: current.dueDate.toISOString() },
      afterMetadata: { propertyId: charge.propertyId, currency: charge.currency, dueDate: charge.dueDate.toISOString(), lineCount: data.lines.length },
    });
    res.json({ charge });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/charges/:id/issue', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = companyQuery.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const current = await prisma.pmsCharge.findFirst({ where: { id, companyId: access.company.id } });
    if (!current) throw new AppError(404, 'Charge not found.');
    assertPmsPropertyScope(access, current.propertyId);
    if (current.status !== 'DRAFT') throw new AppError(409, 'Only draft charges can be issued.');
    const calculated = await prisma.$transaction((tx) => recomputeCharge(tx, current.id));
    if (!calculated.totalAmount.isPositive()) throw new AppError(409, 'Charge total must be greater than zero before issue.');
    await assertFinancialPeriodOpen(prisma, { companyId: access.company.id, propertyId: current.propertyId, currency: current.currency, transactionDate: new Date() });
    const charge = await prisma.pmsCharge.update({ where: { id }, data: { status: 'ISSUED', issuedAt: new Date(), issuedById: req.user!.id }, include: { lines: true, adjustments: true } });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsCharge', entityId: id, action: 'PMS_CHARGE_ISSUED', actorId: req.user!.id, changedFields: ['status', 'issuedAt'] });
    res.json({ charge });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/charges/:id/adjustments', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = adjustmentSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const charge = await prisma.pmsCharge.findFirst({ where: { id, companyId: access.company.id } });
    if (!charge) throw new AppError(404, 'Charge not found.');
    assertPmsPropertyScope(access, charge.propertyId);
    if (charge.status === 'VOID' || charge.status === 'PAID') throw new AppError(409, 'Void or fully paid charges cannot be adjusted.');
    if (charge.status !== 'DRAFT') await assertFinancialPeriodOpen(prisma, { companyId: access.company.id, propertyId: charge.propertyId, currency: charge.currency, transactionDate: new Date() });
    const requestedAmount = money(data.amount);
    const adjustmentAmount = data.type === 'DISCOUNT' || data.type === 'WRITE_OFF'
      ? requestedAmount.abs().negated()
      : requestedAmount;
    const adjustment = await prisma.pmsChargeAdjustment.create({ data: { companyId: access.company.id, chargeId: id, type: data.type, amount: adjustmentAmount, reason: data.reason, createdById: req.user!.id } });
    const updated = await prisma.$transaction((tx) => recomputeCharge(tx, id));
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsChargeAdjustment', entityId: adjustment.id, action: 'PMS_CHARGE_ADJUSTMENT_CREATED', actorId: req.user!.id, afterMetadata: { chargeId: id, type: data.type, requestedAmount: data.amount, postedAmount: adjustmentAmount.toString(), reason: data.reason } });
    res.status(201).json({ adjustment, charge: updated });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/charges/:id/void', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = reverseSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const charge = await prisma.pmsCharge.findFirst({ where: { id, companyId: access.company.id }, include: { allocations: { where: { status: 'ACTIVE' } } } });
    if (!charge) throw new AppError(404, 'Charge not found.');
    assertPmsPropertyScope(access, charge.propertyId);
    if (charge.allocations.length > 0 || charge.paidAmount.isPositive()) throw new AppError(409, 'Reverse active allocations before voiding a charge.');
    if (charge.status === 'VOID') return res.json({ charge });
    await assertFinancialPeriodOpen(prisma, { companyId: access.company.id, propertyId: charge.propertyId, currency: charge.currency, transactionDate: new Date() });
    const updated = await prisma.pmsCharge.update({ where: { id }, data: { status: 'VOID', voidedAt: new Date(), voidedById: req.user!.id, voidReason: data.reason } });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsCharge', entityId: id, action: 'PMS_CHARGE_VOIDED', actorId: req.user!.id, changedFields: ['status', 'voidedAt', 'voidReason'], metadata: { reason: data.reason } });
    res.json({ charge: updated });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/charges/:id/credit-notes', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = creditNoteSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const charge = await prisma.pmsCharge.findFirst({ where: { id, companyId: access.company.id } });
    if (!charge) throw new AppError(404, 'Charge not found.');
    assertPmsPropertyScope(access, charge.propertyId);
    if (charge.status === 'DRAFT' || charge.status === 'VOID') throw new AppError(409, 'Only issued charges can receive credit notes.');
    const amount = assertPositiveMoney(data.amount);
    const sequence = await prisma.pmsCreditNote.count({ where: { companyId: access.company.id } });
    const creditNote = await prisma.pmsCreditNote.create({
      data: {
        companyId: access.company.id,
        propertyId: charge.propertyId,
        unitId: charge.unitId,
        leaseId: charge.leaseId,
        tenantId: charge.tenantId,
        chargeId: charge.id,
        creditNumber: `CRN-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(sequence + 1).padStart(6, '0')}`,
        amount,
        remainingAmount: amount,
        currency: charge.currency,
        reason: data.reason,
        createdById: req.user!.id,
      },
    });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsCreditNote', entityId: creditNote.id, action: 'PMS_CREDIT_NOTE_CREATED', actorId: req.user!.id, afterMetadata: { chargeId: charge.id, amount: amount.toString(), currency: charge.currency, reason: data.reason } });
    res.status(201).json({ creditNote });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/credit-notes/:id/transition', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = creditNoteTransitionSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const current = await prisma.pmsCreditNote.findFirst({ where: { id, companyId: access.company.id }, include: { charge: true } });
    if (!current || !current.charge) throw new AppError(404, 'Credit note or linked charge not found.');
    assertPmsPropertyScope(access, current.propertyId);
    const now = new Date();
    let creditNote;
    if (data.action === 'APPROVE') {
      if (current.status !== 'DRAFT') throw new AppError(409, 'Only draft credit notes can be approved.');
      creditNote = await prisma.pmsCreditNote.update({ where: { id }, data: { status: 'APPROVED', approvedAt: now, approvedById: req.user!.id } });
    } else if (data.action === 'APPLY') {
      if (current.status !== 'APPROVED') throw new AppError(409, 'Only approved credit notes can be applied.');
      await assertFinancialPeriodOpen(prisma, { companyId: access.company.id, propertyId: current.propertyId, currency: current.currency, transactionDate: now });
      creditNote = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "PmsCharge" WHERE id = ${current.chargeId} FOR UPDATE`;
        const charge = await recomputeCharge(tx, current.chargeId!);
        assertSameCurrency(current.currency, charge.currency);
        if (current.amount.greaterThan(charge.balanceAmount)) throw new AppError(409, 'Credit note exceeds the charge outstanding balance.');
        const updated = await tx.pmsCreditNote.update({ where: { id }, data: { status: 'APPLIED', appliedAt: now, remainingAmount: 0 } });
        await recomputeCharge(tx, charge.id);
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } else {
      if (current.status === 'APPLIED') throw new AppError(409, 'Applied credit notes cannot be voided; post a reversing adjustment instead.');
      if (current.status === 'VOID') return res.json({ creditNote: current });
      creditNote = await prisma.pmsCreditNote.update({ where: { id }, data: { status: 'VOID', voidedAt: now } });
    }
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsCreditNote', entityId: id, action: `PMS_CREDIT_NOTE_${data.action}`, actorId: req.user!.id, changedFields: ['status'], metadata: { reason: data.reason, chargeId: current.chargeId } });
    res.json({ creditNote });
  } catch (error) { next(error); }
});

pmsFinanceRouter.get('/payments', requireAuth(), async (req, res, next) => {
  try {
    const query = companyQuery.extend({
      propertyId: z.string().trim().min(1).optional(),
      tenantId: z.string().trim().min(1).optional(),
      status: z.enum(['PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'REFUNDED']).optional(),
      currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
      search: z.string().trim().max(160).optional(),
      paidFrom: z.coerce.date().optional(),
      paidTo: z.coerce.date().optional(),
      sortBy: z.enum(['paidAt', 'createdAt', 'updatedAt', 'amount', 'receiptNumber', 'status']).default('paidAt'),
      direction: z.enum(['asc', 'desc']).default('desc'),
      ...financeListPagination,
    }).parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);
    const where: Prisma.PmsRentPaymentWhereInput = {
      companyId: access.company.id,
      ...propertyScopeWhere(access),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.tenantId ? { tenantId: query.tenantId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...((query.paidFrom || query.paidTo) ? {
        paidAt: {
          ...(query.paidFrom ? { gte: query.paidFrom } : {}),
          ...(query.paidTo ? { lte: query.paidTo } : {}),
        },
      } : {}),
      ...(query.search ? {
        OR: [
          { receiptNumber: { contains: query.search, mode: 'insensitive' } },
          { referenceNumber: { contains: query.search, mode: 'insensitive' } },
          { notes: { contains: query.search, mode: 'insensitive' } },
          { property: { name: { contains: query.search, mode: 'insensitive' } } },
          { unit: { unitNumber: { contains: query.search, mode: 'insensitive' } } },
          { tenant: { fullName: { contains: query.search, mode: 'insensitive' } } },
        ],
      } : {}),
    };
    const [payments, total, totalsByCurrency] = await prisma.$transaction([
      prisma.pmsRentPayment.findMany({
        where,
        include: paymentListInclude,
        orderBy: paymentOrderBy(query.sortBy, query.direction),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsRentPayment.count({ where }),
      prisma.pmsRentPayment.groupBy({
        by: ['currency'],
        where,
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { currency: 'asc' },
      }),
    ]);
    res.json({
      payments: payments.map(paymentListResponse),
      pagination: { take: query.take, skip: query.skip, count: payments.length, total },
      totalsByCurrency: totalsByCurrency.map((item) => ({
        currency: item.currency,
        count: item._count._all,
        recordedAmount: item._sum.amount?.toString() ?? '0',
      })),
    });
  } catch (error) { next(error); }
});

pmsFinanceRouter.get('/payments/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = companyQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    const payment = await prisma.pmsRentPayment.findFirst({
      where: { id, companyId: access.company.id },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
        tenant: { select: { id: true, fullName: true } },
        lease: { select: { id: true, title: true, currency: true } },
        recordedBy: { select: { id: true, name: true, email: true } },
        allocations: {
          include: {
            charge: { select: { id: true, chargeNumber: true, status: true, dueDate: true, totalAmount: true, balanceAmount: true } },
            createdBy: { select: { id: true, name: true } },
            reversedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        adjustments: {
          include: { createdBy: { select: { id: true, name: true } }, reversedBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        securityDepositTransactions: {
          include: { account: { select: { id: true, status: true } } },
          orderBy: { createdAt: 'asc' },
        },
        reconciliationItems: {
          select: { id: true, status: true, source: true, externalReference: true, transactionDate: true, matchedAt: true },
          orderBy: { transactionDate: 'asc' },
        },
      },
    });
    if (!payment) throw new AppError(404, 'Payment not found.');
    assertPmsPropertyScope(access, payment.propertyId);
    const availability = await getPaymentAvailability(prisma, payment.id);
    res.json({ payment, balance: paymentBalanceResponse(availability) });
  } catch (error) { next(error); }
});


pmsFinanceRouter.post('/payments', requireAuth(), async (req, res, next) => {
  try {
    const data = createPaymentSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanCollectPmsRent(access.member);
    const links = await assertPmsScopeLinks({ access, propertyId: data.propertyId, unitId: data.unitId, leaseId: data.leaseId, tenantId: data.tenantId });
    if (!links.lease) throw new AppError(400, 'Lease is required.');
    assertSameCurrency(data.currency, links.lease.currency);
    const providerReference = `manual:${access.company.id}:${data.idempotencyKey}`;
    const existing = await prisma.pmsRentPayment.findUnique({ where: { providerReference } });
    if (existing) return res.json({ payment: existing, idempotent: true });
    await assertFinancialPeriodOpen(prisma, { companyId: access.company.id, propertyId: data.propertyId, currency: data.currency, transactionDate: data.paidAt });
    const payment = await prisma.pmsRentPayment.create({
      data: {
        companyId: access.company.id,
        propertyId: data.propertyId,
        unitId: data.unitId,
        leaseId: data.leaseId,
        tenantId: data.tenantId,
        rentDueItemId: null,
        amount: assertPositiveMoney(data.amount),
        currency: data.currency,
        method: data.method,
        status: 'CONFIRMED',
        paidAt: data.paidAt,
        confirmedAt: new Date(),
        receiptNumber: createPmsRentReceiptNumber(),
        provider: 'MANUAL_PMS',
        providerReference,
        referenceNumber: data.referenceNumber ?? null,
        notes: data.notes ?? null,
        recordedById: req.user!.id,
      },
    });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsRentPayment', entityId: payment.id, action: 'PMS_UNALLOCATED_PAYMENT_RECORDED', actorId: req.user!.id, afterMetadata: { amount: payment.amount.toString(), currency: payment.currency, propertyId: payment.propertyId } });
    res.status(201).json({ payment, idempotent: false });
  } catch (error) { next(error); }
});

pmsFinanceRouter.get('/payments/:id/receipt', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = companyQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    const payment = await prisma.pmsRentPayment.findFirst({
      where: { id, companyId: access.company.id },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
        tenant: { select: { id: true, fullName: true } },
        allocations: {
          where: { status: 'ACTIVE' },
          include: { charge: { select: { id: true, chargeNumber: true, dueDate: true, totalAmount: true, balanceAmount: true } } },
          orderBy: { createdAt: 'asc' },
        },
        adjustments: { where: { status: 'POSTED' }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!payment) throw new AppError(404, 'Payment receipt not found.');
    assertPmsPropertyScope(access, payment.propertyId);
    const availability = await getPaymentAvailability(prisma, payment.id);
    const allocatedAmount = availability.allocated;
    res.json({
      receipt: {
        receiptNumber: payment.receiptNumber,
        receivedAt: payment.paidAt ?? payment.confirmedAt ?? payment.createdAt,
        payment: {
          id: payment.id,
          amount: payment.amount.toString(),
          currency: payment.currency,
          method: payment.method,
          status: payment.status,
          referenceNumber: payment.referenceNumber,
        },
        property: payment.property,
        unit: payment.unit,
        tenant: payment.tenant,
        allocations: payment.allocations.map((allocation) => ({ ...allocation, amount: allocation.amount.toString(), charge: { ...allocation.charge, totalAmount: allocation.charge.totalAmount.toString(), balanceAmount: allocation.charge.balanceAmount.toString() } })),
        adjustments: payment.adjustments.map((adjustment) => ({ ...adjustment, amount: adjustment.amount.toString() })),
        allocatedAmount: allocatedAmount.toString(),
        adjustedAmount: availability.paymentReductions.toString(),
        depositAllocatedAmount: availability.depositAllocated.toString(),
        unallocatedAmount: availability.available.toString(),
      },
    });
  } catch (error) { next(error); }
});

pmsFinanceRouter.get('/payments/:id/balance', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = companyQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    const availability = await getPaymentAvailability(prisma, id);
    if (availability.payment.companyId !== access.company.id) throw new AppError(404, 'Payment not found.');
    assertPmsPropertyScope(access, availability.payment.propertyId);
    res.json({ balance: paymentBalanceResponse(availability) });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/payments/:id/allocations/batch', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = allocationBatchSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const [payment, charges] = await Promise.all([
      prisma.pmsRentPayment.findFirst({ where: { id, companyId: access.company.id }, select: { propertyId: true } }),
      prisma.pmsCharge.findMany({
        where: { id: { in: data.allocations.map((allocation) => allocation.chargeId) }, companyId: access.company.id },
        select: { id: true, propertyId: true },
      }),
    ]);
    if (!payment || charges.length !== new Set(data.allocations.map((allocation) => allocation.chargeId)).size) {
      throw new AppError(404, 'Payment or charge not found.');
    }
    assertPmsPropertyScope(access, payment.propertyId);
    charges.forEach((charge) => assertPmsPropertyScope(access, charge.propertyId));
    const result = await allocatePaymentBatch({
      companyId: access.company.id,
      paymentId: id,
      allocations: data.allocations,
      idempotencyKey: data.idempotencyKey,
      actorId: req.user!.id,
    });
    for (const allocation of result.allocations) {
      await audit(req, {
        companyId: access.company.id,
        domain: DomainAuditDomain.PMS,
        entityType: 'PmsPaymentAllocation',
        entityId: allocation.id,
        action: result.idempotent ? 'PMS_PAYMENT_ALLOCATION_IDEMPOTENT_REPLAY' : 'PMS_PAYMENT_ALLOCATED',
        actorId: req.user!.id,
        afterMetadata: { paymentId: id, chargeId: allocation.chargeId, amount: allocation.amount.toString(), batch: true },
      });
    }
    res.status(result.idempotent ? 200 : 201).json(result);
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/payments/:id/allocations', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = allocationSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const [payment, charge] = await Promise.all([
      prisma.pmsRentPayment.findFirst({ where: { id, companyId: access.company.id }, select: { propertyId: true } }),
      prisma.pmsCharge.findFirst({ where: { id: data.chargeId, companyId: access.company.id }, select: { propertyId: true } }),
    ]);
    if (!payment || !charge) throw new AppError(404, 'Payment or charge not found.');
    assertPmsPropertyScope(access, payment.propertyId);
    assertPmsPropertyScope(access, charge.propertyId);
    const result = await allocatePayment({ companyId: access.company.id, paymentId: id, chargeId: data.chargeId, amount: data.amount, idempotencyKey: data.idempotencyKey, actorId: req.user!.id });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsPaymentAllocation', entityId: result.allocation.id, action: result.idempotent ? 'PMS_PAYMENT_ALLOCATION_IDEMPOTENT_REPLAY' : 'PMS_PAYMENT_ALLOCATED', actorId: req.user!.id, afterMetadata: { paymentId: id, chargeId: data.chargeId, amount: data.amount } });
    res.status(result.idempotent ? 200 : 201).json(result);
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/payments/:id/allocations/:allocationId/reverse', requireAuth(), async (req, res, next) => {
  try {
    const params = allocationParams.parse(req.params);
    const data = reverseSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const allocation = await prisma.pmsPaymentAllocation.findFirst({ where: { id: params.allocationId, paymentId: params.id, companyId: access.company.id }, include: { charge: { select: { propertyId: true } } } });
    if (!allocation) throw new AppError(404, 'Allocation not found.');
    assertPmsPropertyScope(access, allocation.charge.propertyId);
    const updated = await reverseAllocation({ companyId: access.company.id, allocationId: params.allocationId, reason: data.reason, actorId: req.user!.id });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsPaymentAllocation', entityId: updated.id, action: 'PMS_PAYMENT_ALLOCATION_REVERSED', actorId: req.user!.id, metadata: { reason: data.reason } });
    res.json({ allocation: updated });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/payments/:id/adjustments', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = paymentAdjustmentSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const payment = await prisma.pmsRentPayment.findFirst({ where: { id, companyId: access.company.id }, select: { propertyId: true } });
    if (!payment) throw new AppError(404, 'Payment not found.');
    assertPmsPropertyScope(access, payment.propertyId);
    const result = await postPaymentAdjustment({ companyId: access.company.id, paymentId: id, allocationId: data.allocationId, type: data.type, amount: data.amount, reason: data.reason, idempotencyKey: data.idempotencyKey, referenceNumber: data.referenceNumber, actorId: req.user!.id });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsPaymentAdjustment', entityId: result.adjustment.id, action: result.idempotent ? 'PMS_PAYMENT_ADJUSTMENT_IDEMPOTENT_REPLAY' : `PMS_PAYMENT_${data.type}`, actorId: req.user!.id, afterMetadata: { paymentId: id, amount: data.amount, reason: data.reason } });
    res.status(result.idempotent ? 200 : 201).json(result);
  } catch (error) { next(error); }
});

pmsFinanceRouter.get('/deposits', requireAuth(), async (req, res, next) => {
  try {
    const query = companyQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    const accounts = await prisma.pmsSecurityDepositAccount.findMany({
      where: { companyId: access.company.id, ...propertyScopeWhere(access) },
      include: { property: { select: { id: true, name: true } }, unit: { select: { id: true, unitNumber: true } }, tenant: { select: { id: true, fullName: true } }, transactions: { orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ accounts });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/deposits', requireAuth(), async (req, res, next) => {
  try {
    const data = createDepositSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const lease = await prisma.pmsLease.findFirst({ where: { id: data.leaseId, companyId: access.company.id }, select: { id: true, propertyId: true, unitId: true, tenantId: true, currency: true } });
    if (!lease) throw new AppError(404, 'Lease not found.');
    assertPmsPropertyScope(access, lease.propertyId);
    const account = await prisma.pmsSecurityDepositAccount.upsert({
      where: { leaseId: lease.id },
      update: { expectedAmount: money(data.expectedAmount) },
      create: { companyId: access.company.id, propertyId: lease.propertyId, unitId: lease.unitId, leaseId: lease.id, tenantId: lease.tenantId, currency: lease.currency, expectedAmount: money(data.expectedAmount) },
    });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsSecurityDepositAccount', entityId: account.id, action: 'PMS_SECURITY_DEPOSIT_ACCOUNT_UPSERTED', actorId: req.user!.id, afterMetadata: { leaseId: lease.id, expectedAmount: data.expectedAmount, currency: lease.currency } });
    res.status(201).json({ account });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/deposits/:id/transactions', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = depositTransactionSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const account = await prisma.pmsSecurityDepositAccount.findFirst({ where: { id, companyId: access.company.id }, select: { propertyId: true } });
    if (!account) throw new AppError(404, 'Security deposit account not found.');
    assertPmsPropertyScope(access, account.propertyId);
    const result = await postDepositTransaction({ companyId: access.company.id, accountId: id, type: data.type, amount: data.amount, reason: data.reason, idempotencyKey: data.idempotencyKey, paymentId: data.paymentId, chargeId: data.chargeId, actorId: req.user!.id });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsSecurityDepositTransaction', entityId: result.transaction.id, action: result.idempotent ? 'PMS_DEPOSIT_TRANSACTION_IDEMPOTENT_REPLAY' : `PMS_DEPOSIT_${data.type}`, actorId: req.user!.id, afterMetadata: { accountId: id, amount: data.amount, reason: data.reason } });
    res.status(result.idempotent ? 200 : 201).json(result);
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/deposits/:id/transactions/:transactionId/transition', requireAuth(), async (req, res, next) => {
  try {
    const params = depositTransactionParams.parse(req.params);
    const data = depositTransitionSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const account = await prisma.pmsSecurityDepositAccount.findFirst({ where: { id: params.id, companyId: access.company.id }, select: { propertyId: true } });
    if (!account) throw new AppError(404, 'Security deposit account not found.');
    assertPmsPropertyScope(access, account.propertyId);
    const transaction = await transitionDepositTransaction({ companyId: access.company.id, accountId: params.id, transactionId: params.transactionId, action: data.action, reason: data.reason, actorId: req.user!.id });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsSecurityDepositTransaction', entityId: transaction.id, action: `PMS_DEPOSIT_TRANSACTION_${data.action}`, actorId: req.user!.id, changedFields: ['status'], metadata: { accountId: params.id, reason: data.reason } });
    res.json({ transaction });
  } catch (error) { next(error); }
});

pmsFinanceRouter.get('/periods', requireAuth(), async (req, res, next) => {
  try {
    const query = companyQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    const periods = await prisma.pmsFinancialPeriod.findMany({ where: { companyId: access.company.id, OR: [{ propertyId: null }, ...(access.member.propertyScope.allProperties ? [] : [{ propertyId: { in: access.member.propertyScope.propertyIds } }])] }, include: { property: { select: { id: true, name: true } }, events: { orderBy: { createdAt: 'desc' }, take: 20 } }, orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }] });
    res.json({ periods });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/periods', requireAuth(), async (req, res, next) => {
  try {
    const data = periodSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    if (data.periodEnd < data.periodStart) throw new AppError(400, 'Period end must not be before its start.');
    if (data.propertyId) assertPmsPropertyScope(access, data.propertyId);
    const overlap = await prisma.pmsFinancialPeriod.findFirst({ where: { companyId: access.company.id, currency: data.currency, propertyId: data.propertyId ?? null, periodStart: { lte: data.periodEnd }, periodEnd: { gte: data.periodStart } } });
    if (overlap) throw new AppError(409, 'A financial period already overlaps this range.');
    const period = await prisma.pmsFinancialPeriod.create({ data: { companyId: access.company.id, propertyId: data.propertyId ?? null, currency: data.currency, periodStart: data.periodStart, periodEnd: data.periodEnd, createdById: req.user!.id, updatedById: req.user!.id, events: { create: { companyId: access.company.id, toStatus: 'OPEN', reason: 'Period created', createdById: req.user!.id } } }, include: { events: true } });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsFinancialPeriod', entityId: period.id, action: 'PMS_FINANCIAL_PERIOD_CREATED', actorId: req.user!.id, afterMetadata: { propertyId: period.propertyId, currency: period.currency, periodStart: period.periodStart, periodEnd: period.periodEnd } });
    res.status(201).json({ period });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/periods/:id/transition', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = periodTransitionSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const current = await prisma.pmsFinancialPeriod.findFirst({ where: { id, companyId: access.company.id } });
    if (!current) throw new AppError(404, 'Financial period not found.');
    if (current.propertyId) assertPmsPropertyScope(access, current.propertyId);
    const nextStatus = data.action === 'REVIEW' ? 'REVIEWING' : data.action === 'CLOSE' ? 'CLOSED' : 'OPEN';
    const allowed = (current.status === 'OPEN' && nextStatus === 'REVIEWING') || (current.status === 'REVIEWING' && nextStatus === 'CLOSED') || (current.status === 'CLOSED' && nextStatus === 'OPEN');
    if (!allowed) throw new AppError(409, `Cannot move financial period from ${current.status} to ${nextStatus}.`);
    const now = new Date();
    const period = await prisma.$transaction(async (tx) => {
      const updated = await tx.pmsFinancialPeriod.update({ where: { id }, data: { status: nextStatus, updatedById: req.user!.id, ...(nextStatus === 'CLOSED' ? { closedAt: now, closeReason: data.reason } : {}), ...(data.action === 'REOPEN' ? { reopenedAt: now, reopenReason: data.reason } : {}) } });
      await tx.pmsFinancialPeriodEvent.create({ data: { companyId: access.company.id, periodId: id, fromStatus: current.status, toStatus: nextStatus, reason: data.reason, createdById: req.user!.id } });
      return updated;
    });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsFinancialPeriod', entityId: id, action: `PMS_FINANCIAL_PERIOD_${data.action}`, actorId: req.user!.id, changedFields: ['status'], metadata: { reason: data.reason, fromStatus: current.status, toStatus: nextStatus } });
    res.json({ period });
  } catch (error) { next(error); }
});

pmsFinanceRouter.get('/reconciliation', requireAuth(), async (req, res, next) => {
  try {
    const query = companyQuery.extend({ status: z.enum(['UNMATCHED', 'MATCHED', 'DUPLICATE', 'IGNORED']).optional() }).parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    const items = await prisma.pmsReconciliationItem.findMany({ where: { companyId: access.company.id, ...(query.status ? { status: query.status } : {}), OR: [{ propertyId: null }, ...(access.member.propertyScope.allProperties ? [] : [{ propertyId: { in: access.member.propertyScope.propertyIds } }])] }, include: { payment: { select: { id: true, amount: true, currency: true, receiptNumber: true } }, duplicateOf: { select: { id: true, externalReference: true } } }, orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }] });
    res.json({ items });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/reconciliation', requireAuth(), async (req, res, next) => {
  try {
    const data = reconciliationSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    if (data.propertyId) assertPmsPropertyScope(access, data.propertyId);
    const duplicate = await prisma.pmsReconciliationItem.findFirst({ where: { companyId: access.company.id, currency: data.currency, amount: money(data.amount), transactionDate: data.transactionDate, payerReference: data.payerReference ?? null }, orderBy: { createdAt: 'asc' } });
    const item = await prisma.pmsReconciliationItem.create({ data: { companyId: access.company.id, propertyId: data.propertyId ?? null, source: data.source, externalReference: data.externalReference, amount: money(data.amount), currency: data.currency, transactionDate: data.transactionDate, payerReference: data.payerReference ?? null, metadata: data.metadata as Prisma.InputJsonValue | undefined, status: duplicate ? 'DUPLICATE' : 'UNMATCHED', duplicateOfId: duplicate?.id ?? null, createdById: req.user!.id } });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsReconciliationItem', entityId: item.id, action: duplicate ? 'PMS_RECONCILIATION_DUPLICATE_DETECTED' : 'PMS_RECONCILIATION_ITEM_IMPORTED', actorId: req.user!.id, afterMetadata: { source: item.source, externalReference: item.externalReference, amount: item.amount.toString(), currency: item.currency, duplicateOfId: item.duplicateOfId } });
    res.status(201).json({ item });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/reconciliation/:id/match', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = reconciliationMatchSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const [item, payment] = await Promise.all([
      prisma.pmsReconciliationItem.findFirst({ where: { id, companyId: access.company.id } }),
      prisma.pmsRentPayment.findFirst({ where: { id: data.paymentId, companyId: access.company.id } }),
    ]);
    if (!item || !payment) throw new AppError(404, 'Reconciliation item or payment not found.');
    const existingMatch = await prisma.pmsReconciliationItem.findFirst({
      where: { companyId: access.company.id, paymentId: payment.id, status: 'MATCHED', id: { not: item.id } },
      select: { id: true, externalReference: true },
    });
    if (existingMatch) throw new AppError(409, `Payment is already matched to reconciliation item ${existingMatch.externalReference}.`);
    if (item.status === 'MATCHED' && item.paymentId === payment.id) return res.json({ item });
    if (item.status === 'DUPLICATE' || item.status === 'IGNORED') throw new AppError(409, `Cannot match a reconciliation item in ${item.status} status.`);
    if (item.propertyId) assertPmsPropertyScope(access, item.propertyId);
    assertPmsPropertyScope(access, payment.propertyId);
    assertSameCurrency(item.currency, payment.currency);
    if (!item.amount.equals(payment.amount)) throw new AppError(409, 'Reconciliation amount must equal the payment amount.');
    const updated = await prisma.pmsReconciliationItem.update({ where: { id }, data: { status: 'MATCHED', paymentId: payment.id, matchedAt: new Date(), matchedById: req.user!.id, matchReason: data.reason } });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsReconciliationItem', entityId: id, action: 'PMS_RECONCILIATION_MATCHED', actorId: req.user!.id, afterMetadata: { paymentId: payment.id, reason: data.reason } });
    res.json({ item: updated });
  } catch (error) { next(error); }
});

pmsFinanceRouter.get('/owner-payouts', requireAuth(), async (req, res, next) => {
  try {
    const query = companyQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    const batches = await prisma.pmsOwnerPayoutBatch.findMany({ where: { companyId: access.company.id, ...(access.member.propertyScope.allProperties ? {} : { lines: { some: { propertyId: { in: access.member.propertyScope.propertyIds } } } }) }, include: { ownerUser: { select: { id: true, name: true, email: true } }, lines: { include: { property: { select: { id: true, name: true } }, statement: { select: { id: true, revision: true, status: true } } } } }, orderBy: { createdAt: 'desc' } });
    res.json({ batches });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/owner-payouts', requireAuth(), async (req, res, next) => {
  try {
    const data = payoutSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    for (const line of data.lines) assertPmsPropertyScope(access, line.propertyId);
    const propertyIds = [...new Set(data.lines.map((line) => line.propertyId))];
    const ownerAccessCount = await prisma.pmsOwnerPortalAccess.count({ where: { companyId: access.company.id, userId: data.ownerUserId, active: true, propertyId: { in: propertyIds } } });
    if (ownerAccessCount !== propertyIds.length) throw new AppError(400, 'Payout owner must have active portal access to every payout property.');
    if (data.periodEnd < data.periodStart) throw new AppError(400, 'Payout period end must not be before its start.');
    const statementIds = [...new Set(data.lines.flatMap((line) => line.statementId ? [line.statementId] : []))];
    if (statementIds.length > 0) {
      const statements = await prisma.pmsOwnerStatement.findMany({
        where: { id: { in: statementIds }, companyId: access.company.id, status: 'PUBLISHED' },
        select: { id: true, propertyId: true, currency: true, periodStart: true, periodEnd: true },
      });
      const statementsById = new Map(statements.map((statement) => [statement.id, statement]));
      for (const line of data.lines) {
        if (!line.statementId) continue;
        const statement = statementsById.get(line.statementId);
        if (!statement) throw new AppError(400, 'Every linked payout statement must be published and belong to this company.');
        if (statement.propertyId !== line.propertyId || statement.currency !== data.currency) {
          throw new AppError(400, 'Payout statement property or currency does not match its payout line.');
        }
        if (statement.periodStart.getTime() !== data.periodStart.getTime() || statement.periodEnd.getTime() !== data.periodEnd.getTime()) {
          throw new AppError(400, 'Payout statement period must match the payout batch period.');
        }
      }
      const existingPayout = await prisma.pmsOwnerPayoutLine.findFirst({
        where: { statementId: { in: statementIds }, payoutBatch: { status: { notIn: ['FAILED', 'CANCELLED'] } } },
        select: { statementId: true, payoutBatch: { select: { payoutNumber: true } } },
      });
      if (existingPayout) throw new AppError(409, `Published statement is already linked to payout ${existingPayout.payoutBatch.payoutNumber}.`);
    }
    if (statementIds.length !== data.lines.length && !data.notes) {
      throw new AppError(400, 'Manual payout lines without a published statement require an explanatory note.');
    }
    const lineAmounts = data.lines.map((line) => ({ ...line, net: money(line.incomeAmount).minus(line.expenseAmount).minus(line.managementFeeAmount).minus(line.reservedAmount) }));
    if (lineAmounts.some((line) => line.net.isNegative())) throw new AppError(400, 'A payout line cannot have a negative net amount.');
    const gross = lineAmounts.reduce((sum, line) => sum.plus(line.incomeAmount), new Prisma.Decimal(0));
    const fees = lineAmounts.reduce((sum, line) => sum.plus(line.managementFeeAmount), money(data.managementFeeAmount));
    const reserves = lineAmounts.reduce((sum, line) => sum.plus(line.reservedAmount), money(data.reservedAmount));
    const expenses = lineAmounts.reduce((sum, line) => sum.plus(line.expenseAmount), new Prisma.Decimal(0));
    const payout = gross.minus(expenses).minus(fees).minus(reserves);
    if (payout.isNegative()) throw new AppError(400, 'Payout amount cannot be negative.');
    const sequence = await prisma.pmsOwnerPayoutBatch.count({ where: { companyId: access.company.id } });
    const batch = await prisma.pmsOwnerPayoutBatch.create({ data: { companyId: access.company.id, ownerUserId: data.ownerUserId, payoutNumber: `PAY-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(sequence + 1).padStart(6, '0')}`, currency: data.currency, periodStart: data.periodStart, periodEnd: data.periodEnd, grossAmount: gross, managementFeeAmount: fees, reservedAmount: reserves, payoutAmount: payout, notes: data.notes ?? null, createdById: req.user!.id, lines: { create: lineAmounts.map((line) => ({ companyId: access.company.id, propertyId: line.propertyId, statementId: line.statementId ?? null, incomeAmount: money(line.incomeAmount), expenseAmount: money(line.expenseAmount), managementFeeAmount: money(line.managementFeeAmount), reservedAmount: money(line.reservedAmount), netAmount: line.net, currency: data.currency })) } }, include: { lines: true } });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsOwnerPayoutBatch', entityId: batch.id, action: 'PMS_OWNER_PAYOUT_DRAFT_CREATED', actorId: req.user!.id, afterMetadata: { payoutNumber: batch.payoutNumber, payoutAmount: batch.payoutAmount.toString(), currency: batch.currency, ownerUserId: batch.ownerUserId } });
    res.status(201).json({ batch });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/owner-payouts/:id/transition', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = payoutTransitionSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const current = await prisma.pmsOwnerPayoutBatch.findFirst({ where: { id, companyId: access.company.id }, include: { lines: true } });
    if (!current) throw new AppError(404, 'Owner payout batch not found.');
    current.lines.forEach((line) => assertPmsPropertyScope(access, line.propertyId));
    const transitions: Record<typeof data.action, { from: string[]; to: 'APPROVED' | 'PROCESSING' | 'PAID_MANUAL' | 'FAILED' | 'CANCELLED' }> = {
      APPROVE: { from: ['DRAFT'], to: 'APPROVED' },
      START_PROCESSING: { from: ['APPROVED'], to: 'PROCESSING' },
      MARK_PAID_MANUAL: { from: ['APPROVED', 'PROCESSING'], to: 'PAID_MANUAL' },
      FAIL: { from: ['APPROVED', 'PROCESSING'], to: 'FAILED' },
      CANCEL: { from: ['DRAFT', 'APPROVED'], to: 'CANCELLED' },
    };
    const transition = transitions[data.action];
    if (!transition.from.includes(current.status)) throw new AppError(409, `Cannot ${data.action.toLowerCase()} payout from ${current.status}.`);
    if (data.action === 'MARK_PAID_MANUAL' && (!data.payoutReference || !data.paymentMethodNote)) throw new AppError(400, 'Manual payout completion requires a payout reference and payment-method evidence note.');
    const now = new Date();
    const batch = await prisma.pmsOwnerPayoutBatch.update({ where: { id }, data: { status: transition.to, ...(data.action === 'APPROVE' ? { approvedAt: now, approvedById: req.user!.id } : {}), ...(data.action === 'START_PROCESSING' ? { processingAt: now } : {}), ...(data.action === 'MARK_PAID_MANUAL' ? { paidAt: now, paidById: req.user!.id, payoutReference: data.payoutReference, paymentMethodNote: data.paymentMethodNote } : {}), ...(data.action === 'FAIL' ? { failureReason: data.reason ?? 'Manual payout processing failed.' } : {}), ...(data.action === 'CANCEL' ? { cancelledAt: now, cancelledById: req.user!.id, failureReason: data.reason ?? null } : {}) } });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsOwnerPayoutBatch', entityId: id, action: `PMS_OWNER_PAYOUT_${data.action}`, actorId: req.user!.id, changedFields: ['status'], metadata: { fromStatus: current.status, toStatus: transition.to, reason: data.reason, payoutReference: data.payoutReference } });
    res.json({ batch });
  } catch (error) { next(error); }
});
