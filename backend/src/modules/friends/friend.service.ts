import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { sendDevArenaEmail } from "../../shared/utils/email";
import { publishRealtimeEvents } from "../realtime/realtime.service";

function httpError(message: string, statusCode = 400) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}


type LiveTopTechStackItem = {
  name: string;
  percentage: number;
  projectCount: number;
};

function normalizeTopTechStack(value: unknown): LiveTopTechStackItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      const percentage = Number(record.percentage);
      const projectCount = Number(record.projectCount);
      if (!name || !Number.isFinite(percentage)) return [];
      return [{
        name,
        percentage: Math.max(0, Math.min(100, percentage)),
        projectCount: Number.isFinite(projectCount) && projectCount > 0 ? Math.trunc(projectCount) : 0,
      }];
    })
    .slice(0, 3);
}

function decoratePerson<T extends { topTechStack?: unknown }>(person: T) {
  return { ...person, topTechStack: normalizeTopTechStack(person.topTechStack) };
}

const PERSON_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  avatarUrl: true,
  useInitials: true,
  rank: true,
  arenaScore: true,
  topTechStack: true,
  topTechStackUpdatedAt: true,
  topTechStackProjectCount: true,
} as const;

const PUBLIC_PERSON_SELECT = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
  useInitials: true,
  rank: true,
  arenaScore: true,
  topTechStack: true,
  topTechStackUpdatedAt: true,
  topTechStackProjectCount: true,
} as const;

async function publishPlayerState(
  userIds: string[],
  entityId?: string,
  notificationUserIds: string[] = [],
) {
  const jobs: Promise<unknown>[] = [
    publishRealtimeEvents(userIds, {
      type: "players.changed",
      entityType: "player-network",
      entityId: entityId || null,
    }),
  ];
  if (notificationUserIds.length > 0) {
    jobs.push(publishRealtimeEvents(notificationUserIds, {
      type: "notifications.changed",
      entityType: "notification",
      entityId: entityId || null,
    }));
  }
  const results = await Promise.allSettled(jobs);
  for (const result of results) {
    if (result.status === "rejected") console.error("Realtime player sync failed:", result.reason);
  }
}

const PLAYER_REQUEST_NOTIFICATION_ENTITY = "player_request";

async function removeResolvedRequestNotification(
  tx: Prisma.TransactionClient,
  request: {
    id: string;
    receiverId: string;
    createdAt: Date;
    sender: { name: string };
  },
) {
  const exactMessage = `${request.sender.name} sent you a player request.`;
  const deleted = await tx.notification.deleteMany({
    where: {
      userId: request.receiverId,
      OR: [
        { entityType: PLAYER_REQUEST_NOTIFICATION_ENTITY, entityId: request.id },
        { entityType: null, link: "/players", message: exactMessage },
      ],
    },
  });

  // Older notifications did not store an entity id. If the sender changed their
  // display name since sending the request, remove the notification created at
  // the same time as the request instead of leaving a stale action behind.
  if (deleted.count === 0) {
    const createdFrom = new Date(request.createdAt.getTime() - 60_000);
    const createdTo = new Date(request.createdAt.getTime() + 5 * 60_000);
    const legacy = await tx.notification.findFirst({
      where: {
        userId: request.receiverId,
        entityType: null,
        link: "/players",
        message: { endsWith: " sent you a player request." },
        createdAt: { gte: createdFrom, lte: createdTo },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (legacy) await tx.notification.delete({ where: { id: legacy.id } });
  }
}

function pair(userId: string, otherId: string) {
  return userId.localeCompare(otherId) < 0
    ? { userAId: userId, userBId: otherId }
    : { userAId: otherId, userBId: userId };
}

async function relationshipState(userId: string, otherId: string) {
  const ids = pair(userId, otherId);
  const [friendship, outgoing, incoming] = await Promise.all([
    prisma.friendship.findUnique({ where: { userAId_userBId: ids } }),
    prisma.friendRequest.findUnique({ where: { senderId_receiverId: { senderId: userId, receiverId: otherId } } }),
    prisma.friendRequest.findUnique({ where: { senderId_receiverId: { senderId: otherId, receiverId: userId } } }),
  ]);

  if (friendship) return "friends" as const;
  if (outgoing?.status === "Pending") return "outgoing" as const;
  if (incoming?.status === "Pending") return "incoming" as const;
  return "none" as const;
}

async function createFriendRequest(senderId: string, receiverId: string) {
  if (senderId === receiverId) throw httpError("You cannot send a player request to yourself.");
  const block = await prisma.playerBlock.findFirst({
    where: {
      OR: [
        { blockerId: senderId, blockedId: receiverId },
        { blockerId: receiverId, blockedId: senderId },
      ],
    },
    select: { blockerId: true },
  });
  if (block) throw httpError(
    block.blockerId === senderId
      ? "Unblock this player before sending a request."
      : "This player request is unavailable.",
    403,
  );
  const state = await relationshipState(senderId, receiverId);
  if (state === "friends") throw httpError("You are already connected as players.", 409);
  if (state === "outgoing") throw httpError("A player request is already pending.", 409);
  if (state === "incoming") throw httpError("This player already sent you a request. Accept it from Incoming Requests.", 409);

  const [sender, receiver] = await Promise.all([
    prisma.user.findUnique({ where: { id: senderId }, select: PERSON_SELECT }),
    prisma.user.findUnique({ where: { id: receiverId }, select: { ...PERSON_SELECT, friendRequestEmails: true, inAppNotifications: true } }),
  ]);
  if (!sender || !receiver) throw httpError("Developer not found.", 404);

  const request = await prisma.friendRequest.upsert({
    where: { senderId_receiverId: { senderId, receiverId } },
    update: { status: "Pending" },
    create: { senderId, receiverId },
    include: { sender: { select: PERSON_SELECT }, receiver: { select: PERSON_SELECT } },
  });

  if (receiver.inAppNotifications) {
    await prisma.notification.create({
      data: {
        userId: receiverId,
        type: "system",
        message: `${sender.name} sent you a player request.`,
        link: "/players",
        entityType: PLAYER_REQUEST_NOTIFICATION_ENTITY,
        entityId: request.id,
      },
    });
  }

  await publishPlayerState([senderId, receiverId], request.id, receiver.inAppNotifications ? [receiverId] : []);

  if (receiver.friendRequestEmails) {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    await sendDevArenaEmail(
      receiver.email,
      `${sender.name} sent you a DevArena player request`,
      {
        eyebrow: "DevArena players",
        title: `${sender.name} wants to connect`,
        paragraphs: [
          `@${sender.username} sent you a player request on DevArena.`,
          "Open your player requests to accept or decline the connection.",
        ],
        action: { label: "Open player requests", url: `${frontendUrl}/players` },
      },
    );
  }

  return request;
}

export const friendService = {
  async getOverview(userId: string) {
    const [friendships, incoming, outgoing, invites] = await Promise.all([
      prisma.friendship.findMany({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
        orderBy: { createdAt: "desc" },
        include: { userA: { select: PERSON_SELECT }, userB: { select: PERSON_SELECT } },
      }),
      prisma.friendRequest.findMany({
        where: { receiverId: userId, status: "Pending" },
        orderBy: { createdAt: "desc" },
        include: { sender: { select: PERSON_SELECT } },
      }),
      prisma.friendRequest.findMany({
        where: { senderId: userId, status: "Pending" },
        orderBy: { createdAt: "desc" },
        include: { receiver: { select: PERSON_SELECT } },
      }),
      prisma.emailInvite.findMany({
        where: { senderId: userId, status: "Pending" },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, createdAt: true, expiresAt: true, status: true },
      }),
    ]);

    return {
      friends: friendships.map((item) => ({
        friendshipId: item.id,
        friend: decoratePerson(item.userAId === userId ? item.userB : item.userA),
        friendsSince: item.createdAt,
      })),
      incomingRequests: incoming.map((item) => ({ id: item.id, user: decoratePerson(item.sender), createdAt: item.createdAt })),
      outgoingRequests: outgoing.map((item) => ({ id: item.id, user: decoratePerson(item.receiver), createdAt: item.createdAt })),
      emailInvites: invites,
    };
  },

  async search(userId: string, query: string) {
    const q = query.trim();
    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
                { username: { contains: q.replace(/^@/, ""), mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ arenaScore: "desc" }, { name: "asc" }],
      select: PUBLIC_PERSON_SELECT,
    });

    if (users.length === 0) return [];

    const targetIds = users.map((user) => user.id);
    const [friendships, requests] = await Promise.all([
      prisma.friendship.findMany({
        where: {
          OR: [
            { userAId: userId, userBId: { in: targetIds } },
            { userBId: userId, userAId: { in: targetIds } },
          ],
        },
        select: { userAId: true, userBId: true },
      }),
      prisma.friendRequest.findMany({
        where: {
          status: "Pending",
          OR: [
            { senderId: userId, receiverId: { in: targetIds } },
            { receiverId: userId, senderId: { in: targetIds } },
          ],
        },
        select: { senderId: true, receiverId: true },
      }),
    ]);

    const friendIds = new Set(friendships.map((item) => item.userAId === userId ? item.userBId : item.userAId));
    const outgoingIds = new Set(requests.filter((item) => item.senderId === userId).map((item) => item.receiverId));
    const incomingIds = new Set(requests.filter((item) => item.receiverId === userId).map((item) => item.senderId));

    return users.map((user) => ({
      ...decoratePerson(user),
      relationship: friendIds.has(user.id)
        ? "friends" as const
        : outgoingIds.has(user.id)
          ? "outgoing" as const
          : incomingIds.has(user.id)
            ? "incoming" as const
            : "none" as const,
    }));
  },

  async sendRequest(userId: string, receiverId: string) {
    return createFriendRequest(userId, receiverId);
  },

  async inviteByEmail(userId: string, rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError("Enter a valid email address.");

    const sender = await prisma.user.findUnique({ where: { id: userId }, select: PERSON_SELECT });
    if (!sender) throw httpError("User not found.", 404);
    if (sender.email === email) throw httpError("You cannot invite your own email address.");

    const registered = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (registered) {
      const request = await createFriendRequest(userId, registered.id);
      return { type: "request", request, message: "Player request sent to the registered developer." };
    }

    const token = randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await prisma.emailInvite.upsert({
      where: { senderId_email: { senderId: userId, email } },
      update: { token, status: "Pending", expiresAt },
      create: { senderId: userId, email, token, expiresAt },
    });

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const inviteUrl = `${frontendUrl}/signup?invite=${token}`;
    const sent = await sendDevArenaEmail(
      email,
      `${sender.name} invited you to DevArena`,
      {
        eyebrow: "DevArena invitation",
        title: `Build with ${sender.name}`,
        paragraphs: [
          "Create your developer profile, track real work, and connect with your network.",
        ],
        action: { label: "Accept invitation", url: inviteUrl },
      },
    );
    if (!sent) throw httpError("The invitation email could not be sent.", 502);

    await publishPlayerState([userId], invite.id);
    return { type: "email", invite, message: "Invitation email sent." };
  },


  async claimInvite(userId: string, token: string) {
    const invite = await prisma.emailInvite.findUnique({
      where: { token },
      include: { sender: { select: PERSON_SELECT } },
    });
    if (!invite || invite.status !== "Pending") throw httpError("Invitation is no longer available.", 404);
    if (new Date() > invite.expiresAt) {
      await prisma.emailInvite.update({ where: { id: invite.id }, data: { status: "Expired" } });
      throw httpError("Invitation has expired.", 410);
    }

    const recipient = await prisma.user.findUnique({ where: { id: userId }, select: PERSON_SELECT });
    if (!recipient) throw httpError("User not found.", 404);
    if (recipient.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw httpError("This invitation belongs to a different email address.", 403);
    }
    if (invite.senderId === userId) throw httpError("You cannot accept your own invitation.");

    const ids = pair(invite.senderId, userId);
    await prisma.$transaction(async (tx) => {
      await tx.friendship.upsert({ where: { userAId_userBId: ids }, update: {}, create: ids });
      await tx.emailInvite.update({ where: { id: invite.id }, data: { status: "Accepted" } });
    });

    await Promise.all([
      publishPlayerState([invite.senderId, userId], invite.id),
      publishRealtimeEvents([invite.senderId], {
        type: "toast.player_request_accepted",
        entityType: "player",
        entityId: userId,
        payload: { message: `${recipient.name} accepted your invitation.` },
      }),
    ]);
    return { message: `You are now connected with ${invite.sender.name}.` };
  },

  async acceptRequest(userId: string, requestId: string) {
    const request = await prisma.friendRequest.findFirst({
      where: { id: requestId, receiverId: userId, status: "Pending" },
      include: { sender: { select: { name: true } }, receiver: { select: { name: true } } },
    });
    if (!request) throw httpError("Player request not found.", 404);
    const ids = pair(request.senderId, request.receiverId);

    const friendship = await prisma.$transaction(async (tx) => {
      const nextFriendship = await tx.friendship.upsert({ where: { userAId_userBId: ids }, update: {}, create: ids });
      await removeResolvedRequestNotification(tx, request);
      await tx.friendRequest.deleteMany({
        where: {
          OR: [
            { senderId: request.senderId, receiverId: request.receiverId },
            { senderId: request.receiverId, receiverId: request.senderId },
          ],
        },
      });
      return nextFriendship;
    });
    await Promise.all([
      publishPlayerState(
        [request.senderId, request.receiverId],
        request.id,
        [request.receiverId],
      ),
      publishRealtimeEvents([request.senderId], {
        type: "toast.player_request_accepted",
        entityType: "player",
        entityId: request.receiverId,
        payload: { message: `${request.receiver.name} accepted your player request.` },
      }),
    ]);
    return friendship;
  },

  async declineRequest(userId: string, requestId: string) {
    const request = await prisma.friendRequest.findFirst({
      where: { id: requestId, receiverId: userId, status: "Pending" },
      include: { sender: { select: { name: true } } },
    });
    if (!request) throw httpError("Player request not found.", 404);
    await prisma.$transaction(async (tx) => {
      await removeResolvedRequestNotification(tx, request);
      await tx.friendRequest.delete({ where: { id: requestId } });
    });
    await publishPlayerState(
      [request.senderId, request.receiverId],
      request.id,
      [request.receiverId],
    );
    return { message: "Player request declined." };
  },

  async cancelRequest(userId: string, requestId: string) {
    const request = await prisma.friendRequest.findFirst({
      where: { id: requestId, senderId: userId, status: "Pending" },
      include: { sender: { select: { name: true } } },
    });
    if (!request) throw httpError("Player request not found.", 404);
    await prisma.$transaction(async (tx) => {
      await removeResolvedRequestNotification(tx, request);
      await tx.friendRequest.delete({ where: { id: requestId } });
    });
    await publishPlayerState(
      [request.senderId, request.receiverId],
      request.id,
      [request.receiverId],
    );
    return { message: "Player request cancelled." };
  },

  async removeFriend(userId: string, friendId: string) {
    const ids = pair(userId, friendId);
    const result = await prisma.friendship.deleteMany({ where: ids });
    if (result.count === 0) throw httpError("Player connection not found.", 404);
    await publishPlayerState([userId, friendId], friendId);
    return { message: "Player removed." };
  },
};
