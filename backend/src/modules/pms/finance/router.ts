import { DomainAuditDomain, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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
  assertCanViewPmsReports,
} from '../access';
import { AppError } from '../../../utils/http';
import {
  assertPmsPropertyScope,
  assertPmsScopeLinks,
  propertyScopeWhere,
  requirePmsRouteAccess,
} from '../shared/routeAccess';
import { assertFinancialPeriodOpen } from './periods';
import {
  buildFinancialPeriodCloseSnapshot,
  getFinancialPeriodReadiness,
} from './periodClose';
import { buildTreasuryImportPreview } from './treasuryImports';
import {
  buildFinancialPeriodCloseReport,
  financialPeriodCloseReportCsv,
  financialPeriodCloseReportFilename,
} from './periodReports';
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
const depositListQuery = companyQuery.extend({
  ...financeListPagination,
  search: z.string().trim().max(200).optional(),
  status: z.enum(['EXPECTED', 'HELD', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CLOSED']).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  propertyId: z.string().trim().min(1).optional(),
  sortBy: z.enum(['updatedAt', 'createdAt', 'expectedAmount', 'liabilityBalance', 'status']).default('updatedAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});
const closeReportListQuery = companyQuery.extend({
  ...financeListPagination,
  propertyId: z.string().trim().min(1).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  closeStatus: z.enum(['ACTIVE', 'REOPENED']).optional(),
  closedFrom: z.coerce.date().optional(),
  closedTo: z.coerce.date().optional(),
  sortBy: z.enum(['closedAt', 'revision', 'periodStart']).default('closedAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});
const closeReportExportQuery = companyQuery.extend({
  format: z.enum(['csv', 'json']).default('csv'),
});
const periodListQuery = companyQuery.extend({
  ...financeListPagination,
  status: z.enum(['OPEN', 'REVIEWING', 'CLOSED']).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  propertyId: z.string().trim().min(1).optional(),
  sortBy: z.enum(['periodStart', 'periodEnd', 'createdAt', 'status']).default('periodStart'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});
const reconciliationListQuery = companyQuery.extend({
  ...financeListPagination,
  search: z.string().trim().max(200).optional(),
  status: z.enum(['UNMATCHED', 'MATCHED', 'DUPLICATE', 'IGNORED']).optional(),
  source: z.enum(['BANK', 'PAYMENT_PROVIDER', 'CASHBOOK', 'MANUAL']).optional(),
  reconciliationDirection: z.enum(['CREDIT', 'DEBIT']).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  propertyId: z.string().trim().min(1).optional(),
  transactionFrom: z.coerce.date().optional(),
  transactionTo: z.coerce.date().optional(),
  sortBy: z.enum(['transactionDate', 'createdAt', 'amount', 'status', 'externalReference']).default('transactionDate'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});
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
  direction: z.enum(['CREDIT', 'DEBIT']).default('CREDIT'),
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
  paymentId: z.string().trim().min(1).optional(),
  targetType: z.enum(['RENT_PAYMENT', 'VENDOR_INVOICE', 'OWNER_PAYOUT']).optional(),
  targetId: z.string().trim().min(1).optional(),
  reason: z.string().trim().min(3).max(1000),
}).superRefine((data, ctx) => {
  const usesLegacyPayment = Boolean(data.paymentId);
  const usesAnyTypedTarget = Boolean(data.targetType || data.targetId);
  const usesCompleteTypedTarget = Boolean(data.targetType && data.targetId);
  const validLegacyPayload = usesLegacyPayment && !usesAnyTypedTarget;
  const validTypedPayload = !usesLegacyPayment && usesCompleteTypedTarget;
  if (!validLegacyPayload && !validTypedPayload) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide either paymentId or targetType with targetId.' });
  }
});
const reconciliationTransitionSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  action: z.enum(['IGNORE', 'RESTORE_UNMATCHED']),
  reason: z.string().trim().min(3).max(1000),
});
const treasuryImportSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  source: z.enum(['BANK', 'PAYMENT_PROVIDER', 'CASHBOOK']),
  accountReference: z.string().trim().max(200).nullable().optional(),
  filename: z.string().trim().max(255).nullable().optional(),
  csvText: z.string().min(1).max(2 * 1024 * 1024),
});
const treasuryImportBatchListQuery = companyQuery.extend({
  ...financeListPagination,
  status: z.enum(['COMMITTED', 'PARTIAL', 'FAILED']).optional(),
  source: z.enum(['BANK', 'PAYMENT_PROVIDER', 'CASHBOOK']).optional(),
});
const payoutListQuery = companyQuery.extend({
  ...financeListPagination,
  search: z.string().trim().max(200).optional(),
  status: z.enum(['DRAFT', 'APPROVED', 'PROCESSING', 'PAID_MANUAL', 'FAILED', 'CANCELLED']).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  propertyId: z.string().trim().min(1).optional(),
  ownerUserId: z.string().trim().min(1).optional(),
  sortBy: z.enum(['createdAt', 'periodEnd', 'payoutAmount', 'status', 'payoutNumber']).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
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
    statementId: z.string().trim().min(1),
    propertyId: z.string().trim().min(1).optional(),
    incomeAmount: z.coerce.number().nonnegative().optional(),
    expenseAmount: z.coerce.number().nonnegative().optional(),
    managementFeeAmount: z.coerce.number().nonnegative().default(0),
    reservedAmount: z.coerce.number().nonnegative().default(0),
  })).min(1).max(500),
});
const payoutTransitionSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  action: z.enum(['APPROVE', 'SUBMIT', 'RECORD_PAID', 'RECORD_FAILED', 'RETRY', 'CANCEL', 'START_PROCESSING', 'MARK_PAID_MANUAL', 'FAIL']),
  reason: z.string().trim().min(3).max(1000).optional(),
  payoutReference: z.string().trim().max(300).optional(),
  paymentMethodNote: z.string().trim().max(500).optional(),
  evidenceDocumentId: z.string().trim().min(1).optional(),
  adapter: z.enum(['MANUAL_BANK_EVIDENCE']).default('MANUAL_BANK_EVIDENCE'),
  providerConfirmed: z.boolean().optional(),
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

const depositListInclude = {
  property: { select: { id: true, name: true } },
  unit: { select: { id: true, unitNumber: true } },
  lease: { select: { id: true, title: true, status: true } },
  tenant: { select: { id: true, fullName: true } },
  transactions: {
    orderBy: { createdAt: 'desc' as const },
    take: 5,
    select: { id: true, type: true, status: true, amount: true, currency: true, reason: true, createdAt: true },
  },
  _count: { select: { transactions: true } },
} satisfies Prisma.PmsSecurityDepositAccountInclude;

function depositOrderBy(sortBy: z.infer<typeof depositListQuery>['sortBy'], direction: SortDirection): Prisma.PmsSecurityDepositAccountOrderByWithRelationInput[] {
  if (sortBy === 'createdAt') return [{ createdAt: direction }, { id: 'desc' }];
  if (sortBy === 'expectedAmount') return [{ expectedAmount: direction }, { id: 'desc' }];
  if (sortBy === 'liabilityBalance') return [{ liabilityBalance: direction }, { id: 'desc' }];
  if (sortBy === 'status') return [{ status: direction }, { id: 'desc' }];
  return [{ updatedAt: direction }, { id: 'desc' }];
}

function periodOrderBy(sortBy: z.infer<typeof periodListQuery>['sortBy'], direction: SortDirection): Prisma.PmsFinancialPeriodOrderByWithRelationInput[] {
  if (sortBy === 'periodEnd') return [{ periodEnd: direction }, { id: 'desc' }];
  if (sortBy === 'createdAt') return [{ createdAt: direction }, { id: 'desc' }];
  if (sortBy === 'status') return [{ status: direction }, { id: 'desc' }];
  return [{ periodStart: direction }, { id: 'desc' }];
}

function reconciliationOrderBy(sortBy: z.infer<typeof reconciliationListQuery>['sortBy'], direction: SortDirection): Prisma.PmsReconciliationItemOrderByWithRelationInput[] {
  if (sortBy === 'createdAt') return [{ createdAt: direction }, { id: 'desc' }];
  if (sortBy === 'amount') return [{ amount: direction }, { id: 'desc' }];
  if (sortBy === 'status') return [{ status: direction }, { id: 'desc' }];
  if (sortBy === 'externalReference') return [{ externalReference: direction }, { id: 'desc' }];
  return [{ transactionDate: direction }, { id: 'desc' }];
}

const financialPeriodCloseSelect = {
  id: true,
  revision: true,
  snapshotHash: true,
  snapshotVersion: true,
  reviewEventId: true,
  reviewReason: true,
  closeReason: true,
  reviewedAt: true,
  closedAt: true,
  reopenedAt: true,
  reopenReason: true,
  reviewedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  reopenedBy: { select: { id: true, name: true } },
} satisfies Prisma.PmsFinancialPeriodCloseSelect;


const financialPeriodCloseReportSelect = {
  id: true,
  revision: true,
  snapshot: true,
  snapshotHash: true,
  snapshotVersion: true,
  reviewEventId: true,
  reviewReason: true,
  closeReason: true,
  reviewedAt: true,
  closedAt: true,
  reopenedAt: true,
  reopenReason: true,
  createdAt: true,
  reviewedBy: { select: { id: true, name: true } },
  closedBy: { select: { id: true, name: true } },
  reopenedBy: { select: { id: true, name: true } },
  period: {
    select: {
      id: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      currency: true,
      propertyId: true,
      property: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.PmsFinancialPeriodCloseSelect;



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
      where: { id, companyId: access.company.id, ...propertyScopeWhere(access) },
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
      where: { id, companyId: access.company.id, ...propertyScopeWhere(access) },
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
    const query = depositListQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);
    const where: Prisma.PmsSecurityDepositAccountWhereInput = {
      companyId: access.company.id,
      ...propertyScopeWhere(access),
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.search ? {
        OR: [
          { property: { name: { contains: query.search, mode: 'insensitive' } } },
          { unit: { unitNumber: { contains: query.search, mode: 'insensitive' } } },
          { tenant: { fullName: { contains: query.search, mode: 'insensitive' } } },
          { lease: { title: { contains: query.search, mode: 'insensitive' } } },
        ],
      } : {}),
    };
    const [accounts, total, grouped] = await Promise.all([
      prisma.pmsSecurityDepositAccount.findMany({
        where,
        include: depositListInclude,
        orderBy: depositOrderBy(query.sortBy, query.direction),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsSecurityDepositAccount.count({ where }),
      prisma.pmsSecurityDepositAccount.groupBy({
        by: ['currency'],
        where,
        _count: { _all: true },
        _sum: { expectedAmount: true, liabilityBalance: true },
        orderBy: { currency: 'asc' },
      }),
    ]);
    res.json({
      accounts,
      pagination: { take: query.take, skip: query.skip, count: accounts.length, total },
      totalsByCurrency: grouped.map((item) => ({
        currency: item.currency,
        count: item._count._all,
        expectedAmount: item._sum.expectedAmount?.toString() ?? '0',
        liabilityBalance: item._sum.liabilityBalance?.toString() ?? '0',
      })),
    });
  } catch (error) { next(error); }
});

pmsFinanceRouter.get('/deposits/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = companyQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    const account = await prisma.pmsSecurityDepositAccount.findFirst({
      where: { id, companyId: access.company.id, ...propertyScopeWhere(access) },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
        lease: { select: { id: true, title: true, status: true, startDate: true, endDate: true } },
        tenant: { select: { id: true, fullName: true } },
        transactions: {
          include: {
            payment: { select: { id: true, receiptNumber: true, amount: true, currency: true, paidAt: true } },
            charge: { select: { id: true, chargeNumber: true, status: true, totalAmount: true, balanceAmount: true, currency: true } },
            createdBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } },
            documents: { select: { id: true, title: true, type: true, status: true, createdAt: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!account) throw new AppError(404, 'Security deposit account not found.');
    assertPmsPropertyScope(access, account.propertyId);
    res.json({ account });
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


function closeReportOrderBy(
  sortBy: z.infer<typeof closeReportListQuery>['sortBy'],
  direction: SortDirection,
): Prisma.PmsFinancialPeriodCloseOrderByWithRelationInput[] {
  if (sortBy === 'revision') return [{ revision: direction }, { id: 'desc' }];
  if (sortBy === 'periodStart') return [{ period: { periodStart: direction } }, { revision: 'desc' }, { id: 'desc' }];
  return [{ closedAt: direction }, { revision: 'desc' }, { id: 'desc' }];
}

function closeReportScopeWhere(
  access: Awaited<ReturnType<typeof requirePmsRouteAccess>>,
  propertyId?: string,
  currency?: string,
): Prisma.PmsFinancialPeriodWhereInput {
  return {
    ...(!access.member.propertyScope.allProperties
      ? { propertyId: { in: access.member.propertyScope.propertyIds } }
      : {}),
    ...(propertyId ? { propertyId } : {}),
    ...(currency ? { currency } : {}),
  };
}

async function loadFinancialCloseReport(
  closeId: string,
  access: Awaited<ReturnType<typeof requirePmsRouteAccess>>,
) {
  const close = await prisma.pmsFinancialPeriodClose.findFirst({
    where: {
      id: closeId,
      companyId: access.company.id,
      period: { is: closeReportScopeWhere(access) },
    },
    select: financialPeriodCloseReportSelect,
  });
  if (!close) throw new AppError(404, 'Financial close report not found.');
  if (close.period.propertyId) assertPmsPropertyScope(access, close.period.propertyId);
  return buildFinancialPeriodCloseReport(close);
}

pmsFinanceRouter.get('/close-reports', requireAuth(), async (req, res, next) => {
  try {
    const query = closeReportListQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    assertCanViewPmsReports(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);

    const where: Prisma.PmsFinancialPeriodCloseWhereInput = {
      companyId: access.company.id,
      period: { is: closeReportScopeWhere(access, query.propertyId, query.currency) },
      ...(query.closeStatus === 'ACTIVE'
        ? { reopenedAt: null }
        : query.closeStatus === 'REOPENED'
          ? { reopenedAt: { not: null } }
          : {}),
      ...((query.closedFrom || query.closedTo)
        ? {
            closedAt: {
              ...(query.closedFrom ? { gte: query.closedFrom } : {}),
              ...(query.closedTo ? { lte: query.closedTo } : {}),
            },
          }
        : {}),
    };

    const [closes, total] = await prisma.$transaction([
      prisma.pmsFinancialPeriodClose.findMany({
        where,
        select: {
          ...financialPeriodCloseSelect,
          createdAt: true,
          period: {
            select: {
              id: true,
              status: true,
              periodStart: true,
              periodEnd: true,
              currency: true,
              propertyId: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: closeReportOrderBy(query.sortBy, query.direction),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsFinancialPeriodClose.count({ where }),
    ]);

    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      closes,
      pagination: { take: query.take, skip: query.skip, count: closes.length, total },
    });
  } catch (error) {
    next(error);
  }
});

pmsFinanceRouter.get('/close-reports/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = companyQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    assertCanViewPmsReports(access.member);
    const report = await loadFinancialCloseReport(id, access);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ report });
  } catch (error) {
    next(error);
  }
});

pmsFinanceRouter.get('/close-reports/:id/export', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = closeReportExportQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    assertCanViewPmsReports(access.member);
    const report = await loadFinancialCloseReport(id, access);
    if (report.integrity.status !== 'VERIFIED') {
      throw new AppError(409, 'Close-pack integrity verification failed; evidence export is blocked.');
    }

    const filename = financialPeriodCloseReportFilename(report, query.format);
    await audit(req, {
      companyId: access.company.id,
      domain: DomainAuditDomain.PMS,
      entityType: 'PmsFinancialPeriodClose',
      entityId: report.close.id,
      action: 'PMS_FINANCIAL_PERIOD_CLOSE_EXPORTED',
      actorId: req.user!.id,
      metadata: {
        format: query.format,
        revision: report.close.revision,
        periodId: report.period.id,
        snapshotHash: report.integrity.storedHash,
      },
    });

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (query.format === 'json') {
      return res.status(200).type('application/json').send(`${JSON.stringify(report, null, 2)}
`);
    }
    return res.status(200).type('text/csv').send(financialPeriodCloseReportCsv(report));
  } catch (error) {
    next(error);
  }
});

pmsFinanceRouter.get('/periods', requireAuth(), async (req, res, next) => {
  try {
    const query = periodListQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);
    const scope = access.member.propertyScope.allProperties
      ? {}
      : { propertyId: { in: access.member.propertyScope.propertyIds } };
    const where: Prisma.PmsFinancialPeriodWhereInput = {
      companyId: access.company.id,
      ...scope,
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
    };
    const [periods, total] = await Promise.all([
      prisma.pmsFinancialPeriod.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } },
          events: {
            include: { createdBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          closes: {
            select: financialPeriodCloseSelect,
            orderBy: { revision: 'desc' },
            take: 1,
          },
        },
        orderBy: periodOrderBy(query.sortBy, query.direction),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsFinancialPeriod.count({ where }),
    ]);
    res.json({ periods, pagination: { take: query.take, skip: query.skip, count: periods.length, total } });
  } catch (error) { next(error); }
});

pmsFinanceRouter.get('/periods/:id/readiness', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = companyQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    const period = await prisma.pmsFinancialPeriod.findFirst({
      where: {
        id,
        companyId: access.company.id,
        ...(access.member.propertyScope.allProperties
          ? {}
          : { propertyId: { in: access.member.propertyScope.propertyIds } }),
      },
      include: {
        property: { select: { id: true, name: true } },
        events: {
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        closes: {
          select: financialPeriodCloseSelect,
          orderBy: { revision: 'desc' },
          take: 10,
        },
      },
    });
    if (!period) throw new AppError(404, 'Financial period not found.');
    if (period.propertyId) assertPmsPropertyScope(access, period.propertyId);
    res.json({ period, readiness: await getFinancialPeriodReadiness(period) });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/periods', requireAuth(), async (req, res, next) => {
  try {
    const data = periodSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    if (data.periodEnd < data.periodStart) throw new AppError(400, 'Period end must not be before its start.');
    if (data.propertyId) assertPmsPropertyScope(access, data.propertyId);
    else if (!access.member.propertyScope.allProperties) throw new AppError(403, 'Company-wide financial periods require access to all properties.');
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
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      await lockFinanceRows(tx, 'PmsFinancialPeriod', [id]);
      const current = await tx.pmsFinancialPeriod.findFirst({ where: { id, companyId: access.company.id } });
      if (!current) throw new AppError(404, 'Financial period not found.');
      if (current.propertyId) assertPmsPropertyScope(access, current.propertyId);
      else if (!access.member.propertyScope.allProperties) throw new AppError(403, 'Company-wide financial periods require access to all properties.');

      const nextStatus = data.action === 'REVIEW' ? 'REVIEWING' : data.action === 'CLOSE' ? 'CLOSED' : 'OPEN';
      const allowed = (current.status === 'OPEN' && nextStatus === 'REVIEWING')
        || (current.status === 'REVIEWING' && nextStatus === 'CLOSED')
        || (current.status === 'CLOSED' && nextStatus === 'OPEN');
      if (!allowed) throw new AppError(409, `Cannot move financial period from ${current.status} to ${nextStatus}.`);

      let closeRecord: Prisma.PmsFinancialPeriodCloseGetPayload<{ select: typeof financialPeriodCloseSelect }> | null = null;
      if (data.action === 'CLOSE') {
        const reviewEvent = await tx.pmsFinancialPeriodEvent.findFirst({
          where: { periodId: id, toStatus: 'REVIEWING', close: null },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        if (!reviewEvent?.createdById) {
          throw new AppError(409, 'Financial period closure requires an identified reviewer.');
        }
        if (reviewEvent.createdById === req.user!.id) {
          throw new AppError(409, 'The financial-period reviewer cannot close the same period. A second accounting manager is required.');
        }

        const readiness = await getFinancialPeriodReadiness(current, tx);
        if (!readiness.canClose) {
          throw new AppError(
            409,
            `Financial period has ${readiness.blockerTotal} close blocker(s): `
            + `${readiness.reconciliationExceptions} reconciliation exception(s), `
            + `${readiness.pendingDepositTransactions} pending deposit transaction(s), `
            + `${readiness.unallocatedPayments} unallocated payment(s), `
            + `${readiness.unreconciledRentPayments} unreconciled rent payment(s), `
            + `${readiness.unreconciledVendorPayments} unreconciled vendor payment(s), and `
            + `${readiness.unreconciledOwnerPayouts} unreconciled owner payout(s).`,
          );
        }

        const { snapshot, snapshotHash } = await buildFinancialPeriodCloseSnapshot({
          client: tx,
          period: current,
          readiness,
          reviewEvent: {
            id: reviewEvent.id,
            reason: reviewEvent.reason,
            createdAt: reviewEvent.createdAt,
            createdById: reviewEvent.createdById,
          },
          closeReason: data.reason,
          closedAt: now,
          closedById: req.user!.id,
        });
        const latestClose = await tx.pmsFinancialPeriodClose.findFirst({
          where: { periodId: id },
          orderBy: { revision: 'desc' },
          select: { revision: true },
        });

        await tx.pmsFinancialPeriod.update({
          where: { id },
          data: {
            status: 'CLOSED',
            updatedById: req.user!.id,
            closedAt: now,
            closeReason: data.reason,
          },
        });
        closeRecord = await tx.pmsFinancialPeriodClose.create({
          data: {
            companyId: access.company.id,
            periodId: id,
            reviewEventId: reviewEvent.id,
            revision: (latestClose?.revision ?? 0) + 1,
            snapshot,
            snapshotHash,
            snapshotVersion: 1,
            reviewReason: reviewEvent.reason ?? 'Financial period reviewed',
            closeReason: data.reason,
            reviewedAt: reviewEvent.createdAt,
            reviewedById: reviewEvent.createdById,
            closedAt: now,
            closedById: req.user!.id,
          },
          select: financialPeriodCloseSelect,
        });
      } else if (data.action === 'REOPEN') {
        const activeClose = await tx.pmsFinancialPeriodClose.findFirst({
          where: { periodId: id, reopenedAt: null },
          orderBy: { revision: 'desc' },
          select: { id: true },
        });
        if (activeClose) {
          closeRecord = await tx.pmsFinancialPeriodClose.update({
            where: { id: activeClose.id },
            data: { reopenedAt: now, reopenReason: data.reason, reopenedById: req.user!.id },
            select: financialPeriodCloseSelect,
          });
        }
        await tx.pmsFinancialPeriod.update({
          where: { id },
          data: {
            status: 'OPEN',
            updatedById: req.user!.id,
            reopenedAt: now,
            reopenReason: data.reason,
            closedAt: null,
            closeReason: null,
          },
        });
      } else {
        await tx.pmsFinancialPeriod.update({
          where: { id },
          data: { status: 'REVIEWING', updatedById: req.user!.id },
        });
      }

      const event = await tx.pmsFinancialPeriodEvent.create({
        data: {
          companyId: access.company.id,
          periodId: id,
          fromStatus: current.status,
          toStatus: nextStatus,
          reason: data.reason,
          createdById: req.user!.id,
        },
      });
      const period = await tx.pmsFinancialPeriod.findUniqueOrThrow({
        where: { id },
        include: {
          property: { select: { id: true, name: true } },
          events: {
            include: { createdBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
          closes: {
            select: financialPeriodCloseSelect,
            orderBy: { revision: 'desc' },
            take: 10,
          },
        },
      });
      return { period, closeRecord, event, fromStatus: current.status, toStatus: nextStatus };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await audit(req, {
      companyId: access.company.id,
      domain: DomainAuditDomain.PMS,
      entityType: 'PmsFinancialPeriod',
      entityId: id,
      action: `PMS_FINANCIAL_PERIOD_${data.action}`,
      actorId: req.user!.id,
      changedFields: ['status'],
      metadata: {
        reason: data.reason,
        fromStatus: result.fromStatus,
        toStatus: result.toStatus,
        closeId: result.closeRecord?.id,
        closeRevision: result.closeRecord?.revision,
        snapshotHash: result.closeRecord?.snapshotHash,
        transitionEventId: result.event.id,
      },
    });
    res.json({ period: result.period, close: result.closeRecord });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return next(new AppError(409, 'The financial period changed concurrently. Reload and retry the transition.'));
    }
    next(error);
  }
});

const treasuryImportBatchInclude = {
  createdBy: { select: { id: true, name: true, email: true } },
  _count: { select: { items: true } },
} satisfies Prisma.PmsTreasuryImportBatchInclude;

function treasuryImportBatchResponse(batch: Prisma.PmsTreasuryImportBatchGetPayload<{ include: typeof treasuryImportBatchInclude }>) {
  return {
    id: batch.id,
    source: batch.source,
    filename: batch.filename,
    accountReference: batch.accountReference,
    status: batch.status,
    totalRows: batch.totalRows,
    importedRows: batch.importedRows,
    duplicateRows: batch.duplicateRows,
    failedRows: batch.failedRows,
    metadata: batch.metadata,
    createdBy: batch.createdBy,
    itemCount: batch._count.items,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  };
}

pmsFinanceRouter.get('/reconciliation/import-batches', requireAuth(), async (req, res, next) => {
  try {
    const query = treasuryImportBatchListQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    if (!access.member.propertyScope.allProperties) throw new AppError(403, 'Treasury import history requires access to all properties.');
    const where: Prisma.PmsTreasuryImportBatchWhereInput = {
      companyId: access.company.id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
    };
    const [batches, total] = await prisma.$transaction([
      prisma.pmsTreasuryImportBatch.findMany({ where, include: treasuryImportBatchInclude, orderBy: { createdAt: 'desc' }, take: query.take, skip: query.skip }),
      prisma.pmsTreasuryImportBatch.count({ where }),
    ]);
    res.json({ batches: batches.map(treasuryImportBatchResponse), pagination: { take: query.take, skip: query.skip, count: batches.length, total } });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/reconciliation/imports/preview', requireAuth(), async (req, res, next) => {
  try {
    const data = treasuryImportSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    if (!access.member.propertyScope.allProperties) throw new AppError(403, 'Treasury statement imports require access to all properties.');
    const preview = await buildTreasuryImportPreview({ companyId: access.company.id, source: data.source, accountReference: data.accountReference, csvText: data.csvText });
    res.json({ preview });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/reconciliation/imports/commit', requireAuth(), async (req, res, next) => {
  try {
    const data = treasuryImportSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    if (!access.member.propertyScope.allProperties) throw new AppError(403, 'Treasury statement imports require access to all properties.');
    const preview = await buildTreasuryImportPreview({ companyId: access.company.id, source: data.source, accountReference: data.accountReference, csvText: data.csvText });
    const existingBatch = await prisma.pmsTreasuryImportBatch.findUnique({
      where: { companyId_source_contentHash: { companyId: access.company.id, source: data.source, contentHash: preview.contentHash } },
      include: treasuryImportBatchInclude,
    });
    if (existingBatch) throw new AppError(409, `This treasury statement was already imported in batch ${existingBatch.id}.`);

    const status = preview.validRows.length === 0 ? 'FAILED' : (preview.duplicateRows.length || preview.invalidRows.length ? 'PARTIAL' : 'COMMITTED');
    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.pmsTreasuryImportBatch.create({
        data: {
          companyId: access.company.id,
          source: data.source,
          filename: data.filename || null,
          accountReference: data.accountReference || null,
          contentHash: preview.contentHash,
          status,
          totalRows: preview.totalRows,
          importedRows: preview.validRows.length,
          duplicateRows: preview.duplicateRows.length,
          failedRows: preview.invalidRows.length,
          createdById: req.user!.id,
          metadata: {
            headers: preview.headers,
            duplicateRows: preview.duplicateRows,
            invalidRows: preview.invalidRows,
          } as unknown as Prisma.InputJsonObject,
        },
        include: treasuryImportBatchInclude,
      });
      if (preview.validRows.length) {
        await tx.pmsReconciliationItem.createMany({
          data: preview.validRows.map((row) => ({
            companyId: access.company.id,
            source: data.source,
            direction: row.data!.direction,
            status: 'UNMATCHED',
            externalReference: row.data!.externalReference,
            amount: row.data!.amount,
            currency: row.data!.currency,
            transactionDate: new Date(row.data!.transactionDate),
            propertyId: row.data!.propertyId,
            payerReference: row.data!.payerReference,
            metadata: row.data!.metadata as Prisma.InputJsonObject,
            importBatchId: created.id,
            importRowNumber: row.rowNumber,
            createdById: req.user!.id,
          })),
        });
      }
      return tx.pmsTreasuryImportBatch.findUniqueOrThrow({ where: { id: created.id }, include: treasuryImportBatchInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await audit(req, {
      companyId: access.company.id,
      domain: DomainAuditDomain.PMS,
      entityType: 'PmsTreasuryImportBatch',
      entityId: batch.id,
      action: 'PMS_TREASURY_STATEMENT_IMPORTED',
      actorId: req.user!.id,
      afterMetadata: { source: data.source, filename: data.filename || null, accountReference: data.accountReference || null, status, totalRows: preview.totalRows, importedRows: preview.validRows.length, duplicateRows: preview.duplicateRows.length, failedRows: preview.invalidRows.length },
    });

    const response = { preview, batch: treasuryImportBatchResponse(batch) };
    if (preview.validRows.length === 0) return res.status(400).json({ ...response, message: 'No valid treasury rows were imported.' });
    res.status(201).json(response);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
      return next(new AppError(409, 'The statement or one of its external references was imported concurrently. Reload and review import history.'));
    }
    next(error);
  }
});

pmsFinanceRouter.get('/reconciliation', requireAuth(), async (req, res, next) => {
  try {
    const query = reconciliationListQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);
    const scope = access.member.propertyScope.allProperties
      ? {}
      : { propertyId: { in: access.member.propertyScope.propertyIds } };
    const where: Prisma.PmsReconciliationItemWhereInput = {
      companyId: access.company.id,
      ...scope,
      ...(query.propertyId ? { propertyId: query.propertyId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.reconciliationDirection ? { direction: query.reconciliationDirection } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...((query.transactionFrom || query.transactionTo) ? { transactionDate: { ...(query.transactionFrom ? { gte: query.transactionFrom } : {}), ...(query.transactionTo ? { lte: query.transactionTo } : {}) } } : {}),
      ...(query.search ? {
        OR: [
          { externalReference: { contains: query.search, mode: 'insensitive' } },
          { payerReference: { contains: query.search, mode: 'insensitive' } },
          { payment: { receiptNumber: { contains: query.search, mode: 'insensitive' } } },
          { vendorInvoice: { invoiceNumber: { contains: query.search, mode: 'insensitive' } } },
          { vendorInvoice: { paymentReference: { contains: query.search, mode: 'insensitive' } } },
          { ownerPayoutBatch: { payoutNumber: { contains: query.search, mode: 'insensitive' } } },
          { ownerPayoutBatch: { payoutReference: { contains: query.search, mode: 'insensitive' } } },
          { importBatch: { filename: { contains: query.search, mode: 'insensitive' } } },
          { importBatch: { accountReference: { contains: query.search, mode: 'insensitive' } } },
        ],
      } : {}),
    };
    const [items, total, statusTotals, currencyTotals] = await Promise.all([
      prisma.pmsReconciliationItem.findMany({
        where,
        include: {
          property: { select: { id: true, name: true } },
          payment: { select: { id: true, amount: true, currency: true, receiptNumber: true, paidAt: true, status: true } },
          vendorInvoice: { select: { id: true, invoiceNumber: true, paidAmount: true, currency: true, paidAt: true, status: true, paymentReference: true, propertyId: true } },
          ownerPayoutBatch: { select: { id: true, payoutNumber: true, payoutAmount: true, currency: true, paidAt: true, status: true, payoutReference: true } },
          duplicateOf: { select: { id: true, externalReference: true } },
          importBatch: { select: { id: true, filename: true, accountReference: true, source: true, createdAt: true } },
          createdBy: { select: { id: true, name: true } },
          matchedBy: { select: { id: true, name: true } },
        },
        orderBy: reconciliationOrderBy(query.sortBy, query.direction),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsReconciliationItem.count({ where }),
      prisma.pmsReconciliationItem.groupBy({ by: ['status'], where, _count: { _all: true }, orderBy: { status: 'asc' } }),
      prisma.pmsReconciliationItem.groupBy({ by: ['currency'], where, _count: { _all: true }, _sum: { amount: true }, orderBy: { currency: 'asc' } }),
    ]);
    res.json({
      items,
      pagination: { take: query.take, skip: query.skip, count: items.length, total },
      totalsByStatus: statusTotals.map((item) => ({ status: item.status, count: item._count._all })),
      totalsByCurrency: currencyTotals.map((item) => ({ currency: item.currency, count: item._count._all, amount: item._sum.amount?.toString() ?? '0' })),
    });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/reconciliation', requireAuth(), async (req, res, next) => {
  try {
    const data = reconciliationSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    if (data.propertyId) assertPmsPropertyScope(access, data.propertyId);
    else if (!access.member.propertyScope.allProperties) throw new AppError(403, 'Company-wide reconciliation items require access to all properties.');
    const duplicate = await prisma.pmsReconciliationItem.findFirst({ where: { companyId: access.company.id, propertyId: data.propertyId ?? null, source: data.source, direction: data.direction, currency: data.currency, amount: money(data.amount), transactionDate: data.transactionDate, payerReference: data.payerReference ?? null }, orderBy: { createdAt: 'asc' } });
    const item = await prisma.pmsReconciliationItem.create({ data: { companyId: access.company.id, propertyId: data.propertyId ?? null, source: data.source, direction: data.direction, externalReference: data.externalReference, amount: money(data.amount), currency: data.currency, transactionDate: data.transactionDate, payerReference: data.payerReference ?? null, metadata: data.metadata as Prisma.InputJsonValue | undefined, status: duplicate ? 'DUPLICATE' : 'UNMATCHED', duplicateOfId: duplicate?.id ?? null, createdById: req.user!.id } });
    await audit(req, { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsReconciliationItem', entityId: item.id, action: duplicate ? 'PMS_RECONCILIATION_DUPLICATE_DETECTED' : 'PMS_RECONCILIATION_ITEM_IMPORTED', actorId: req.user!.id, afterMetadata: { source: item.source, direction: item.direction, externalReference: item.externalReference, amount: item.amount.toString(), currency: item.currency, duplicateOfId: item.duplicateOfId } });
    res.status(201).json({ item });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/reconciliation/:id/match', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = reconciliationMatchSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const targetType = data.paymentId ? 'RENT_PAYMENT' : data.targetType!;
    const targetId = data.paymentId ?? data.targetId!;

    const updated = await prisma.$transaction(async (tx) => {
      await lockFinanceRows(tx, 'PmsReconciliationItem', [id]);
      if (targetType === 'RENT_PAYMENT') await lockFinanceRows(tx, 'PmsRentPayment', [targetId]);
      else if (targetType === 'VENDOR_INVOICE') await lockFinanceRows(tx, 'PmsVendorInvoice', [targetId]);
      else await lockFinanceRows(tx, 'PmsOwnerPayoutBatch', [targetId]);

      const item = await tx.pmsReconciliationItem.findFirst({ where: { id, companyId: access.company.id } });
      if (!item) throw new AppError(404, 'Reconciliation item not found.');
      if (item.status === 'DUPLICATE' || item.status === 'IGNORED') throw new AppError(409, `Cannot match a reconciliation item in ${item.status} status.`);
      if (item.propertyId) assertPmsPropertyScope(access, item.propertyId);
      else if (!access.member.propertyScope.allProperties) throw new AppError(403, 'Company-wide reconciliation items require access to all properties.');

      if (targetType === 'RENT_PAYMENT') {
        const payment = await tx.pmsRentPayment.findFirst({ where: { id: targetId, companyId: access.company.id } });
        if (!payment) throw new AppError(404, 'Rent payment not found.');
        if (item.status === 'MATCHED' && item.paymentId === payment.id) return item;
        if (item.status === 'MATCHED') throw new AppError(409, 'Reconciliation item is already matched.');
        if (item.direction !== 'CREDIT') throw new AppError(409, 'Outgoing reconciliation items cannot be matched to rent payments.');
        if (payment.status !== 'CONFIRMED') throw new AppError(409, 'Only confirmed rent payments can be reconciled.');
        assertPmsPropertyScope(access, payment.propertyId);
        if (item.propertyId && item.propertyId !== payment.propertyId) throw new AppError(409, 'Reconciliation property must match the rent payment property.');
        assertSameCurrency(item.currency, payment.currency);
        if (!item.amount.equals(payment.amount)) throw new AppError(409, 'Reconciliation amount must equal the payment amount.');
        const existingMatch = await tx.pmsReconciliationItem.findFirst({
          where: { companyId: access.company.id, paymentId: payment.id, status: 'MATCHED', id: { not: item.id } },
          select: { id: true, externalReference: true },
        });
        if (existingMatch) throw new AppError(409, `Payment is already matched to reconciliation item ${existingMatch.externalReference}.`);
        return tx.pmsReconciliationItem.update({
          where: { id },
          data: {
            status: 'MATCHED',
            paymentId: payment.id,
            vendorInvoiceId: null,
            ownerPayoutBatchId: null,
            matchedAt: new Date(),
            matchedById: req.user!.id,
            matchReason: data.reason,
          },
        });
      }

      if (targetType === 'VENDOR_INVOICE') {
        const invoice = await tx.pmsVendorInvoice.findFirst({ where: { id: targetId, companyId: access.company.id } });
        if (!invoice) throw new AppError(404, 'Vendor invoice not found.');
        if (item.status === 'MATCHED' && item.vendorInvoiceId === invoice.id) return item;
        if (item.status === 'MATCHED') throw new AppError(409, 'Reconciliation item is already matched.');
        if (item.direction !== 'DEBIT') throw new AppError(409, 'Incoming reconciliation items cannot be matched to vendor payments.');
        if (invoice.status !== 'PAID' || !invoice.paidAmount.greaterThan(0)) throw new AppError(409, 'Only paid vendor invoices can be reconciled.');
        assertPmsPropertyScope(access, invoice.propertyId);
        if (!item.propertyId || item.propertyId !== invoice.propertyId) throw new AppError(409, 'Vendor-payment reconciliation must use the invoice property.');
        assertSameCurrency(item.currency, invoice.currency);
        if (!item.amount.equals(invoice.paidAmount)) throw new AppError(409, 'Reconciliation amount must equal the paid vendor invoice amount.');
        const existingMatch = await tx.pmsReconciliationItem.findFirst({
          where: { companyId: access.company.id, vendorInvoiceId: invoice.id, status: 'MATCHED', id: { not: item.id } },
          select: { id: true, externalReference: true },
        });
        if (existingMatch) throw new AppError(409, `Vendor invoice is already matched to reconciliation item ${existingMatch.externalReference}.`);
        return tx.pmsReconciliationItem.update({
          where: { id },
          data: {
            status: 'MATCHED',
            paymentId: null,
            vendorInvoiceId: invoice.id,
            ownerPayoutBatchId: null,
            matchedAt: new Date(),
            matchedById: req.user!.id,
            matchReason: data.reason,
          },
        });
      }

      const payout = await tx.pmsOwnerPayoutBatch.findFirst({ where: { id: targetId, companyId: access.company.id } });
      if (!payout) throw new AppError(404, 'Owner payout not found.');
      if (item.status === 'MATCHED' && item.ownerPayoutBatchId === payout.id) return item;
      if (item.status === 'MATCHED') throw new AppError(409, 'Reconciliation item is already matched.');
      if (item.direction !== 'DEBIT') throw new AppError(409, 'Incoming reconciliation items cannot be matched to owner payouts.');
      if (item.propertyId) throw new AppError(409, 'Owner-payout reconciliation must be company-wide.');
      if (!access.member.propertyScope.allProperties) throw new AppError(403, 'Owner-payout reconciliation requires access to all properties.');
      if (payout.status !== 'PAID_MANUAL' || !payout.payoutAmount.greaterThan(0)) throw new AppError(409, 'Only paid owner payouts can be reconciled.');
      assertSameCurrency(item.currency, payout.currency);
      if (!item.amount.equals(payout.payoutAmount)) throw new AppError(409, 'Reconciliation amount must equal the owner payout amount.');
      const existingMatch = await tx.pmsReconciliationItem.findFirst({
        where: { companyId: access.company.id, ownerPayoutBatchId: payout.id, status: 'MATCHED', id: { not: item.id } },
        select: { id: true, externalReference: true },
      });
      if (existingMatch) throw new AppError(409, `Owner payout is already matched to reconciliation item ${existingMatch.externalReference}.`);
      return tx.pmsReconciliationItem.update({
        where: { id },
        data: {
          status: 'MATCHED',
          paymentId: null,
          vendorInvoiceId: null,
          ownerPayoutBatchId: payout.id,
          matchedAt: new Date(),
          matchedById: req.user!.id,
          matchReason: data.reason,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    await audit(req, {
      companyId: access.company.id,
      domain: DomainAuditDomain.PMS,
      entityType: 'PmsReconciliationItem',
      entityId: id,
      action: 'PMS_RECONCILIATION_MATCHED',
      actorId: req.user!.id,
      afterMetadata: { targetType, targetId, reason: data.reason },
    });
    res.json({ item: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002')) {
      return next(new AppError(409, 'The reconciliation item or target changed concurrently or is already matched. Reload and retry.'));
    }
    next(error);
  }
});

pmsFinanceRouter.post('/reconciliation/:id/transition', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = reconciliationTransitionSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const result = await prisma.$transaction(async (tx) => {
      await lockFinanceRows(tx, 'PmsReconciliationItem', [id]);
      const current = await tx.pmsReconciliationItem.findFirst({ where: { id, companyId: access.company.id } });
      if (!current) throw new AppError(404, 'Reconciliation item not found.');
      if (current.propertyId) assertPmsPropertyScope(access, current.propertyId);
      else if (!access.member.propertyScope.allProperties) throw new AppError(403, 'Company-wide reconciliation items require access to all properties.');
      if (data.action === 'IGNORE' && current.status !== 'UNMATCHED') throw new AppError(409, 'Only unmatched reconciliation items can be ignored.');
      if (data.action === 'RESTORE_UNMATCHED' && current.status !== 'IGNORED') throw new AppError(409, 'Only ignored reconciliation items can be restored.');
      const nextStatus = data.action === 'IGNORE' ? 'IGNORED' : 'UNMATCHED';
      const item = await tx.pmsReconciliationItem.update({
        where: { id },
        data: {
          status: nextStatus,
          paymentId: null,
          vendorInvoiceId: null,
          ownerPayoutBatchId: null,
          matchedAt: null,
          matchedById: null,
          matchReason: data.reason,
        },
      });
      return { item, fromStatus: current.status, toStatus: nextStatus };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await audit(req, {
      companyId: access.company.id,
      domain: DomainAuditDomain.PMS,
      entityType: 'PmsReconciliationItem',
      entityId: id,
      action: `PMS_RECONCILIATION_${data.action}`,
      actorId: req.user!.id,
      changedFields: ['status'],
      metadata: { fromStatus: result.fromStatus, toStatus: result.toStatus, reason: data.reason },
    });
    res.json({ item: result.item });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return next(new AppError(409, 'The reconciliation item changed concurrently. Reload and retry.'));
    }
    next(error);
  }
});

const ownerPayoutInclude = {
  ownerUser: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true } },
  paidBy: { select: { id: true, name: true, email: true } },
  cancelledBy: { select: { id: true, name: true, email: true } },
  lines: {
    include: {
      property: { select: { id: true, name: true, code: true } },
      statement: {
        select: {
          id: true,
          revision: true,
          status: true,
          periodStart: true,
          periodEnd: true,
          currency: true,
          openingBalance: true,
          income: true,
          expenses: true,
          adjustments: true,
          closingBalance: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  documents: {
    where: { status: { not: 'ARCHIVED' as const } },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.PmsOwnerPayoutBatchInclude;

type OwnerPayoutWithRelations = Prisma.PmsOwnerPayoutBatchGetPayload<{ include: typeof ownerPayoutInclude }>;

function ownerPayoutResponse(batch: OwnerPayoutWithRelations) {
  return {
    ...batch,
    grossAmount: batch.grossAmount.toString(),
    managementFeeAmount: batch.managementFeeAmount.toString(),
    reservedAmount: batch.reservedAmount.toString(),
    payoutAmount: batch.payoutAmount.toString(),
    lines: batch.lines.map((line) => ({
      ...line,
      incomeAmount: line.incomeAmount.toString(),
      expenseAmount: line.expenseAmount.toString(),
      managementFeeAmount: line.managementFeeAmount.toString(),
      reservedAmount: line.reservedAmount.toString(),
      netAmount: line.netAmount.toString(),
      statement: line.statement
        ? {
            ...line.statement,
            openingBalance: line.statement.openingBalance.toString(),
            income: line.statement.income.toString(),
            expenses: line.statement.expenses.toString(),
            adjustments: line.statement.adjustments.toString(),
            closingBalance: line.statement.closingBalance.toString(),
          }
        : null,
    })),
  };
}

function ownerPayoutOrderBy(
  sortBy: z.infer<typeof payoutListQuery>['sortBy'],
  direction: z.infer<typeof payoutListQuery>['direction'],
): Prisma.PmsOwnerPayoutBatchOrderByWithRelationInput[] {
  if (sortBy === 'createdAt') return [{ createdAt: direction }];
  if (sortBy === 'periodEnd') return [{ periodEnd: direction }, { createdAt: 'desc' }];
  if (sortBy === 'payoutAmount') return [{ payoutAmount: direction }];
  if (sortBy === 'status') return [{ status: direction }, { createdAt: 'desc' }];
  return [{ payoutNumber: direction }];
}

async function lockOwnerPayout(tx: Prisma.TransactionClient, id: string, companyId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "PmsOwnerPayoutBatch" WHERE "id" = ${id} AND "companyId" = ${companyId} FOR UPDATE`,
  );
  if (rows.length === 0) throw new AppError(404, 'Owner payout batch not found.');
  return tx.pmsOwnerPayoutBatch.findFirstOrThrow({ where: { id, companyId }, include: ownerPayoutInclude });
}

async function requireOwnerPayoutEvidence(input: {
  tx: Prisma.TransactionClient;
  batchId: string;
  evidenceDocumentId?: string;
  minimumCreatedAt?: Date | null;
  purpose: string;
}) {
  if (!input.evidenceDocumentId) {
    throw new AppError(400, `${input.purpose} requires a linked evidence document.`);
  }
  const document = await input.tx.pmsDocument.findFirst({
    where: {
      id: input.evidenceDocumentId,
      ownerPayoutBatchId: input.batchId,
      status: { not: 'ARCHIVED' },
      ...(input.minimumCreatedAt ? { createdAt: { gte: input.minimumCreatedAt } } : {}),
    },
    select: { id: true, title: true, createdAt: true },
  });
  if (!document) {
    throw new AppError(409, `${input.purpose} evidence must be active, linked to this payout, and recorded at the correct workflow stage.`);
  }
  return document;
}

function normalizedPayoutAction(action: z.infer<typeof payoutTransitionSchema>['action']) {
  if (action === 'START_PROCESSING') return 'SUBMIT' as const;
  if (action === 'MARK_PAID_MANUAL') return 'RECORD_PAID' as const;
  if (action === 'FAIL') return 'RECORD_FAILED' as const;
  return action;
}

pmsFinanceRouter.get('/owner-payouts', requireAuth(), async (req, res, next) => {
  try {
    const query = payoutListQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    if (query.propertyId) assertPmsPropertyScope(access, query.propertyId);
    const scopeFilters: Prisma.PmsOwnerPayoutBatchWhereInput[] = [];
    if (!access.member.propertyScope.allProperties) {
      scopeFilters.push({
        lines: {
          some: {},
          every: { propertyId: { in: access.member.propertyScope.propertyIds } },
        },
      });
    }
    if (query.propertyId) scopeFilters.push({ lines: { some: { propertyId: query.propertyId } } });
    const where: Prisma.PmsOwnerPayoutBatchWhereInput = {
      companyId: access.company.id,
      ...(scopeFilters.length > 0 ? { AND: scopeFilters } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.ownerUserId ? { ownerUserId: query.ownerUserId } : {}),
      ...(query.search
        ? {
            OR: [
              { payoutNumber: { contains: query.search, mode: 'insensitive' } },
              { payoutReference: { contains: query.search, mode: 'insensitive' } },
              { ownerUser: { name: { contains: query.search, mode: 'insensitive' } } },
              { ownerUser: { email: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [batches, total, totalsByStatus, totalsByCurrency, ownerAccesses] = await prisma.$transaction([
      prisma.pmsOwnerPayoutBatch.findMany({
        where,
        include: ownerPayoutInclude,
        orderBy: ownerPayoutOrderBy(query.sortBy, query.direction),
        take: query.take,
        skip: query.skip,
      }),
      prisma.pmsOwnerPayoutBatch.count({ where }),
      prisma.pmsOwnerPayoutBatch.groupBy({ by: ['status'], where, _count: { _all: true } }),
      prisma.pmsOwnerPayoutBatch.groupBy({ by: ['currency'], where, _count: { _all: true }, _sum: { payoutAmount: true } }),
      prisma.pmsOwnerPortalAccess.findMany({
        where: {
          companyId: access.company.id,
          active: true,
          ...(query.propertyId
            ? { propertyId: query.propertyId }
            : access.member.propertyScope.allProperties
              ? {}
              : { propertyId: { in: access.member.propertyScope.propertyIds } }),
        },
        select: {
          id: true,
          propertyId: true,
          property: { select: { id: true, name: true, code: true } },
          userId: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ user: { name: 'asc' } }, { property: { name: 'asc' } }],
      }),
    ]);
    res.json({
      batches: batches.map(ownerPayoutResponse),
      pagination: { take: query.take, skip: query.skip, count: batches.length, total },
      totalsByStatus: totalsByStatus.map((row) => ({ status: row.status, count: row._count._all })),
      totalsByCurrency: totalsByCurrency.map((row) => ({ currency: row.currency, count: row._count._all, payoutAmount: row._sum.payoutAmount?.toString() ?? '0' })),
      ownerAccesses,
    });
  } catch (error) { next(error); }
});

pmsFinanceRouter.get('/owner-payouts/:id', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const query = companyQuery.parse(req.query);
    const access = await requirePmsRouteAccess(req, query.companyId);
    assertCanViewPmsAccounting(access.member);
    const batch = await prisma.pmsOwnerPayoutBatch.findFirst({ where: { id, companyId: access.company.id }, include: ownerPayoutInclude });
    if (!batch) throw new AppError(404, 'Owner payout batch not found.');
    batch.lines.forEach((line) => assertPmsPropertyScope(access, line.propertyId));
    const events = await prisma.domainAuditEvent.findMany({
      where: { companyId: access.company.id, domain: DomainAuditDomain.PMS, entityType: 'PmsOwnerPayoutBatch', entityId: batch.id },
      select: { id: true, action: true, actorId: true, metadata: true, beforeMetadata: true, afterMetadata: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ batch: ownerPayoutResponse(batch), events });
  } catch (error) { next(error); }
});

pmsFinanceRouter.post('/owner-payouts', requireAuth(), async (req, res, next) => {
  try {
    const data = payoutSchema.parse(req.body);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    if (money(data.managementFeeAmount).greaterThan(0) || money(data.reservedAmount).greaterThan(0)) {
      throw new AppError(400, 'Payout fees and reserves must be recorded against individual statement lines.');
    }
    if (data.periodEnd < data.periodStart) throw new AppError(400, 'Payout period end must not be before its start.');
    const statementIds = data.lines.map((line) => line.statementId);
    if (new Set(statementIds).size !== statementIds.length) throw new AppError(400, 'Each published statement can appear only once in a payout batch.');

    const batch = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "PmsOwnerStatement" WHERE "id" IN (${Prisma.join(statementIds)}) FOR UPDATE`,
      );
      const statements = await tx.pmsOwnerStatement.findMany({
        where: { id: { in: statementIds }, companyId: access.company.id, status: 'PUBLISHED' },
        select: {
          id: true,
          propertyId: true,
          currency: true,
          periodStart: true,
          periodEnd: true,
          openingBalance: true,
          income: true,
          expenses: true,
          adjustments: true,
          closingBalance: true,
        },
      });
      if (statements.length !== statementIds.length) {
        throw new AppError(400, 'Every payout line must reference a published owner statement in this company.');
      }
      const statementsById = new Map(statements.map((statement) => [statement.id, statement]));
      const propertyIds = [...new Set(statements.map((statement) => statement.propertyId))];
      propertyIds.forEach((propertyId) => assertPmsPropertyScope(access, propertyId));
      const ownerAccessCount = await tx.pmsOwnerPortalAccess.count({
        where: { companyId: access.company.id, userId: data.ownerUserId, active: true, propertyId: { in: propertyIds } },
      });
      if (ownerAccessCount !== propertyIds.length) {
        throw new AppError(400, 'Payout owner must have active portal access to every payout property.');
      }
      const existingPayout = await tx.pmsOwnerPayoutLine.findFirst({
        where: { statementId: { in: statementIds }, payoutBatch: { status: { not: 'CANCELLED' } } },
        select: { statementId: true, payoutBatch: { select: { payoutNumber: true } } },
      });
      if (existingPayout) {
        throw new AppError(409, `Published statement is already linked to payout ${existingPayout.payoutBatch.payoutNumber}.`);
      }

      const lineAmounts = data.lines.map((line) => {
        const statement = statementsById.get(line.statementId)!;
        if (statement.currency !== data.currency) throw new AppError(400, 'Every payout statement must use the payout currency.');
        if (statement.periodStart.getTime() !== data.periodStart.getTime() || statement.periodEnd.getTime() !== data.periodEnd.getTime()) {
          throw new AppError(400, 'Every payout statement must match the payout batch period.');
        }
        if (line.propertyId && line.propertyId !== statement.propertyId) {
          throw new AppError(400, 'Payout line property does not match its published statement.');
        }
        const carryAndAdjustments = statement.openingBalance.plus(statement.adjustments);
        const incomeAmount = statement.income.plus(carryAndAdjustments.isPositive() ? carryAndAdjustments : 0);
        const expenseAmount = statement.expenses.plus(carryAndAdjustments.isNegative() ? carryAndAdjustments.abs() : 0);
        if (line.incomeAmount !== undefined && !money(line.incomeAmount).equals(incomeAmount)) {
          throw new AppError(400, 'Payout income must be derived from the immutable published statement.');
        }
        if (line.expenseAmount !== undefined && !money(line.expenseAmount).equals(expenseAmount)) {
          throw new AppError(400, 'Payout expenses must be derived from the immutable published statement.');
        }
        const managementFeeAmount = money(line.managementFeeAmount);
        const reservedAmount = money(line.reservedAmount);
        const net = statement.closingBalance.minus(managementFeeAmount).minus(reservedAmount);
        if (net.isNegative()) throw new AppError(400, 'A payout line cannot exceed the published statement closing balance.');
        return { statement, incomeAmount, expenseAmount, managementFeeAmount, reservedAmount, net };
      });
      const gross = lineAmounts.reduce((sum, line) => sum.plus(line.incomeAmount), new Prisma.Decimal(0));
      const fees = lineAmounts.reduce((sum, line) => sum.plus(line.managementFeeAmount), new Prisma.Decimal(0));
      const reserves = lineAmounts.reduce((sum, line) => sum.plus(line.reservedAmount), new Prisma.Decimal(0));
      const payout = lineAmounts.reduce((sum, line) => sum.plus(line.statement.closingBalance), new Prisma.Decimal(0)).minus(fees).minus(reserves);
      if (payout.isNegative()) throw new AppError(400, 'Payout amount cannot be negative.');
      const payoutNumber = `PAY-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
      return tx.pmsOwnerPayoutBatch.create({
        data: {
          companyId: access.company.id,
          ownerUserId: data.ownerUserId,
          payoutNumber,
          currency: data.currency,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          grossAmount: gross,
          managementFeeAmount: fees,
          reservedAmount: reserves,
          payoutAmount: payout,
          notes: data.notes ?? null,
          createdById: req.user!.id,
          lines: {
            create: lineAmounts.map((line) => ({
              companyId: access.company.id,
              propertyId: line.statement.propertyId,
              statementId: line.statement.id,
              incomeAmount: line.incomeAmount,
              expenseAmount: line.expenseAmount,
              managementFeeAmount: line.managementFeeAmount,
              reservedAmount: line.reservedAmount,
              netAmount: line.net,
              currency: data.currency,
            })),
          },
        },
        include: ownerPayoutInclude,
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await audit(req, {
      companyId: access.company.id,
      domain: DomainAuditDomain.PMS,
      entityType: 'PmsOwnerPayoutBatch',
      entityId: batch.id,
      action: 'PMS_OWNER_PAYOUT_DRAFT_CREATED',
      actorId: req.user!.id,
      afterMetadata: {
        payoutNumber: batch.payoutNumber,
        payoutAmount: batch.payoutAmount.toString(),
        currency: batch.currency,
        ownerUserId: batch.ownerUserId,
        statementIds,
      },
    });
    res.status(201).json({ batch: ownerPayoutResponse(batch) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return next(new AppError(409, 'The payout inputs changed concurrently. Reload and retry.'));
    }
    next(error);
  }
});

pmsFinanceRouter.post('/owner-payouts/:id/transition', requireAuth(), async (req, res, next) => {
  try {
    const { id } = idParams.parse(req.params);
    const data = payoutTransitionSchema.parse(req.body);
    const action = normalizedPayoutAction(data.action);
    const access = await requirePmsRouteAccess(req, data.companyId);
    assertCanManagePmsAccounting(access.member);
    const transitions: Record<ReturnType<typeof normalizedPayoutAction>, { from: string[]; to: 'DRAFT' | 'APPROVED' | 'PROCESSING' | 'PAID_MANUAL' | 'FAILED' | 'CANCELLED' }> = {
      APPROVE: { from: ['DRAFT'], to: 'APPROVED' },
      SUBMIT: { from: ['APPROVED'], to: 'PROCESSING' },
      RECORD_PAID: { from: ['PROCESSING'], to: 'PAID_MANUAL' },
      RECORD_FAILED: { from: ['PROCESSING'], to: 'FAILED' },
      RETRY: { from: ['FAILED'], to: 'DRAFT' },
      CANCEL: { from: ['DRAFT', 'APPROVED', 'FAILED'], to: 'CANCELLED' },
    };
    const transition = transitions[action];
    const batch = await prisma.$transaction(async (tx) => {
      const current = await lockOwnerPayout(tx, id, access.company.id);
      current.lines.forEach((line) => assertPmsPropertyScope(access, line.propertyId));
      if (!transition.from.includes(current.status)) {
        throw new AppError(409, `Cannot ${action.toLowerCase()} payout from ${current.status}.`);
      }
      if (['RECORD_FAILED', 'RETRY', 'CANCEL'].includes(action) && !data.reason) {
        throw new AppError(400, `${action.replaceAll('_', ' ').toLowerCase()} requires a reason.`);
      }
      const now = new Date();
      const updateData: Prisma.PmsOwnerPayoutBatchUncheckedUpdateInput = { status: transition.to };
      let evidenceDocumentId: string | null = null;
      if (action === 'APPROVE') {
        if (current.createdById === req.user!.id) {
          throw new AppError(409, 'The payout preparer cannot approve the same payout batch.');
        }
        const evidence = await requireOwnerPayoutEvidence({ tx, batchId: current.id, evidenceDocumentId: data.evidenceDocumentId, purpose: 'Payout approval' });
        evidenceDocumentId = evidence.id;
        Object.assign(updateData, { approvedAt: now, approvedById: req.user!.id, failureReason: null });
      }
      if (action === 'SUBMIT') {
        if (current.approvedById === req.user!.id) {
          throw new AppError(409, 'The payout approver cannot submit the same payout batch.');
        }
        if (!data.providerConfirmed || !data.payoutReference || !data.paymentMethodNote) {
          throw new AppError(400, 'Payout submission requires adapter confirmation, an external reference, and a payment-method evidence note.');
        }
        const evidence = await requireOwnerPayoutEvidence({ tx, batchId: current.id, evidenceDocumentId: data.evidenceDocumentId, purpose: 'Payout submission' });
        evidenceDocumentId = evidence.id;
        Object.assign(updateData, {
          processingAt: now,
          payoutReference: data.payoutReference,
          paymentMethodNote: `[${data.adapter}] ${data.paymentMethodNote}`,
          failureReason: null,
        });
      }
      if (action === 'RECORD_PAID') {
        if (current.createdById === req.user!.id) {
          throw new AppError(409, 'The payout preparer cannot record the final paid result.');
        }
        if (!data.payoutReference || !data.paymentMethodNote) {
          throw new AppError(400, 'Recording a paid payout requires the final payment reference and evidence note.');
        }
        const evidence = await requireOwnerPayoutEvidence({
          tx,
          batchId: current.id,
          evidenceDocumentId: data.evidenceDocumentId,
          minimumCreatedAt: current.processingAt,
          purpose: 'Paid payout result',
        });
        evidenceDocumentId = evidence.id;
        Object.assign(updateData, {
          paidAt: now,
          paidById: req.user!.id,
          payoutReference: data.payoutReference,
          paymentMethodNote: data.paymentMethodNote,
          failureReason: null,
        });
      }
      if (action === 'RECORD_FAILED') Object.assign(updateData, { failureReason: data.reason });
      if (action === 'RETRY') {
        Object.assign(updateData, {
          approvedAt: null,
          approvedById: null,
          processingAt: null,
          paidAt: null,
          paidById: null,
          payoutReference: null,
          paymentMethodNote: null,
          failureReason: null,
        });
      }
      if (action === 'CANCEL') Object.assign(updateData, { cancelledAt: now, cancelledById: req.user!.id, failureReason: data.reason });
      const updated = await tx.pmsOwnerPayoutBatch.update({ where: { id }, data: updateData, include: ownerPayoutInclude });
      await recordDomainAuditEvent(tx, {
        companyId: access.company.id,
        domain: DomainAuditDomain.PMS,
        entityType: 'PmsOwnerPayoutBatch',
        entityId: id,
        action: `PMS_OWNER_PAYOUT_${action}`,
        actorId: req.user!.id,
        changedFields: ['status'],
        beforeMetadata: { status: current.status },
        afterMetadata: { status: updated.status },
        metadata: {
          reason: data.reason ?? null,
          payoutReference: data.payoutReference ?? null,
          adapter: action === 'SUBMIT' ? data.adapter : null,
          providerConfirmed: action === 'SUBMIT' ? data.providerConfirmed === true : null,
          evidenceDocumentId,
        },
        ...requestAuditContext(req),
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json({ batch: ownerPayoutResponse(batch) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return next(new AppError(409, 'The payout batch changed concurrently. Reload and retry.'));
    }
    next(error);
  }
});
