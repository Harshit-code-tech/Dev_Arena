import type { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma";

type RealtimeDatabase = Prisma.TransactionClient | typeof prisma;

type RealtimeEventInput = {
  userId?: string | null;
  type: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown> | null;
};

function jsonPayload(payload: RealtimeEventInput["payload"]): Prisma.InputJsonValue | undefined {
  if (!payload) return undefined;
  return payload as Prisma.InputJsonValue;
}

export async function publishRealtimeEvent(
  input: RealtimeEventInput,
  database: RealtimeDatabase = prisma,
) {
  return database.realtimeEvent.create({
    data: {
      userId: input.userId ?? null,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      ...(input.payload ? { payload: jsonPayload(input.payload) } : {}),
    },
  });
}

export async function publishRealtimeEvents(
  userIds: Array<string | null | undefined>,
  input: Omit<RealtimeEventInput, "userId">,
  database: RealtimeDatabase = prisma,
) {
  const recipients = Array.from(new Set(userIds.filter((value): value is string => Boolean(value))));
  if (recipients.length === 0) return;

  await database.realtimeEvent.createMany({
    data: recipients.map((userId) => ({
      userId,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      ...(input.payload ? { payload: jsonPayload(input.payload) } : {}),
    })),
  });
}

export async function publishProfileChanged(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  const connectedUserIds = friendships.map((item) => item.userAId === userId ? item.userBId : item.userAId);

  await publishRealtimeEvents([userId, ...connectedUserIds], {
    type: "profile.changed",
    entityType: "user",
    entityId: userId,
    payload: { userId },
  });
}

export async function trimRealtimeEvents() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.realtimeEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
