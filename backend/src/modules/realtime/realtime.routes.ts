import { Router } from "express";

import { prisma } from "../../database/prisma";
import { protect } from "../../middleware/auth.middleware";
import { trimRealtimeEvents } from "./realtime.service";

const router = Router();
router.use(protect);

router.get("/stream", async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: "Not authorized." });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const requestedCursor = String(req.query.cursor || "").trim();
  let cursor = 0n;
  if (/^\d+$/.test(requestedCursor)) {
    cursor = BigInt(requestedCursor);
  } else {
    const latest = await prisma.realtimeEvent.findFirst({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: { id: "desc" },
      select: { id: true },
    });
    cursor = latest?.id ?? 0n;
  }

  const writeEvent = (event: string, data: unknown, id?: bigint) => {
    if (id !== undefined) res.write(`id: ${id.toString()}\n`);
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  writeEvent("ready", { cursor: cursor.toString(), syncedAt: new Date().toISOString() });

  let closed = false;
  let reading = false;

  const readEvents = async () => {
    if (closed || reading) return;
    reading = true;
    try {
      const events = await prisma.realtimeEvent.findMany({
        where: {
          id: { gt: cursor },
          OR: [{ userId }, { userId: null }],
        },
        orderBy: { id: "asc" },
        take: 100,
      });

      for (const event of events) {
        cursor = event.id;
        writeEvent("sync", {
          id: event.id.toString(),
          type: event.type,
          entityType: event.entityType,
          entityId: event.entityId,
          payload: event.payload,
          createdAt: event.createdAt.toISOString(),
        }, event.id);
      }
    } catch (error) {
      console.error("Realtime stream read failed:", error);
    } finally {
      reading = false;
    }
  };

  const eventTimer = setInterval(() => void readEvents(), 1200);
  const heartbeatTimer = setInterval(() => {
    if (!closed) res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15000);

  if (Math.random() < 0.05) void trimRealtimeEvents().catch(() => undefined);

  req.on("close", () => {
    closed = true;
    clearInterval(eventTimer);
    clearInterval(heartbeatTimer);
    res.end();
  });
});

export default router;
