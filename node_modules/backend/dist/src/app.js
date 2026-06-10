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
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const error_1 = require("./middleware/error");
const activities_1 = require("./routes/activities");
const auth_1 = require("./routes/auth");
const bookings_1 = require("./routes/bookings");
const developers_1 = require("./routes/developers");
const inquiries_1 = require("./routes/inquiries");
const landmarks_1 = require("./routes/landmarks");
const listings_1 = require("./routes/listings");
const travelAgencies_1 = require("./routes/travelAgencies");
const uploads_1 = require("./routes/uploads");
function createApp() {
    const app = (0, express_1.default)();
    const uploadDirectory = path_1.default.resolve(process.cwd(), env_1.env.UPLOAD_DIR);
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)({
        crossOriginResourcePolicy: {
            policy: 'cross-origin'
        }
    }));
    app.use((0, compression_1.default)());
    app.use((0, cors_1.default)({
        origin: env_1.env.CORS_ORIGIN,
        credentials: true
    }));
    app.use((0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        limit: env_1.isProduction ? 200 : 2000,
        standardHeaders: 'draft-7',
        legacyHeaders: false
    }));
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use(express_1.default.urlencoded({ extended: false }));
    app.use('/uploads', express_1.default.static(uploadDirectory, {
        maxAge: env_1.isProduction ? '7d' : 0,
        immutable: env_1.isProduction
    }));
    app.get('/health', (_req, res) => {
        res.json({
            ok: true,
            app: 'lux.om API',
            environment: env_1.env.NODE_ENV
        });
    });
    app.get('/api/health', (_req, res) => {
        res.json({
            ok: true,
            app: 'lux.om API',
            environment: env_1.env.NODE_ENV
        });
    });
    app.use('/api/auth', auth_1.authRouter);
    app.use('/api/listings', listings_1.listingsRouter);
    app.use('/api/activities', activities_1.activitiesRouter);
    app.use('/api/developers', developers_1.developersRouter);
    app.use('/api/travel-agencies', travelAgencies_1.travelAgenciesRouter);
    app.use('/api/landmarks', landmarks_1.landmarksRouter);
    app.use('/api/inquiries', inquiries_1.inquiriesRouter);
    app.use('/api/bookings', bookings_1.bookingsRouter);
    app.use('/api/uploads', uploads_1.uploadsRouter);
    /**
     * Temporary legacy aliases while the frontend API client is being introduced.
     * Remove these after all frontend service calls use /api routes.
     */
    app.use('/auth', auth_1.authRouter);
    app.use('/listings', listings_1.listingsRouter);
    app.use('/activities', activities_1.activitiesRouter);
    app.use('/developers', developers_1.developersRouter);
    app.use('/travel-agencies', travelAgencies_1.travelAgenciesRouter);
    app.use('/landmarks', landmarks_1.landmarksRouter);
    app.use('/inquiries', inquiries_1.inquiriesRouter);
    app.use('/bookings', bookings_1.bookingsRouter);
    app.use('/uploads', uploads_1.uploadsRouter);
    app.use(error_1.notFoundHandler);
    app.use(error_1.errorHandler);
    return app;
}
