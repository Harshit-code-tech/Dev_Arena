import { prisma } from "../../database/prisma";
import { getWeekStart, getWeekEnd } from "../../shared/utils/tracking";

type CoachTone =
    | "roast"
    | "motivational"
    | "strong";

interface CoachFeedback {
    message: string;
    tone: CoachTone;
    activeDays: number;
}

const ROAST_MESSAGES = [
    "3 days or fewer? Even your keyboard is disappointed. It was really looking forward to being used.",
    "Your Arena score called. It's doing fine without you, but it misses you. Sort of.",
    "Low activity detected. Don't worry — the algorithms are very good at waiting. They've been practicing.",
    "At this pace, even the 'Unranked' badge is starting to feel like an achievement.",
    "The leaderboard updated this week. You were not exactly a major plot point.",
    "Three active days. Three! Your keyboard has more keys than that — use some of them.",
    "The Arena is still here. Your DSA problems are still unsolved. Your heatmap has opinions.",
    "The code isn't going to solve itself. Unfortunately, neither is your Arena score.",
    "Your weekly activity looks suspiciously like a weekend-only subscription.",
    "The leaderboard hasn't forgotten you. It just hasn't had much reason to mention you.",
    "Did you take an unscheduled sabbatical, or are you just admiring your VS Code wallpaper?",
    "Your git graph is looking like a desert. Not a single green cactus in sight.",
    "Zero bugs found this week! Mainly because you didn't write any code, genius.",
    "Bro, even your console.log is getting lonely. Open the editor.",
    "If excuses gave Arena points, you'd be ranked #1 globally right now.",
    "Procrastination is winning 3-0 against you. Stage a comeback already, bro.",
    "Are you coding or just staring intensely at Stack Overflow hoping for telepathy?",
    "Your streak is currently hanging on by a thread and a prayer. Fix it.",
];

const MOTIVATIONAL_MESSAGES = [
    "4+ active days? Okay, you're cooking. Don't burn the kitchen now.",
    "Look at you actually following through. Your rivals are quietly stressing.",
    "Solid week. The gap between you and the top 10 is shrinking. Keep stomping.",
    "Consistency detected. Reluctant respect granted from the AI Coach.",
    "You showed up when you could've binged Netflix. Respect. Keep stacking wins.",
    "4+ days in the Arena. That's not beginner's luck, that's dangerous momentum.",
    "Streak looking healthy, code compiling cleanly, score going up. Life is good.",
    "You're locking in. Keep this up and your future self owes you a coffee.",
    "Another week, another set of problems crushed. That's how we move the needle.",
    "Not bad at all. You're actually making this coding thing look like a habit.",
];

const STRONG_MESSAGES = [
    "6+ days active?! Are you running on caffeine, spite, or sheer willpower? You're a menace.",
    "Six days in the Arena this week. At this rate, the server might overheat from your commits.",
    "Touch grass? Absolutely not. You're dominating the leaderboard and nobody can stop you.",
    "6 active days. Even the AI Coach is taking notes from you at this point.",
    "Demon mode activated. Your friends don't stand a chance this season.",
    "Almost a clean 7/7 week. Finish strong — make them remember who runs this Arena.",
    "Unstoppable. The compiler fears you. The leaderboard respects you.",
    "You're not just participating in the Arena anymore — you're setting the pace.",
];


function pickRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

export const coachService = {
    async getFeedback(userId: string): Promise<CoachFeedback> {
        const now = new Date();

        const weekStart = getWeekStart(now);
        const weekEnd = getWeekEnd(now);

        const activeDays = await prisma.activity.count({
            where: {
                userId,
                date: {
                    gte: weekStart,
                    lt: weekEnd,
                },
                isActive: true,
            },
        });

        let tone: CoachTone;
        let pool: string[];

        if (activeDays <= 3) {
            tone = "roast";
            pool = ROAST_MESSAGES;
        } else if (activeDays <= 5) {
            tone = "motivational";
            pool = MOTIVATIONAL_MESSAGES;
        } else {
            tone = "strong";
            pool = STRONG_MESSAGES;
        }

        return {
            message: pickRandom(pool),
            tone,
            activeDays,
        };
    },
};