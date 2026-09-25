// ── AI module types ───────────────────────────────────────────────────────────

// Phase 4.2 — Rival Roast
export interface RivalRoastInput {
    rivalId: string;
}

export interface RivalRoastResponse {
    message: string;
    rivalName: string;
    yourScore: number;
    rivalScore: number;
}

// Phase 4.3 — AI Challenge Generator
export interface GenerateChallengeInput {
    topic: string;
    difficulty?: "Easy" | "Medium" | "Hard" | "Expert";
}

export interface GeneratedTestCase {
    input: string;
    expectedOutput: string;
}

export interface GeneratedTask {
    title: string;
    description: string;
    difficulty: "Easy" | "Medium" | "Hard" | "Expert";
    expectedTime: string;
    expectedSpace: string;
    sampleTestCases: GeneratedTestCase[];
}
