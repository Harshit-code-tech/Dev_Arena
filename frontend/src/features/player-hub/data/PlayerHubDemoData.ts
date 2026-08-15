import type { HubPlayer } from "../../../services/PlayerHubService";

function seed(value: string) {
  return [...value].reduce((total, character, index) => total + character.charCodeAt(0) * (index + 1), 0);
}

export function hardcodedTechProfile(player: Pick<HubPlayer, "id" | "arenaScore" | "topTechStack">): {
  primary: string[];
  confidence: Array<{ name: string; confidence: number; evidence: string }>;
  dsaLanguage: string;
  activityLevel: string;
} {
  const stack = Array.isArray(player.topTechStack) ? player.topTechStack.slice(0, 3) : [];
  return {
    primary: stack.map((item) => item.name),
    confidence: stack.map((item) => ({
      name: item.name,
      confidence: Math.max(1, Math.min(100, item.percentage)),
      evidence: `${item.projectCount} eligible project${item.projectCount === 1 ? "" : "s"} from verified GitHub language evidence`,
    })),
    dsaLanguage: stack.find((item) => ["C++", "Python", "Java", "JavaScript", "TypeScript", "Kotlin", "Go", "Rust"].includes(item.name))?.name || "No verified signal",
    activityLevel: player.arenaScore > 500 ? "High" : player.arenaScore > 100 ? "Growing" : "New",
  };
}

export function hardcodedMatchProfile(
  currentUserId: string,
  player: Pick<HubPlayer, "id" | "arenaScore" | "topTechStack">,
) {
  const value = seed(`${currentUserId}:${player.id}`);
  const score = 62 + (value % 34);
  const profile = hardcodedTechProfile(player);
  const first = profile.primary[0];
  const second = profile.primary[1];
  return {
    score,
    reasons: first
      ? [
        `${first} is backed by this player’s eligible GitHub projects.`,
        second ? `${second} adds another verified collaboration signal.` : "The current profile has one verified technology signal.",
        "The percentage remains a placeholder until the player-matching model is trained.",
      ]
      : [
        "This player has no eligible project technologies yet.",
        "The match percentage is still a placeholder.",
        "Verified project signals will be used by the future matching model.",
      ],
  };
}
