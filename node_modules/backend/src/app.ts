import path from 'path';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env, isProduction } from './config/env';
import { authRouter } from './routes/auth';
import { listingsRouter } from './routes/listings';
import { bookingsRouter } from './routes/bookings';
import { uploadsRouter } from './routes/uploads';
import { notFoundHandler } from './middleware/error';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      credentials: true
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: isProduction ? 200 : 2000,
      standardHeaders: 'draft-7',
      legacyHeaders: false
    })
  );

  app.use('/uploads', express.static(path.resolve(process.cwd(), env.UPLOAD_DIR), { maxAge: '7d' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, app: 'lux.om API' });
  });

  app.use('/auth', authRouter);
  app.use('/listings', listingsRouter);
  app.use('/bookings', bookingsRouter);
  app.use('/uploads', uploadsRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });

  app.use(notFoundHandler);

  return app;
}