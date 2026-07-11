import { Prisma } from '@prisma/client';

import { prisma } from '../src/lib/prisma';

async function main() {
  const [rentDueWithoutCharge, confirmedPaymentsWithoutAllocation, leasesWithoutDeposit, invalidChargeBalances, mixedCurrencyAllocations] = await Promise.all([
    prisma.pmsRentDueItem.count({ where: { structuredCharge: null } }),
    prisma.pmsRentPayment.count({
      where: {
        status: 'CONFIRMED',
        rentDueItemId: { not: null },
        allocations: { none: { status: 'ACTIVE' } },
      },
    }),
    prisma.pmsLease.count({ where: { pmsSecurityDepositAccount: null } }),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "PmsCharge"
      WHERE "balanceAmount" < 0
         OR "paidAmount" < 0
         OR "creditedAmount" < 0
         OR "balanceAmount" <> GREATEST("totalAmount" - "paidAmount" - "creditedAmount", 0)
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "PmsPaymentAllocation" a
      JOIN "PmsRentPayment" p ON p.id = a."paymentId"
      JOIN "PmsCharge" c ON c.id = a."chargeId"
      WHERE a.currency <> p.currency OR a.currency <> c.currency
    `),
  ]);

  const failures = {
    rentDueWithoutCharge,
    leasesWithoutDeposit,
    invalidChargeBalances: Number(invalidChargeBalances[0]?.count ?? 0n),
    mixedCurrencyAllocations: Number(mixedCurrencyAllocations[0]?.count ?? 0n),
  };
  const warnings = {
    confirmedPaymentsWithoutAllocation,
  };

  console.log('[lux.om] Stage 21G backfill verification', { failures, warnings });
  if (Object.values(failures).some((value) => value !== 0)) {
    throw new Error('Stage 21G backfill verification failed. Resolve the reported records before release.');
  }
  if (warnings.confirmedPaymentsWithoutAllocation > 0) console.warn('[lux.om] Confirmed legacy payments remain as unallocated tenant credit; review them in the payment allocation queue.');
  console.log('[lux.om] Stage 21G backfill verification passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
