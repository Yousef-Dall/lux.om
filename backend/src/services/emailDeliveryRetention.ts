import type { Prisma, PrismaClient } from '@prisma/client';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const DEFAULT_EMAIL_DELIVERY_RETENTION_DAYS = 180;
export const MIN_EMAIL_DELIVERY_RETENTION_DAYS = 30;

export type EmailDeliveryRetentionResult = {
  retentionDays: number;
  cutoff: Date;
  dryRun: boolean;
  matchedCount: number;
  deletedCount: number;
};

export function getEmailDeliveryRetentionDays(value?: string | number | null) {
  const envValue = process.env.EMAIL_DELIVERY_RETENTION_DAYS?.trim();
  const rawValue =
    value ?? (envValue ? envValue : DEFAULT_EMAIL_DELIVERY_RETENTION_DAYS);

  const parsed =
    typeof rawValue === 'number' ? rawValue : Number.parseInt(String(rawValue), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('EMAIL_DELIVERY_RETENTION_DAYS must be a positive integer.');
  }

  if (parsed < MIN_EMAIL_DELIVERY_RETENTION_DAYS) {
    throw new Error(
      `EMAIL_DELIVERY_RETENTION_DAYS must be at least ${MIN_EMAIL_DELIVERY_RETENTION_DAYS} days.`
    );
  }

  return parsed;
}

export function getEmailDeliveryRetentionCutoff(
  retentionDays: number,
  now = new Date()
) {
  return new Date(now.getTime() - retentionDays * MS_PER_DAY);
}

export async function pruneOldEmailDeliveryEvents(
  db: DatabaseClient,
  input: {
    retentionDays?: number;
    dryRun?: boolean;
    now?: Date;
  } = {}
): Promise<EmailDeliveryRetentionResult> {
  const retentionDays = getEmailDeliveryRetentionDays(input.retentionDays);
  const cutoff = getEmailDeliveryRetentionCutoff(retentionDays, input.now);
  const dryRun = input.dryRun ?? true;

  const where: Prisma.EmailDeliveryEventWhereInput = {
    createdAt: {
      lt: cutoff
    }
  };

  const matchedCount = await db.emailDeliveryEvent.count({
    where
  });

  if (dryRun) {
    return {
      retentionDays,
      cutoff,
      dryRun,
      matchedCount,
      deletedCount: 0
    };
  }

  const result = await db.emailDeliveryEvent.deleteMany({
    where
  });

  return {
    retentionDays,
    cutoff,
    dryRun,
    matchedCount,
    deletedCount: result.count
  };
}
