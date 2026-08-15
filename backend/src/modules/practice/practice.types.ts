import type { PracticeType } from "@prisma/client";

export type PracticeLogInput = {
    title: string;
    type: PracticeType;
    notes: string;
    timeSpent: number;
    proofLink?: string | null;
    activityDate?: string;
};

export const PRACTICE_POINTS: Record<PracticeType, number> = {
    DSA_Revision: 2,
    Concept_Explanation: 3,
};
