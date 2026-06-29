import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { env, isProduction } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { activitiesRouter } from './routes/activities';
import { authRouter } from './routes/auth';
import { bookingsRouter } from './routes/bookings';
import { contractsRouter } from './routes/contracts';
import { marketInsightsRouter } from './routes/marketInsights';
import { rentPaymentsRouter } from './routes/rentPayments';
import { reportsRouter } from './routes/reports';
import { reviewsRouter } from './routes/reviews';
import { savedRouter } from './routes/saved';
import { transactionsRouter } from './routes/transactions';
import { valuationsRouter } from './routes/valuations';
import { verificationRouter } from './routes/verification';
import { dashboardRouter } from './routes/dashboard';
import { developersRouter } from './routes/developers';
import { inquiriesRouter } from './routes/inquiries';
import { landmarksRouter } from './routes/landmarks';
import { listingsRouter } from './routes/listings';
import { notificationsRouter } from './routes/notifications';
import { travelAgenciesRouter } from './routes/travelAgencies';
import { uploadsRouter } from './routes/uploads';
import {
  getLocalUploadDirectory,
  usesLocalImageStorage
} from './storage/imageStorage';
import { prisma } from './lib/prisma';


const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 25 : 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isProduction ? 60 : 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.RATE_LIMIT_TRUST_PROXY_HOPS);

  app.use(
    helmet({
      crossOriginResourcePolicy: {
        policy: 'cross-origin'
      }
    })
  );

  app.use(compression());

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true
    })
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: isProduction ? 200 : 2000,
      standardHeaders: 'draft-7',
      legacyHeaders: false
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  if (usesLocalImageStorage()) {
    app.use(
      '/uploads',
      express.static(getLocalUploadDirectory(), {
        maxAge: isProduction ? '7d' : 0,
        immutable: isProduction
      })
    );
  }

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      app: 'lux.om API',
      environment: env.NODE_ENV
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      app: 'lux.om API',
      environment: env.NODE_ENV
    });
  });

  app.get('/api/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      ok: true,
      app: 'lux.om API',
      database: 'connected',
      environment: env.NODE_ENV
    });
  } catch (error) {
    console.error('Readiness check failed:', error);

    res.status(503).json({
      ok: false,
      app: 'lux.om API',
      database: 'unavailable',
      environment: env.NODE_ENV
    });
  }
});

  app.use('/api/auth', authRateLimiter, authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/listings', listingsRouter);
  app.use('/api/activities', activitiesRouter);
  app.use('/api/developers', developersRouter);
  app.use('/api/travel-agencies', travelAgenciesRouter);
  app.use('/api/landmarks', landmarksRouter);
  app.use('/api/inquiries', inquiriesRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/uploads', uploadRateLimiter, uploadsRouter);
  app.use('/api/contracts', contractsRouter);
  app.use('/api/rent-payments', rentPaymentsRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/market-insights', marketInsightsRouter);
  app.use('/api/valuations', valuationsRouter);
  app.use('/api/verification', verificationRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/saved', savedRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}