import { getStoredAuthToken } from "../features/auth/api/AuthStorageService";

export const FEEDBACK_FEATURES = [
  "Authentication and email OTP", "Username and GitHub setup", "Dashboard", "DSA tracking",
  "Revision", "Learning logs", "Projects", "Full-Stack logs", "GitHub integration",
  "GitHub language fetching", "Top Tech Stack", "Player Hub", "Player Matching",
  "Friends and player requests", "Direct Messaging", "Message recovery and devices",
  "Leaderboard", "Tournaments", "Profile", "Settings", "Notifications", "Shared Projects",
  "PDF export", "Support", "Other",
] as const;

type Envelope<T> = { success: boolean; data: T; message?: string };

export async function submitFeedback(payload: { feature: string; feedback: string }) {
  const token = getStoredAuthToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({})) as Partial<Envelope<{ id: string; feature: string; status: string; createdAt: string }>>;
  if (!response.ok || !body.success || !body.data) throw new Error(body.message || "Feedback could not be submitted.");
  return body.data;
}
