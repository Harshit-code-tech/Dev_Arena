import type { Request, Response } from "express";
import { projectService } from "./project.service";

// Scoring: Work session = 3pt, Milestone completed = 8pt, Project completed = 20pt
// Rules: edit/delete logs only within 24 hours of creation

export const getProjects = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(projectService.getProjects());
};

export const createProject = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(projectService.createProject());
};

export const updateProject = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(projectService.updateProject());
};

export const addLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(projectService.addLog());
};

export const updateLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(projectService.updateLog());
};

export const deleteLog = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(projectService.deleteLog());
};

export const addMilestone = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(projectService.addMilestone());
};

export const updateMilestone = async (_req: Request, res: Response): Promise<void> => {
    res.status(501).json(projectService.updateMilestone());
};
