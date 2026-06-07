"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../utils/http");
function signToken(user) {
    return jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, env_1.env.JWT_SECRET, {
        expiresIn: '7d',
        issuer: 'lux.om'
    });
}
function requireAuth(required = true) {
    return async (req, _res, next) => {
        try {
            const header = req.headers.authorization ?? '';
            const token = header.startsWith('Bearer ') ? header.slice(7) : null;
            if (!token) {
                if (!required)
                    return next();
                throw new http_1.AppError(401, 'Unauthorized');
            }
            const payload = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET, { issuer: 'lux.om' });
            const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.userId } });
            if (!user)
                throw new http_1.AppError(401, 'Unauthorized');
            req.user = user;
            return next();
        }
        catch (error) {
            return next(error instanceof http_1.AppError ? error : new http_1.AppError(401, 'Unauthorized'));
        }
    };
}
function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            next(new http_1.AppError(403, 'Forbidden'));
            return;
        }
        next();
    };
}
