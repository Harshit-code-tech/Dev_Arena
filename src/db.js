const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Add it to your .env file.");
}

const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
        rejectUnauthorized: false,
    },
});

async function testDatabaseConnection() {
    try {
        const result = await pool.query("select now() as current_time");
        console.log("DB connected at:", result.rows[0].current_time);
    } catch (err) {
        console.error("DB connection failed:", err.message);
    }
}

module.exports = {
    pool,
    testDatabaseConnection,
};
