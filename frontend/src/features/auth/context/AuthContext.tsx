import { createContext, useContext, useEffect, useState } from "react";
import {
  clearStoredAuthToken,
  getStoredAuthToken,
  storeAuthToken,
} from "../api/AuthStorageService";
import {
  getCurrentBackendUser,
  signOutFirebaseUser,
} from "../api/AuthSessionService";
import type { AppUser, AuthContextValue } from "../api/AuthTypes";

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
      // Keep Firebase and DevArena auth in the same state when a stored DevArena
      // token is invalid/expired. This prevents a stale Firebase identity from
      // silently restoring a session on a later page load.
      void signOutFirebaseUser().catch(() => undefined);
      setUser(null);
    }
  };

  const loginWithToken = async (token: string, remember = true) => {
    storeAuthToken(token, remember);
    await fetchUserFromBackend(token);
  };

  const refreshUser = async () => {
    const token = getStoredAuthToken();
    if (token) {
      await fetchUserFromBackend(token);
    } else {
      setUser(null);
    }
  };

  const logout = () => {
    clearStoredAuthToken();
    void signOutFirebaseUser().catch(() => undefined);
    setUser(null);
  };

  useEffect(() => {
    const handleProfileUpdate = () => { void refreshUser(); };
    window.addEventListener("devarena:profile-updated", handleProfileUpdate);

    const token = getStoredAuthToken();

    // A DevArena token is deliberately the only thing that restores an app
    // session. Firebase may still have an identity while an OTP/signup flow is
    // in progress, but it must never create a new DevArena session by itself.
    // This is what makes Remember me=false truly tab/session scoped.
    if (token) {
      void fetchUserFromBackend(token).finally(() => setLoading(false));
    } else {
      setUser(null);
      setLoading(false);
    }

    return () => {
      window.removeEventListener("devarena:profile-updated", handleProfileUpdate);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithToken, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
