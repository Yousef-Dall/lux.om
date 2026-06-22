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

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

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

  app.use('/api/auth', authRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/listings', listingsRouter);
  app.use('/api/activities', activitiesRouter);
  app.use('/api/developers', developersRouter);
  app.use('/api/travel-agencies', travelAgenciesRouter);
  app.use('/api/landmarks', landmarksRouter);
  app.use('/api/inquiries', inquiriesRouter);
  app.use('/api/bookings', bookingsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/uploads', uploadsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}