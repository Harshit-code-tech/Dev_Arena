require("dotenv").config();

const { pool, testDatabaseConnection } = require("../db");

async function run() {
    try {
        const currentTime = await testDatabaseConnection();
        console.log("Database connection successful.");
        console.log("Database time:", currentTime);
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

run();
