import type { Request, Response } from "express";
import { sendTrackingError } from "../../shared/utils/tracking";
import { projectService } from "./project.service";
import type { MilestoneInput, ProjectInput, ProjectLogInput } from "./project.types";

function userId(req: Request) {
    return req.user?.id || "";
}

function fail(res: Response, error: unknown) {
    const result = sendTrackingError(error);
    res.status(result.status).json({ success: false, message: result.message });
}

export const getProjects = async (req: Request, res: Response): Promise<void> => {
    try {
        res.status(200).json({ success: true, data: await projectService.getProjects(userId(req)) });
    } catch (error) { fail(res, error); }
};

export const createProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const project = await projectService.createProject(userId(req), req.body as Partial<ProjectInput>);
        res.status(201).json({ success: true, data: project });
    } catch (error) { fail(res, error); }
};

export const updateProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const project = await projectService.updateProject(userId(req), req.params.id as string, req.body as Partial<ProjectInput>);
        res.status(200).json({ success: true, data: project });
    } catch (error) { fail(res, error); }
};

export const addLog = async (req: Request, res: Response): Promise<void> => {
    try {
        const log = await projectService.addLog(userId(req), req.params.id as string, req.body as Partial<ProjectLogInput>);
        res.status(201).json({ success: true, data: log });
    } catch (error) { fail(res, error); }
};

export const updateLog = async (req: Request, res: Response): Promise<void> => {
    try {
        const log = await projectService.updateLog(userId(req), req.params.id as string, req.params.logId as string, req.body as Partial<ProjectLogInput>);
        res.status(200).json({ success: true, data: log });
    } catch (error) { fail(res, error); }
};

export const deleteLog = async (req: Request, res: Response): Promise<void> => {
    try {
        await projectService.deleteLog(userId(req), req.params.id as string, req.params.logId as string);
        res.status(200).json({ success: true, message: "Project session deleted." });
    } catch (error) { fail(res, error); }
};

export const addMilestone = async (req: Request, res: Response): Promise<void> => {
    try {
        const milestone = await projectService.addMilestone(userId(req), req.params.id as string, req.body as Partial<MilestoneInput>);
        res.status(201).json({ success: true, data: milestone });
    } catch (error) { fail(res, error); }
};

export const updateMilestone = async (req: Request, res: Response): Promise<void> => {
    try {
        const milestone = await projectService.updateMilestone(userId(req), req.params.id as string, req.params.msId as string, req.body as Partial<MilestoneInput>);
        res.status(200).json({ success: true, data: milestone });
    } catch (error) { fail(res, error); }
};

export const updateSharing = async (req: Request, res: Response): Promise<void> => {
    try {
        const project = await projectService.setSharing(
            userId(req),
            req.params.id as string,
            req.body?.enabled === true,
        );
        res.status(200).json({ success: true, data: project });
    } catch (error) { fail(res, error); }
};

export const getSharedProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const project = await projectService.getSharedProject(req.params.shareSlug as string);
        res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
        res.status(200).json({ success: true, data: project });
    } catch (error) { fail(res, error); }
};



export const attachGitHubRepository = async (req: Request, res: Response): Promise<void> => {
    try {
        const project = await projectService.attachRepository(userId(req), req.params.id as string, req.body?.repositoryUrl);
        res.status(200).json({ success: true, data: project });
    } catch (error) { fail(res, error); }
};

export const refreshGitHubRepository = async (req: Request, res: Response): Promise<void> => {
    try {
        const project = await projectService.refreshRepositoryLanguages(userId(req), req.params.id as string);
        res.status(200).json({ success: true, data: project });
    } catch (error) { fail(res, error); }
};

export const reverifyGitHubRepositories = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await projectService.reverifyAllRepositories(userId(req));
        res.status(200).json({ success: true, data: result });
    } catch (error) { fail(res, error); }
};
