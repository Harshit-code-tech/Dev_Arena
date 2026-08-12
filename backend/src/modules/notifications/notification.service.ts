import { prisma } from "../../database/prisma";

const PLAYER_REQUEST_ENTITY = "player_request";

/**
 * Removes actionable request notifications whose underlying request no longer exists.
 * This is a defensive cleanup for requests resolved by another tab/device or by an
 * older backend process that did not remove the notification itself.
 */
export async function pruneResolvedPlayerRequestNotifications(userId: string) {
  await prisma.notification.deleteMany({
    where: { userId, entityType: "player_request_result" },
  });
  const pendingRequests = await prisma.friendRequest.findMany({
    where: { receiverId: userId, status: "Pending" },
    select: { id: true },
  });
  const pendingIds = pendingRequests.map((request) => request.id);

  return prisma.notification.deleteMany({
    where: {
      userId,
      entityType: PLAYER_REQUEST_ENTITY,
      ...(pendingIds.length > 0
        ? { entityId: { notIn: pendingIds } }
        : {}),
    },
  });
}
