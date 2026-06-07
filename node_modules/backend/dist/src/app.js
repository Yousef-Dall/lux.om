"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const path_1 = __importDefault(require("path"));
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("./config/env");
const auth_1 = require("./routes/auth");
const listings_1 = require("./routes/listings");
const bookings_1 = require("./routes/bookings");
const uploads_1 = require("./routes/uploads");
const error_1 = require("./middleware/error");
function createApp() {
    const app = (0, express_1.default)();
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
    app.use((0, compression_1.default)());
    app.use((0, cors_1.default)({
        origin: env_1.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
        credentials: true
    }));
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use(express_1.default.urlencoded({ extended: false }));
    app.use((0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        limit: env_1.isProduction ? 200 : 2000,
        standardHeaders: 'draft-7',
        legacyHeaders: false
    }));
    app.use('/uploads', express_1.default.static(path_1.default.resolve(process.cwd(), env_1.env.UPLOAD_DIR), { maxAge: '7d' }));
    app.get('/health', (_req, res) => {
        res.json({ ok: true, app: 'lux.om API' });
    });
    app.use('/auth', auth_1.authRouter);
    app.use('/listings', listings_1.listingsRouter);
    app.use('/bookings', bookings_1.bookingsRouter);
    app.use('/uploads', uploads_1.uploadsRouter);
    app.use((_req, res) => {
        res.status(404).json({ message: 'Route not found' });
    });
    app.use(error_1.notFoundHandler);
    return app;
}
