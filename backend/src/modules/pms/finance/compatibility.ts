import {
  PmsChargeStatus,
  PmsRentDueStatus,
  PmsRentPaymentStatus,
  Prisma,
} from '@prisma/client';

import { AppError } from '../../../utils/http';
import { assertSameCurrency, money, ZERO } from './money';
import { recomputeCharge, type FinanceTransaction } from './service';

export type LegacyRentDueSnapshot = {
  id: string;
  companyId: string;
  propertyId: string;
  unitId: string;
  leaseId: string;
  tenantId: string;
  amount: Prisma.Decimal.Value;
  paidAmount: Prisma.Decimal.Value;
  currency: string;
  dueDate: Date;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  status: PmsRentDueStatus;
  notes?: string | null;
  createdById?: string | null;
};

export type LegacyRentPaymentSnapshot = {
  id: string;
  companyId: string;
  rentDueItemId?: string | null;
  amount: Prisma.Decimal.Value;
  currency: string;
  status: PmsRentPaymentStatus;
  recordedById?: string | null;
};

function legacyChargeStatus(status: PmsRentDueStatus): PmsChargeStatus {
  if (status === PmsRentDueStatus.CANCELLED) return PmsChargeStatus.VOID;
  if (status === PmsRentDueStatus.PAID) return PmsChargeStatus.PAID;
  if (status === PmsRentDueStatus.PARTIALLY_PAID) return PmsChargeStatus.PARTIALLY_PAID;
  return PmsChargeStatus.ISSUED;
}

/**
 * Compatibility adapter for the legacy rent schedule. The deterministic source
 * relation and charge number make retries safe and keep the public rent URLs
 * unchanged while the structured charge subledger becomes authoritative.
 */
export async function ensureRentDueStructuredCharge(
  tx: FinanceTransaction,
  rentDueItem: LegacyRentDueSnapshot,
  actorId?: string | null,
) {
  const existing = await tx.pmsCharge.findUnique({
    where: { sourceRentDueItemId: rentDueItem.id },
  });
  if (existing) return existing;

  const amount = money(rentDueItem.amount);
  const paidAmount = money(rentDueItem.paidAmount);
  const status = legacyChargeStatus(rentDueItem.status);
  const chargeNumber = `RENT-${rentDueItem.id}`;

  try {
    // Create as a draft so the database immutability trigger permits the
    // initial nested line insert. Transitioning from DRAFT to the legacy
    // financial state in the same transaction preserves issued history while
    // preventing any later line mutation.
    const created = await tx.pmsCharge.create({
      data: {
        companyId: rentDueItem.companyId,
        propertyId: rentDueItem.propertyId,
        unitId: rentDueItem.unitId,
        leaseId: rentDueItem.leaseId,
        tenantId: rentDueItem.tenantId,
        sourceRentDueItemId: rentDueItem.id,
        chargeNumber,
        status: PmsChargeStatus.DRAFT,
        currency: rentDueItem.currency,
        dueDate: rentDueItem.dueDate,
        servicePeriodStart: rentDueItem.periodStart ?? null,
        servicePeriodEnd: rentDueItem.periodEnd ?? null,
        subtotal: amount,
        totalAmount: amount,
        paidAmount,
        balanceAmount: Prisma.Decimal.max(ZERO, amount.minus(paidAmount)),
        notes: rentDueItem.notes ?? null,
        createdById: actorId ?? rentDueItem.createdById ?? null,
        lines: {
          create: {
            companyId: rentDueItem.companyId,
            category: 'RENT',
            description: `Rent due ${rentDueItem.dueDate.toISOString().slice(0, 10)}`,
            quantity: 1,
            unitAmount: amount,
            amount,
            position: 0,
            servicePeriodStart: rentDueItem.periodStart ?? null,
            servicePeriodEnd: rentDueItem.periodEnd ?? null,
            metadata: {
              compatibilitySource: 'PmsRentDueItem',
              rentDueItemId: rentDueItem.id,
            },
          },
        },
      },
    });

    return tx.pmsCharge.update({
      where: { id: created.id },
      data: {
        status,
        issuedAt: status === PmsChargeStatus.VOID ? null : new Date(),
        voidedAt: status === PmsChargeStatus.VOID ? new Date() : null,
        voidReason: status === PmsChargeStatus.VOID ? 'Legacy rent due item was cancelled.' : null,
        issuedById: status === PmsChargeStatus.VOID ? null : actorId ?? rentDueItem.createdById ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return tx.pmsCharge.findUniqueOrThrow({ where: { sourceRentDueItemId: rentDueItem.id } });
    }
    throw error;
  }
}

/** Allocate a confirmed legacy rent payment to its structured rent charge. */
export async function allocateLegacyRentPayment(
  tx: FinanceTransaction,
  input: {
    payment: LegacyRentPaymentSnapshot;
    chargeId: string;
    actorId?: string | null;
  },
) {
  if (input.payment.status !== PmsRentPaymentStatus.CONFIRMED) {
    throw new AppError(409, 'Only confirmed legacy rent payments can be allocated.');
  }
  if (!input.payment.rentDueItemId) {
    throw new AppError(400, 'Legacy rent allocation requires a rent due item.');
  }

  const idempotencyKey = `legacy-rent-payment:${input.payment.id}`;
  const existing = await tx.pmsPaymentAllocation.findUnique({
    where: {
      companyId_idempotencyKey: {
        companyId: input.payment.companyId,
        idempotencyKey,
      },
    },
  });
  if (existing) return existing;

  const charge = await tx.pmsCharge.findUnique({ where: { id: input.chargeId } });
  if (!charge || charge.companyId !== input.payment.companyId) {
    throw new AppError(404, 'Structured rent charge not found.');
  }
  assertSameCurrency(input.payment.currency, charge.currency);

  const requested = money(input.payment.amount);
  const refreshed = await recomputeCharge(tx, charge.id);
  if (requested.greaterThan(refreshed.balanceAmount)) {
    throw new AppError(409, 'Legacy rent payment exceeds the structured charge balance.');
  }

  const allocation = await tx.pmsPaymentAllocation.create({
    data: {
      companyId: input.payment.companyId,
      paymentId: input.payment.id,
      chargeId: charge.id,
      amount: requested,
      currency: charge.currency,
      idempotencyKey,
      createdById: input.actorId ?? input.payment.recordedById ?? null,
    },
  });
  await recomputeCharge(tx, charge.id);
  return allocation;
}

export async function ensureLeaseSecurityDepositAccount(
  tx: FinanceTransaction,
  input: {
    companyId: string;
    propertyId: string;
    unitId: string;
    leaseId: string;
    tenantId: string;
    currency: string;
    expectedAmount?: Prisma.Decimal.Value | null;
  },
) {
  const expectedAmount = money(input.expectedAmount ?? 0);
  return tx.pmsSecurityDepositAccount.upsert({
    where: { leaseId: input.leaseId },
    create: {
      companyId: input.companyId,
      propertyId: input.propertyId,
      unitId: input.unitId,
      leaseId: input.leaseId,
      tenantId: input.tenantId,
      currency: input.currency,
      expectedAmount,
      liabilityBalance: ZERO,
    },
    update: {
      expectedAmount,
      currency: input.currency,
    },
  });
}
