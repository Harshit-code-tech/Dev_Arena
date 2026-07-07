import cors from "cors";
import express, { Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";

import errorHandler from "./middleware/errorHandler";

// ── Routes ────────────────────────────────────────────────────
import authRoutes from "./modules/auth/auth.routes";
import dsaRoutes from "./modules/dsa/dsa.routes";
import fullstackRoutes from "./modules/fullstack/fullstack.routes";
import projectRoutes from "./modules/projects/project.routes";
import practiceRoutes from "./modules/practice/practice.routes";
import leaderboardRoutes from "./modules/leaderboard/leaderboard.routes";
import challengeRoutes from "./modules/challenges/challenge.routes";
import blogRoutes from "./modules/blog/blog.routes";
import releaseRoutes from "./modules/releases/release.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";

export function createApp(port: number) {
    const app = express();

    // ── Global middleware ─────────────────────────────────────────
    app.use(helmet());
    app.use(cors());
    app.use(express.json());
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
    app.use("/api/challenge", challengeRoutes);
    app.use("/api/blog", blogRoutes);
    app.use("/api/releases", releaseRoutes);

    // ── 404 fallback ──────────────────────────────────────────────
    app.use((_req: Request, res: Response) => {
        res.status(404).json({ message: "Route not found" });
    });

    // ── Global error handler (must be last) ───────────────────────
    app.use(errorHandler);

    return app;
}
