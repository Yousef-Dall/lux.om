"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const env_1 = require("./config/env");
const prisma_1 = require("./lib/prisma");
const app = (0, app_1.createApp)();
const server = app.listen(env_1.env.PORT, () => {
    console.log(`lux.om API running on http://localhost:${env_1.env.PORT}`);
});
async function shutdown(signal) {
    console.log(`${signal} received. Closing server.`);
    server.close(async (error) => {
        if (error) {
            console.error('Error while closing HTTP server:', error);
            process.exit(1);
        }
        try {
            await prisma_1.prisma.$disconnect();
            console.log('Database connection closed.');
            process.exit(0);
        }
        catch (disconnectError) {
            console.error('Error while disconnecting Prisma:', disconnectError);
            process.exit(1);
        }
    });
    setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
    }, 10_000).unref();
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
    void shutdown('unhandledRejection');
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    void shutdown('uncaughtException');
});
