import type { MilestoneSize, MilestoneStatus, ProjectDomain, ProjectStatus } from "@prisma/client";

export type ProjectInput = {
    title: string;
    description?: string | null;
    domain: ProjectDomain;
    status?: ProjectStatus;
    githubRepositoryUrl: string;
};

export type ProjectLogInput = {
    description: string;
    timeSpent: number;
    proofLink?: string | null;
    activityDate?: string;
};

export type MilestoneInput = {
    title: string;
    description?: string | null;
    size?: MilestoneSize;
    status?: MilestoneStatus;
};

// 11 — Milestone progress values by size (NOT competitive points)
export const MILESTONE_POINTS: Record<MilestoneSize, number> = {
    Minor: 2,
    Major: 5,
    Release: 8,
};
