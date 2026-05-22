/**
 * prisma/seed.js
 *
 * Seeds the database with the pre-defined Achievements list.
 * Achievements are fixed system data — they are NOT created by users.
 * Every time a user meets a condition, the backend checks this table
 * and writes a record into `user_achievements`.
 *
 * Run with:  npm run db:seed
 */

const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

require("dotenv").config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────
// Achievement definitions
// conditionType  → the metric the backend checks
// conditionValue → the threshold that triggers the unlock
// ─────────────────────────────────────────────────────────────
const achievements = [
    // ── DSA ──────────────────────────────────────────────────
    {
        title: "Baby Steps",
        category: "DSA",
        conditionType: "dsa_problems_solved",
        conditionValue: 10,
    },
    {
        title: "Half Century",
        category: "DSA",
        conditionType: "dsa_problems_solved",
        conditionValue: 50,
    },

    // ── Fullstack ─────────────────────────────────────────────
    {
        title: "First Chapter",
        category: "Fullstack",
        conditionType: "fullstack_logs_count",
        conditionValue: 1,
    },
    {
        title: "Learning Machine",
        category: "Fullstack",
        conditionType: "fullstack_logs_count",
        conditionValue: 5,
    },

    // ── Project ───────────────────────────────────────────────
    {
        title: "Builder Mode: ON",
        category: "Project",
        conditionType: "projects_created",
        conditionValue: 1,
    },
    {
        title: "Checkpoint Reached",
        category: "Project",
        conditionType: "milestones_completed",
        conditionValue: 1,
    },
    {
        title: "Ship It!",
        category: "Project",
        conditionType: "projects_completed",
        conditionValue: 1,
    },

    // ── Consistency ───────────────────────────────────────────
    {
        title: "Showing Up",
        category: "Consistency",
        conditionType: "active_days_in_week",
        conditionValue: 3,
    },
    {
        title: "Lock In",
        category: "Consistency",
        conditionType: "active_days_in_week",
        conditionValue: 5,
    },
];

// ─────────────────────────────────────────────────────────────
// Seed function
// Uses upsert so it's safe to run multiple times —
// it won't create duplicates if the title already exists.
// ─────────────────────────────────────────────────────────────
async function main() {
    console.log("🌱 Seeding achievements...\n");

    for (const achievement of achievements) {
        const record = await prisma.achievement.upsert({
            where: {
                title: achievement.title,
            },
            update: {
                // If it exists, keep it in sync with this file
                category: achievement.category,
                conditionType: achievement.conditionType,
                conditionValue: achievement.conditionValue,
            },
            create: achievement,
        });

        console.log(`  ✅  [${record.category}] ${record.title}`);
    }

    console.log(`\n✨ Done! ${achievements.length} achievements seeded.`);
}

main()
    .catch((err) => {
        console.error("❌ Seed failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
