import type { Request, Response } from "express";
import { friendService } from "./friend.service";

function userId(req: Request) { return req.user?.id || ""; }
function sendError(res: Response, error: unknown) {
  const typed = error as Error & { statusCode?: number };
  res.status(typed.statusCode || 500).json({ success: false, message: typed.message || "Request failed." });
}

export async function overview(req: Request, res: Response) {
  try { res.json({ success: true, data: await friendService.getOverview(userId(req)) }); } catch (e) { sendError(res, e); }
}
export async function search(req: Request, res: Response) {
  try { res.json({ success: true, data: await friendService.search(userId(req), String(req.query.q || "")) }); } catch (e) { sendError(res, e); }
}
export async function request(req: Request, res: Response) {
  try { res.status(201).json({ success: true, data: await friendService.sendRequest(userId(req), String(req.params.userId)) }); } catch (e) { sendError(res, e); }
}
export async function invite(req: Request, res: Response) {
  try { res.status(201).json({ success: true, data: await friendService.inviteByEmail(userId(req), String(req.body?.email || "")) }); } catch (e) { sendError(res, e); }
}
export async function accept(req: Request, res: Response) {
  try { res.json({ success: true, data: await friendService.acceptRequest(userId(req), String(req.params.id)) }); } catch (e) { sendError(res, e); }
}
export async function decline(req: Request, res: Response) {
  try { res.json({ success: true, data: await friendService.declineRequest(userId(req), String(req.params.id)) }); } catch (e) { sendError(res, e); }
}
export async function cancel(req: Request, res: Response) {
  try { res.json({ success: true, data: await friendService.cancelRequest(userId(req), String(req.params.id)) }); } catch (e) { sendError(res, e); }
}
export async function remove(req: Request, res: Response) {
  try { res.json({ success: true, data: await friendService.removeFriend(userId(req), String(req.params.friendId)) }); } catch (e) { sendError(res, e); }
}

export async function claimInvite(req: Request, res: Response) {
  try { res.json({ success: true, data: await friendService.claimInvite(userId(req), String(req.body?.token || "")) }); } catch (e) { sendError(res, e); }
}
