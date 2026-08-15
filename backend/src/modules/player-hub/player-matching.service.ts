import type { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma";

const MODEL_VERSION = "tech-match-v1.1";
const MIN_VERIFIED_PROJECTS = 2;
const GOALS = ["Project teammate", "DSA partner", "Hackathon teammate", "Mentor", "Mentee", "Open-source contributor"] as const;
const MODES = ["Balanced", "Similar", "Complementary"] as const;
const DOMAINS = ["Any", "Fullstack", "App", "AI", "Other"] as const;
const AVAILABILITY = ["Any", "1-3 hours", "4-7 hours", "8-12 hours", "12+ hours"] as const;
const EXPERIENCE = ["Similar", "More experienced", "Less experienced", "Any"] as const;
const FEEDBACK = ["Good match", "Not relevant", "Hide"] as const;

type StackItem = { name: string; percentage: number; projectCount?: number };
type Preference = {
  goal: string;
  mode: string;
  preferredDomain: string;
  weeklyAvailability: string;
  experiencePreference: string;
  discoveryEnabled: boolean;
};
type CandidateUser = {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  useInitials: boolean;
  rank: string;
  arenaScore: number;
  activeDays: number;
  streak: number;
  topTechStack: Prisma.JsonValue | null;
  topTechStackUpdatedAt: Date | null;
  topTechStackProjectCount: number;
  matchingPreference: Preference | null;
  githubConnection: {
    connectedAt: Date | null;
    accessTokenEncrypted: string | null;
  } | null;
};

type MatchingEligibilityReason =
  | "ELIGIBLE"
  | "GITHUB_NOT_CONNECTED"
  | "INSUFFICIENT_VERIFIED_PROJECTS"
  | "TECH_STACK_NOT_READY";

type MatchingEligibility = {
  eligible: boolean;
  reason: MatchingEligibilityReason;
  requiredProjects: number;
  verifiedProjects: number;
  githubConnected: boolean;
  techStackReady: boolean;
};

function eligibility(user: CandidateUser, verifiedProjects: number): MatchingEligibility {
  const githubConnected = Boolean(
    user.githubConnection?.connectedAt && user.githubConnection.accessTokenEncrypted,
  );
  const techStackReady = Boolean(
    user.topTechStackUpdatedAt
      && user.topTechStackProjectCount >= MIN_VERIFIED_PROJECTS
      && stack(user.topTechStack).length > 0,
  );

  if (!githubConnected) {
    return {
      eligible: false,
      reason: "GITHUB_NOT_CONNECTED",
      requiredProjects: MIN_VERIFIED_PROJECTS,
      verifiedProjects,
      githubConnected,
      techStackReady,
    };
  }

  if (verifiedProjects < MIN_VERIFIED_PROJECTS) {
    return {
      eligible: false,
      reason: "INSUFFICIENT_VERIFIED_PROJECTS",
      requiredProjects: MIN_VERIFIED_PROJECTS,
      verifiedProjects,
      githubConnected,
      techStackReady,
    };
  }

  if (!techStackReady) {
    return {
      eligible: false,
      reason: "TECH_STACK_NOT_READY",
      requiredProjects: MIN_VERIFIED_PROJECTS,
      verifiedProjects,
      githubConnected,
      techStackReady,
    };
  }

  return {
    eligible: true,
    reason: "ELIGIBLE",
    requiredProjects: MIN_VERIFIED_PROJECTS,
    verifiedProjects,
    githubConnected,
    techStackReady,
  };
}

function error(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function choice<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  const clean = String(value || "").trim();
  if (!allowed.includes(clean as T[number])) throw error(`${label} is invalid.`);
  return clean as T[number];
}

function stack(value: Prisma.JsonValue | null | undefined): StackItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const percentage = Number(row.percentage);
    if (!name || !Number.isFinite(percentage) || percentage <= 0) return [];
    return [{ name, percentage: Math.max(0, Math.min(100, percentage)), projectCount: Number(row.projectCount) || 0 }];
  });
}

function vector(items: StackItem[]) {
  return new Map(items.map((item) => [item.name.toLowerCase(), item.percentage]));
}

function cosine(left: StackItem[], right: StackItem[]) {
  if (!left.length || !right.length) return 50;
  const a = vector(left);
  const b = vector(right);
  const keys = new Set([...a.keys(), ...b.keys()]);
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  keys.forEach((key) => {
    const av = a.get(key) || 0;
    const bv = b.get(key) || 0;
    dot += av * bv;
    aNorm += av * av;
    bNorm += bv * bv;
  });
  if (!aNorm || !bNorm) return 50;
  return Math.round((dot / Math.sqrt(aNorm * bNorm)) * 100);
}

const ROLE_LANGUAGES: Record<string, string[]> = {
  Frontend: ["typescript", "javascript", "css", "html", "vue", "svelte"],
  Backend: ["python", "java", "go", "php", "ruby", "typescript", "javascript", "c#"],
  Mobile: ["kotlin", "java", "swift", "dart", "typescript", "javascript"],
  "AI/ML": ["python", "r", "julia", "c++", "cuda"],
  Systems: ["c", "c++", "rust", "go", "assembly"],
};

function roleScores(items: StackItem[]) {
  const values = vector(items);
  return Object.fromEntries(Object.entries(ROLE_LANGUAGES).map(([role, languages]) => [
    role,
    Math.min(100, languages.reduce((sum, language) => sum + (values.get(language) || 0), 0)),
  ])) as Record<string, number>;
}

function complementary(left: StackItem[], right: StackItem[]) {
  if (!left.length || !right.length) return 50;
  const mine = roleScores(left);
  const theirs = roleScores(right);
  let need = 0;
  let fill = 0;
  Object.keys(ROLE_LANGUAGES).forEach((role) => {
    const gap = Math.max(0, 60 - mine[role]);
    need += gap;
    fill += gap * Math.min(1, theirs[role] / 60);
  });
  const gapScore = need ? (fill / need) * 100 : 50;
  const diversity = 100 - cosine(left, right);
  return Math.round(Math.max(0, Math.min(100, gapScore * 0.72 + diversity * 0.28)));
}

function domainScore(myDomains: Set<string>, candidateDomains: Set<string>, preferredDomain: string) {
  if (preferredDomain !== "Any") return candidateDomains.has(preferredDomain) ? 100 : 25;
  if (!myDomains.size && !candidateDomains.size) return 55;
  const intersection = [...myDomains].filter((item) => candidateDomains.has(item)).length;
  const union = new Set([...myDomains, ...candidateDomains]).size;
  return Math.round(union ? (intersection / union) * 100 : 55);
}

function closeness(a: number, b: number, scale: number) {
  return Math.round(Math.max(0, 100 - Math.min(100, Math.abs(a - b) / Math.max(1, scale) * 100)));
}

function experienceScore(current: CandidateUser, candidate: CandidateUser, preference: string) {
  if (preference === "Any") return 75;
  if (preference === "More experienced") return candidate.arenaScore > current.arenaScore ? Math.min(100, 70 + Math.log10(candidate.arenaScore - current.arenaScore + 1) * 12) : 35;
  if (preference === "Less experienced") return candidate.arenaScore < current.arenaScore ? Math.min(100, 70 + Math.log10(current.arenaScore - candidate.arenaScore + 1) * 12) : 35;
  return closeness(current.arenaScore, candidate.arenaScore, Math.max(100, current.arenaScore, candidate.arenaScore));
}

function availabilityScore(a: string, b: string) {
  if (a === "Any" && b === "Any") return 70;
  if (a === b) return 100;
  if (a === "Any" || b === "Any") return 78;
  return 42;
}

function goalScore(a: string, b: string) {
  if (a === b) return 100;
  if ((a === "Mentor" && b === "Mentee") || (a === "Mentee" && b === "Mentor")) return 100;
  if ([a, b].includes("Project teammate") && [a, b].some((item) => item === "Hackathon teammate" || item === "Open-source contributor")) return 72;
  return 55;
}

function weights(goal: string) {
  if (goal === "DSA partner") return { tech: 15, domain: 5, goal: 10, activity: 20, dsa: 35, experience: 10, availability: 5 };
  if (goal === "Hackathon teammate") return { tech: 35, domain: 20, goal: 10, activity: 10, dsa: 5, experience: 5, availability: 15 };
  if (goal === "Mentor" || goal === "Mentee") return { tech: 25, domain: 15, goal: 15, activity: 10, dsa: 10, experience: 20, availability: 5 };
  if (goal === "Open-source contributor") return { tech: 35, domain: 20, goal: 10, activity: 15, dsa: 5, experience: 10, availability: 5 };
  return { tech: 40, domain: 20, goal: 10, activity: 10, dsa: 5, experience: 10, availability: 5 };
}

function topLanguages(items: StackItem[]) {
  return items.slice(0, 3).map((item) => item.name);
}

function techReason(mode: string, currentStack: StackItem[], candidateStack: StackItem[]) {
  if (!currentStack.length || !candidateStack.length) return "One profile has limited verified GitHub technology evidence, so the model uses neutral technical confidence.";
  const mine = new Set(currentStack.map((item) => item.name.toLowerCase()));
  const shared = candidateStack.filter((item) => mine.has(item.name.toLowerCase())).map((item) => item.name);
  if (mode === "Complementary") {
    const unique = candidateStack.filter((item) => !mine.has(item.name.toLowerCase())).map((item) => item.name);
    return unique.length
      ? `${unique.slice(0, 2).join(" and ")} complement your verified ${topLanguages(currentStack).slice(0, 2).join(" and ")} evidence.`
      : "The recommendation balances role coverage with verified technology diversity.";
  }
  if (shared.length) return `Both profiles contain verified ${shared.slice(0, 2).join(" and ")} project evidence.`;
  return `The model found compatible evidence across ${topLanguages(currentStack).slice(0, 2).join(" and ")} and ${topLanguages(candidateStack).slice(0, 2).join(" and ")}.`;
}

function defaultPreference(): Preference {
  return {
    goal: "Project teammate",
    mode: "Balanced",
    preferredDomain: "Any",
    weeklyAvailability: "Any",
    experiencePreference: "Similar",
    discoveryEnabled: true,
  };
}

export const playerMatchingService = {
  modelVersion: MODEL_VERSION,

  async getPreferences(userId: string) {
    return (await prisma.playerMatchingPreference.findUnique({ where: { userId } })) || defaultPreference();
  },

  async updatePreferences(userId: string, input: Record<string, unknown>) {
    const data = {
      goal: choice(input.goal, GOALS, "Matching goal"),
      mode: choice(input.mode, MODES, "Matching mode"),
      preferredDomain: choice(input.preferredDomain, DOMAINS, "Preferred domain"),
      weeklyAvailability: choice(input.weeklyAvailability, AVAILABILITY, "Weekly availability"),
      experiencePreference: choice(input.experiencePreference, EXPERIENCE, "Experience preference"),
      discoveryEnabled: input.discoveryEnabled !== false,
    };
    return prisma.playerMatchingPreference.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  },

  async recommendations(userId: string) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, name: true, username: true, avatarUrl: true, useInitials: true, rank: true,
        arenaScore: true, activeDays: true, streak: true, topTechStack: true,
        topTechStackUpdatedAt: true, topTechStackProjectCount: true,
        matchingPreference: { select: { goal: true, mode: true, preferredDomain: true, weeklyAvailability: true, experiencePreference: true, discoveryEnabled: true } },
        githubConnection: { select: { connectedAt: true, accessTokenEncrypted: true } },
      },
    });
    if (!current) throw error("User not found.", 404);
    const preference = current.matchingPreference || defaultPreference();
    const currentVerifiedProjects = await prisma.project.count({
      where: {
        userId,
        githubEligibleForTechStack: true,
        githubLanguagesFetchedAt: { not: null },
      },
    });
    const currentEligibility = eligibility(current, currentVerifiedProjects);
    if (!currentEligibility.eligible) {
      return {
        modelVersion: MODEL_VERSION,
        preference,
        eligibility: currentEligibility,
        items: [],
      };
    }

    const [friendships, requests, blocks, feedback] = await Promise.all([
      prisma.friendship.findMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] }, select: { userAId: true, userBId: true } }),
      prisma.friendRequest.findMany({ where: { status: "Pending", OR: [{ senderId: userId }, { receiverId: userId }] }, select: { senderId: true, receiverId: true } }),
      prisma.playerBlock.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } }),
      prisma.playerMatchFeedback.findMany({ where: { userId }, select: { candidateId: true, action: true } }),
    ]);
    const excluded = new Set<string>([userId]);
    friendships.forEach((item) => excluded.add(item.userAId === userId ? item.userBId : item.userAId));
    requests.forEach((item) => excluded.add(item.senderId === userId ? item.receiverId : item.senderId));
    blocks.forEach((item) => excluded.add(item.blockerId === userId ? item.blockedId : item.blockerId));
    feedback.filter((item) => item.action === "Hide").forEach((item) => excluded.add(item.candidateId));
    const adjustments = feedback.reduce<Map<string, number>>((map, item) => {
      if (item.action === "Good match") {
        map.set(item.candidateId, 5);
      } else if (item.action === "Not relevant") {
        map.set(item.candidateId, -12);
      }
      return map;
    }, new Map<string, number>());

    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: [...excluded] },
        topTechStackProjectCount: { gte: MIN_VERIFIED_PROJECTS },
        topTechStackUpdatedAt: { not: null },
        githubConnection: {
          is: {
            connectedAt: { not: null },
            accessTokenEncrypted: { not: null },
          },
        },
        OR: [
          { matchingPreference: { is: null } },
          { matchingPreference: { is: { discoveryEnabled: true } } },
        ],
      },
      orderBy: [{ activeDays: "desc" }, { arenaScore: "desc" }],
      take: 100,
      select: {
        id: true, name: true, username: true, avatarUrl: true, useInitials: true, rank: true,
        arenaScore: true, activeDays: true, streak: true, topTechStack: true,
        topTechStackUpdatedAt: true, topTechStackProjectCount: true,
        matchingPreference: { select: { goal: true, mode: true, preferredDomain: true, weeklyAvailability: true, experiencePreference: true, discoveryEnabled: true } },
        githubConnection: { select: { connectedAt: true, accessTokenEncrypted: true } },
      },
    });
    if (!candidates.length) {
      return { modelVersion: MODEL_VERSION, preference, eligibility: currentEligibility, items: [] };
    }

    const candidateIds = candidates.map((item) => item.id);
    const projects = await prisma.project.findMany({
      where: {
        userId: { in: [userId, ...candidateIds] },
        githubEligibleForTechStack: true,
        githubLanguagesFetchedAt: { not: null },
      },
      select: { userId: true, domain: true },
    });
    const eligibleProjectCounts = new Map<string, number>();
    const domainMap = new Map<string, Set<string>>();
    projects.forEach((item) => {
      eligibleProjectCounts.set(item.userId, (eligibleProjectCounts.get(item.userId) || 0) + 1);
      const values = domainMap.get(item.userId) || new Set<string>();
      values.add(item.domain);
      domainMap.set(item.userId, values);
    });

    const eligibleCandidates = candidates.filter((candidate) => {
      const verifiedProjects = eligibleProjectCounts.get(candidate.id) || 0;
      return eligibility(candidate, verifiedProjects).eligible;
    });
    if (!eligibleCandidates.length) {
      return { modelVersion: MODEL_VERSION, preference, eligibility: currentEligibility, items: [] };
    }

    const ids = [userId, ...eligibleCandidates.map((item) => item.id)];
    const dsaScores = await prisma.scoreEvent.groupBy({
      by: ["userId"],
      where: { userId: { in: ids }, sourceType: "DSA_LOG" },
      _sum: { points: true },
    });
    const dsaMap = new Map<string, number>();
    dsaScores.forEach((item) => dsaMap.set(item.userId, item._sum.points || 0));

    const currentStack = stack(current.topTechStack);
    const currentDomains = domainMap.get(userId) || new Set<string>();
    const currentDsa = dsaMap.get(userId) || 0;
    const scoreWeights = weights(preference.goal);

    const items = eligibleCandidates.map((candidate) => {
      const candidatePreference = candidate.matchingPreference || defaultPreference();
      const candidateStack = stack(candidate.topTechStack);
      const similar = cosine(currentStack, candidateStack);
      const complement = complementary(currentStack, candidateStack);
      const tech = preference.mode === "Similar" ? similar : preference.mode === "Complementary" ? complement : Math.round(similar * 0.45 + complement * 0.55);
      const domain = domainScore(currentDomains, domainMap.get(candidate.id) || new Set<string>(), preference.preferredDomain);
      const activity = Math.round((closeness(current.activeDays, candidate.activeDays, Math.max(30, current.activeDays, candidate.activeDays)) * 0.7) + (closeness(current.streak, candidate.streak, Math.max(14, current.streak, candidate.streak)) * 0.3));
      const dsa = closeness(currentDsa, dsaMap.get(candidate.id) || 0, Math.max(30, currentDsa, dsaMap.get(candidate.id) || 0));
      const experience = experienceScore(current, candidate, preference.experiencePreference);
      const availability = availabilityScore(preference.weeklyAvailability, candidatePreference.weeklyAvailability);
      const goal = goalScore(preference.goal, candidatePreference.goal);
      const components = { tech, domain, goal, activity, dsa, experience: Math.round(experience), availability };
      const weighted = Object.entries(scoreWeights).reduce((sum, [key, weight]) => sum + components[key as keyof typeof components] * weight, 0) / 100;
      const score = Math.max(1, Math.min(99, Math.round(weighted + (adjustments.get(candidate.id) || 0))));
      const reasons = [
        techReason(preference.mode, currentStack, candidateStack),
        domain >= 70 ? "Your verified project domains align strongly." : domain <= 35 ? "The model treats different project domains as complementary evidence." : "Your project-domain evidence has useful overlap.",
        activity >= 75 ? "Recent consistency and activity levels are compatible." : "Activity compatibility contributes conservatively to this result.",
      ];
      return {
        player: {
          id: candidate.id, name: candidate.name, username: candidate.username, avatarUrl: candidate.avatarUrl,
          useInitials: candidate.useInitials, rank: candidate.rank, arenaScore: candidate.arenaScore,
          topTechStack: candidate.topTechStack, topTechStackUpdatedAt: candidate.topTechStackUpdatedAt,
          topTechStackProjectCount: candidate.topTechStackProjectCount,
        },
        score,
        mode: preference.mode,
        goal: preference.goal,
        components,
        reasons,
      };
    }).sort((a, b) => b.score - a.score || b.components.tech - a.components.tech).slice(0, 20);

    return { modelVersion: MODEL_VERSION, preference, eligibility: currentEligibility, items };
  },

  async feedback(userId: string, candidateId: string, actionInput: unknown) {
    if (!candidateId || candidateId === userId) throw error("Choose another player.");
    const action = choice(actionInput, FEEDBACK, "Feedback");
    const candidate = await prisma.user.findUnique({ where: { id: candidateId }, select: { id: true } });
    if (!candidate) throw error("Player not found.", 404);
    return prisma.playerMatchFeedback.upsert({
      where: { userId_candidateId: { userId, candidateId } },
      update: { action, modelVersion: MODEL_VERSION },
      create: { userId, candidateId, action, modelVersion: MODEL_VERSION },
      select: { candidateId: true, action: true, modelVersion: true, updatedAt: true },
    });
  },
};
