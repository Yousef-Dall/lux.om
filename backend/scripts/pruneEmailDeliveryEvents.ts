import { PrismaClient } from '@prisma/client';

import {
  DEFAULT_EMAIL_DELIVERY_RETENTION_DAYS,
  getEmailDeliveryRetentionDays,
  pruneOldEmailDeliveryEvents
} from '../src/services/emailDeliveryRetention';

type ParsedArgs = {
  days?: string;
  execute: boolean;
};

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    execute: false
  };

  for (const arg of args) {
    if (arg === '--execute') {
      parsed.execute = true;
      continue;
    }

    if (arg === '--dry-run') {
      parsed.execute = false;
      continue;
    }

    if (arg.startsWith('--days=')) {
      parsed.days = arg.slice('--days='.length);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const retentionDays = getEmailDeliveryRetentionDays(
    args.days ??
      process.env.EMAIL_DELIVERY_RETENTION_DAYS ??
      DEFAULT_EMAIL_DELIVERY_RETENTION_DAYS
  );

  const prisma = new PrismaClient();

  try {
    const result = await pruneOldEmailDeliveryEvents(prisma, {
      retentionDays,
      dryRun: !args.execute
    });

    const mode = result.dryRun ? 'dry run' : 'cleanup';
    const message = [
      `[lux.om] Email delivery retention ${mode}:`,
      `${result.matchedCount} event(s) matched`,
      `older than ${result.cutoff.toISOString()}`,
      `using ${result.retentionDays} day retention.`
    ].join(' ');

    console.log(message);

    if (result.dryRun) {
      console.log(
        '[lux.om] No rows were deleted. Re-run with --execute to delete old delivery events.'
      );
    } else {
      console.log(
        `[lux.om] Deleted ${result.deletedCount} old email delivery event(s).`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
