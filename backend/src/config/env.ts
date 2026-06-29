import 'dotenv/config';
import { z } from 'zod';

const isProductionEnv = process.env.NODE_ENV === 'production';

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const optionalBooleanString = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');


const corsOriginsSchema = z
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
    if (!isProductionEnv) return;

    const hasLocalhostOrigin = origins.some(
      (origin) => origin.includes('localhost') || origin.includes('127.0.0.1')
    );

    if (hasLocalhostOrigin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CORS_ORIGIN must not use localhost in production'
      });
    }
  });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1).startsWith('postgresql://', {
      message: 'DATABASE_URL must be a PostgreSQL connection string'
    }),
    JWT_SECRET: z.string().min(24, 'JWT_SECRET must be at least 24 characters long'),
    CORS_ORIGIN: corsOriginsSchema,
    FRONTEND_URL: optionalTrimmedString,
    EMAIL_DELIVERY_MODE: z.enum(['dev', 'smtp']).default('dev'),
    SMTP_HOST: optionalTrimmedString,
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_SECURE: optionalBooleanString.default(false),
    SMTP_USER: optionalTrimmedString,
    SMTP_PASS: optionalTrimmedString,
    MAIL_FROM: optionalTrimmedString,
    GOOGLE_OAUTH_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
    GOOGLE_CLIENT_ID: optionalTrimmedString,
    GOOGLE_CLIENT_SECRET: optionalTrimmedString,
    GOOGLE_OAUTH_REDIRECT_URL: optionalTrimmedString,
    STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
    UPLOAD_DIR: z.string().default('uploads'),
    MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
    CLOUDINARY_CLOUD_NAME: z.string().trim().optional().transform((value) => value || undefined),
    CLOUDINARY_API_KEY: z.string().trim().optional().transform((value) => value || undefined),
    CLOUDINARY_API_SECRET: z.string().trim().optional().transform((value) => value || undefined),
    CLOUDINARY_FOLDER: z.string().trim().default('lux-om')
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.JWT_SECRET.includes('replace-this')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be changed before running in production'
      });
    }

    const smtpDeliveryRequired =
      env.NODE_ENV === 'production' ||
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
              env.NODE_ENV === 'production'
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

export const env = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === 'production';

export const maxUploadBytes = env.MAX_UPLOAD_MB * 1024 * 1024;