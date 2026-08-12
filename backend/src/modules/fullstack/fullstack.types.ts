import type { FullstackCategory, FullstackType } from "@prisma/client";

export type FullstackLogInput = {
    title: string;
    category: FullstackCategory;
    type: FullstackType;
    description: string;
    timeSpent: number;
    proofLink?: string | null;
    activityDate?: string;
};

export const FULLSTACK_POINTS: Record<FullstackType, number> = {
    Learning: 2,
    Building: 4,
};
