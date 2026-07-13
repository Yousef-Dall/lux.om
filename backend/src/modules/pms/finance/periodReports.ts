import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../../utils/http';
import { hashFinancialPeriodCloseSnapshot } from './periodClose';

const countAmountSchema = z.object({
  count: z.number().int().nonnegative(),
  amount: z.string(),
}).strict();

const groupedCountAmountSchema = z.object({
  key: z.string(),
  count: z.number().int().nonnegative(),
  amount: z.string(),
}).strict();

const readinessSchema = z.object({
  canClose: z.boolean(),
  blockerTotal: z.number().int().nonnegative(),
  reconciliationExceptions: z.number().int().nonnegative(),
  pendingDepositTransactions: z.number().int().nonnegative(),
  unallocatedPayments: z.number().int().nonnegative(),
  unallocatedAmount: z.string(),
  unreconciledRentPayments: z.number().int().nonnegative(),
  unreconciledVendorPayments: z.number().int().nonnegative(),
  unreconciledOwnerPayouts: z.number().int().nonnegative(),
}).strict();

export const financialPeriodCloseSnapshotV1Schema = z.object({
  snapshotVersion: z.literal(1),
  generatedAt: z.string().min(1),
  period: z.object({
    id: z.string().nullable(),
    companyId: z.string(),
    propertyId: z.string().nullable(),
    currency: z.string().length(3),
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
  }).strict(),
  review: z.object({
    eventId: z.string(),
    reason: z.string().nullable(),
    reviewedAt: z.string().min(1),
    reviewedById: z.string(),
  }).strict(),
  close: z.object({
    reason: z.string(),
    closedAt: z.string().min(1),
    closedById: z.string(),
  }).strict(),
  readiness: readinessSchema,
  totals: z.object({
    rentPayments: countAmountSchema,
    accountingLedgerByType: z.array(groupedCountAmountSchema),
    accountingLedgerBySource: z.array(groupedCountAmountSchema),
    paidVendorInvoices: countAmountSchema,
    paidOwnerPayouts: countAmountSchema,
    reconciliation: z.array(groupedCountAmountSchema),
    postedDepositTransactions: z.array(groupedCountAmountSchema),
  }).strict(),
  recordIds: z.object({
    rentPaymentIds: z.array(z.string()),
    accountingLedgerEntryIds: z.array(z.string()),
    vendorInvoiceIds: z.array(z.string()),
    ownerPayoutBatchIds: z.array(z.string()),
    ownerPayoutLineIds: z.array(z.string()),
    ownerPayoutReconciliationItemIds: z.array(z.string()),
    reconciliationItemIds: z.array(z.string()),
    securityDepositTransactionIds: z.array(z.string()),
  }).strict(),
}).strict();

export type FinancialPeriodCloseSnapshotV1 = z.infer<typeof financialPeriodCloseSnapshotV1Schema>;
export type FinancialPeriodCloseIntegrityStatus = 'VERIFIED' | 'HASH_MISMATCH' | 'UNSUPPORTED_VERSION' | 'INVALID_SNAPSHOT';

export type FinancialPeriodCloseReportInput = {
  id: string;
  revision: number;
  snapshot: Prisma.JsonValue;
  snapshotHash: string;
  snapshotVersion: number;
  reviewEventId: string;
  reviewReason: string;
  closeReason: string;
  reviewedAt: Date;
  closedAt: Date;
  reopenedAt: Date | null;
  reopenReason: string | null;
  createdAt: Date;
  reviewedBy: { id: string; name: string };
  closedBy: { id: string; name: string };
  reopenedBy: { id: string; name: string } | null;
  period: {
    id: string;
    status: string;
    periodStart: Date;
    periodEnd: Date;
    currency: string;
    propertyId: string | null;
    property: { id: string; name: string } | null;
  };
};

function snapshotVersionOf(snapshot: Prisma.JsonValue) {
  if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object') return null;
  const version = (snapshot as Prisma.JsonObject).snapshotVersion;
  return typeof version === 'number' ? version : null;
}

export function buildFinancialPeriodCloseReport(close: FinancialPeriodCloseReportInput) {
  const computedHash = hashFinancialPeriodCloseSnapshot(close.snapshot as Prisma.InputJsonValue);
  const parsed = financialPeriodCloseSnapshotV1Schema.safeParse(close.snapshot);
  const embeddedVersion = snapshotVersionOf(close.snapshot);

  let status: FinancialPeriodCloseIntegrityStatus;
  let message: string;
  if (computedHash !== close.snapshotHash) {
    status = 'HASH_MISMATCH';
    message = 'The stored close-pack hash does not match its immutable snapshot.';
  } else if (close.snapshotVersion !== 1 || embeddedVersion !== 1) {
    status = 'UNSUPPORTED_VERSION';
    message = `Snapshot version ${close.snapshotVersion} is not supported by this report renderer.`;
  } else if (!parsed.success) {
    status = 'INVALID_SNAPSHOT';
    message = 'The close-pack snapshot does not satisfy the supported evidence contract.';
  } else {
    status = 'VERIFIED';
    message = 'The snapshot hash and supported evidence contract are verified.';
  }

  return {
    close: {
      id: close.id,
      revision: close.revision,
      reviewEventId: close.reviewEventId,
      reviewReason: close.reviewReason,
      closeReason: close.closeReason,
      reviewedAt: close.reviewedAt,
      closedAt: close.closedAt,
      reopenedAt: close.reopenedAt,
      reopenReason: close.reopenReason,
      createdAt: close.createdAt,
      reviewedBy: close.reviewedBy,
      closedBy: close.closedBy,
      reopenedBy: close.reopenedBy,
    },
    period: close.period,
    integrity: {
      status,
      message,
      snapshotVersion: close.snapshotVersion,
      storedHash: close.snapshotHash,
      computedHash,
    },
    snapshot: parsed.success ? parsed.data : null,
    rawSnapshot: close.snapshot,
  };
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  const spreadsheetSafe = /^[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`;
}

export function financialPeriodCloseReportFilename(report: ReturnType<typeof buildFinancialPeriodCloseReport>, extension: 'csv' | 'json') {
  const date = report.period.periodStart.toISOString().slice(0, 10);
  const scope = report.period.property?.name ?? 'company-wide';
  const safeScope = scope.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scope';
  return `pms-close-report-${date}-${report.period.currency.toLowerCase()}-${safeScope}-r${report.close.revision}.${extension}`;
}

export function financialPeriodCloseReportCsv(report: ReturnType<typeof buildFinancialPeriodCloseReport>) {
  if (report.integrity.status !== 'VERIFIED' || !report.snapshot) {
    throw new AppError(409, 'Close-pack integrity verification failed; evidence export is blocked.');
  }

  const { snapshot } = report;
  const rows: unknown[][] = [
    ['section', 'key', 'count', 'amount', 'currency', 'details'],
    ['integrity', 'status', '', '', report.period.currency, report.integrity.status],
    ['integrity', 'snapshotVersion', report.integrity.snapshotVersion, '', report.period.currency, ''],
    ['integrity', 'storedHash', '', '', report.period.currency, report.integrity.storedHash],
    ['integrity', 'computedHash', '', '', report.period.currency, report.integrity.computedHash],
    ['period', 'periodId', '', '', report.period.currency, report.period.id],
    ['period', 'propertyId', '', '', report.period.currency, report.period.propertyId ?? ''],
    ['period', 'scope', '', '', report.period.currency, report.period.property?.name ?? 'Company-wide'],
    ['period', 'periodStart', '', '', report.period.currency, report.period.periodStart.toISOString()],
    ['period', 'periodEnd', '', '', report.period.currency, report.period.periodEnd.toISOString()],
    ['close', 'revision', report.close.revision, '', report.period.currency, report.close.closeReason],
    ['close', 'reviewEventId', '', '', report.period.currency, report.close.reviewEventId],
    ['close', 'reviewReason', '', '', report.period.currency, report.close.reviewReason],
    ['close', 'reviewedBy', '', '', report.period.currency, report.close.reviewedBy.name],
    ['close', 'reviewedAt', '', '', report.period.currency, report.close.reviewedAt.toISOString()],
    ['close', 'closedBy', '', '', report.period.currency, report.close.closedBy.name],
    ['close', 'closedAt', '', '', report.period.currency, report.close.closedAt.toISOString()],
    ['close', 'reopenedAt', '', '', report.period.currency, report.close.reopenedAt?.toISOString() ?? ''],
    ['close', 'reopenReason', '', '', report.period.currency, report.close.reopenReason ?? ''],
    ['snapshot', 'generatedAt', '', '', report.period.currency, snapshot.generatedAt],
    ['readiness', 'canClose', '', '', report.period.currency, snapshot.readiness.canClose],
    ['readiness', 'blockerTotal', snapshot.readiness.blockerTotal, '', report.period.currency, ''],
    ['readiness', 'reconciliationExceptions', snapshot.readiness.reconciliationExceptions, '', report.period.currency, ''],
    ['readiness', 'pendingDepositTransactions', snapshot.readiness.pendingDepositTransactions, '', report.period.currency, ''],
    ['readiness', 'unallocatedPayments', snapshot.readiness.unallocatedPayments, snapshot.readiness.unallocatedAmount, report.period.currency, ''],
    ['readiness', 'unreconciledRentPayments', snapshot.readiness.unreconciledRentPayments, '', report.period.currency, ''],
    ['readiness', 'unreconciledVendorPayments', snapshot.readiness.unreconciledVendorPayments, '', report.period.currency, ''],
    ['readiness', 'unreconciledOwnerPayouts', snapshot.readiness.unreconciledOwnerPayouts, '', report.period.currency, ''],
    ['total', 'rentPayments', snapshot.totals.rentPayments.count, snapshot.totals.rentPayments.amount, report.period.currency, ''],
    ['total', 'paidVendorInvoices', snapshot.totals.paidVendorInvoices.count, snapshot.totals.paidVendorInvoices.amount, report.period.currency, ''],
    ['total', 'paidOwnerPayouts', snapshot.totals.paidOwnerPayouts.count, snapshot.totals.paidOwnerPayouts.amount, report.period.currency, ''],
    ...snapshot.totals.accountingLedgerByType.map((row) => ['ledgerType', row.key, row.count, row.amount, report.period.currency, '']),
    ...snapshot.totals.accountingLedgerBySource.map((row) => ['ledgerSource', row.key, row.count, row.amount, report.period.currency, '']),
    ...snapshot.totals.reconciliation.map((row) => ['reconciliation', row.key, row.count, row.amount, report.period.currency, '']),
    ...snapshot.totals.postedDepositTransactions.map((row) => ['deposit', row.key, row.count, row.amount, report.period.currency, '']),
  ];

  const recordGroups: Array<[string, string[]]> = [
    ['rentPayment', snapshot.recordIds.rentPaymentIds],
    ['accountingLedgerEntry', snapshot.recordIds.accountingLedgerEntryIds],
    ['vendorInvoice', snapshot.recordIds.vendorInvoiceIds],
    ['ownerPayoutBatch', snapshot.recordIds.ownerPayoutBatchIds],
    ['ownerPayoutLine', snapshot.recordIds.ownerPayoutLineIds],
    ['ownerPayoutReconciliationItem', snapshot.recordIds.ownerPayoutReconciliationItemIds],
    ['reconciliationItem', snapshot.recordIds.reconciliationItemIds],
    ['securityDepositTransaction', snapshot.recordIds.securityDepositTransactionIds],
  ];
  for (const [recordType, ids] of recordGroups) {
    rows.push(['recordCount', recordType, ids.length, '', report.period.currency, '']);
    for (const id of ids) rows.push(['recordId', recordType, '', '', report.period.currency, id]);
  }

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
