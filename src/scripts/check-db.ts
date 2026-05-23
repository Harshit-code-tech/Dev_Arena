import "dotenv/config";
import { prisma, testDatabaseConnection } from "../db";

async function run(): Promise<void> {
    try {
        const currentTime = await testDatabaseConnection();
        console.log("Database connection successful.");
        console.log("Database time:", currentTime);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Database connection failed:", message);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

run();
