import type { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma";
import { publishRealtimeEvent, publishRealtimeEvents } from "../realtime/realtime.service";

const PERSON_SELECT = {
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
  chatPublicKey: true,
  chatKeyVersion: true,
} as const;

const PUBLIC_OWNER_SELECT = {
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

function error(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function sameChatPublicKey(left: unknown, right: unknown) {
  if (!left || typeof left !== "object" || Array.isArray(left) || !right || typeof right !== "object" || Array.isArray(right)) return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  return a.kty === b.kty && a.crv === b.crv && a.x === b.x && a.y === b.y;
}


function text(value: unknown, label: string, min = 1, max = 5000) {
  if (typeof value !== "string") throw error(`${label} is required.`);
  const clean = value.trim();
  if (clean.length < min) throw error(`${label} must be at least ${min} characters.`);
  if (clean.length > max) throw error(`${label} must be at most ${max} characters.`);
  return clean;
}

function optionalText(value: unknown, max = 5000) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw error("Invalid text value.");
  const clean = value.trim();
  if (clean.length > max) throw error(`Text must be at most ${max} characters.`);
  return clean || null;
}

function integer(value: unknown, label: string, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw error(`${label} must be between ${min} and ${max}.`);
  }
  return parsed;
}

function stringArray(value: unknown, label: string, maxItems = 10) {
  if (!Array.isArray(value)) throw error(`${label} must be a list.`);
  const result = value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, maxItems);
  if (result.length === 0) throw error(`Add at least one ${label.toLowerCase()}.`);
  return Array.from(new Set(result));
}

function pair(userId: string, otherId: string) {
  return userId.localeCompare(otherId) < 0
    ? { userAId: userId, userBId: otherId }
    : { userAId: otherId, userBId: userId };
}

async function blockState(userId: string, otherId: string) {
  const blocks = await prisma.playerBlock.findMany({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherId },
        { blockerId: otherId, blockedId: userId },
      ],
    },
    select: { blockerId: true },
  });
  return {
    blockedByMe: blocks.some((item) => item.blockerId === userId),
    blockedMe: blocks.some((item) => item.blockerId === otherId),
  };
}

async function ensureInteractionAllowed(userId: string, otherId: string) {
  if (!otherId || otherId === userId) throw error("Choose another player.");
  const other = await prisma.user.findUnique({ where: { id: otherId }, select: { id: true } });
  if (!other) throw error("Player not found.", 404);
  const state = await blockState(userId, otherId);
  if (state.blockedByMe) throw error("Unblock this player before continuing.", 403);
  if (state.blockedMe) throw error("This interaction is unavailable.", 403);
}

async function connected(userId: string, otherId: string) {
  const ids = pair(userId, otherId);
  return Boolean(await prisma.friendship.findUnique({ where: { userAId_userBId: ids }, select: { id: true } }));
}

async function relationshipMaps(userId: string, targetIds: string[]) {
  const [friendships, requests, blocks] = await Promise.all([
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
    prisma.playerBlock.findMany({
      where: {
        OR: [
          { blockerId: userId, blockedId: { in: targetIds } },
          { blockedId: userId, blockerId: { in: targetIds } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  return {
    friends: new Set(friendships.map((item) => item.userAId === userId ? item.userBId : item.userAId)),
    outgoing: new Set(requests.filter((item) => item.senderId === userId).map((item) => item.receiverId)),
    incoming: new Set(requests.filter((item) => item.receiverId === userId).map((item) => item.senderId)),
    blockedByMe: new Set(blocks.filter((item) => item.blockerId === userId).map((item) => item.blockedId)),
    blockedMe: new Set(blocks.filter((item) => item.blockedId === userId).map((item) => item.blockerId)),
  };
}

function relationshipFor(
  id: string,
  maps: Awaited<ReturnType<typeof relationshipMaps>>,
) {
  if (maps.friends.has(id)) return "friends" as const;
  if (maps.outgoing.has(id)) return "outgoing" as const;
  if (maps.incoming.has(id)) return "incoming" as const;
  return "none" as const;
}

async function publishGlobal(type: string, entityType: string, entityId?: string | null) {
  await publishRealtimeEvent({ userId: null, type, entityType, entityId: entityId ?? null });
}

async function publishMessageState(
  userIds: string[],
  conversationId: string,
  changeType: "sent" | "delivered" | "read",
  actorUserId: string,
  messageId?: string,
) {
  await publishRealtimeEvents(userIds, {
    type: "player_hub.messages.changed",
    entityType: "direct_conversation",
    entityId: conversationId,
    payload: { conversationId, changeType, actorUserId, ...(messageId ? { messageId } : {}) },
  });
}

async function unreadCountForUser(userId: string) {
  const conversations = await prisma.directConversation.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true, userAId: true, userALastReadAt: true, userBLastReadAt: true },
  });
  const counts = await Promise.all(conversations.map((item) => prisma.directMessage.count({
    where: {
      conversationId: item.id,
      senderId: { not: userId },
      createdAt: { gt: item.userAId === userId ? item.userALastReadAt : item.userBLastReadAt },
      deletedAt: null,
    },
  })));
  return counts.reduce((sum, count) => sum + count, 0);
}

function projectProgress(project: {
  milestones: Array<{ status: string }>;
  logs: Array<{ activityDate: Date }>;
  updatedAt: Date;
}) {
  const totalMilestones = project.milestones.length;
  const completedMilestones = project.milestones.filter((item) => item.status === "Completed").length;
  return {
    completedMilestones,
    totalMilestones,
    milestoneProgress: totalMilestones === 0 ? 0 : Math.round((completedMilestones / totalMilestones) * 100),
    totalSessions: project.logs.length,
    lastActivityDate: project.logs[0]?.activityDate ?? project.updatedAt,
  };
}

export const playerHubService = {
  async getOverview(userId: string) {
    const [playerCount, sharedProjectCount, collaborationCount, communityCount, unreadMessages] = await Promise.all([
      prisma.user.count(),
      prisma.project.count({ where: { isShared: true } }),
      prisma.collaborationPost.count({ where: { status: "Open" } }),
      prisma.communityPost.count(),
      unreadCountForUser(userId),
    ]);
    return { playerCount, sharedProjectCount, collaborationCount, communityCount, unreadMessages };
  },

  async getPlayers(userId: string, query = "") {
    const q = query.trim().replace(/^@/, "");
    const users = await prisma.user.findMany({
      where: {
        id: { not: userId },
        ...(q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
        } : {}),
      },
      orderBy: [{ arenaScore: "desc" }, { name: "asc" }],
      take: 100,
      select: PERSON_SELECT,
    });
    const maps = await relationshipMaps(userId, users.map((item) => item.id));
    return users
      .filter((item) => !maps.blockedMe.has(item.id))
      .map((item) => ({
        ...item,
        relationship: relationshipFor(item.id, maps),
        blockedByMe: maps.blockedByMe.has(item.id),
        chatReady: Boolean(item.chatPublicKey),
      }));
  },

  async getPlayerWork(userId: string, playerId: string) {
    await ensureInteractionAllowed(userId, playerId);

    const player = await prisma.user.findUnique({
      where: { id: playerId },
      select: {
        ...PUBLIC_OWNER_SELECT,
        activeDays: true,
        streak: true,
      },
    });
    if (!player) throw error("Player not found.", 404);

    const [dsaLogs, dsaTotal, dsaScoreEvents, projects, projectTotal] = await Promise.all([
      prisma.dSALog.findMany({
        where: { userId: playerId },
        orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: {
          id: true,
          problemName: true,
          url: true,
          solutionUrl: true,
          difficulty: true,
          timeTaken: true,
          timeComplexity: true,
          spaceComplexity: true,
          notes: true,
          activityDate: true,
          createdAt: true,
        },
      }),
      prisma.dSALog.count({ where: { userId: playerId } }),
      prisma.scoreEvent.findMany({
        where: { userId: playerId, sourceType: "DSA_LOG" },
        select: { sourceId: true, points: true },
      }),
      prisma.project.findMany({
        where: { userId: playerId, isShared: true },
        orderBy: [{ sharedAt: "desc" }, { updatedAt: "desc" }],
        take: 50,
        include: {
          logs: { select: { activityDate: true }, orderBy: { activityDate: "desc" } },
          milestones: { select: { status: true } },
        },
      }),
      prisma.project.count({ where: { userId: playerId, isShared: true } }),
    ]);

    const dsaPoints = new Map(dsaScoreEvents.map((event) => [event.sourceId, event.points]));

    return {
      player,
      dsa: {
        total: dsaTotal,
        logs: dsaLogs.map((log) => ({
          ...log,
          points: dsaPoints.get(log.id) || 0,
        })),
      },
      projects: {
        total: projectTotal,
        items: projects.map((project) => ({
          id: project.id,
          title: project.title,
          description: project.description,
          domain: project.domain,
          status: project.status,
          startDate: project.startDate,
          shareSlug: project.shareSlug,
          sharedAt: project.sharedAt,
          updatedAt: project.updatedAt,
          repositoryUrl: project.githubRepositoryPrivate ? null : project.githubRepositoryUrl,
          languages: project.githubLanguages,
          languagesFetchedAt: project.githubLanguagesFetchedAt,
          metrics: projectProgress(project),
        })),
      },
    };
  },

  async getSharedProjects(userId: string) {
    const blocked = await prisma.playerBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const hiddenIds = new Set(blocked.map((item) => item.blockerId === userId ? item.blockedId : item.blockerId));
    const projects = await prisma.project.findMany({
      where: { isShared: true, userId: { notIn: [...hiddenIds] } },
      orderBy: [{ sharedAt: "desc" }, { updatedAt: "desc" }],
      take: 50,
      include: {
        user: { select: PUBLIC_OWNER_SELECT },
        logs: { select: { activityDate: true }, orderBy: { activityDate: "desc" } },
        milestones: { select: { status: true } },
        savedBy: { where: { userId }, select: { id: true } },
        _count: { select: { savedBy: true } },
      },
    });
    return projects.map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      domain: project.domain,
      status: project.status,
      shareSlug: project.shareSlug,
      sharedAt: project.sharedAt,
      updatedAt: project.updatedAt,
      github: project.githubRepositoryUrl ? {
        languages: project.githubLanguages,
        languagesFetchedAt: project.githubLanguagesFetchedAt,
      } : null,
      owner: project.user,
      metrics: projectProgress(project),
      savedByMe: project.savedBy.length > 0,
      saveCount: project._count.savedBy,
    }));
  },

  async setProjectSaved(userId: string, projectId: string, saved: boolean) {
    const project = await prisma.project.findFirst({ where: { id: projectId, isShared: true }, select: { id: true, userId: true } });
    if (!project) throw error("Shared project not found.", 404);
    await ensureInteractionAllowed(userId, project.userId).catch((reason) => {
      if (project.userId !== userId) throw reason;
    });
    if (saved) {
      await prisma.projectSave.upsert({
        where: { userId_projectId: { userId, projectId } },
        update: {},
        create: { userId, projectId },
      });
    } else {
      await prisma.projectSave.deleteMany({ where: { userId, projectId } });
    }
    await publishGlobal("player_hub.shared_projects.changed", "project", projectId);
    return { saved };
  },

  async getCollaborations(userId: string) {
    const blocked = await prisma.playerBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const hidden = blocked.map((item) => item.blockerId === userId ? item.blockedId : item.blockerId);
    const posts = await prisma.collaborationPost.findMany({
      where: { authorId: { notIn: hidden } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        author: { select: PUBLIC_OWNER_SELECT },
        applications: {
          where: { applicantId: userId },
          select: { id: true, status: true },
        },
        _count: { select: { applications: true } },
      },
    });
    return posts.map((post) => ({
      ...post,
      appliedByMe: post.applications.length > 0,
      myApplicationStatus: post.applications[0]?.status ?? null,
      applicationCount: post._count.applications,
      isOwner: post.authorId === userId,
      applications: undefined,
      _count: undefined,
    }));
  },

  async createCollaboration(userId: string, input: Record<string, unknown>) {
    const deadlineValue = input.deadline ? new Date(String(input.deadline)) : null;
    if (deadlineValue && Number.isNaN(deadlineValue.getTime())) throw error("Deadline is invalid.");
    const post = await prisma.collaborationPost.create({
      data: {
        authorId: userId,
        title: text(input.title, "Title", 5, 120),
        description: text(input.description, "Description", 20, 3000),
        type: text(input.type, "Collaboration type", 2, 60),
        domain: text(input.domain, "Domain", 2, 60),
        skills: stringArray(input.skills, "Skills", 10),
        commitment: text(input.commitment, "Commitment", 2, 80),
        positions: integer(input.positions ?? 1, "Positions", 1, 20),
        deadline: deadlineValue,
      },
      include: { author: { select: PUBLIC_OWNER_SELECT } },
    });
    await publishGlobal("player_hub.collaborations.changed", "collaboration_post", post.id);
    return post;
  },

  async applyToCollaboration(userId: string, postId: string, input: Record<string, unknown>) {
    const post = await prisma.collaborationPost.findUnique({ where: { id: postId }, select: { id: true, authorId: true, status: true, title: true } });
    if (!post || post.status !== "Open") throw error("This collaboration is no longer open.", 404);
    if (post.authorId === userId) throw error("You cannot apply to your own collaboration.");
    await ensureInteractionAllowed(userId, post.authorId);
    const application = await prisma.collaborationApplication.upsert({
      where: { postId_applicantId: { postId, applicantId: userId } },
      update: {
        introduction: text(input.introduction, "Introduction", 15, 1200),
        availability: text(input.availability, "Availability", 2, 120),
        status: "Pending",
      },
      create: {
        postId,
        applicantId: userId,
        introduction: text(input.introduction, "Introduction", 15, 1200),
        availability: text(input.availability, "Availability", 2, 120),
      },
    });
    await publishGlobal("player_hub.collaborations.changed", "collaboration_application", application.id);
    return application;
  },

  async getCollaborationApplications(userId: string, postId: string) {
    const post = await prisma.collaborationPost.findFirst({
      where: { id: postId, authorId: userId },
      select: { id: true },
    });
    if (!post) throw error("Collaboration not found.", 404);
    return prisma.collaborationApplication.findMany({
      where: { postId },
      orderBy: { createdAt: "desc" },
      include: { applicant: { select: PUBLIC_OWNER_SELECT } },
    });
  },

  async setCollaborationApplicationStatus(userId: string, postId: string, applicationId: string, status: string) {
    if (!["Pending", "Shortlisted", "Accepted", "Rejected"].includes(status)) {
      throw error("Application status is invalid.");
    }
    const application = await prisma.collaborationApplication.findFirst({
      where: { id: applicationId, postId, post: { authorId: userId } },
      include: { post: { select: { title: true } } },
    });
    if (!application) throw error("Application not found.", 404);
    const updated = await prisma.collaborationApplication.update({
      where: { id: applicationId },
      data: { status },
      include: { applicant: { select: PUBLIC_OWNER_SELECT } },
    });
    await publishGlobal("player_hub.collaborations.changed", "collaboration_application", applicationId);
    if (status !== "Pending") {
      await publishRealtimeEvents([application.applicantId], {
        type: "toast.collaboration_application",
        entityType: "collaboration_application",
        entityId: applicationId,
        payload: { message: `Your application for ${application.post.title} is now ${status.toLowerCase()}.` },
      });
    }
    return updated;
  },

  async setCollaborationStatus(userId: string, postId: string, status: string) {
    if (!["Open", "Closed"].includes(status)) throw error("Collaboration status is invalid.");
    const updated = await prisma.collaborationPost.updateMany({ where: { id: postId, authorId: userId }, data: { status } });
    if (updated.count === 0) throw error("Collaboration not found.", 404);
    await publishGlobal("player_hub.collaborations.changed", "collaboration_post", postId);
    return { status };
  },

  async getCommunityPosts(userId: string) {
    const blocked = await prisma.playerBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const hidden = blocked.map((item) => item.blockerId === userId ? item.blockedId : item.blockerId);
    const posts = await prisma.communityPost.findMany({
      where: { authorId: { notIn: hidden } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: { select: PUBLIC_OWNER_SELECT },
        reactions: { where: { userId }, select: { id: true } },
        saves: { where: { userId }, select: { id: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          take: 20,
          include: { author: { select: PUBLIC_OWNER_SELECT } },
        },
        _count: { select: { reactions: true, saves: true, comments: true } },
      },
    });
    return posts.map((post) => ({
      ...post,
      reactedByMe: post.reactions.length > 0,
      savedByMe: post.saves.length > 0,
      reactionCount: post._count.reactions,
      saveCount: post._count.saves,
      commentCount: post._count.comments,
      reactions: undefined,
      saves: undefined,
      _count: undefined,
    }));
  },

  async createCommunityPost(userId: string, input: Record<string, unknown>) {
    const post = await prisma.communityPost.create({
      data: {
        authorId: userId,
        type: text(input.type, "Post type", 2, 60),
        title: text(input.title, "Title", 5, 140),
        content: text(input.content, "Post content", 10, 5000),
        codeSnippet: optionalText(input.codeSnippet, 8000),
      },
      include: { author: { select: PUBLIC_OWNER_SELECT } },
    });
    await publishGlobal("player_hub.community.changed", "community_post", post.id);
    return post;
  },

  async setCommunityReaction(userId: string, postId: string, active: boolean) {
    const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
    if (!post) throw error("Community post not found.", 404);
    if (post.authorId !== userId) await ensureInteractionAllowed(userId, post.authorId);
    if (active) {
      await prisma.communityReaction.upsert({
        where: { postId_userId: { postId, userId } },
        update: {},
        create: { postId, userId },
      });
    } else {
      await prisma.communityReaction.deleteMany({ where: { postId, userId } });
    }
    await publishGlobal("player_hub.community.changed", "community_post", postId);
    return { active };
  },

  async setCommunitySaved(userId: string, postId: string, active: boolean) {
    const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
    if (!post) throw error("Community post not found.", 404);
    if (post.authorId !== userId) await ensureInteractionAllowed(userId, post.authorId);
    if (active) {
      await prisma.communitySave.upsert({ where: { postId_userId: { postId, userId } }, update: {}, create: { postId, userId } });
    } else {
      await prisma.communitySave.deleteMany({ where: { postId, userId } });
    }
    await publishGlobal("player_hub.community.changed", "community_post", postId);
    return { active };
  },

  async addCommunityComment(userId: string, postId: string, content: unknown) {
    const post = await prisma.communityPost.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
    if (!post) throw error("Community post not found.", 404);
    if (post.authorId !== userId) await ensureInteractionAllowed(userId, post.authorId);
    const comment = await prisma.communityComment.create({
      data: { postId, authorId: userId, content: text(content, "Comment", 2, 1600) },
      include: { author: { select: PUBLIC_OWNER_SELECT } },
    });
    await publishGlobal("player_hub.community.changed", "community_post", postId);
    return comment;
  },

  async getBlockedPlayers(userId: string) {
    const items = await prisma.playerBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: "desc" },
      include: { blocked: { select: PUBLIC_OWNER_SELECT } },
    });
    return items.map((item) => ({ id: item.id, player: item.blocked, createdAt: item.createdAt }));
  },

  async setBlocked(userId: string, otherId: string, blocked: boolean) {
    if (userId === otherId) throw error("You cannot block yourself.");
    const target = await prisma.user.findUnique({ where: { id: otherId }, select: { id: true } });
    if (!target) throw error("Player not found.", 404);
    if (blocked) {
      await prisma.$transaction(async (tx) => {
        await tx.playerBlock.upsert({
          where: { blockerId_blockedId: { blockerId: userId, blockedId: otherId } },
          update: {},
          create: { blockerId: userId, blockedId: otherId },
        });
        const ids = pair(userId, otherId);
        await tx.friendship.deleteMany({ where: ids });
        await tx.friendRequest.deleteMany({
          where: {
            OR: [
              { senderId: userId, receiverId: otherId },
              { senderId: otherId, receiverId: userId },
            ],
          },
        });
      });
    } else {
      await prisma.playerBlock.deleteMany({ where: { blockerId: userId, blockedId: otherId } });
    }
    await publishRealtimeEvents([userId, otherId], {
      type: "player_hub.safety.changed",
      entityType: "player_block",
      entityId: otherId,
      payload: { blocked },
    });
    await publishRealtimeEvents([userId, otherId], {
      type: "players.changed",
      entityType: "player-network",
      entityId: otherId,
    });
    return { blocked };
  },

  async createReport(userId: string, input: Record<string, unknown>) {
    const report = await prisma.playerReport.create({
      data: {
        reporterId: userId,
        subjectType: text(input.subjectType, "Subject type", 2, 40),
        subjectId: text(input.subjectId, "Subject", 1, 100),
        reason: text(input.reason, "Reason", 3, 120),
        details: optionalText(input.details, 2000),
      },
    });
    return { id: report.id, status: report.status };
  },

  async getChatKey(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { chatPublicKey: true, chatKeyVersion: true } });
    if (!user) throw error("User not found.", 404);
    return user;
  },

  async setChatKey(userId: string, publicKey: unknown) {
    if (!publicKey || typeof publicKey !== "object" || Array.isArray(publicKey)) throw error("Public key is invalid.");
    const value = publicKey as Record<string, unknown>;
    if (value.kty !== "EC" || value.crv !== "P-256" || typeof value.x !== "string" || typeof value.y !== "string") {
      throw error("Public key must be a P-256 ECDH key.");
    }
    const [existing, backup, authenticatorRecovery] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { chatPublicKey: true, chatKeyVersion: true },
      }),
      prisma.chatIdentityBackup.findUnique({ where: { userId }, select: { publicKey: true } }),
      prisma.chatTotpRecovery.findUnique({ where: { userId }, select: { id: true } }),
    ]);
    if (!existing) throw error("User not found.", 404);
    if (backup && !sameChatPublicKey(backup.publicKey, value)) {
      throw error("Secure-chat recovery protects the current identity. Restore the existing identity instead of replacing the public key.", 409);
    }
    if (authenticatorRecovery && existing.chatPublicKey && !sameChatPublicKey(existing.chatPublicKey, value)) {
      throw error("Google Authenticator recovery protects the current secure-chat identity. Restore it instead of replacing the public key.", 409);
    }
    const existingMatches = existing.chatPublicKey ? sameChatPublicKey(existing.chatPublicKey, value) : false;
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        chatPublicKey: value as Prisma.InputJsonValue,
        ...(existing.chatPublicKey && !existingMatches ? { chatKeyVersion: { increment: 1 } } : {}),
      },
      select: { chatPublicKey: true, chatKeyVersion: true },
    });
    await publishRealtimeEvent({
      userId: null,
      type: "player_hub.chat_key.changed",
      entityType: "user",
      entityId: userId,
    });
    return user;
  },

  async getConversations(userId: string) {
    const conversations = await prisma.directConversation.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      include: {
        userA: { select: PERSON_SELECT },
        userB: { select: PERSON_SELECT },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, senderId: true, createdAt: true, deletedAt: true } },
      },
    });

    return Promise.all(conversations.map(async (conversation) => {
      const isA = conversation.userAId === userId;
      const peer = isA ? conversation.userB : conversation.userA;
      const lastReadAt = isA ? conversation.userALastReadAt : conversation.userBLastReadAt;
      const unreadCount = await prisma.directMessage.count({
        where: { conversationId: conversation.id, senderId: { not: userId }, createdAt: { gt: lastReadAt }, deletedAt: null },
      });
      return {
        id: conversation.id,
        peer,
        unreadCount,
        lastMessageAt: conversation.lastMessageAt,
        lastMessage: conversation.messages[0] ?? null,
      };
    }));
  },

  async getOrCreateConversation(userId: string, playerId: string) {
    await ensureInteractionAllowed(userId, playerId);
    if (!(await connected(userId, playerId))) throw error("Connect with this player before starting a direct message.", 403);
    const ids = pair(userId, playerId);
    const conversation = await prisma.directConversation.upsert({
      where: { userAId_userBId: ids },
      update: {},
      create: ids,
      include: { userA: { select: PERSON_SELECT }, userB: { select: PERSON_SELECT } },
    });
    return {
      id: conversation.id,
      peer: conversation.userAId === userId ? conversation.userB : conversation.userA,
      unreadCount: 0,
      lastMessageAt: conversation.lastMessageAt,
      lastMessage: null,
    };
  },

  async getMessages(userId: string, conversationId: string, before?: string) {
    const conversation = await prisma.directConversation.findFirst({
      where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }] },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        userALastReadAt: true,
        userBLastReadAt: true,
      },
    });
    if (!conversation) throw error("Conversation not found.", 404);
    const peerId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
    const peerLastReadAt = conversation.userAId === userId
      ? conversation.userBLastReadAt
      : conversation.userALastReadAt;
    const block = await blockState(userId, peerId);
    if (block.blockedMe) throw error("This conversation is unavailable.", 403);
    const beforeDate = before ? new Date(before) : null;
    if (beforeDate && Number.isNaN(beforeDate.getTime())) throw error("Message cursor is invalid.");
    const messages = await prisma.directMessage.findMany({
      where: {
        conversationId,
        ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        senderId: true,
        clientId: true,
        ciphertext: true,
        iv: true,
        algorithm: true,
        senderKeyVersion: true,
        createdAt: true,
        deliveredAt: true,
        readAt: true,
        editedAt: true,
        deletedAt: true,
      },
    });
    return messages.reverse().map((message) => {
      if (message.senderId !== userId) return message;
      const wasReadBeforeStatusTracking = message.createdAt <= peerLastReadAt;
      return {
        ...message,
        deliveredAt: message.deliveredAt ?? (wasReadBeforeStatusTracking ? peerLastReadAt : null),
        readAt: message.readAt ?? (wasReadBeforeStatusTracking ? peerLastReadAt : null),
      };
    });
  },

  async sendMessage(userId: string, conversationId: string, input: Record<string, unknown>) {
    const conversation = await prisma.directConversation.findFirst({
      where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }] },
      select: {
        id: true,
        userAId: true,
        userBId: true,
        userA: { select: { name: true } },
        userB: { select: { name: true } },
      },
    });
    if (!conversation) throw error("Conversation not found.", 404);
    const peerId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
    const senderName = conversation.userAId === userId ? conversation.userA.name : conversation.userB.name;
    await ensureInteractionAllowed(userId, peerId);
    if (!(await connected(userId, peerId))) throw error("This direct conversation requires an active player connection.", 403);

    const clientId = text(input.clientId, "Message client ID", 8, 100);
    const existingMessage = await prisma.directMessage.findFirst({ where: { senderId: userId, clientId } });
    if (existingMessage) return existingMessage;

    const ciphertext = text(input.ciphertext, "Encrypted message", 8, 20000);
    const iv = text(input.iv, "Encryption IV", 8, 200);
    const algorithm = input.algorithm === undefined ? "AES-GCM" : text(input.algorithm, "Algorithm", 3, 40);
    if (algorithm !== "AES-GCM") throw error("Unsupported message encryption algorithm.");
    const senderKeyVersion = integer(input.senderKeyVersion ?? 1, "Key version", 1, 100000);

    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.directMessage.create({
        data: { conversationId, senderId: userId, clientId, ciphertext, iv, algorithm, senderKeyVersion },
      });
      await tx.directConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: created.createdAt,
          ...(conversation.userAId === userId ? { userALastReadAt: created.createdAt } : { userBLastReadAt: created.createdAt }),
        },
      });
      // Keep one actionable direct-message notification per conversation instead of
      // filling the notification panel with one permanent row per message.
      await tx.notification.deleteMany({
        where: { userId: peerId, entityType: "direct_conversation", entityId: conversationId },
      });
      await tx.notification.create({
        data: {
          userId: peerId,
          message: `${senderName} sent you an encrypted direct message.`,
          type: "system",
          link: `/player-hub?section=messages&conversation=${conversationId}`,
          entityType: "direct_conversation",
          entityId: conversationId,
        },
      });
      return created;
    });
    await Promise.all([
      publishMessageState([userId, peerId], conversationId, "sent", userId, message.id),
      publishRealtimeEvent({
        userId: peerId,
        type: "notifications.changed",
        entityType: "direct_conversation",
        entityId: conversationId,
        payload: { conversationId, messageId: message.id },
      }),
    ]);
    return message;
  },

  async markConversationDelivered(userId: string, conversationId: string) {
    const conversation = await prisma.directConversation.findFirst({
      where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    if (!conversation) throw error("Conversation not found.", 404);
    const deliveredAt = new Date();
    const result = await prisma.directMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        deliveredAt: null,
        deletedAt: null,
      },
      data: { deliveredAt },
    });
    if (result.count > 0) {
      const peerId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
      await publishMessageState([userId, peerId], conversationId, "delivered", userId);
    }
    return { deliveredAt, count: result.count };
  },

  async setTyping(userId: string, conversationId: string, active: boolean) {
    const conversation = await prisma.directConversation.findFirst({
      where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    if (!conversation) throw error("Conversation not found.", 404);
    const peerId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
    await publishRealtimeEvents([peerId], {
      type: "player_hub.typing",
      entityType: "direct_conversation",
      entityId: conversationId,
      payload: { conversationId, userId, active },
    });
    return { active };
  },

  async markConversationRead(userId: string, conversationId: string) {
    const conversation = await prisma.directConversation.findFirst({
      where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true },
    });
    if (!conversation) throw error("Conversation not found.", 404);
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
      await tx.directConversation.update({
        where: { id: conversationId },
        data: conversation.userAId === userId ? { userALastReadAt: now } : { userBLastReadAt: now },
      });
      const messages = await tx.directMessage.updateMany({
        where: { conversationId, senderId: { not: userId }, readAt: null, deletedAt: null },
        data: { deliveredAt: now, readAt: now },
      });
      const notifications = await tx.notification.deleteMany({
        where: { userId, entityType: "direct_conversation", entityId: conversationId },
      });
      return { messages: messages.count, notifications: notifications.count };
    });
    const peerId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;
    const sync: Promise<unknown>[] = [];
    if (result.messages > 0) sync.push(publishMessageState([userId, peerId], conversationId, "read", userId));
    if (result.notifications > 0) {
      sync.push(publishRealtimeEvent({
        userId,
        type: "notifications.changed",
        entityType: "direct_conversation",
        entityId: conversationId,
      }));
    }
    await Promise.all(sync);
    return { readAt: now, ...result };
  },

  async getUnreadCount(userId: string) {
    return unreadCountForUser(userId);
  },
};
