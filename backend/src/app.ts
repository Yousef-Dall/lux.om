import compression from 'compression';
import cors, { type CorsOptions } from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

import { env, isProduction } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { AppError } from './utils/http';
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
  getStoredImageContentType,
  isSafeLocalUploadFilename,
  usesLocalImageStorage
} from './storage/imageStorage';
import { prisma } from './lib/prisma';

const THAWANI_CHECKOUT_ORIGINS = [
  'https://checkout.thawani.om',
  'https://uatcheckout.thawani.om',
  'https://*.thawani.om'
];

const GOOGLE_AUTH_ORIGINS = [
  'https://accounts.google.com',
  'https://apis.google.com',
  'https://oauth2.googleapis.com',
  'https://www.googleapis.com'
];

const GOOGLE_IMAGE_ORIGINS = [
  'https://lh3.googleusercontent.com',
  'https://*.googleusercontent.com'
];

const LOCAL_DEVELOPMENT_HTTP_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const LOCAL_DEVELOPMENT_CONNECT_ORIGINS = [
  ...LOCAL_DEVELOPMENT_HTTP_ORIGINS,
  'ws://localhost:5173',
  'ws://127.0.0.1:5173'
];

const NO_STORE_CACHE_CONTROL =
  'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';
const PUBLIC_API_CACHE_CONTROL =
  'public, max-age=60, stale-while-revalidate=300';
const PUBLIC_SEO_CACHE_CONTROL =
  'public, max-age=3600, stale-while-revalidate=86400';
const PUBLIC_UPLOAD_CACHE_CONTROL =
  'public, max-age=604800, stale-while-revalidate=86400';
const DEVELOPMENT_UPLOAD_CACHE_CONTROL = 'no-cache, max-age=0';

const CORS_ALLOWED_METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS'
];
const CORS_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'X-Requested-With'
];
const CORS_EXPOSED_HEADERS = ['RateLimit', 'RateLimit-Policy', 'Retry-After'];
const API_JSON_BODY_LIMIT = '1mb';
const API_FORM_BODY_LIMIT = '32kb';
const BODY_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const SENSITIVE_API_PREFIXES = [
  '/api/auth',
  '/api/dashboard',
  '/api/admin',
  '/api/verification',
  '/api/notifications',
  '/api/uploads',
  '/api/bookings',
  '/api/contracts',
  '/api/rent-payments',
  '/api/transactions',
  '/api/reports',
  '/api/saved',
  '/api/inquiries'
];

const PUBLIC_CACHEABLE_API_PREFIXES = [
  '/api/listings',
  '/api/activities',
  '/api/developers',
  '/api/travel-agencies',
  '/api/landmarks',
  '/api/market-insights',
  '/api/reviews'
];

const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'camera=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()'
].join(', ');

function parseEnvList(value?: string) {
  return value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function uniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function startsWithAny(path: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

function isAllowedCorsOrigin(origin: string) {
  return env.CORS_ORIGIN.includes(origin);
}

function requestHasBody(req: Request) {
  const contentLength = req.headers['content-length'];

  if (Array.isArray(contentLength)) {
    return contentLength.some((value) => Number(value) > 0);
  }

  return Number(contentLength ?? 0) > 0 || Boolean(req.headers['transfer-encoding']);
}

function isSupportedApiContentType(req: Request) {
  return Boolean(
    req.is('application/json') ||
      req.is('application/*+json') ||
      req.is('application/x-www-form-urlencoded') ||
      (req.path.startsWith('/api/uploads') && req.is('multipart/form-data'))
  );
}

function requireSupportedApiContentType(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (
    !req.path.startsWith('/api') ||
    !BODY_METHODS.includes(req.method) ||
    !requestHasBody(req) ||
    isSupportedApiContentType(req)
  ) {
    return next();
  }

  return next(new AppError(415, 'Unsupported content type'));
}

function validateLocalUploadRequest(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({
      message: 'Method not allowed'
    });
  }

  const requestedFilename = req.path.startsWith('/') ? req.path.slice(1) : req.path;

  if (!isSafeLocalUploadFilename(requestedFilename)) {
    return res.status(404).json({
      message: 'Media not found'
    });
  }

  return next();
}

function rejectDisallowedCorsOrigins(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const origin = req.headers.origin;

  res.vary('Origin');

  if (!origin || isAllowedCorsOrigin(origin)) {
    return next();
  }

  return res.status(403).json({
    message: 'CORS origin is not allowed'
  });
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, isAllowedCorsOrigin(origin));
  },
  credentials: true,
  methods: CORS_ALLOWED_METHODS,
  allowedHeaders: CORS_ALLOWED_HEADERS,
  exposedHeaders: CORS_EXPOSED_HEADERS,
  optionsSuccessStatus: 204,
  maxAge: isProduction ? 600 : 0
};

function setNoStoreHeaders(res: Response) {
  res.setHeader('Cache-Control', NO_STORE_CACHE_CONTROL);
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function createContentSecurityPolicyDirectives(): Record<string, string[] | null> {
  const configuredAppOrigins = uniqueValues([
    env.FRONTEND_URL,
    ...env.CORS_ORIGIN,
    ...(isProduction ? [] : LOCAL_DEVELOPMENT_HTTP_ORIGINS)
  ]);

  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    scriptSrc: ["'self'", ...GOOGLE_AUTH_ORIGINS],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      ...configuredAppOrigins,
      ...GOOGLE_IMAGE_ORIGINS,
      'https://res.cloudinary.com',
      ...parseEnvList(env.CSP_IMG_SRC)
    ],
    connectSrc: [
      "'self'",
      ...configuredAppOrigins,
      ...(isProduction ? [] : LOCAL_DEVELOPMENT_CONNECT_ORIGINS),
      ...GOOGLE_AUTH_ORIGINS,
      ...THAWANI_CHECKOUT_ORIGINS,
      ...parseEnvList(env.CSP_CONNECT_SRC)
    ],
    frameSrc: [
      "'self'",
      ...GOOGLE_AUTH_ORIGINS,
      ...THAWANI_CHECKOUT_ORIGINS,
      ...parseEnvList(env.CSP_FRAME_SRC)
    ],
    formAction: ["'self'", ...GOOGLE_AUTH_ORIGINS, ...THAWANI_CHECKOUT_ORIGINS],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: isProduction ? [] : null
  };
}

function cacheControl(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    setNoStoreHeaders(res);
    return next();
  }

  if (
    req.path === '/robots.txt' ||
    req.path === '/sitemap.xml' ||
    req.path.startsWith('/sitemaps/')
  ) {
    res.setHeader('Cache-Control', PUBLIC_SEO_CACHE_CONTROL);
    return next();
  }

  if (!req.path.startsWith('/api')) {
    return next();
  }

  if (startsWithAny(req.path, SENSITIVE_API_PREFIXES) || req.headers.authorization) {
    setNoStoreHeaders(res);
    return next();
  }

  if (startsWithAny(req.path, PUBLIC_CACHEABLE_API_PREFIXES)) {
    res.setHeader('Cache-Control', PUBLIC_API_CACHE_CONTROL);
    return next();
  }

  setNoStoreHeaders(res);
  return next();
}

function permissionsPolicy(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  next();
}

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
      contentSecurityPolicy: {
        useDefaults: true,
        directives: createContentSecurityPolicyDirectives()
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: {
        policy: 'same-origin-allow-popups'
      },
      crossOriginResourcePolicy: {
        policy: 'cross-origin'
      },
      frameguard: {
        action: 'deny'
      },
      hsts: isProduction
        ? {
            maxAge: 15552000,
            includeSubDomains: true,
            preload: false
          }
        : false,
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
      }
    })
  );
  app.use(permissionsPolicy);
  app.use(cacheControl);

  app.use(compression());

  app.use(rejectDisallowedCorsOrigins);
  app.use(cors(corsOptions));

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: isProduction ? 200 : 2000,
      standardHeaders: 'draft-7',
      legacyHeaders: false
    })
  );

  app.use(requireSupportedApiContentType);
  app.use(
    express.json({
      limit: API_JSON_BODY_LIMIT,
      type: ['application/json', 'application/*+json']
    })
  );
  app.use(
    express.urlencoded({
      extended: false,
      limit: API_FORM_BODY_LIMIT,
      parameterLimit: 100
    })
  );

  if (usesLocalImageStorage()) {
    app.use(
      '/uploads',
      validateLocalUploadRequest,
      express.static(getLocalUploadDirectory(), {
        dotfiles: 'deny',
        index: false,
        redirect: false,
        maxAge: isProduction ? '7d' : 0,
        immutable: false,
        setHeaders: (res, filePath) => {
          const contentType = getStoredImageContentType(filePath.split(/[\\/]/).pop() ?? '');

          if (contentType) {
            res.setHeader('Content-Type', contentType);
          }

          res.setHeader(
            'Cache-Control',
            isProduction ? PUBLIC_UPLOAD_CACHE_CONTROL : DEVELOPMENT_UPLOAD_CACHE_CONTROL
          );
          res.setHeader('Content-Disposition', 'inline');
          res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
          res.setHeader('X-Content-Type-Options', 'nosniff');
        }
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