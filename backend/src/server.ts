import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { startBackgroundNotificationJobs } from './jobs/notificationJobs';
import { logError, logInfo } from './utils/logging';

const app = createApp();
const stopBackgroundNotificationJobs = startBackgroundNotificationJobs();

const server = app.listen(env.PORT, () => {
  logInfo('lux.om API running', { port: env.PORT, environment: env.NODE_ENV });
});

async function shutdown(signal: string) {
  logInfo('Shutdown signal received', { signal });
  stopBackgroundNotificationJobs();

  server.close(async (error) => {
    if (error) {
      logError('Error while closing HTTP server', error);
      process.exit(1);
    }

    try {
      await prisma.$disconnect();
      logInfo('Database connection closed');
      process.exit(0);
    } catch (disconnectError) {
      logError('Error while disconnecting Prisma', disconnectError);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logError('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  logError('Unhandled promise rejection', reason);
  void shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logError('Uncaught exception', error);
  void shutdown('uncaughtException');
});