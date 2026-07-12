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
import type { AppUser, AuthContextValue } from "../api/AuthTypes";

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  loginWithToken: async () => {},
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

  const logout = () => {
    clearStoredAuthToken();
    signOutFirebaseUser();
    setUser(null);
  };

  useEffect(() => {
    const token = getStoredAuthToken();
    
    if (token) {
      // 1. Try to log in using our Custom JWT
      fetchUserFromBackend(token).finally(() => setLoading(false));
    } else {
      // 2. Fallback to Firebase (for existing Google/GitHub sessions)
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return unsubscribe;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
