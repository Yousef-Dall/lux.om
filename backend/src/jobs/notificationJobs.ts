import { prisma } from '../lib/prisma';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RENT_DUE_SOON_DAYS = 3;
const DEFAULT_NOTIFICATION_JOB_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_NOTIFICATION_JOB_INITIAL_DELAY_MS = 5 * 60 * 1000;
const RENT_REMINDER_BATCH_SIZE = 100;

type RentReminderSchedule = {
  title: string;
  createdById: string;
  landlordUserId?: string | null;
  tenantUserId?: string | null;
  listing?: {
    ownerId: string;
  } | null;
  contractDraft?: {
    createdById: string;
    landlordUserId?: string | null;
    tenantUserId?: string | null;
    listing?: {
      ownerId: string;
    } | null;
  } | null;
};

type RentReminderDueItem = {
  id: string;
  dueDate: Date;
  amount: {
    toString(): string;
  };
  currency: string;
  schedule: RentReminderSchedule;
};

function getPositiveIntegerEnv(name: string, fallback: number) {
  const rawValue = process.env[name];

  if (!rawValue) return fallback;

  const parsed = Number(rawValue);

  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * ONE_DAY_MS);
}

function startOfUtcDay(value: Date) {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  );
}

function formatRentDate(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC'
  }).format(value);
}

function formatRentMoney(
  amount: { toString(): string } | string | number,
  currency: string
) {
  const numericAmount = Number(amount.toString());

  if (!Number.isFinite(numericAmount)) {
    return `${currency} ${amount.toString()}`;
  }

  return `${currency} ${numericAmount.toLocaleString(undefined, {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0
  })}`;
}

function getUniqueRentNotificationUsers(schedule: RentReminderSchedule) {
  return Array.from(
    new Set(
      [
        schedule.createdById,
        schedule.landlordUserId,
        schedule.tenantUserId,
        schedule.listing?.ownerId,
        schedule.contractDraft?.createdById,
        schedule.contractDraft?.landlordUserId,
        schedule.contractDraft?.tenantUserId,
        schedule.contractDraft?.listing?.ownerId
      ].filter((id): id is string => Boolean(id))
    )
  );
}

async function createRentReminderNotifications({
  dueItem,
  title,
  message
}: {
  dueItem: RentReminderDueItem;
  title: string;
  message: string;
}) {
  const userIds = getUniqueRentNotificationUsers(dueItem.schedule);

  if (userIds.length === 0) return 0;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: 'RENT_PAYMENT_DUE',
      title,
      message
    }))
  });

  return userIds.length;
}

const rentReminderScheduleInclude = {
  listing: {
    select: {
      ownerId: true
    }
  },
  contractDraft: {
    select: {
      createdById: true,
      landlordUserId: true,
      tenantUserId: true,
      listing: {
        select: {
          ownerId: true
        }
      }
    }
  }
} as const;

async function processRentDueSoonReminders(now = new Date()) {
  const dueSoonDays = getPositiveIntegerEnv(
    'RENT_DUE_SOON_DAYS',
    DEFAULT_RENT_DUE_SOON_DAYS
  );

  const todayStart = startOfUtcDay(now);
  const dueSoonEnd = addDays(todayStart, dueSoonDays + 1);

  const dueItems = await prisma.rentPaymentDueItem.findMany({
    where: {
      status: 'PENDING',
      dueDate: {
        gte: todayStart,
        lt: dueSoonEnd
      },
      schedule: {
        active: true
      }
    },
    include: {
      schedule: {
        include: rentReminderScheduleInclude
      }
    },
    orderBy: {
      dueDate: 'asc'
    },
    take: RENT_REMINDER_BATCH_SIZE
  });

  let updated = 0;
  let notifications = 0;

  for (const dueItem of dueItems) {
    const result = await prisma.rentPaymentDueItem.updateMany({
      where: {
        id: dueItem.id,
        status: 'PENDING'
      },
      data: {
        status: 'DUE_SOON'
      }
    });

    if (result.count === 0) continue;

    updated += result.count;

    notifications += await createRentReminderNotifications({
      dueItem,
      title: 'Rent payment due soon',
      message: `${dueItem.schedule.title} is due on ${formatRentDate(
        dueItem.dueDate
      )} for ${formatRentMoney(dueItem.amount, dueItem.currency)}.`
    });
  }

  return {
    dueSoonItemsUpdated: updated,
    dueSoonNotificationsCreated: notifications
  };
}

async function processRentOverdueReminders(now = new Date()) {
  const todayStart = startOfUtcDay(now);

  const dueItems = await prisma.rentPaymentDueItem.findMany({
    where: {
      status: {
        in: ['PENDING', 'DUE_SOON']
      },
      dueDate: {
        lt: todayStart
      },
      schedule: {
        active: true
      }
    },
    include: {
      schedule: {
        include: rentReminderScheduleInclude
      }
    },
    orderBy: {
      dueDate: 'asc'
    },
    take: RENT_REMINDER_BATCH_SIZE
  });

  let updated = 0;
  let notifications = 0;

  for (const dueItem of dueItems) {
    const result = await prisma.rentPaymentDueItem.updateMany({
      where: {
        id: dueItem.id,
        status: {
          in: ['PENDING', 'DUE_SOON']
        }
      },
      data: {
        status: 'OVERDUE'
      }
    });

    if (result.count === 0) continue;

    updated += result.count;

    notifications += await createRentReminderNotifications({
      dueItem,
      title: 'Rent payment overdue',
      message: `${dueItem.schedule.title} was due on ${formatRentDate(
        dueItem.dueDate
      )} for ${formatRentMoney(dueItem.amount, dueItem.currency)}.`
    });
  }

  return {
    overdueItemsUpdated: updated,
    overdueNotificationsCreated: notifications
  };
}

export async function runBackgroundNotificationJobs(now = new Date()) {
  const dueSoon = await processRentDueSoonReminders(now);
  const overdue = await processRentOverdueReminders(now);

  return {
    ...dueSoon,
    ...overdue
  };
}

export function startBackgroundNotificationJobs() {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.NOTIFICATION_JOBS_ENABLED === 'false'
  ) {
    return () => undefined;
  }

  const intervalMs = getPositiveIntegerEnv(
    'NOTIFICATION_JOBS_INTERVAL_MS',
    DEFAULT_NOTIFICATION_JOB_INTERVAL_MS
  );

  const initialDelayMs = getPositiveIntegerEnv(
    'NOTIFICATION_JOBS_INITIAL_DELAY_MS',
    DEFAULT_NOTIFICATION_JOB_INITIAL_DELAY_MS
  );

  let isRunning = false;

  const runSafely = async () => {
    if (isRunning) return;

    isRunning = true;

    try {
      const result = await runBackgroundNotificationJobs();

      if (
        result.dueSoonItemsUpdated > 0 ||
        result.overdueItemsUpdated > 0 ||
        result.dueSoonNotificationsCreated > 0 ||
        result.overdueNotificationsCreated > 0
      ) {
        console.log('Background notification jobs completed:', result);
      }
    } catch (error) {
      console.error('Background notification jobs failed:', error);
    } finally {
      isRunning = false;
    }
  };

  const initialTimer = setTimeout(() => {
    void runSafely();
  }, initialDelayMs);

  const interval = setInterval(() => {
    void runSafely();
  }, intervalMs);

  initialTimer.unref();
  interval.unref();

  return () => {
    clearTimeout(initialTimer);
    clearInterval(interval);
  };
}
