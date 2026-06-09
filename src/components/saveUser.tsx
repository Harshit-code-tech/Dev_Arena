import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../config/fireBase";
import { serverTimestamp } from "firebase/firestore";

export const saveUser = async (user: any, provider: string) => {
  // Sync with Backend (Neon Database)
  try {
    const res = await fetch("/api/auth/sync-firebase", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        provider,
      }),
    });

    if (!res.ok) {
      console.error("Failed to sync user with Neon backend", await res.text());
    }
  } catch (error) {
    console.error("Error syncing user with backend:", error);
  }

  // Save to Firebase Firestore
  const userRef = doc(db, "users", user.uid);
  const existingUser = await getDoc(userRef);

  if (existingUser.exists()) {
    await setDoc(
      userRef,
      {
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        email: user.email || "",
        provider,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    return;
  }

  await setDoc(userRef, {
    uid: user.uid,

    displayName: user.displayName || "",

    username: user.email?.split("@")[0] || user.uid.slice(0, 8),

    email: user.email || "",

    photoURL: user.photoURL || "",

    provider,

    role: "user",

    xp: 0,
    level: 1,
    streak: 0,
    rank: "Unranked",
    arenaScore: 0,
    activityCount: 0,
    unreadNotifications: 0,
    contestRating: 0,

    followers: 0,
    following: 0,

    dailyChallengeCompleted: false,

    completedChallenges: [],
    solvedProblems: [],
    projects: [],
    badges: [],

    bio: "",
    location: "",
    website: "",
    github: "",

    profileCompleted: false,

    selectedAvatar: "",

    theme: "dark",

    isVerified: false,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};
