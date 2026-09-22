import cors from "cors";
import express, { Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";

/** Origins allowed to call the API */
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  // Production domain — set FRONTEND_URL in .env
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

import errorHandler from "./middleware/errorHandler";

// ── Routes ────────────────────────────────────────────────────
import authRoutes from "./modules/auth/auth.routes";
import dsaRoutes from "./modules/dsa/dsa.routes";
import fullstackRoutes from "./modules/fullstack/fullstack.routes";
import projectRoutes from "./modules/projects/project.routes";
import practiceRoutes from "./modules/practice/practice.routes";
import leaderboardRoutes from "./modules/leaderboard/leaderboard.routes";
import tournamentRoutes from "./modules/tournaments/tournament.routes";
import adminRoutes from "./modules/admin/admin.routes";
import blogRoutes from "./modules/blog/blog.routes";
import releaseRoutes from "./modules/releases/release.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import settingsRoutes from "./modules/settings/settings.routes";
import friendRoutes from "./modules/friends/friend.routes";
import notificationRoutes from "./modules/notifications/notification.routes";
import platformRoutes from "./modules/platform/platform.routes";
import realtimeRoutes from "./modules/realtime/realtime.routes";
import activityRoutes from "./modules/activity/activity.routes";
import playerHubRoutes from "./modules/player-hub/player-hub.routes";
import githubRoutes from "./modules/github/github.routes";
import feedbackRoutes from "./modules/feedback/feedback.routes";
import challengeRoutes from "./modules/challenges/challenge.routes";
import supportRoutes from "./modules/support/support.routes";
import coachRoutes from "./modules/coach/coach.routes";

export function createApp(port: number) {
    const app = express();

    // ── Global middleware ─────────────────────────────────────────
    app.use(helmet({
      // Enforce HTTPS for 1 year in production (tells browsers to never use HTTP)
      hsts: process.env.NODE_ENV === "production"
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
    }));
    app.use(cors({
      origin: (origin, callback) => {
        // Allow server-to-server requests (no Origin header) and allowlisted origins
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin '${origin}' is not allowed`));
        }
      },
      credentials: true,
    }));
    app.use(express.json({
        limit: "8mb",
        verify: (req, _res, buffer) => {
            const request = req as Request & { rawBody?: Buffer };
            if ((request.originalUrl || request.url || "").startsWith("/api/github/webhook")) {
                request.rawBody = Buffer.from(buffer);
            }
        },
    }));
    app.use(morgan("dev"));

    // ── Health check ──────────────────────────────────────────────
    app.get("/", (_req: Request, res: Response) => {
        res.status(200).json({
            status: "ok",
            service: "dev-arena-backend",
            frontendPort: 5173,
            backendPort: port,
        });
    });

    app.get("/health", (_req: Request, res: Response) => {
        res.status(200).json({ status: "ok", service: "dev-arena-backend" });
    });

    // ── API routes ────────────────────────────────────────────────
    app.use("/api/auth", authRoutes);
    app.use("/api/dashboard", dashboardRoutes);
    app.use("/api/dsa", dsaRoutes);
    app.use("/api/fullstack", fullstackRoutes);
    app.use("/api/projects", projectRoutes);
    app.use("/api/practice", practiceRoutes);
    app.use("/api/leaderboard", leaderboardRoutes);
    app.use("/api/tournaments", tournamentRoutes);
    app.use("/api/challenge", challengeRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/blog", blogRoutes);
    app.use("/api/releases", releaseRoutes);
    app.use("/api/settings", settingsRoutes);
    app.use("/api/friends", friendRoutes);
    app.use("/api/notifications", notificationRoutes);
    app.use("/api/public", platformRoutes);
    app.use("/api/realtime", realtimeRoutes);
    app.use("/api/activity", activityRoutes);
    app.use("/api/player-hub", playerHubRoutes);
    app.use("/api/github", githubRoutes);
    app.use("/api/feedback", feedbackRoutes);
    app.use("/api/support", supportRoutes);
    app.use("/api/coach", coachRoutes);

    // ── 404 fallback ──────────────────────────────────────────────
    app.use((_req: Request, res: Response) => {
        res.status(404).json({ message: "Route not found" });
    });

    // ── Global error handler (must be last) ───────────────────────
    app.use(errorHandler);

    return app;
}
