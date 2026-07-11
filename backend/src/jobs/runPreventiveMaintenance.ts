import { prisma } from '../lib/prisma';
import { generateDuePreventiveWorkOrders } from '../modules/pms/maintenance/preventive';

async function main() {
  const generated = await generateDuePreventiveWorkOrders({ asOf: new Date() });
  console.log(`[lux.om] Preventive maintenance generated ${generated.filter((item) => !item.idempotent).length} work order(s); ${generated.filter((item) => item.idempotent).length} idempotent replay(s).`);
}

main()
  .catch((error) => {
    console.error('[lux.om] Preventive maintenance job failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
