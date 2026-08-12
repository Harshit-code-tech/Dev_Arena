import { prisma } from "../../database/prisma";

export const FEEDBACK_FEATURES = [
  "Authentication and email OTP",
  "Username and GitHub setup",
  "Dashboard",
  "DSA tracking",
  "Revision",
  "Learning logs",
  "Projects",
  "Full-Stack logs",
  "GitHub integration",
  "GitHub language fetching",
  "Top Tech Stack",
  "Player Hub",
  "Player Matching",
  "Friends and player requests",
  "Direct Messaging",
  "Message recovery and devices",
  "Leaderboard",
  "Tournaments",
  "Profile",
  "Settings",
  "Notifications",
  "Shared Projects",
  "PDF export",
  "Support",
  "Other",
] as const;

function feedbackError(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

export const feedbackService = {
  async create(userId: string, input: Record<string, unknown>) {
    const feature = String(input.feature || "").trim();
    const feedback = String(input.feedback || "").trim();
    if (!FEEDBACK_FEATURES.includes(feature as (typeof FEEDBACK_FEATURES)[number])) {
      throw feedbackError("Choose the DevArena feature that needs attention.");
    }
    if (feedback.length < 10) throw feedbackError("Feedback must contain at least 10 characters.");
    if (feedback.length > 4000) throw feedbackError("Feedback cannot exceed 4,000 characters.");
    return prisma.feedbackSubmission.create({
      data: { userId, feature, feedback },
      select: { id: true, feature: true, status: true, createdAt: true },
    });
  },
};
