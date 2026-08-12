import type { Request, Response } from "express";
import { settingsService } from "./settings.service";
import { renderAccountExportDocument } from "./account-export-document";

function userId(req: Request) {
  return req.user?.id || "";
}

function sendError(res: Response, error: unknown) {
  const typed = error as Error & { statusCode?: number };
  res.status(typed.statusCode || 500).json({ success: false, message: typed.message || "Request failed." });
}

export async function getSettings(req: Request, res: Response) {
  try {
    res.json({ success: true, data: await settingsService.getSettings(userId(req)) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function updatePreferences(req: Request, res: Response) {
  try {
    res.json({ success: true, data: await settingsService.updatePreferences(userId(req), req.body) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function updateProfilePhoto(req: Request, res: Response) {
  try {
    res.json({ success: true, data: await settingsService.updateProfilePhoto(userId(req), req.body) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function requestIdentityChange(req: Request, res: Response) {
  try {
    res.json({ success: true, data: await settingsService.requestIdentityChange(userId(req), req.body) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function confirmIdentityChange(req: Request, res: Response) {
  try {
    res.json({ success: true, data: await settingsService.confirmIdentityChange(userId(req), String(req.body?.otp || "")) });
  } catch (error) {
    sendError(res, error);
  }
}

export async function exportAccount(req: Request, res: Response) {
  try {
    const payload = await settingsService.exportAccount(userId(req));
    const html = renderAccountExportDocument(payload as unknown as Record<string, unknown>);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=devarena-data-report-${new Date().toISOString().slice(0, 10)}.html`);
    res.status(200).send(html);
  } catch (error) {
    sendError(res, error);
  }
}

export async function deleteAccount(req: Request, res: Response) {
  try {
    res.json({ success: true, data: await settingsService.deleteAccount(userId(req), String(req.body?.confirmation || "")) });
  } catch (error) {
    sendError(res, error);
  }
}
