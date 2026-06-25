import dotenv from 'dotenv';
import path from 'path';

dotenv.config({
  path: path.resolve(__dirname, '../../.env')
});

dotenv.config({
  path: path.resolve(__dirname, '../../../.env')
});

const { prisma } = require('../lib/prisma') as typeof import('../lib/prisma');
const { runBackgroundNotificationJobs } = require('./notificationJobs') as typeof import('./notificationJobs');

async function main() {
  const result = await runBackgroundNotificationJobs();

  console.log('Background notification jobs completed:', result);
}

main()
  .catch((error) => {
    console.error('Background notification jobs failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
