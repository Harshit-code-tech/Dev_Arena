import { doc, setDoc } from "firebase/firestore";
import { db } from "../config/fireBase";

export const saveUser = async (
  user: any,
  provider: string
) => {
  await setDoc(
    doc(db, "users", user.uid),
    {
      // =====================
      // BASIC INFO
      // =====================

      uid: user.uid,

      displayName:
        user.displayName || "",

      username:
        user.email?.split("@")[0] ||
        user.uid.slice(0, 8),

      email: user.email || "",

      photoURL:
        user.photoURL || "",

      provider,

      role: "user",

      // =====================
      // DEVARNA GAMIFICATION
      // =====================

      xp: 0,

      level: 1,

      streak: 0,

      rank: "Unranked",

      arenaScore: 0,

      contestRating: 0,

      // =====================
      // SOCIAL
      // =====================

      followers: 0,

      following: 0,

      // =====================
      // CHALLENGES
      // =====================

      dailyChallengeCompleted: false,

      completedChallenges: [],

      solvedProblems: [],

      projects: [],

      badges: [],

      // =====================
      // PROFILE
      // =====================

      bio: "",

      location: "",

      website: "",

      github: "",

      profileCompleted: false,

      selectedAvatar: "",

      theme: "dark",

      isVerified: false,

      // =====================
      // TIMESTAMPS
      // =====================

      createdAt: new Date(),

      updatedAt: new Date(),
    },
    {
      merge: true,
    }
  );
};