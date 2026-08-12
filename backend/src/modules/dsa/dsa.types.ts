import type { Difficulty } from "@prisma/client";

export type DsaLogInput = {
    problemName: string;
    problemUrl: string;
    solutionUrl?: string | null;
    difficulty: Difficulty;
    timeTaken: number;
    timeComplexity?: string | null;
    spaceComplexity?: string | null;
    notes?: string | null;
    activityDate?: string;
};

export const DSA_BASE_POINTS: Record<Difficulty, number> = {
    Easy: 1,
    Medium: 4,
    Hard: 10,
};
