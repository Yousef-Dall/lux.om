"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maxUploadBytes = exports.isProduction = exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const corsOriginsSchema = zod_1.z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean))
    .refine((origins) => origins.length > 0, {
    message: 'CORS_ORIGIN must contain at least one origin'
});
const envSchema = zod_1.z
    .object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    DATABASE_URL: zod_1.z.string().min(1).startsWith('postgresql://', {
        message: 'DATABASE_URL must be a PostgreSQL connection string'
    }),
    JWT_SECRET: zod_1.z.string().min(24, 'JWT_SECRET must be at least 24 characters long'),
    CORS_ORIGIN: corsOriginsSchema,
    UPLOAD_DIR: zod_1.z.string().default('uploads'),
    MAX_UPLOAD_MB: zod_1.z.coerce.number().positive().default(5)
})
    .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.JWT_SECRET.includes('replace-this')) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['JWT_SECRET'],
            message: 'JWT_SECRET must be changed before running in production'
        });
    }
});
exports.env = envSchema.parse(process.env);
exports.isProduction = exports.env.NODE_ENV === 'production';
exports.maxUploadBytes = exports.env.MAX_UPLOAD_MB * 1024 * 1024;
