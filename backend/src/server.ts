import "dotenv/config";

import { createApp } from "./app";
import { testDatabaseConnection } from "./database/prisma";

// ── Start ─────────────────────────────────────────────────────
async function startServer(): Promise<void> {
    const port = Number(process.env.PORT ?? 4000);
    const app = createApp(port);

    try {
        const currentTime = await testDatabaseConnection();
        console.log("Database connected:", currentTime);

        app.listen(port, () => {
            console.log(`API server listening on http://localhost:${port}`);
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to start server:", message);
        process.exit(1);
    }
}

startServer();
