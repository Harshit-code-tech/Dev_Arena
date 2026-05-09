const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function testDatabaseConnection() {
    try {
        const result = await prisma.$queryRaw`SELECT now() as current_time`;
        console.log("DB connected via Prisma at:", result[0].current_time);
        return result[0].current_time;
    } catch (err) {
        console.error("DB connection failed:", err.message);
        throw err;
    }
}

module.exports = {
    prisma,
    testDatabaseConnection,
};
