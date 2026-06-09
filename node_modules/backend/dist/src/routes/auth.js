"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../utils/http");
exports.authRouter = (0, express_1.Router)();
const registerSchema = zod_1.z
    .object({
    name: zod_1.z.string().trim().min(2).max(80),
    email: zod_1.z.string().trim().email().toLowerCase(),
    password: zod_1.z.string().min(8).max(100),
    role: zod_1.z.enum(['USER', 'OWNER']).default('USER'),
    phone: zod_1.z.string().trim().min(6).max(30).optional()
})
    .strict();
const loginSchema = zod_1.z
    .object({
    email: zod_1.z.string().trim().email().toLowerCase(),
    password: zod_1.z.string().min(1)
})
    .strict();
exports.authRouter.post('/register', async (req, res, next) => {
    try {
        const data = registerSchema.parse(req.body);
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: {
                email: data.email
            }
        });
        if (existingUser) {
            throw new http_1.AppError(409, 'An account with this email already exists');
        }
        const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
        const user = await prisma_1.prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                password: passwordHash,
                role: data.role,
                phone: data.phone?.trim() || null
            }
        });
        res.status(201).json({
            user: (0, http_1.publicUser)(user),
            token: (0, auth_1.signToken)(user)
        });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.post('/login', async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({
            where: {
                email: data.email
            }
        });
        if (!user) {
            throw new http_1.AppError(401, 'Invalid credentials');
        }
        const passwordMatches = await bcryptjs_1.default.compare(data.password, user.password);
        if (!passwordMatches) {
            throw new http_1.AppError(401, 'Invalid credentials');
        }
        res.json({
            user: (0, http_1.publicUser)(user),
            token: (0, auth_1.signToken)(user)
        });
    }
    catch (error) {
        next(error);
    }
});
exports.authRouter.get('/me', (0, auth_1.requireAuth)(), (req, res) => {
    res.json({
        user: req.user ? (0, http_1.publicUser)(req.user) : null
    });
});
