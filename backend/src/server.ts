import "dotenv/config";

import { createApp } from "./app";
import { testDatabaseConnection } from "./database/prisma";
import { githubService } from "./modules/github/github.service";
import { tournamentService } from "./modules/tournaments/tournament.service";
import { startInactivityWorker, startWeeklySummaryWorker, startRankDecayWorker, startChallengeDeadlineWorker, startTournamentLiveWorker } from "./shared/services/notification-workers";

// ── Start ─────────────────────────────────────────────────────
async function startServer(): Promise<void> {
    const port = Number(process.env.PORT ?? 4000);

    // Guard: refuse to start in production without a real JWT secret.
    // The fallback "fallback_secret" is only acceptable in local development.
    const jwtSecret = process.env.JWT_SECRET ?? "";
    if (process.env.NODE_ENV === "production" && (!jwtSecret || jwtSecret === "fallback_secret")) {
        console.error(
            "FATAL: JWT_SECRET is missing or is the insecure fallback value. " +
            "Set a strong, randomly-generated secret in backend/.env before running in production.",
        );
        process.exit(1);
    }

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

            // Notification workers
            startInactivityWorker();
            startWeeklySummaryWorker();
            startRankDecayWorker();
            startChallengeDeadlineWorker();
            startTournamentLiveWorker();
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Failed to start server:", message);
        process.exit(1);
    }
}

startServer();
