import {
    MilestoneStatus,
    ProjectDomain,
    ProjectStatus,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { prisma } from "../../database/prisma";
import { publishRealtimeEvent } from "../realtime/realtime.service";
import { githubService } from "../github/github.service";
import {
    ensureEditable,
    optionalText,
    optionalUrl,
    parseActivityDate,
    positiveInteger,
    requiredText,
    TrackingError,
} from "../../shared/utils/tracking";
import {
    type MilestoneInput,
    type ProjectInput,
    type ProjectLogInput,
} from "./project.types";
import { PROJECT_SCORE_VERSION, rebuildProjectScoreEvents, rebuildProjectScoresForUser } from "./project-scoring";

function parseDomain(value: unknown): ProjectDomain {
    if (Object.values(ProjectDomain).includes(value as ProjectDomain)) return value as ProjectDomain;
    throw new TrackingError("Project domain is invalid.");
}

function parseStatus(value: unknown): ProjectStatus {
    if (value === undefined) return ProjectStatus.In_Progress;
    if (Object.values(ProjectStatus).includes(value as ProjectStatus)) return value as ProjectStatus;
    throw new TrackingError("Project status is invalid.");
}

function parseMilestoneStatus(value: unknown): MilestoneStatus {
    if (value === undefined) return MilestoneStatus.Pending;
    if (Object.values(MilestoneStatus).includes(value as MilestoneStatus)) return value as MilestoneStatus;
    throw new TrackingError("Milestone status is invalid.");
}

function parseProjectInput(input: Partial<ProjectInput>) {
    return {
        title: requiredText(input.title, "Project title", 3),
        description: optionalText(input.description),
        domain: parseDomain(input.domain),
        startDate: new Date(),
        status: parseStatus(input.status),
        githubRepositoryUrl: requiredText(input.githubRepositoryUrl, "GitHub repository URL", 19),
    };
}

function parseLogInput(input: Partial<ProjectLogInput>, existingActivityDate?: Date) {
    return {
        description: requiredText(input.description, "Task description", 10),
        timeSpent: positiveInteger(input.timeSpent, "Time spent", 960),
        proofLink: optionalUrl(input.proofLink),
        activityDate: input.activityDate ? parseActivityDate(input.activityDate) : existingActivityDate || parseActivityDate(undefined),
    };
}

function parseMilestoneInput(input: Partial<MilestoneInput>) {
    return {
        title: requiredText(input.title, "Milestone title", 4),
        description: optionalText(input.description),
        status: parseMilestoneStatus(input.status),
    };
}

const projectInclude = {
    logs: { orderBy: { activityDate: "desc" as const } },
    milestones: { orderBy: { createdAt: "asc" as const } },
};


const sharedProjectInclude = {
    user: {
        select: {
            name: true,
            username: true,
            avatarUrl: true,
            useInitials: true,
        },
    },
    logs: {
        select: { activityDate: true },
        orderBy: { activityDate: "desc" as const },
        take: 1,
    },
    milestones: {
        select: {
            id: true,
            title: true,
            description: true,
            status: true,
            createdAt: true,
        },
        orderBy: { createdAt: "asc" as const },
    },
};

function createShareSlug() {
    return randomBytes(9).toString("base64url");
}

function withProgress<T extends {
    status: ProjectStatus;
    completionAwardedAt: Date | null;
    githubInstallationId?: string | null;
    projectScore: number;
    logs: Array<unknown>;
    milestones: Array<{ status: MilestoneStatus; completionAwardedAt: Date | null }>;
}>(project: T) {
    const completedMilestones = project.milestones.filter((item) => item.status === MilestoneStatus.Completed).length;
    const awardedMilestones = project.milestones.filter((item) => item.completionAwardedAt !== null).length;
    const totalMilestones = project.milestones.length;
    const milestoneProgress = totalMilestones === 0 ? 0 : Math.round((completedMilestones / totalMilestones) * 100);
    const score = Number(project.projectScore) || 0;

    const { githubInstallationId: _githubInstallationId, ...safeProject } = project;
    return {
        ...safeProject,
        metrics: {
            totalSessions: project.logs.length,
            completedMilestones,
            totalMilestones,
            milestoneProgress,
            score,
        },
    };
}

export const projectService = {
    async getProjects(userId: string) {
        await githubService.refreshStaleProjects(userId).catch(() => undefined);
        const staleScores = await prisma.project.count({
            where: {
                userId,
                OR: [
                    { projectScoreVersion: null },
                    { projectScoreVersion: { not: PROJECT_SCORE_VERSION } },
                ],
            },
        });
        if (staleScores > 0) await prisma.$transaction((tx) => rebuildProjectScoresForUser(tx, userId));
        const projects = await prisma.project.findMany({
            where: { userId },
            include: projectInclude,
            orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        });

        const enriched = projects.map(withProgress);
        return {
            projects: enriched,
            summary: {
                totalProjects: projects.length,
                activeProjects: projects.filter((project) => project.status === ProjectStatus.In_Progress).length,
                completedProjects: projects.filter((project) => project.status === ProjectStatus.Completed).length,
                totalSessions: projects.reduce((sum, project) => sum + project.logs.length, 0),
                projectPoints: enriched.reduce((sum, project) => sum + project.metrics.score, 0),
            },
        };
    },

    async createProject(userId: string, input: Partial<ProjectInput>) {
        const data = parseProjectInput(input);
        const verifiedRepository = await githubService.verifyRepositoryForUser(userId, data.githubRepositoryUrl);
        const duplicateRepository = await prisma.project.findFirst({
            where: {
                userId,
                githubRepositoryUrl: { equals: verifiedRepository.url, mode: "insensitive" },
            },
            select: { id: true, title: true },
        });
        if (duplicateRepository) {
            throw new TrackingError(`This GitHub repository is already linked to "${duplicateRepository.title}".`, 409);
        }
        const { githubRepositoryUrl: _repositoryUrl, ...projectData } = data;
        const created = await prisma.$transaction(async (tx) => {
            const completionAwardedAt = projectData.status === ProjectStatus.Completed ? new Date() : null;
            const project = await tx.project.create({
                data: {
                    userId,
                    ...projectData,
                    ...githubService.projectData(verifiedRepository),
                    completionAwardedAt,
                },
                include: projectInclude,
            });
            await rebuildProjectScoreEvents(tx, userId, project.id);
            const scored = await tx.project.findUnique({ where: { id: project.id }, include: projectInclude });
            if (!scored) throw new TrackingError("Project could not be loaded after scoring.", 500);
            return withProgress(scored);
        });
        await githubService.rebuildTopTechStack(userId);
        return created;
    },

    async updateProject(userId: string, id: string, input: Partial<ProjectInput>) {
        const existing = await prisma.project.findFirst({ where: { id, userId } });
        if (!existing) throw new TrackingError("Project not found.", 404);

        const data = {
            ...(input.title !== undefined && { title: requiredText(input.title, "Project title", 3) }),
            ...(input.description !== undefined && { description: optionalText(input.description) }),
            ...(input.domain !== undefined && { domain: parseDomain(input.domain) }),
            ...(input.status !== undefined && { status: parseStatus(input.status) }),
        };

        const isCompleting = input.status === ProjectStatus.Completed && existing.status !== ProjectStatus.Completed;
        const completionAwardedAt = isCompleting && !existing.completionAwardedAt ? new Date() : null;

        return prisma.$transaction(async (tx) => {
            const project = await tx.project.update({
                where: { id },
                data: {
                    ...data,
                    ...(completionAwardedAt && { completionAwardedAt }),
                },
                include: projectInclude,
            });
            await rebuildProjectScoreEvents(tx, userId, project.id);
            const scored = await tx.project.findUnique({ where: { id: project.id }, include: projectInclude });
            if (!scored) throw new TrackingError("Project could not be loaded after scoring.", 500);
            return withProgress(scored);
        });
    },

    async setSharing(userId: string, projectId: string, enabled: boolean) {
        const existing = await prisma.project.findFirst({ where: { id: projectId, userId } });
        if (!existing) throw new TrackingError("Project not found.", 404);

        const project = await prisma.project.update({
            where: { id: projectId },
            data: enabled
                ? {
                    isShared: true,
                    sharedAt: existing.sharedAt || new Date(),
                    shareSlug: existing.shareSlug || createShareSlug(),
                }
                : {
                    isShared: false,
                    sharedAt: null,
                },
            include: projectInclude,
        });

        await publishRealtimeEvent({
            userId: null,
            type: "player_hub.shared_projects.changed",
            entityType: "project",
            entityId: project.id,
            payload: { enabled },
        }).catch((reason) => console.error("Shared project realtime event failed:", reason));

        return withProgress(project);
    },

    async getSharedProject(shareSlug: string) {
        const slug = requiredText(shareSlug, "Share link", 6);
        const project = await prisma.project.findFirst({
            where: { shareSlug: slug, isShared: true },
            include: sharedProjectInclude,
        });
        if (!project) throw new TrackingError("This shared project is unavailable.", 404);

        const completedMilestones = project.milestones.filter(
            (milestone) => milestone.status === MilestoneStatus.Completed,
        ).length;
        const totalMilestones = project.milestones.length;

        return {
            id: project.id,
            title: project.title,
            description: project.description,
            domain: project.domain,
            status: project.status,
            startDate: project.startDate,
            sharedAt: project.sharedAt,
            updatedAt: project.updatedAt,
            github: project.githubRepositoryUrl ? {
                languages: project.githubLanguages,
                languagesFetchedAt: project.githubLanguagesFetchedAt,
            } : null,
            owner: project.user,
            milestones: project.milestones,
            metrics: {
                completedMilestones,
                totalMilestones,
                milestoneProgress: totalMilestones === 0
                    ? 0
                    : Math.round((completedMilestones / totalMilestones) * 100),
                lastActivityDate: project.logs[0]?.activityDate || project.updatedAt,
            },
        };
    },

    async attachRepository(userId: string, projectId: string, repositoryUrl: unknown) {
        const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
        if (!project) throw new TrackingError("Project not found.", 404);
        if (project.githubRepositoryUrl) {
            throw new TrackingError("This project already has a verified GitHub repository.", 409);
        }
        const verified = await githubService.verifyRepositoryForUser(userId, repositoryUrl);
        const duplicate = await prisma.project.findFirst({
            where: {
                userId,
                id: { not: projectId },
                githubRepositoryUrl: { equals: verified.url, mode: "insensitive" },
            },
            select: { title: true },
        });
        if (duplicate) {
            throw new TrackingError(`This GitHub repository is already linked to "${duplicate.title}".`, 409);
        }
        const updated = await prisma.$transaction(async (tx) => {
            await tx.project.update({ where: { id: projectId }, data: githubService.projectData(verified) });
            await rebuildProjectScoreEvents(tx, userId, projectId);
            const scored = await tx.project.findUnique({ where: { id: projectId }, include: projectInclude });
            if (!scored) throw new TrackingError("Project could not be loaded after scoring.", 500);
            return scored;
        });
        await githubService.rebuildTopTechStack(userId);
        return withProgress(updated);
    },

    async refreshRepositoryLanguages(userId: string, projectId: string) {
        const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
        if (!project) throw new TrackingError("Project not found.", 404);
        if (!project.githubRepositoryUrl) {
            throw new TrackingError("This existing project does not have a verified GitHub repository.", 409);
        }
        await githubService.reverifyProjectRepository(userId, project);
        const refreshed = await prisma.project.findUnique({
            where: { id: projectId },
            include: projectInclude,
        });
        if (!refreshed) throw new TrackingError("Project not found.", 404);
        return withProgress(refreshed);
    },

    async reverifyAllRepositories(userId: string) {
        return githubService.reverifyUserRepositories(userId);
    },

    async addLog(userId: string, projectId: string, input: Partial<ProjectLogInput>) {
        const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
        if (!project) throw new TrackingError("Project not found.", 404);
        const data = parseLogInput(input);
        const duplicate = await prisma.projectLog.findFirst({
            where: {
                projectId,
                userId,
                activityDate: data.activityDate,
                description: { equals: data.description, mode: "insensitive" },
            },
        });
        if (duplicate) throw new TrackingError("This project work session is already logged for that date.", 409);

        return prisma.$transaction(async (tx) => {
            const log = await tx.projectLog.create({ data: { projectId, userId, ...data } });
            const breakdown = await rebuildProjectScoreEvents(tx, userId, projectId);
            const sessionOrdinal = await tx.projectLog.count({ where: { projectId, activityDate: { lte: log.activityDate } } });
            return { ...log, points: breakdown && sessionOrdinal <= 10 && project.githubEligibleForTechStack ? 1 : 0 };
        });
    },

    async updateLog(userId: string, projectId: string, logId: string, input: Partial<ProjectLogInput>) {
        const [log, project] = await Promise.all([
            prisma.projectLog.findFirst({ where: { id: logId, projectId, userId } }),
            prisma.project.findFirst({ where: { id: projectId, userId } }),
        ]);
        if (!log) throw new TrackingError("Project work session not found.", 404);
        if (!project) throw new TrackingError("Project not found.", 404);
        ensureEditable(log.createdAt);
        const data = parseLogInput(input, log.activityDate);
        const duplicate = await prisma.projectLog.findFirst({
            where: {
                projectId,
                userId,
                id: { not: logId },
                activityDate: data.activityDate,
                description: { equals: data.description, mode: "insensitive" },
            },
        });
        if (duplicate) throw new TrackingError("This project work session is already logged for that date.", 409);

        return prisma.$transaction(async (tx) => {
            const updated = await tx.projectLog.update({ where: { id: logId }, data });
            await rebuildProjectScoreEvents(tx, userId, projectId);
            const ordered = await tx.projectLog.findMany({ where: { projectId }, orderBy: [{ activityDate: "asc" }, { createdAt: "asc" }], select: { id: true } });
            const ordinal = ordered.findIndex((item) => item.id === updated.id) + 1;
            return { ...updated, points: ordinal > 0 && ordinal <= 10 && project.githubEligibleForTechStack ? 1 : 0 };
        });
    },

    async deleteLog(userId: string, projectId: string, logId: string) {
        const log = await prisma.projectLog.findFirst({ where: { id: logId, projectId, userId } });
        if (!log) throw new TrackingError("Project work session not found.", 404);
        ensureEditable(log.createdAt);

        return prisma.$transaction(async (tx) => {
            await tx.projectLog.delete({ where: { id: logId } });
            await rebuildProjectScoreEvents(tx, userId, projectId);
        });
    },

    async addMilestone(userId: string, projectId: string, input: Partial<MilestoneInput>) {
        const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
        if (!project) throw new TrackingError("Project not found.", 404);
        const data = parseMilestoneInput(input);

        return prisma.$transaction(async (tx) => {
            const completionAwardedAt = data.status === MilestoneStatus.Completed ? new Date() : null;
            const milestone = await tx.milestone.create({
                data: { projectId, ...data, completionAwardedAt },
            });
            await rebuildProjectScoreEvents(tx, userId, projectId);
            return milestone;
        });
    },

    async updateMilestone(userId: string, projectId: string, milestoneId: string, input: Partial<MilestoneInput>) {
        const project = await prisma.project.findFirst({ where: { id: projectId, userId } });
        if (!project) throw new TrackingError("Project not found.", 404);
        const existing = await prisma.milestone.findFirst({ where: { id: milestoneId, projectId } });
        if (!existing) throw new TrackingError("Milestone not found.", 404);

        const data = {
            ...(input.title !== undefined && { title: requiredText(input.title, "Milestone title", 4) }),
            ...(input.description !== undefined && { description: optionalText(input.description) }),
            ...(input.status !== undefined && { status: parseMilestoneStatus(input.status) }),
        };

        const completionAwardedAt =
            input.status === MilestoneStatus.Completed && !existing.completionAwardedAt
                ? new Date()
                : null;

        return prisma.$transaction(async (tx) => {
            const milestone = await tx.milestone.update({
                where: { id: milestoneId },
                data: {
                    ...data,
                    ...(completionAwardedAt && { completionAwardedAt }),
                },
            });
            await rebuildProjectScoreEvents(tx, userId, projectId);
            return milestone;
        });
    },
};
