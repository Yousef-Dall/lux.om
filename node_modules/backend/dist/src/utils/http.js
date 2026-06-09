"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.publicUser = publicUser;
class AppError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone ?? null
    };
}
