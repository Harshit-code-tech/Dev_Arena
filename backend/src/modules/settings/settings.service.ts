import { createHash, randomInt } from "node:crypto";

import { prisma } from "../../database/prisma";
import { sendAuthOtpEmail } from "../../shared/utils/email";
import { hashAuthOtp, verifyAuthOtpHash } from "../auth/auth.otp";
import { publishProfileChanged } from "../realtime/realtime.service";
import type {
  IdentityChangeInput,
  ProfilePhotoInput,
  SettingsPreferencesInput,
} from "./settings.types";

const SETTINGS_SELECT = {
  id: true,
  name: true,
  email: true,
  username: true,
  avatarUrl: true,
  useInitials: true,
  activityReminders: true,
  privacyMode: true,
  compactWorkspace: true,
  friendRequestEmails: true,
  loginOtpEmails: true,
  streakReminderEmails: true,
  challengeNotifications: true,
  inAppNotifications: true,
  createdAt: true,
} as const;

function httpError(message: string, statusCode = 400) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

function cleanName(value: string | undefined) {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function cleanEmail(value: string | undefined) {
  return value?.trim().toLowerCase() || "";
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function uploadToCloudinary(imageData: string, userId: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw httpError(
      "Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
      503,
    );
  }

  if (!imageData.startsWith("data:image/")) {
    throw httpError("Choose a valid image file.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "devarena/profiles";
  const publicId = `user_${userId}`;
  const signatureSource = `folder=${folder}&invalidate=true&overwrite=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(signatureSource).digest("hex");

  const body = new FormData();
  body.set("file", imageData);
  body.set("api_key", apiKey);
  body.set("timestamp", String(timestamp));
  body.set("signature", signature);
  body.set("folder", folder);
  body.set("public_id", publicId);
  body.set("overwrite", "true");
  body.set("invalidate", "true");

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body,
  });
  const payload = (await response.json()) as { secure_url?: string; error?: { message?: string } };

  if (!response.ok || !payload.secure_url) {
    throw httpError(payload.error?.message || "Cloudinary upload failed.", 502);
  }

  return payload.secure_url.replace("/image/upload/", "/image/upload/f_auto,q_auto:best/");
}

export const settingsService = {
  async getSettings(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: SETTINGS_SELECT });
    if (!user) throw httpError("User not found.", 404);
    return user;
  },

  async updatePreferences(userId: string, input: SettingsPreferencesInput) {
    const data = {
      ...(typeof input.useInitials === "boolean" ? { useInitials: input.useInitials } : {}),
      ...(typeof input.activityReminders === "boolean" ? { activityReminders: input.activityReminders } : {}),
      ...(typeof input.privacyMode === "boolean" ? { privacyMode: input.privacyMode } : {}),
      ...(typeof input.compactWorkspace === "boolean" ? { compactWorkspace: input.compactWorkspace } : {}),
      ...(typeof input.friendRequestEmails === "boolean" ? { friendRequestEmails: input.friendRequestEmails } : {}),
      ...(typeof input.loginOtpEmails === "boolean" ? { loginOtpEmails: input.loginOtpEmails } : {}),
      ...(typeof input.streakReminderEmails === "boolean" ? { streakReminderEmails: input.streakReminderEmails } : {}),
      ...(typeof input.challengeNotifications === "boolean" ? { challengeNotifications: input.challengeNotifications } : {}),
      ...(typeof input.inAppNotifications === "boolean" ? { inAppNotifications: input.inAppNotifications } : {}),
    };

    if (Object.keys(data).length === 0) throw httpError("No valid preference changes were supplied.");

    const updated = await prisma.user.update({ where: { id: userId }, data, select: SETTINGS_SELECT });
    if (typeof input.useInitials === "boolean") {
      await publishProfileChanged(userId).catch((error) => console.error("Profile sync failed:", error));
    }
    return updated;
  },

  async updateProfilePhoto(userId: string, input: ProfilePhotoInput) {
    let avatarUrl = input.imageUrl?.trim() || "";

    if (input.imageData) {
      if (input.imageData.length > 7_500_000) throw httpError("Image is too large. Use a file under 5 MB.");
      avatarUrl = await uploadToCloudinary(input.imageData, userId);
    }

    if (!avatarUrl) throw httpError("Choose a profile photo or paste an image URL.");

    try {
      const parsed = new URL(avatarUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("invalid protocol");
    } catch {
      throw httpError("Enter a valid image URL.");
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: SETTINGS_SELECT,
    });
    await publishProfileChanged(userId).catch((error) => console.error("Profile sync failed:", error));
    return updated;
  },

  async requestIdentityChange(userId: string, input: IdentityChangeInput) {
    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw httpError("User not found.", 404);

    const name = cleanName(input.name);
    const email = cleanEmail(input.email);

    const pendingName = name && name !== current.name ? name : null;
    const pendingEmail = email && email !== current.email ? email : null;

    if (!pendingName && !pendingEmail) throw httpError("Enter a new name or email address.");
    if (pendingName && (pendingName.length < 2 || pendingName.length > 80)) {
      throw httpError("Account name must contain 2 to 80 characters.");
    }
    if (pendingEmail && !validEmail(pendingEmail)) throw httpError("Enter a valid email address.");

    if (pendingEmail && !current.passwordHash) {
      throw httpError("Accounts created through Google or GitHub must change their email with that provider.");
    }

    if (pendingEmail) {
      const existing = await prisma.user.findUnique({ where: { email: pendingEmail }, select: { id: true } });
      if (existing && existing.id !== userId) throw httpError("That email address is already in use.", 409);
    }

    const otp = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const sent = await sendAuthOtpEmail(current.email, otp, "identity-change");
    if (!sent) throw httpError("The verification email could not be sent.", 502);

    await prisma.user.update({
      where: { id: userId },
      data: {
        pendingName,
        pendingEmail,
        profileChangeOtp: hashAuthOtp(otp),
        profileChangeOtpExpiresAt: expiresAt,
      },
    });

    return { message: `A one-time code was sent to ${current.email}.` };
  },

  async confirmIdentityChange(userId: string, otp: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw httpError("User not found.", 404);
    if (!user.profileChangeOtp || !user.profileChangeOtpExpiresAt) {
      throw httpError("No identity change is waiting for verification.");
    }
    if (new Date() > user.profileChangeOtpExpiresAt) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          pendingName: null,
          pendingEmail: null,
          profileChangeOtp: null,
          profileChangeOtpExpiresAt: null,
        },
      });
      throw httpError("The verification code has expired.");
    }
    if (!verifyAuthOtpHash(otp.trim(), user.profileChangeOtp)) throw httpError("The verification code is incorrect.");

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(user.pendingName ? { name: user.pendingName } : {}),
        ...(user.pendingEmail ? { email: user.pendingEmail } : {}),
        pendingName: null,
        pendingEmail: null,
        profileChangeOtp: null,
        profileChangeOtpExpiresAt: null,
      },
      select: SETTINGS_SELECT,
    });

    await publishProfileChanged(userId).catch((error) => console.error("Profile sync failed:", error));
    return updated;
  },

  async exportAccount(userId: string) {
    const personSelect = { name: true, username: true, email: true } as const;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
        avatarUrl: true,
        githubUrl: true,
        linkedinUrl: true,
        portfolioUrl: true,
        isEmailVerified: true,
        termsAcceptedAt: true,
        termsVersion: true,
        privacyVersion: true,
        arenaScore: true,
        seasonPoints: true,
        seasonNumber: true,
        rank: true,
        streak: true,
        activeDays: true,
        topTechStack: true,
        topTechStackProjectCount: true,
        activityReminders: true,
        privacyMode: true,
        compactWorkspace: true,
        friendRequestEmails: true,
        loginOtpEmails: true,
        streakReminderEmails: true,
        challengeNotifications: true,
        inAppNotifications: true,
        dsaLogs: { orderBy: { activityDate: "desc" }, select: { problemName: true, url: true, solutionUrl: true, difficulty: true, timeTaken: true, timeComplexity: true, spaceComplexity: true, notes: true, activityDate: true } },
        practiceLogs: { orderBy: { activityDate: "desc" }, select: { title: true, type: true, notes: true, timeSpent: true, proofLink: true, activityDate: true } },
        fullstackLogs: { orderBy: { activityDate: "desc" }, select: { title: true, category: true, type: true, description: true, timeSpent: true, proofLink: true, activityDate: true } },
        projects: {
          orderBy: { createdAt: "desc" },
          select: {
            title: true, description: true, domain: true, status: true, startDate: true, createdAt: true, isShared: true,
            githubRepositoryUrl: true, githubRepositoryFullName: true, githubVisibility: true, githubLanguages: true,
            githubContributionStatus: true, githubContributionPercent: true, githubEligibleForTechStack: true,
            projectScore: true,
            logs: { orderBy: { activityDate: "desc" }, select: { description: true, timeSpent: true, proofLink: true, activityDate: true } },
            milestones: { orderBy: { createdAt: "asc" }, select: { title: true, description: true, status: true, createdAt: true, updatedAt: true } },
          },
        },
        weeklyScores: { orderBy: { weekStart: "desc" }, select: { weekStart: true, dsaPoints: true, fullstackPoints: true, projectPoints: true, practicePoints: true, generalPoints: true, challengePoints: true, totalScore: true, activeDays: true } },
        scoreEvents: { orderBy: { occurredAt: "desc" }, select: { category: true, label: true, points: true, occurredAt: true } },
        activities: { orderBy: { date: "desc" }, select: { date: true, isActive: true } },
        notifications: { orderBy: { createdAt: "desc" }, select: { message: true, type: true, isRead: true, link: true, createdAt: true } },
        sentFriendRequests: { orderBy: { createdAt: "desc" }, select: { status: true, createdAt: true, receiver: { select: personSelect } } },
        receivedFriendRequests: { orderBy: { createdAt: "desc" }, select: { status: true, createdAt: true, sender: { select: personSelect } } },
        friendshipsAsA: { orderBy: { createdAt: "desc" }, select: { createdAt: true, userB: { select: personSelect } } },
        friendshipsAsB: { orderBy: { createdAt: "desc" }, select: { createdAt: true, userA: { select: personSelect } } },
        emailInvites: { orderBy: { createdAt: "desc" }, select: { email: true, status: true, expiresAt: true, createdAt: true } },
        userAchievements: { orderBy: { unlockedAt: "desc" }, select: { unlockedAt: true, achievement: { select: { title: true, category: true } } } },
        githubConnection: { select: { githubLogin: true, connectedAt: true } },
        githubRepositories: { orderBy: { lastSyncedAt: "desc" }, select: { fullName: true, url: true, isPrivate: true, visibility: true, permission: true, lastSyncedAt: true } },
      },
    });
    if (!user) throw httpError("User not found.", 404);

    const [conversationCount, messageCount, activeChatDevices] = await Promise.all([
      prisma.directConversation.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
      prisma.directMessage.count({ where: { senderId: userId } }),
      prisma.chatDevice.count({ where: { userId, revokedAt: null } }),
    ]);

    const friends = [
      ...user.friendshipsAsA.map((item) => ({ person: item.userB, connectedAt: item.createdAt })),
      ...user.friendshipsAsB.map((item) => ({ person: item.userA, connectedAt: item.createdAt })),
    ].sort((a, b) => b.connectedAt.getTime() - a.connectedAt.getTime());

    return {
      report: {
        title: "DevArena Personal Data Report",
        exportedAt: new Date().toISOString(),
        description: "A readable copy of the DevArena information associated with this account. Internal database identifiers, authentication secrets, OTP values, access tokens, encrypted private-key backups, and other security credentials are intentionally excluded.",
      },
      profile: {
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        joinedAt: user.createdAt,
        emailVerified: user.isEmailVerified,
        avatarUrl: user.avatarUrl,
        links: { github: user.githubUrl, linkedin: user.linkedinUrl, portfolio: user.portfolioUrl },
        legal: { termsAcceptedAt: user.termsAcceptedAt, termsVersion: user.termsVersion, privacyVersion: user.privacyVersion },
      },
      developerProgress: {
        arenaScore: user.arenaScore,
        seasonPoints: user.seasonPoints,
        seasonNumber: user.seasonNumber,
        rank: user.rank,
        currentStreakDays: user.streak,
        activeDays: user.activeDays,
        topTechStack: user.topTechStack,
        verifiedProjectsUsedForTechStack: user.topTechStackProjectCount,
      },
      preferences: {
        activityReminders: user.activityReminders,
        privacyMode: user.privacyMode,
        compactWorkspace: user.compactWorkspace,
        friendRequestEmails: user.friendRequestEmails,
        loginOtpEmails: user.loginOtpEmails,
        streakReminderEmails: user.streakReminderEmails,
        tournamentAndSeasonNotifications: user.challengeNotifications,
        inAppNotifications: user.inAppNotifications,
      },
      github: {
        connected: Boolean(user.githubConnection),
        login: user.githubConnection?.githubLogin || null,
        connectedAt: user.githubConnection?.connectedAt || null,
        authorizedRepositories: user.githubRepositories,
      },
      projects: user.projects,
      dsaHistory: user.dsaLogs,
      practiceHistory: user.practiceLogs,
      legacyFullstackHistory: user.fullstackLogs,
      scoring: { weeklyScores: user.weeklyScores, scoreEvents: user.scoreEvents },
      activityHistory: user.activities,
      notifications: user.notifications,
      network: {
        friends,
        sentRequests: user.sentFriendRequests.map((item) => ({ person: item.receiver, status: item.status, createdAt: item.createdAt })),
        receivedRequests: user.receivedFriendRequests.map((item) => ({ person: item.sender, status: item.status, createdAt: item.createdAt })),
        emailInvitations: user.emailInvites,
      },
      achievements: user.userAchievements.map((item) => ({ title: item.achievement.title, category: item.achievement.category, unlockedAt: item.unlockedAt })),
      secureMessaging: {
        conversations: conversationCount,
        messagesSent: messageCount,
        activeAuthorizedDevices: activeChatDevices,
        privacyNote: "Direct-message bodies are end-to-end encrypted. DevArena does not include unreadable ciphertext or private-key material in this human-readable report.",
      },
    };
  },

  async deleteAccount(userId: string, confirmation: string) {
    if (confirmation.trim().toUpperCase() !== "DELETE") {
      throw httpError('Type "DELETE" to permanently remove the account.');
    }
    await prisma.user.delete({ where: { id: userId } });
    return { message: "Account permanently deleted." };
  },
};
