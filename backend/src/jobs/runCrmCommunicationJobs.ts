import { prisma } from '../lib/prisma';
import { redactExpiredCrmDeliveryContent, submitQueuedCrmDeliveryAttempts } from '../modules/crm/stage21h/communications';

function readLimit() {
  const value = process.argv.find((item) => item.startsWith('--limit='))?.slice('--limit='.length);
  if (!value) return 25;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 250) {
    throw new Error('--limit must be an integer between 1 and 250.');
  }
  return parsed;
}

async function main() {
  const deliveries = await submitQueuedCrmDeliveryAttempts(prisma, { limit: readLimit() });
  const retention = await redactExpiredCrmDeliveryContent(prisma);
  console.log('[lux.om] CRM communication jobs complete', {
    deliveries: {
      processed: deliveries.length,
      submitted: deliveries.filter((item) => item.status === 'SUBMITTED').length,
      failed: deliveries.filter((item) => item.status === 'FAILED').length
    },
    retention
  });
}

main().catch((error) => {
  console.error('[lux.om] CRM communication jobs failed.', error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
