import 'dotenv/config';
import { z } from 'zod';

const isProductionEnv = process.env.NODE_ENV === 'production';

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
    UPLOAD_DIR: z.string().default('uploads'),
    MAX_UPLOAD_MB: z.coerce.number().positive().default(5)
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.JWT_SECRET.includes('replace-this')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be changed before running in production'
      });
    }
  });

export const env = envSchema.parse(process.env);

export const isProduction = env.NODE_ENV === 'production';

export const maxUploadBytes = env.MAX_UPLOAD_MB * 1024 * 1024;