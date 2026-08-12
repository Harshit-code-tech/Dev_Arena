import { prisma } from "../database/prisma";
import { rebuildDsaScoreEvents } from "../modules/dsa/dsa-scoring";
import { rebuildProjectScoresForUser } from "../modules/projects/project-scoring";

async function main() {
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
        await prisma.$transaction(async (tx) => {
            await rebuildDsaScoreEvents(tx, user.id);
            await rebuildProjectScoresForUser(tx, user.id);
        });
    }
    console.log(`Rebuilt DSA, project, rank, weekly, and leaderboard scores for ${users.length} user(s).`);
}

main()
    .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("Score rebuild failed:", message);
        process.exitCode = 1;
    })
    .finally(async () => { await prisma.$disconnect(); });
