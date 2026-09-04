import { prisma } from "../../database/prisma";
import type { PlatformPulse } from "./platform.types";

const LOG_SOURCE_TYPES = [
    "DSA_LOG",
    "PRACTICE_LOG",
    "FULLSTACK_LOG",
    "PROJECT_LOG",
] as const;

export const platformService = {
    async getPulse(): Promise<PlatformPulse> {
        const [projectsShared, logsCreated, developers] = await prisma.$transaction([
            prisma.project.count({ where: { isShared: true } }),
            prisma.scoreEvent.count({ where: { sourceType: { in: [...LOG_SOURCE_TYPES] } } }),
            prisma.user.count(),
        ]);

        return {
            projectsShared,
            logsCreated,
            developers,
            generatedAt: new Date().toISOString(),
        };
    },
};
