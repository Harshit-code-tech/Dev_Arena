import { Router } from "express";

import { prisma } from "../../database/prisma";
import { protect } from "../../middleware/auth.middleware";
import { publishRealtimeEvent } from "../realtime/realtime.service";
import { pruneResolvedPlayerRequestNotifications } from "./notification.service";

const router = Router();
router.use(protect);

router.get("/", async (req, res) => {
  const userId = req.user?.id || "";
  const requestedLimit = Number(req.query.limit || 20);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50)
    : 20;
  await pruneResolvedPlayerRequestNotifications(userId);
  const data = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
  res.json({ success: true, data });
});

router.get("/unread-count", async (req, res) => {
  const userId = req.user?.id || "";
  await pruneResolvedPlayerRequestNotifications(userId);
  const count = await prisma.notification.count({ where: { userId, isRead: false } });
  res.json({ success: true, data: { count } });
});

router.patch("/:id/read", async (req, res) => {
  const userId = req.user?.id || "";
  const result = await prisma.notification.updateMany({
    where: { id: String(req.params.id), userId },
    data: { isRead: true },
  });
  if (result.count) {
    await publishRealtimeEvent({
      userId,
      type: "notifications.changed",
      entityType: "notification",
      entityId: String(req.params.id),
    }).catch((error) => console.error("Notification sync failed:", error));
  }
  res.status(result.count ? 200 : 404).json({ success: result.count > 0 });
});

router.patch("/read-all", async (req, res) => {
  const userId = req.user?.id || "";
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
  await publishRealtimeEvent({
    userId,
    type: "notifications.changed",
    entityType: "notification",
  }).catch((error) => console.error("Notification sync failed:", error));
  res.json({ success: true });
});

export default router;
