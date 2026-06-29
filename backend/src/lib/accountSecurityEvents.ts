import {
  AccountSecurityEventType,
  NotificationType,
  type Prisma,
  type PrismaClient
} from '@prisma/client';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type AccountSecurityEventInput = {
  userId: string;
  actorId?: string | null;
  type: AccountSecurityEventType;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
};

export async function recordAccountSecurityEvent(
  db: DatabaseClient,
  input: AccountSecurityEventInput
) {
  const metadata =
    input.metadata === undefined ? {} : { metadata: input.metadata };

  const [event, notification] = await Promise.all([
    db.accountSecurityEvent.create({
      data: {
        type: input.type,
        title: input.title,
        message: input.message,
        userId: input.userId,
        actorId: input.actorId ?? input.userId,
        ...metadata
      }
    }),

    db.notification.create({
      data: {
        type: NotificationType.ACCOUNT_SECURITY,
        title: input.title,
        message: input.message,
        userId: input.userId
      }
    })
  ]);

  return {
    event,
    notification
  };
}
