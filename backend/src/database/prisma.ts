import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

export async function testDatabaseConnection(): Promise<Date> {
    try {
        const result = await prisma.$queryRaw<[{ current_time: Date }]>`SELECT now() as current_time`;
        console.log("DB connected via Prisma at:", result[0].current_time);
        return result[0].current_time;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("DB connection failed:", message);
        throw err;
    }
}
