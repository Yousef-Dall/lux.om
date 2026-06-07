"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = void 0;
const zod_1 = require("zod");
const http_1 = require("../utils/http");
const env_1 = require("../config/env");
const notFoundHandler = (error, _req, res, _next) => {
    if (error instanceof http_1.AppError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }
    if (error instanceof zod_1.ZodError) {
        res.status(400).json({
            message: 'Validation failed',
            issues: error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message
            }))
        });
        return;
    }
    console.error(error);
    res.status(500).json({
        message: 'Server error',
        ...(env_1.isProduction ? {} : { detail: error instanceof Error ? error.message : String(error) })
    });
};
exports.notFoundHandler = notFoundHandler;
