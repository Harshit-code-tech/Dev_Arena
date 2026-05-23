require("dotenv").config();

const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const { testDatabaseConnection } = require("./db");
const errorHandler = require("./middleware/errorHandler");

// ── Routes ────────────────────────────────────────────────────
const authRoutes        = require("./routes/auth.routes");
const dsaRoutes         = require("./routes/dsa.routes");
const fullstackRoutes   = require("./routes/fullstack.routes");
const projectRoutes     = require("./routes/project.routes");
const practiceRoutes    = require("./routes/practice.routes");
const leaderboardRoutes = require("./routes/leaderboard.routes");
const challengeRoutes   = require("./routes/challenge.routes");

const app  = express();
const port = Number(process.env.PORT) || 4000;

// ── Global middleware ─────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ── Health check ──────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", service: "dev-arena-backend" });
});

// ── API routes ────────────────────────────────────────────────
app.use("/api/auth",        authRoutes);
app.use("/api/dsa",         dsaRoutes);
app.use("/api/fullstack",   fullstackRoutes);
app.use("/api/projects",    projectRoutes);
app.use("/api/practice",    practiceRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/challenge",   challengeRoutes);

// ── 404 fallback ──────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
});

// ── Global error handler (must be last) ───────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
async function startServer() {
    try {
        const currentTime = await testDatabaseConnection();
        console.log("Database connected:", currentTime);

        app.listen(port, () => {
            console.log(`API server listening on http://localhost:${port}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
}

startServer();

