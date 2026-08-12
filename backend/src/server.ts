import "dotenv/config";

import { createApp } from "./app";
import { testDatabaseConnection } from "./database/prisma";
import { githubService } from "./modules/github/github.service";
import { tournamentService } from "./modules/tournaments/tournament.service";

// ── Start ─────────────────────────────────────────────────────
async function startServer(): Promise<void> {
    const port = Number(process.env.PORT ?? 4000);
    const app = createApp(port);

    try {
        const currentTime = await testDatabaseConnection();
        console.log("Database connected:", currentTime);

        app.listen(port, () => {
            console.log(`API server listening on http://localhost:${port}`);

            const configuredMinutes = Number(process.env.GITHUB_MAINTENANCE_MINUTES || 60);
            const maintenanceMinutes = Number.isFinite(configuredMinutes) && configuredMinutes >= 15
                ? configuredMinutes
                : 60;
            const maintenanceTimer = setInterval(() => {
                void githubService.runScheduledRechecks().catch((reason) => {
                    const message = reason instanceof Error ? reason.message : String(reason);
                    console.error("Scheduled GitHub repository recheck failed:", message);
                });
            }, maintenanceMinutes * 60 * 1000);
            maintenanceTimer.unref();

            const webhookWorker = setInterval(() => {
                void githubService.runPendingWebhookRefreshes().catch((reason) => {
                    const message = reason instanceof Error ? reason.message : String(reason);
                    console.error("GitHub webhook refresh worker failed:", message);
                });
                void tournamentService.runScheduledMaintenance().catch((reason) => {
                    const message = reason instanceof Error ? reason.message : String(reason);
                    console.error("Tournament maintenance failed:", message);
                });
            }, 30 * 1000);
            webhookWorker.unref();
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to start server:", message);
        process.exit(1);
    }
}

startServer();
