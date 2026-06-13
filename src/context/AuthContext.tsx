import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User as FirebaseUser } from "firebase/auth";
import { auth } from "../config/fireBase";

// We extend the User type so it supports both Firebase and our Neon Backend
export type AppUser = FirebaseUser | {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  isTwoFactorEnabled?: boolean;
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
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
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Map Neon database fields to Firebase-like structure to prevent breaking the frontend!
        setUser({
          uid: data.user.id,
          email: data.user.email,
          displayName: data.user.name,
          photoURL: data.user.avatarUrl,
          isTwoFactorEnabled: data.user.isTwoFactorEnabled,
        });
      } else {
        localStorage.removeItem("token");
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user from backend:", error);
      localStorage.removeItem("token");
      setUser(null);
    }
  };

  const loginWithToken = async (token: string) => {
    localStorage.setItem("token", token);
    await fetchUserFromBackend(token);
  };

  const logout = () => {
    localStorage.removeItem("token");
    auth.signOut();
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    
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