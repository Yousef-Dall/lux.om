import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { prisma } from '../../../lib/prisma';

type FinanceClient = Prisma.TransactionClient | typeof prisma;

export type FinancialPeriodScope = {
  id?: string;
  companyId: string;
  propertyId: string | null;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
};

export type FinancialPeriodReadiness = {
  canClose: boolean;
  blockerTotal: number;
  reconciliationExceptions: number;
  pendingDepositTransactions: number;
  unallocatedPayments: number;
  unallocatedAmount: string;
  unreconciledRentPayments: number;
  unreconciledVendorPayments: number;
  unreconciledOwnerPayouts: number;
};

function paymentEffectiveDateWhere(period: FinancialPeriodScope): Prisma.PmsRentPaymentWhereInput {
  return {
    OR: [
      { paidAt: { gte: period.periodStart, lte: period.periodEnd } },
      { paidAt: null, confirmedAt: { gte: period.periodStart, lte: period.periodEnd } },
      { paidAt: null, confirmedAt: null, createdAt: { gte: period.periodStart, lte: period.periodEnd } },
    ],
  };
}

function paymentScopeWhere(period: FinancialPeriodScope): Prisma.PmsRentPaymentWhereInput {
  return {
    companyId: period.companyId,
    status: 'CONFIRMED',
    currency: period.currency,
    ...(period.propertyId ? { propertyId: period.propertyId } : {}),
    ...paymentEffectiveDateWhere(period),
  };
}

function ledgerScopeWhere(period: FinancialPeriodScope): Prisma.PmsAccountingLedgerEntryWhereInput {
  return {
    companyId: period.companyId,
    currency: period.currency,
    transactionDate: { gte: period.periodStart, lte: period.periodEnd },
    ...(period.propertyId ? { propertyId: period.propertyId } : {}),
  };
}

function reconciliationScopeWhere(period: FinancialPeriodScope): Prisma.PmsReconciliationItemWhereInput {
  return {
    companyId: period.companyId,
    currency: period.currency,
    transactionDate: { gte: period.periodStart, lte: period.periodEnd },
    ...(period.propertyId ? { propertyId: period.propertyId } : {}),
  };
}

function matchedReconciliationWhere(
  period: FinancialPeriodScope,
  direction: 'CREDIT' | 'DEBIT',
): Prisma.PmsReconciliationItemWhereInput {
  return {
    status: 'MATCHED',
    direction,
    transactionDate: { gte: period.periodStart, lte: period.periodEnd },
  };
}

function vendorPaymentScopeWhere(period: FinancialPeriodScope): Prisma.PmsVendorInvoiceWhereInput {
  return {
    companyId: period.companyId,
    currency: period.currency,
    status: 'PAID',
    paidAt: { gte: period.periodStart, lte: period.periodEnd },
    ...(period.propertyId ? { propertyId: period.propertyId } : {}),
  };
}

function ownerPayoutScopeWhere(period: FinancialPeriodScope): Prisma.PmsOwnerPayoutBatchWhereInput {
  return {
    companyId: period.companyId,
    currency: period.currency,
    status: 'PAID_MANUAL',
    paidAt: { gte: period.periodStart, lte: period.periodEnd },
    ...(period.propertyId ? { lines: { some: { propertyId: period.propertyId } } } : {}),
  };
}

function depositTransactionScopeWhere(period: FinancialPeriodScope): Prisma.PmsSecurityDepositTransactionWhereInput {
  return {
    companyId: period.companyId,
    currency: period.currency,
    createdAt: { gte: period.periodStart, lte: period.periodEnd },
    ...(period.propertyId ? { account: { propertyId: period.propertyId } } : {}),
  };
}

function sumDecimals(values: Prisma.Decimal[]) {
  return values.reduce((sum, value) => sum.plus(value), new Prisma.Decimal(0));
}

export async function getFinancialPeriodReadiness(
  period: FinancialPeriodScope,
  client: FinanceClient = prisma,
): Promise<FinancialPeriodReadiness> {
  const [
    reconciliationExceptions,
    pendingDepositTransactions,
    payments,
    unreconciledVendorPayments,
    unreconciledOwnerPayouts,
  ] = await Promise.all([
    client.pmsReconciliationItem.count({
      where: {
        ...reconciliationScopeWhere(period),
        status: { in: ['UNMATCHED', 'DUPLICATE'] },
      },
    }),
    client.pmsSecurityDepositTransaction.count({
      where: {
        ...depositTransactionScopeWhere(period),
        status: { in: ['PENDING_APPROVAL', 'APPROVED'] },
      },
    }),
    client.pmsRentPayment.findMany({
      where: paymentScopeWhere(period),
      select: {
        id: true,
        amount: true,
        allocations: { where: { status: 'ACTIVE' }, select: { amount: true } },
        adjustments: { where: { status: 'POSTED' }, select: { amount: true } },
        securityDepositTransactions: {
          where: { status: 'POSTED', type: 'COLLECTION' },
          select: { amount: true },
        },
        reconciliationItems: {
          where: matchedReconciliationWhere(period, 'CREDIT'),
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { id: 'asc' },
    }),
    client.pmsVendorInvoice.count({
      where: {
        ...vendorPaymentScopeWhere(period),
        reconciliationItems: { none: matchedReconciliationWhere(period, 'DEBIT') },
      },
    }),
    client.pmsOwnerPayoutBatch.count({
      where: {
        ...ownerPayoutScopeWhere(period),
        reconciliationItems: { none: matchedReconciliationWhere(period, 'DEBIT') },
      },
    }),
  ]);

  let unallocatedPayments = 0;
  let unallocatedAmount = new Prisma.Decimal(0);
  let unreconciledRentPayments = 0;
  for (const payment of payments) {
    const allocated = sumDecimals(payment.allocations.map((item) => item.amount));
    const adjusted = sumDecimals(payment.adjustments.map((item) => item.amount));
    const depositAllocated = sumDecimals(payment.securityDepositTransactions.map((item) => item.amount));
    const available = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      payment.amount.minus(allocated).minus(adjusted).minus(depositAllocated),
    );
    if (available.greaterThan(0)) {
      unallocatedPayments += 1;
      unallocatedAmount = unallocatedAmount.plus(available);
    }
    if (payment.reconciliationItems.length === 0) unreconciledRentPayments += 1;
  }

  const blockerTotal = reconciliationExceptions
    + pendingDepositTransactions
    + unallocatedPayments
    + unreconciledRentPayments
    + unreconciledVendorPayments
    + unreconciledOwnerPayouts;

  return {
    canClose: blockerTotal === 0,
    blockerTotal,
    reconciliationExceptions,
    pendingDepositTransactions,
    unallocatedPayments,
    unallocatedAmount: unallocatedAmount.toString(),
    unreconciledRentPayments,
    unreconciledVendorPayments,
    unreconciledOwnerPayouts,
  };
}

function decimalGroup<T extends string>(
  rows: Array<{ key: T; amount: Prisma.Decimal; count: number }>,
) {
  return rows.map((row) => ({ key: row.key, count: row.count, amount: row.amount.toString() }));
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => compareText(left, right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashFinancialPeriodCloseSnapshot(snapshot: Prisma.InputJsonValue) {
  return createHash('sha256').update(stableJson(snapshot)).digest('hex');
}

export async function buildFinancialPeriodCloseSnapshot(input: {
  client: FinanceClient;
  period: FinancialPeriodScope;
  readiness: FinancialPeriodReadiness;
  reviewEvent: { id: string; reason: string | null; createdAt: Date; createdById: string };
  closeReason: string;
  closedAt: Date;
  closedById: string;
}) {
  const { client, period } = input;
  const [payments, ledgerEntries, vendorInvoices, ownerPayouts, reconciliationItems, depositTransactions] = await Promise.all([
    client.pmsRentPayment.findMany({
      where: paymentScopeWhere(period),
      select: { id: true, amount: true },
      orderBy: { id: 'asc' },
    }),
    client.pmsAccountingLedgerEntry.findMany({
      where: ledgerScopeWhere(period),
      select: { id: true, type: true, source: true, amount: true },
      orderBy: { id: 'asc' },
    }),
    client.pmsVendorInvoice.findMany({
      where: vendorPaymentScopeWhere(period),
      select: { id: true, paidAmount: true },
      orderBy: { id: 'asc' },
    }),
    client.pmsOwnerPayoutBatch.findMany({
      where: ownerPayoutScopeWhere(period),
      select: {
        id: true,
        payoutAmount: true,
        lines: {
          where: period.propertyId ? { propertyId: period.propertyId } : undefined,
          select: { id: true, netAmount: true },
          orderBy: { id: 'asc' },
        },
        reconciliationItems: {
          where: matchedReconciliationWhere(period, 'DEBIT'),
          select: { id: true },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    }),
    client.pmsReconciliationItem.findMany({
      where: reconciliationScopeWhere(period),
      select: { id: true, direction: true, status: true, amount: true },
      orderBy: { id: 'asc' },
    }),
    client.pmsSecurityDepositTransaction.findMany({
      where: { ...depositTransactionScopeWhere(period), status: 'POSTED' },
      select: { id: true, type: true, amount: true },
      orderBy: { id: 'asc' },
    }),
  ]);

  const ledgerByType = new Map<string, { amount: Prisma.Decimal; count: number }>();
  const ledgerBySource = new Map<string, { amount: Prisma.Decimal; count: number }>();
  for (const entry of ledgerEntries) {
    const byType = ledgerByType.get(entry.type) ?? { amount: new Prisma.Decimal(0), count: 0 };
    byType.amount = byType.amount.plus(entry.amount);
    byType.count += 1;
    ledgerByType.set(entry.type, byType);
    const bySource = ledgerBySource.get(entry.source) ?? { amount: new Prisma.Decimal(0), count: 0 };
    bySource.amount = bySource.amount.plus(entry.amount);
    bySource.count += 1;
    ledgerBySource.set(entry.source, bySource);
  }

  const reconciliationGroups = new Map<string, { amount: Prisma.Decimal; count: number }>();
  for (const item of reconciliationItems) {
    const key = `${item.direction}:${item.status}`;
    const current = reconciliationGroups.get(key) ?? { amount: new Prisma.Decimal(0), count: 0 };
    current.amount = current.amount.plus(item.amount);
    current.count += 1;
    reconciliationGroups.set(key, current);
  }

  const depositGroups = new Map<string, { amount: Prisma.Decimal; count: number }>();
  for (const item of depositTransactions) {
    const current = depositGroups.get(item.type) ?? { amount: new Prisma.Decimal(0), count: 0 };
    current.amount = current.amount.plus(item.amount);
    current.count += 1;
    depositGroups.set(item.type, current);
  }

  const ownerPayoutAmount = ownerPayouts.reduce((sum, payout) => (
    period.propertyId
      ? sum.plus(payout.lines.reduce((lineSum, line) => lineSum.plus(line.netAmount), new Prisma.Decimal(0)))
      : sum.plus(payout.payoutAmount)
  ), new Prisma.Decimal(0));

  const snapshot = {
    snapshotVersion: 1,
    generatedAt: input.closedAt.toISOString(),
    period: {
      id: period.id ?? null,
      companyId: period.companyId,
      propertyId: period.propertyId,
      currency: period.currency,
      periodStart: period.periodStart.toISOString(),
      periodEnd: period.periodEnd.toISOString(),
    },
    review: {
      eventId: input.reviewEvent.id,
      reason: input.reviewEvent.reason,
      reviewedAt: input.reviewEvent.createdAt.toISOString(),
      reviewedById: input.reviewEvent.createdById,
    },
    close: {
      reason: input.closeReason,
      closedAt: input.closedAt.toISOString(),
      closedById: input.closedById,
    },
    readiness: input.readiness,
    totals: {
      rentPayments: {
        count: payments.length,
        amount: sumDecimals(payments.map((item) => item.amount)).toString(),
      },
      accountingLedgerByType: decimalGroup(
        [...ledgerByType.entries()].sort(([left], [right]) => compareText(left, right))
          .map(([key, value]) => ({ key, ...value })),
      ),
      accountingLedgerBySource: decimalGroup(
        [...ledgerBySource.entries()].sort(([left], [right]) => compareText(left, right))
          .map(([key, value]) => ({ key, ...value })),
      ),
      paidVendorInvoices: {
        count: vendorInvoices.length,
        amount: sumDecimals(vendorInvoices.map((item) => item.paidAmount)).toString(),
      },
      paidOwnerPayouts: {
        count: ownerPayouts.length,
        amount: ownerPayoutAmount.toString(),
      },
      reconciliation: decimalGroup(
        [...reconciliationGroups.entries()].sort(([left], [right]) => compareText(left, right))
          .map(([key, value]) => ({ key, ...value })),
      ),
      postedDepositTransactions: decimalGroup(
        [...depositGroups.entries()].sort(([left], [right]) => compareText(left, right))
          .map(([key, value]) => ({ key, ...value })),
      ),
    },
    recordIds: {
      rentPaymentIds: payments.map((item) => item.id),
      accountingLedgerEntryIds: ledgerEntries.map((item) => item.id),
      vendorInvoiceIds: vendorInvoices.map((item) => item.id),
      ownerPayoutBatchIds: ownerPayouts.map((item) => item.id),
      ownerPayoutLineIds: ownerPayouts.flatMap((item) => item.lines.map((line) => line.id)),
      ownerPayoutReconciliationItemIds: ownerPayouts.flatMap((item) => item.reconciliationItems.map((reconciliation) => reconciliation.id)),
      reconciliationItemIds: reconciliationItems.map((item) => item.id),
      securityDepositTransactionIds: depositTransactions.map((item) => item.id),
    },
  } satisfies Prisma.InputJsonObject;

  return {
    snapshot,
    snapshotHash: hashFinancialPeriodCloseSnapshot(snapshot),
  };
}
