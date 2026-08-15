import type { Request, Response } from "express";
import { activityService } from "./activity.service";

export async function getDayActivity(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Not authenticated." });
      return;
    }
    const timezoneOffset = Number(req.query.timezoneOffset || 0);
    const data = await activityService.getDay(userId, String(req.params.date || ""), timezoneOffset);
    res.json({ success: true, data });
  } catch (error) {
    const typed = error as Error & { statusCode?: number };
    res.status(typed.statusCode || 500).json({ success: false, message: typed.message || "Activity could not be loaded." });
  }
}
