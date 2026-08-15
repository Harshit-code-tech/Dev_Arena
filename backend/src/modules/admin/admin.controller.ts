import type { Request, Response } from "express";
import { adminService } from "./admin.service";

function userId(req: Request) {
  if (!req.user?.id) throw Object.assign(new Error("Not authenticated"), { statusCode: 401 });
  return req.user.id;
}

async function send(res: Response, action: () => Promise<unknown>, created = false) {
  try {
    const data = await action();
    res.status(created ? 201 : 200).json({ success: true, data });
  } catch (reason) {
    const error = reason as Error & { statusCode?: number };
    res.status(error.statusCode || 500).json({ success: false, message: error.message || "Admin request failed." });
  }
}

export const heartbeat = (req: Request, res: Response) => send(res, () => adminService.heartbeat(userId(req), req.body || {}));
export const access = (req: Request, res: Response) => send(res, () => adminService.access(userId(req)));
export const overview = (_req: Request, res: Response) => send(res, () => adminService.overview());
export const presenceHistory = (req: Request, res: Response) => send(res, () => adminService.presenceHistory(Number(req.query.hours) || 24));
export const metrics = (req: Request, res: Response) => send(res, () => adminService.metrics(Number(req.query.hours) || 24));
export const listTournaments = (_req: Request, res: Response) => send(res, () => adminService.listTournaments());
export const createTournament = (req: Request, res: Response) => send(res, () => adminService.createTournament(userId(req), req.body || {}), true);
export const updateTournament = (req: Request, res: Response) => send(res, () => adminService.updateTournament(userId(req), String(req.params.tournamentId), req.body || {}));
export const createQuestion = (req: Request, res: Response) => send(res, () => adminService.createQuestion(userId(req), String(req.params.tournamentId), req.body || {}), true);
export const listQuestions = (req: Request, res: Response) => send(res, () => adminService.listQuestions(String(req.params.tournamentId)));
export const listSubmissions = (req: Request, res: Response) => send(res, () => adminService.listSubmissions(req.query.tournamentId ? String(req.query.tournamentId) : undefined));
export const reviewDsa = (req: Request, res: Response) => send(res, () => adminService.reviewDsa(userId(req), String(req.params.submissionId), req.body || {}));
export const reviewProject = (req: Request, res: Response) => send(res, () => adminService.reviewProject(userId(req), String(req.params.submissionId), req.body || {}));
export const publishResults = (req: Request, res: Response) => send(res, () => adminService.publishResults(userId(req), String(req.params.tournamentId)));
export const createAnnouncement = (req: Request, res: Response) => send(res, () => adminService.createAnnouncement(userId(req), String(req.params.tournamentId), req.body || {}), true);
export const moderation = (_req: Request, res: Response) => send(res, () => adminService.moderation());
export const systemHealth = (_req: Request, res: Response) => send(res, () => adminService.systemHealth());
