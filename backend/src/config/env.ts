import 'dotenv/config';
import { z } from 'zod';

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const optionalBooleanString = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

function isProductionInput(input: NodeJS.ProcessEnv) {
  return input.NODE_ENV === 'production';
}

function isLocalhostUrl(value: string) {
  return (
    value.includes('localhost') ||
    value.includes('127.0.0.1') ||
    value.includes('0.0.0.0')
  );
}

function addUrlIssue(
  ctx: z.RefinementCtx,
  path: string,
  message: string
) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [path],
    message
  });
}

function validateHttpsProductionUrl(
  value: string,
  field: string,
  ctx: z.RefinementCtx
) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    addUrlIssue(ctx, field, `${field} must be a valid URL`);
    return;
  }

  if (parsedUrl.protocol !== 'https:') {
    addUrlIssue(ctx, field, `${field} must use HTTPS in production`);
  }

  if (isLocalhostUrl(parsedUrl.hostname)) {
    addUrlIssue(ctx, field, `${field} must not use localhost in production`);
  }
}

function getDatabaseName(value: string) {
  try {
    return new URL(value).pathname.replace(/^\/+/, '');
  } catch {
    return '';
  }
}

function createCorsOriginsSchema(input: NodeJS.ProcessEnv) {
  const isProductionEnv = isProductionInput(input);

  return z
    .string()
    .optional()
    .transform((value) => {
      if (!value && !isProductionEnv) {
        return ['http://localhost:5173'];
      }

      return (value ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    })
    .refine((origins) => origins.length > 0, {
      message: 'CORS_ORIGIN must contain at least one origin'
    })
    .superRefine((origins, ctx) => {
      for (const origin of origins) {
        if (origin === '*') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'CORS_ORIGIN must not use wildcard origins'
          });
          continue;
        }

        let parsedOrigin: URL;

        try {
          parsedOrigin = new URL(origin);
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `CORS_ORIGIN contains an invalid URL: ${origin}`
          });
          continue;
        }

        if (isProductionEnv && parsedOrigin.protocol !== 'https:') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'CORS_ORIGIN must use HTTPS in production'
          });
        }

        if (isProductionEnv && isLocalhostUrl(parsedOrigin.hostname)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'CORS_ORIGIN must not use localhost in production'
          });
        }
      }
    });
}

function createEnvSchema(input: NodeJS.ProcessEnv) {
  return z
    .object({
      NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
      PORT: z.coerce.number().int().positive().default(4000),
      DATABASE_URL: z.string().min(1).startsWith('postgresql://', {
        message: 'DATABASE_URL must be a PostgreSQL connection string'
      }),
      JWT_SECRET: z.string().min(24, 'JWT_SECRET must be at least 24 characters long'),
      CORS_ORIGIN: createCorsOriginsSchema(input),
      FRONTEND_URL: optionalTrimmedString,
      EMAIL_DELIVERY_MODE: z.enum(['dev', 'smtp']).default('dev'),
      SMTP_HOST: optionalTrimmedString,
      SMTP_PORT: z.coerce.number().int().positive().optional(),
      SMTP_SECURE: optionalBooleanString.default(false),
      SMTP_USER: optionalTrimmedString,
      SMTP_PASS: optionalTrimmedString,
      MAIL_FROM: optionalTrimmedString,
      GOOGLE_OAUTH_ENABLED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
      GOOGLE_CLIENT_ID: optionalTrimmedString,
      GOOGLE_CLIENT_SECRET: optionalTrimmedString,
      GOOGLE_OAUTH_REDIRECT_URL: optionalTrimmedString,
      RATE_LIMIT_TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
      STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
      UPLOAD_DIR: z.string().default('uploads'),
      MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
      CLOUDINARY_CLOUD_NAME: z
        .string()
        .trim()
        .optional()
        .transform((value) => value || undefined),
      CLOUDINARY_API_KEY: z
        .string()
        .trim()
        .optional()
        .transform((value) => value || undefined),
      CLOUDINARY_API_SECRET: z
        .string()
        .trim()
        .optional()
        .transform((value) => value || undefined),
      CLOUDINARY_FOLDER: z.string().trim().default('lux-om'),
      CSP_CONNECT_SRC: optionalTrimmedString,
      CSP_IMG_SRC: optionalTrimmedString,
      CSP_FRAME_SRC: optionalTrimmedString
    })
    .superRefine((env, ctx) => {
      const isProductionEnv = env.NODE_ENV === 'production';

      if (isProductionEnv) {
        if (env.JWT_SECRET.length < 48) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_SECRET'],
            message: 'JWT_SECRET must be at least 48 characters long in production'
          });
        }

        const weakSecretFragments = [
          'replace-this',
          'change-me',
          'changeme',
          'password',
          'secret',
          'jwt_secret'
        ];

        if (
          weakSecretFragments.some((fragment) =>
            env.JWT_SECRET.toLowerCase().includes(fragment)
          )
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['JWT_SECRET'],
            message: 'JWT_SECRET must be a strong random value in production'
          });
        }

        const productionDatabaseName = getDatabaseName(env.DATABASE_URL);

        if (productionDatabaseName.endsWith('_test')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['DATABASE_URL'],
            message: 'DATABASE_URL must not point to a test database in production'
          });
        }

        if (!env.FRONTEND_URL) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['FRONTEND_URL'],
            message: 'FRONTEND_URL is required in production'
          });
        } else {
          validateHttpsProductionUrl(env.FRONTEND_URL, 'FRONTEND_URL', ctx);
        }

        if (env.EMAIL_DELIVERY_MODE !== 'smtp') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['EMAIL_DELIVERY_MODE'],
            message: 'EMAIL_DELIVERY_MODE must be smtp in production'
          });
        }

        if (env.RATE_LIMIT_TRUST_PROXY_HOPS < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['RATE_LIMIT_TRUST_PROXY_HOPS'],
            message:
              'RATE_LIMIT_TRUST_PROXY_HOPS must be at least 1 in production so rate limits use the real client IP behind a proxy'
          });
        }
      } else if (env.FRONTEND_URL) {
        try {
          new URL(env.FRONTEND_URL);
        } catch {
          addUrlIssue(ctx, 'FRONTEND_URL', 'FRONTEND_URL must be a valid URL');
        }
      }

      const smtpDeliveryRequired =
        isProductionEnv ||
        (env.NODE_ENV === 'development' && env.EMAIL_DELIVERY_MODE === 'smtp');

      if (smtpDeliveryRequired) {
        const requiredEmailFields = [
          ['SMTP_HOST', env.SMTP_HOST],
          ['SMTP_PORT', env.SMTP_PORT],
          ['SMTP_USER', env.SMTP_USER],
          ['SMTP_PASS', env.SMTP_PASS],
          ['MAIL_FROM', env.MAIL_FROM]
        ] as const;

        for (const [field, value] of requiredEmailFields) {
          if (!value) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [field],
              message:
                isProductionEnv
                  ? 'SMTP email configuration is required in production'
                  : 'SMTP email configuration is required when EMAIL_DELIVERY_MODE=smtp'
            });
          }
        }
      }

      if (env.GOOGLE_OAUTH_ENABLED) {
        const requiredGoogleFields = [
          ['GOOGLE_CLIENT_ID', env.GOOGLE_CLIENT_ID],
          ['GOOGLE_CLIENT_SECRET', env.GOOGLE_CLIENT_SECRET],
          ['GOOGLE_OAUTH_REDIRECT_URL', env.GOOGLE_OAUTH_REDIRECT_URL]
        ] as const;

        for (const [field, value] of requiredGoogleFields) {
          if (!value) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [field],
              message: 'Google OAuth credentials are required when GOOGLE_OAUTH_ENABLED=true'
            });
          }
        }

        if (isProductionEnv && env.GOOGLE_OAUTH_REDIRECT_URL) {
          validateHttpsProductionUrl(
            env.GOOGLE_OAUTH_REDIRECT_URL,
            'GOOGLE_OAUTH_REDIRECT_URL',
            ctx
          );

          try {
            const redirectUrl = new URL(env.GOOGLE_OAUTH_REDIRECT_URL);

            if (redirectUrl.pathname !== '/api/auth/google/callback') {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['GOOGLE_OAUTH_REDIRECT_URL'],
                message:
                  'GOOGLE_OAUTH_REDIRECT_URL must end with /api/auth/google/callback'
              });
            }
          } catch {
            // The URL validity issue is already added by validateHttpsProductionUrl.
          }
        }
      }

      if (env.STORAGE_DRIVER === 'cloudinary') {
        const requiredCloudinaryFields = [
          ['CLOUDINARY_CLOUD_NAME', env.CLOUDINARY_CLOUD_NAME],
          ['CLOUDINARY_API_KEY', env.CLOUDINARY_API_KEY],
          ['CLOUDINARY_API_SECRET', env.CLOUDINARY_API_SECRET]
        ] as const;

        for (const [field, value] of requiredCloudinaryFields) {
          if (!value) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [field],
              message: 'Cloudinary credentials are required when STORAGE_DRIVER=cloudinary'
            });
          }
        }
      }
    });
}

export function validateEnv(input: NodeJS.ProcessEnv) {
  return createEnvSchema(input).parse(input);
}

export const env = validateEnv(process.env);

export const isProduction = env.NODE_ENV === 'production';

export const maxUploadBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
