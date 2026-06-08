import "dotenv/config";
import cors from "cors";
import express, { Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";

import { testDatabaseConnection } from "./db";
import errorHandler from "./middleware/errorHandler";

// ── Routes ────────────────────────────────────────────────────
import authRoutes from "./routes/auth.routes";
import dsaRoutes from "./routes/dsa.routes";
import fullstackRoutes from "./routes/fullstack.routes";
import projectRoutes from "./routes/project.routes";
import practiceRoutes from "./routes/practice.routes";
import leaderboardRoutes from "./routes/leaderboard.routes";
import challengeRoutes from "./routes/challenge.routes";
import blogRoutes from "./routes/blog.routes";
import releaseRoutes from "./routes/release.routes";

const app = express();
const port = Number(process.env.PORT ?? 4000);

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

// ── Start ─────────────────────────────────────────────────────
async function startServer(): Promise<void> {
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
