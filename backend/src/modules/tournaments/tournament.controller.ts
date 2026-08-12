import type { Request, Response } from "express";
import { tournamentService } from "./tournament.service";

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
    res.status(error.statusCode || 500).json({ success: false, message: error.message || "Tournament request failed." });
  }
}

export const getGlobalLeaderboard = (req: Request, res: Response) => send(res, () => tournamentService.globalLeaderboard(userId(req)));
export const listTournaments = (req: Request, res: Response) => send(res, () => tournamentService.list(userId(req), String(req.query.tab || "Upcoming")));
export const getTournament = (req: Request, res: Response) => send(res, () => tournamentService.detail(userId(req), String(req.params.tournamentId)));
export const registerTournament = (req: Request, res: Response) => send(res, () => tournamentService.register(userId(req), String(req.params.tournamentId), req.body || {}), true);
export const submitDsa = (req: Request, res: Response) => send(res, () => tournamentService.submitDsa(userId(req), String(req.params.tournamentId), req.body || {}), true);
export const saveProjectSubmission = (req: Request, res: Response) => send(res, () => tournamentService.saveProjectSubmission(userId(req), String(req.params.tournamentId), req.body || {}), true);
export const getLeaderboard = (req: Request, res: Response) => send(res, () => tournamentService.leaderboard(userId(req), String(req.params.tournamentId)));
