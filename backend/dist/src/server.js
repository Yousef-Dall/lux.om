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
    server.close(async () => {
        await prisma_1.prisma.$disconnect();
        process.exit(0);
    });
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
