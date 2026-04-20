require("dotenv").config();

const cors = require("cors");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");

const { testDatabaseConnection } = require("./db");

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
        service: "dev-arena-backend",
    });
});

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
