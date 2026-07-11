import { Prisma, type PmsChargeStatus } from '@prisma/client';

import { prisma } from '../../../lib/prisma';
import { AppError } from '../../../utils/http';
import { assertFinancialPeriodOpen } from './periods';
import { assertPositiveMoney, assertSameCurrency, money, ZERO } from './money';

const ACTIVE_ALLOCATION_STATUS = 'ACTIVE' as const;
const POSTED_ADJUSTMENT_STATUS = 'POSTED' as const;

function isSerializableConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  if (error.code !== 'P2010') return false;
  const meta = error.meta as { code?: unknown; message?: unknown } | undefined;
  return meta?.code === '40001' || String(meta?.message ?? '').includes('could not serialize access');
}

export type FinanceTransaction = Prisma.TransactionClient;

export async function lockFinanceRows(
  tx: FinanceTransaction,
  table: 'PmsCharge' | 'PmsRentPayment' | 'PmsSecurityDepositAccount',
  ids: string[],
) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return;
  if (table === 'PmsCharge') {
    await tx.$queryRaw`SELECT id FROM "PmsCharge" WHERE id IN (${Prisma.join(uniqueIds)}) FOR UPDATE`;
  } else if (table === 'PmsRentPayment') {
    await tx.$queryRaw`SELECT id FROM "PmsRentPayment" WHERE id IN (${Prisma.join(uniqueIds)}) FOR UPDATE`;
  } else {
    await tx.$queryRaw`SELECT id FROM "PmsSecurityDepositAccount" WHERE id IN (${Prisma.join(uniqueIds)}) FOR UPDATE`;
  }
}

export async function recomputeCharge(tx: FinanceTransaction, chargeId: string) {
  const charge = await tx.pmsCharge.findUnique({
    where: { id: chargeId },
    include: {
      lines: { select: { amount: true } },
      adjustments: { where: { active: true }, select: { amount: true } },
      creditNotes: { where: { status: 'APPLIED' }, select: { amount: true } },
      allocations: { where: { status: ACTIVE_ALLOCATION_STATUS }, select: { amount: true } },
      securityDepositTransactions: { where: { status: 'POSTED', type: 'CONVERSION_TO_INCOME' }, select: { amount: true } },
    },
  });
  if (!charge) throw new AppError(404, 'Charge not found.');

  const subtotal = charge.lines.reduce((sum, line) => sum.plus(line.amount), ZERO);
  const adjustmentTotal = charge.adjustments.reduce((sum, item) => sum.plus(item.amount), ZERO);
  const creditedAmount = charge.creditNotes.reduce((sum, item) => sum.plus(item.amount), ZERO);
  const allocatedAmount = charge.allocations.reduce((sum, item) => sum.plus(item.amount), ZERO);
  const depositConversionAmount = charge.securityDepositTransactions.reduce((sum, item) => sum.plus(item.amount), ZERO);
  const paidAmount = allocatedAmount.plus(depositConversionAmount);
  const totalAmount = Prisma.Decimal.max(ZERO, subtotal.plus(adjustmentTotal));
  const balanceAmount = Prisma.Decimal.max(ZERO, totalAmount.minus(creditedAmount).minus(paidAmount));

  let status: PmsChargeStatus = charge.status;
  if (charge.status !== 'DRAFT' && charge.status !== 'VOID') {
    status = balanceAmount.isZero()
      ? 'PAID'
      : paidAmount.plus(creditedAmount).isPositive()
        ? 'PARTIALLY_PAID'
        : 'ISSUED';
  }

  return tx.pmsCharge.update({
    where: { id: chargeId },
    data: { subtotal, adjustmentTotal, creditedAmount, paidAmount, totalAmount, balanceAmount, status },
    include: {
      lines: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      adjustments: { orderBy: { createdAt: 'asc' } },
      allocations: { orderBy: { createdAt: 'asc' } },
      creditNotes: { orderBy: { createdAt: 'asc' } },
    },
  });
}

export async function getPaymentAvailability(tx: FinanceTransaction, paymentId: string) {
  const payment = await tx.pmsRentPayment.findUnique({
    where: { id: paymentId },
    include: {
      allocations: { where: { status: ACTIVE_ALLOCATION_STATUS }, select: { amount: true } },
      adjustments: { where: { status: POSTED_ADJUSTMENT_STATUS }, select: { amount: true, type: true } },
      securityDepositTransactions: {
        where: { status: 'POSTED', type: 'COLLECTION' },
        select: { amount: true },
      },
    },
  });
  if (!payment) throw new AppError(404, 'Payment not found.');
  const allocated = payment.allocations.reduce((sum, item) => sum.plus(item.amount), ZERO);
  const paymentReductions = payment.adjustments.reduce((sum, item) => sum.plus(item.amount), ZERO);
  const depositAllocated = payment.securityDepositTransactions.reduce((sum, item) => sum.plus(item.amount), ZERO);
  const effectiveAmount = Prisma.Decimal.max(ZERO, payment.amount.minus(paymentReductions));
  return {
    payment,
    allocated,
    paymentReductions,
    depositAllocated,
    effectiveAmount,
    available: Prisma.Decimal.max(ZERO, effectiveAmount.minus(allocated).minus(depositAllocated)),
  };
}

export async function allocatePayment(input: {
  companyId: string;
  paymentId: string;
  chargeId: string;
  amount: Prisma.Decimal.Value;
  idempotencyKey: string;
  actorId: string;
}) {
  const requestedAmount = assertPositiveMoney(input.amount);
  try {
    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.pmsPaymentAllocation.findUnique({
          where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } },
          include: { charge: true, payment: true },
        });
        if (existing) return { allocation: existing, idempotent: true };

        await lockFinanceRows(tx, 'PmsRentPayment', [input.paymentId]);
        await lockFinanceRows(tx, 'PmsCharge', [input.chargeId]);

        const [availability, charge] = await Promise.all([
          getPaymentAvailability(tx, input.paymentId),
          recomputeCharge(tx, input.chargeId),
        ]);
        if (availability.payment.companyId !== input.companyId || charge.companyId !== input.companyId) {
          throw new AppError(404, 'Payment or charge not found.');
        }
        if (availability.payment.status !== 'CONFIRMED') {
          throw new AppError(409, 'Only confirmed payments can be allocated.');
        }
        if (charge.status === 'DRAFT' || charge.status === 'VOID') {
          throw new AppError(409, 'Only issued charges can receive allocations.');
        }
        assertSameCurrency(availability.payment.currency, charge.currency);
        if (requestedAmount.greaterThan(availability.available)) {
          throw new AppError(409, 'Allocation exceeds the payment available balance.');
        }
        if (requestedAmount.greaterThan(charge.balanceAmount)) {
          throw new AppError(409, 'Allocation exceeds the charge outstanding balance.');
        }
        await assertFinancialPeriodOpen(tx, {
          companyId: input.companyId,
          propertyId: charge.propertyId,
          currency: charge.currency,
          transactionDate: availability.payment.paidAt ?? availability.payment.createdAt,
        });

        const allocation = await tx.pmsPaymentAllocation.create({
          data: {
            companyId: input.companyId,
            paymentId: input.paymentId,
            chargeId: input.chargeId,
            amount: requestedAmount,
            currency: charge.currency,
            idempotencyKey: input.idempotencyKey,
            createdById: input.actorId,
          },
          include: { charge: true, payment: true },
        });
        await recomputeCharge(tx, input.chargeId);
        return { allocation, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.pmsPaymentAllocation.findUnique({
        where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } },
        include: { charge: true, payment: true },
      });
      if (existing) return { allocation: existing, idempotent: true };
    }
    if (isSerializableConflict(error)) {
      throw new AppError(409, 'The payment changed concurrently. Retry the allocation.');
    }
    throw error;
  }
}

export async function reverseAllocation(input: {
  companyId: string;
  allocationId: string;
  reason: string;
  actorId: string;
}) {
  return prisma.$transaction(
    async (tx) => {
      const allocation = await tx.pmsPaymentAllocation.findFirst({
        where: { id: input.allocationId, companyId: input.companyId },
      });
      if (!allocation) throw new AppError(404, 'Allocation not found.');
      if (allocation.status === 'REVERSED') return allocation;
      await lockFinanceRows(tx, 'PmsRentPayment', [allocation.paymentId]);
      await lockFinanceRows(tx, 'PmsCharge', [allocation.chargeId]);
      const charge = await tx.pmsCharge.findUniqueOrThrow({ where: { id: allocation.chargeId } });
      await assertFinancialPeriodOpen(tx, {
        companyId: input.companyId,
        propertyId: charge.propertyId,
        currency: allocation.currency,
        transactionDate: new Date(),
      });
      const updated = await tx.pmsPaymentAllocation.update({
        where: { id: allocation.id },
        data: {
          status: 'REVERSED',
          reversedAt: new Date(),
          reversalReason: input.reason,
          reversedById: input.actorId,
        },
      });
      await recomputeCharge(tx, allocation.chargeId);
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function postPaymentAdjustment(input: {
  companyId: string;
  paymentId: string;
  allocationId?: string | null;
  type: 'REFUND' | 'REVERSAL' | 'CHARGEBACK' | 'WRITE_OFF';
  amount: Prisma.Decimal.Value;
  reason: string;
  idempotencyKey: string;
  referenceNumber?: string | null;
  actorId: string;
}) {
  const amount = assertPositiveMoney(input.amount);
  try {
    return await prisma.$transaction(
      async (tx) => {
      const existing = await tx.pmsPaymentAdjustment.findUnique({
        where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) return { adjustment: existing, idempotent: true };
      await lockFinanceRows(tx, 'PmsRentPayment', [input.paymentId]);
      const availability = await getPaymentAvailability(tx, input.paymentId);
      if (availability.payment.companyId !== input.companyId) throw new AppError(404, 'Payment not found.');
      if (input.allocationId) {
        const allocation = await tx.pmsPaymentAllocation.findFirst({
          where: { id: input.allocationId, companyId: input.companyId, paymentId: input.paymentId },
        });
        if (!allocation) throw new AppError(400, 'Allocation does not belong to this payment.');
      }
      if (amount.greaterThan(availability.available)) {
        throw new AppError(409, 'Reverse active allocations or deposit collections before reducing the remaining payment value.');
      }
      await assertFinancialPeriodOpen(tx, {
        companyId: input.companyId,
        propertyId: availability.payment.propertyId,
        currency: availability.payment.currency,
        transactionDate: new Date(),
      });
      const adjustment = await tx.pmsPaymentAdjustment.create({
        data: {
          companyId: input.companyId,
          paymentId: input.paymentId,
          allocationId: input.allocationId ?? null,
          type: input.type,
          amount,
          currency: availability.payment.currency,
          reason: input.reason,
          idempotencyKey: input.idempotencyKey,
          referenceNumber: input.referenceNumber ?? null,
          createdById: input.actorId,
        },
      });
      return { adjustment, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.pmsPaymentAdjustment.findUnique({
        where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) return { adjustment: existing, idempotent: true };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new AppError(409, 'The payment changed concurrently. Retry the adjustment.');
    }
    throw error;
  }
}

export async function recomputeDepositAccount(tx: FinanceTransaction, accountId: string) {
  const account = await tx.pmsSecurityDepositAccount.findUnique({
    where: { id: accountId },
    include: { transactions: { where: { status: 'POSTED' }, select: { type: true, amount: true } } },
  });
  if (!account) throw new AppError(404, 'Security deposit account not found.');
  const liability = account.transactions.reduce((sum, transaction) => {
    if (transaction.type === 'COLLECTION' || transaction.type === 'ADJUSTMENT') return sum.plus(transaction.amount);
    return sum.minus(transaction.amount);
  }, ZERO);
  if (liability.isNegative()) throw new AppError(409, 'Deposit transaction would create a negative liability balance.');
  const status = liability.isZero()
    ? account.transactions.some((item) => item.type === 'REFUND')
      ? 'REFUNDED'
      : 'EXPECTED'
    : liability.lessThan(account.expectedAmount)
      ? 'PARTIALLY_REFUNDED'
      : 'HELD';
  return tx.pmsSecurityDepositAccount.update({
    where: { id: account.id },
    data: { liabilityBalance: liability, status },
  });
}

export async function postDepositTransaction(input: {
  companyId: string;
  accountId: string;
  type: 'COLLECTION' | 'DEDUCTION' | 'REFUND' | 'CONVERSION_TO_INCOME' | 'ADJUSTMENT';
  amount: Prisma.Decimal.Value;
  reason?: string | null;
  idempotencyKey: string;
  paymentId?: string | null;
  chargeId?: string | null;
  actorId: string;
}) {
  const amount = assertPositiveMoney(input.amount);
  const requiresApproval = input.type === 'DEDUCTION' || input.type === 'REFUND' || input.type === 'CONVERSION_TO_INCOME';
  if (input.type === 'CONVERSION_TO_INCOME' && !input.chargeId) {
    throw new AppError(400, 'Deposit conversion to income requires an approved linked charge.');
  }
  try {
    return await prisma.$transaction(
      async (tx) => {
        const existing = await tx.pmsSecurityDepositTransaction.findUnique({
          where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } },
        });
        if (existing) return { transaction: existing, idempotent: true };
        await lockFinanceRows(tx, 'PmsSecurityDepositAccount', [input.accountId]);
        if (input.paymentId) await lockFinanceRows(tx, 'PmsRentPayment', [input.paymentId]);
        const account = await recomputeDepositAccount(tx, input.accountId);
        if (account.companyId !== input.companyId) throw new AppError(404, 'Security deposit account not found.');
        if (input.type !== 'COLLECTION' && amount.greaterThan(account.liabilityBalance)) {
          throw new AppError(409, 'Deposit deduction or refund exceeds the held liability balance.');
        }
        if (input.paymentId) {
          if (input.type !== 'COLLECTION') {
            throw new AppError(400, 'Only a deposit collection may reference an incoming payment.');
          }
          const availability = await getPaymentAvailability(tx, input.paymentId);
          const payment = availability.payment;
          if (payment.companyId !== input.companyId || payment.status !== 'CONFIRMED') {
            throw new AppError(400, 'Confirmed deposit payment not found.');
          }
          if (
            payment.propertyId !== account.propertyId ||
            payment.unitId !== account.unitId ||
            payment.leaseId !== account.leaseId ||
            payment.tenantId !== account.tenantId
          ) {
            throw new AppError(400, 'Deposit payment scope does not match the deposit account.');
          }
          assertSameCurrency(payment.currency, account.currency);
          if (amount.greaterThan(availability.available)) {
            throw new AppError(409, 'Deposit collection exceeds the payment available balance.');
          }
        }
        if (input.chargeId) {
          const charge = await tx.pmsCharge.findFirst({ where: { id: input.chargeId, companyId: input.companyId, propertyId: account.propertyId } });
          if (!charge || charge.status === 'DRAFT' || charge.status === 'VOID') throw new AppError(400, 'Deposit deduction charge must be an issued charge for this property.');
          assertSameCurrency(charge.currency, account.currency);
        }
        if (!requiresApproval) {
          await assertFinancialPeriodOpen(tx, {
            companyId: input.companyId,
            propertyId: account.propertyId,
            currency: account.currency,
            transactionDate: new Date(),
          });
        }
        const now = new Date();
        const transaction = await tx.pmsSecurityDepositTransaction.create({
          data: {
            companyId: input.companyId,
            accountId: account.id,
            type: input.type,
            status: requiresApproval ? 'PENDING_APPROVAL' : 'POSTED',
            amount,
            currency: account.currency,
            reason: input.reason ?? null,
            idempotencyKey: input.idempotencyKey,
            paymentId: input.paymentId ?? null,
            chargeId: input.chargeId ?? null,
            createdById: input.actorId,
            ...(!requiresApproval ? { approvedById: input.actorId, approvedAt: now, postedAt: now } : {}),
          },
        });
        if (!requiresApproval) {
          await createDepositLedgerEntry(tx, transaction, account, input.actorId);
          await recomputeDepositAccount(tx, account.id);
        }
        return { transaction, idempotent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.pmsSecurityDepositTransaction.findUnique({
        where: { companyId_idempotencyKey: { companyId: input.companyId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) return { transaction: existing, idempotent: true };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new AppError(409, 'The security-deposit balance changed concurrently. Retry the request.');
    }
    throw error;
  }
}

async function createDepositLedgerEntry(
  tx: FinanceTransaction,
  transaction: {
    id: string;
    type: 'COLLECTION' | 'DEDUCTION' | 'REFUND' | 'CONVERSION_TO_INCOME' | 'ADJUSTMENT';
    amount: Prisma.Decimal;
    currency: string;
    chargeId: string | null;
    paymentId: string | null;
    reason: string | null;
  },
  account: {
    companyId: string;
    propertyId: string;
    unitId: string;
    leaseId: string;
    tenantId: string;
  },
  actorId: string,
) {
  const type = transaction.type === 'COLLECTION'
    ? 'DEPOSIT'
    : transaction.type === 'REFUND'
      ? 'REFUND'
      : transaction.type === 'CONVERSION_TO_INCOME'
        ? 'INCOME'
        : 'ADJUSTMENT';
  await tx.pmsAccountingLedgerEntry.create({
    data: {
      companyId: account.companyId,
      propertyId: account.propertyId,
      unitId: account.unitId,
      leaseId: account.leaseId,
      tenantId: account.tenantId,
      chargeId: transaction.chargeId,
      rentPaymentId: transaction.paymentId,
      securityDepositTransactionId: transaction.id,
      type,
      source: 'SECURITY_DEPOSIT',
      category: transaction.type === 'CONVERSION_TO_INCOME' ? 'Approved security deposit conversion' : `Security deposit ${transaction.type.toLowerCase().replaceAll('_', ' ')}`,
      amount: transaction.amount,
      currency: transaction.currency,
      transactionDate: new Date(),
      notes: transaction.reason,
      createdById: actorId,
      updatedById: actorId,
    },
  });
}

export async function transitionDepositTransaction(input: {
  companyId: string;
  accountId: string;
  transactionId: string;
  action: 'APPROVE' | 'POST' | 'VOID';
  reason?: string | null;
  actorId: string;
}) {
  try {
    return await prisma.$transaction(
    async (tx) => {
      await lockFinanceRows(tx, 'PmsSecurityDepositAccount', [input.accountId]);
      const current = await tx.pmsSecurityDepositTransaction.findFirst({
        where: { id: input.transactionId, accountId: input.accountId, companyId: input.companyId },
      });
      if (!current) throw new AppError(404, 'Security deposit transaction not found.');
      const account = await recomputeDepositAccount(tx, input.accountId);
      if (input.action === 'APPROVE') {
        if (current.status !== 'PENDING_APPROVAL') throw new AppError(409, 'Only pending deposit transactions can be approved.');
        return tx.pmsSecurityDepositTransaction.update({
          where: { id: current.id },
          data: { status: 'APPROVED', approvedAt: new Date(), approvedById: input.actorId, reason: input.reason ?? current.reason },
        });
      }
      if (input.action === 'VOID') {
        if (current.status === 'POSTED') throw new AppError(409, 'Posted deposit transactions require a reversing transaction.');
        if (current.status === 'VOID') return current;
        return tx.pmsSecurityDepositTransaction.update({
          where: { id: current.id },
          data: { status: 'VOID', voidedAt: new Date(), reason: input.reason ?? current.reason },
        });
      }
      if (current.status !== 'APPROVED') throw new AppError(409, 'Only approved deposit transactions can be posted.');
      if (current.type !== 'COLLECTION' && current.amount.greaterThan(account.liabilityBalance)) {
        throw new AppError(409, 'Deposit deduction or refund exceeds the current held liability balance.');
      }
      let linkedChargeId: string | null = null;
      if (current.type === 'CONVERSION_TO_INCOME') {
        if (!current.chargeId) throw new AppError(409, 'Deposit conversion requires a linked issued charge.');
        linkedChargeId = current.chargeId;
        await lockFinanceRows(tx, 'PmsCharge', [linkedChargeId]);
        const charge = await recomputeCharge(tx, linkedChargeId);
        if (charge.companyId !== input.companyId || charge.propertyId !== account.propertyId || charge.currency !== account.currency || charge.status === 'DRAFT' || charge.status === 'VOID') {
          throw new AppError(409, 'Linked deposit charge is no longer eligible for conversion.');
        }
        if (current.amount.greaterThan(charge.balanceAmount)) {
          throw new AppError(409, 'Deposit conversion exceeds the linked charge outstanding balance.');
        }
      }
      await assertFinancialPeriodOpen(tx, {
        companyId: input.companyId,
        propertyId: account.propertyId,
        currency: account.currency,
        transactionDate: new Date(),
      });
      const posted = await tx.pmsSecurityDepositTransaction.update({
        where: { id: current.id },
        data: { status: 'POSTED', postedAt: new Date(), reason: input.reason ?? current.reason },
      });
      await createDepositLedgerEntry(tx, posted, account, input.actorId);
      await recomputeDepositAccount(tx, account.id);
      if (linkedChargeId) await recomputeCharge(tx, linkedChargeId);
      return posted;
    },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new AppError(409, 'The security-deposit transaction changed concurrently. Retry the request.');
    }
    throw error;
  }
}

export function paymentBalanceResponse(input: Awaited<ReturnType<typeof getPaymentAvailability>>) {
  return {
    paymentId: input.payment.id,
    currency: input.payment.currency,
    receivedAmount: money(input.payment.amount).toString(),
    allocatedAmount: money(input.allocated).toString(),
    adjustedAmount: money(input.paymentReductions).toString(),
    refundedOrChargedBackAmount: money(input.paymentReductions).toString(),
    depositAllocatedAmount: money(input.depositAllocated).toString(),
    availableAmount: money(input.available).toString(),
  };
}
