import type { User as FirebaseUser } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type DocumentReference,
} from "firebase/firestore";

import { db } from "../../../config/Firebase";
import type { SocialAuthProvider } from "./AuthTypes";

export async function syncFirebaseUserWithFirestore(
  user: FirebaseUser,
  provider: SocialAuthProvider,
) {
  const userRef = doc(db, "users", user.uid);
  const existingUser = await getDoc(userRef);

  if (existingUser.exists()) {
    await updateExistingFirestoreUser(userRef, user, provider);
    return;
  }

  await createFirestoreUser(userRef, user, provider);
}

async function updateExistingFirestoreUser(
  userRef: DocumentReference,
  user: FirebaseUser,
  provider: SocialAuthProvider,
) {
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
}

async function createFirestoreUser(
  userRef: DocumentReference,
  user: FirebaseUser,
  provider: SocialAuthProvider,
) {
  await setDoc(userRef, buildNewFirestoreUser(user, provider));
}

function buildNewFirestoreUser(
  user: FirebaseUser,
  provider: SocialAuthProvider,
) {
  return {
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
    activeDays: 0,
    lastActiveDate: "",
    seasonPoints: 0,
    weeklyBonusClaimed: false,
    seasonBonusClaimed: false,
    seasonNumber: 1,
    seasonStartDate: serverTimestamp(),
    seasonEndDate: null,
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
  };
}
