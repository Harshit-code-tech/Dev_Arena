import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function readDurationMs(
    name: string,
    fallback: number,
    minimum: number,
    maximum: number,
): number {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
        console.warn(`[database] Ignoring invalid ${name}=${raw}; using ${fallback}ms.`);
        return fallback;
    }

    return Math.min(Math.max(Math.trunc(parsed), minimum), maximum);
}

// Prisma interactive transactions default to only 5 seconds. DevArena's score
// rebuilds intentionally update several related tables (score events, activity,
// weekly scores, realtime events, achievements, etc.) in one atomic operation,
// so a remote PostgreSQL/Neon connection can legitimately need longer than that.
//
// These defaults apply to every interactive transaction in the application,
// which keeps project, DSA, Fullstack, Practice, dashboard, GitHub-sync and admin
// scoring behavior consistent on both localhost and deployed backends. They can
// still be tuned per environment without changing source code.
const transactionMaxWaitMs = readDurationMs(
    "PRISMA_TRANSACTION_MAX_WAIT_MS",
    10_000,
    2_000,
    120_000,
);
const transactionTimeoutMs = readDurationMs(
    "PRISMA_TRANSACTION_TIMEOUT_MS",
    30_000,
    5_000,
    300_000,
);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
    adapter,
    transactionOptions: {
        maxWait: transactionMaxWaitMs,
        timeout: transactionTimeoutMs,
    },
});

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
