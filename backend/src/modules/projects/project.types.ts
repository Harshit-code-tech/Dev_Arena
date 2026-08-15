import type { MilestoneStatus, ProjectDomain, ProjectStatus } from "@prisma/client";

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
    status?: MilestoneStatus;
};
