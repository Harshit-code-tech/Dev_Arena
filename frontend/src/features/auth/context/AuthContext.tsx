import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../../config/Firebase";
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  storeAuthToken,
} from "../api/AuthStorageService";
import {
  getCurrentBackendUser,
  signOutFirebaseUser,
} from "../api/AuthSessionService";
import { syncFirebaseUser } from "../api/FirebaseUserSyncService";
import type { AppUser, AuthContextValue, FirebaseAuthProvider } from "../api/AuthTypes";

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  loginWithToken: async () => {},
  refreshUser: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserFromBackend = async (token: string) => {
    try {
      const backendUser = await getCurrentBackendUser(token);
      setUser(backendUser);
    } catch (error) {
      console.error("Failed to fetch user from backend:", error);
      clearStoredAuthToken();
      setUser(null);
    }
  };

  const loginWithToken = async (token: string) => {
    storeAuthToken(token);
    await fetchUserFromBackend(token);
  };

  const refreshUser = async () => {
    const token = getStoredAuthToken();
    if (token) await fetchUserFromBackend(token);
  };

  const logout = () => {
    clearStoredAuthToken();
    signOutFirebaseUser();
    setUser(null);
  };

  useEffect(() => {
    const handleProfileUpdate = () => { void refreshUser(); };
    window.addEventListener("devarena:profile-updated", handleProfileUpdate);

    const token = getStoredAuthToken();
    let unsubscribe: (() => void) | undefined;

    if (token) {
      fetchUserFromBackend(token).finally(() => setLoading(false));
    } else {
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (!currentUser) {
          setUser(null);
          setLoading(false);
          return;
        }

        void (async () => {
          try {
            const tokenResult = await currentUser.getIdTokenResult();
            const providerId = tokenResult.signInProvider;
            const provider: FirebaseAuthProvider = providerId === "google.com"
              ? "google"
              : providerId === "github.com"
                ? "github"
                : "password";
            const synced = await syncFirebaseUser(currentUser, provider, false, { remember: true });
            if (!synced.token) throw new Error("DevArena session could not be restored.");
            await loginWithToken(synced.token);
          } catch (error) {
            console.warn("Firebase session exists but DevArena session could not be restored:", error);
            setUser(null);
          } finally {
            setLoading(false);
          }
        })();
      });
    }

    return () => {
      window.removeEventListener("devarena:profile-updated", handleProfileUpdate);
      unsubscribe?.();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithToken, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
