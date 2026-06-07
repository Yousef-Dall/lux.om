"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProduction = exports.env = void 0;
require("dotenv/config");
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'test', 'production']).default('development'),
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    DATABASE_URL: zod_1.z.string().min(1),
    JWT_SECRET: zod_1.z.string().min(24, 'JWT_SECRET must be at least 24 characters long'),
    CORS_ORIGIN: zod_1.z.string().default('http://localhost:5173'),
    UPLOAD_DIR: zod_1.z.string().default('uploads'),
    MAX_UPLOAD_MB: zod_1.z.coerce.number().positive().default(5)
});
exports.env = envSchema.parse(process.env);
exports.isProduction = exports.env.NODE_ENV === 'production';
