import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../../utils/http';

export async function assertFinancialPeriodOpen(
  tx: Prisma.TransactionClient | PrismaClient,
  input: {
    companyId: string;
    propertyId?: string | null;
    currency: string;
    transactionDate: Date;
  },
) {
  const closed = await tx.pmsFinancialPeriod.findFirst({
    where: {
      companyId: input.companyId,
      status: 'CLOSED',
      currency: input.currency,
      periodStart: { lte: input.transactionDate },
      periodEnd: { gte: input.transactionDate },
      OR: [{ propertyId: null }, ...(input.propertyId ? [{ propertyId: input.propertyId }] : [])],
    },
    select: { id: true, periodStart: true, periodEnd: true },
  });
  if (closed) {
    throw new AppError(
      409,
      `Financial period ${closed.periodStart.toISOString().slice(0, 10)} to ${closed.periodEnd
        .toISOString()
        .slice(0, 10)} is closed. Reopen it with a reason before posting corrections.`,
    );
  }
}
