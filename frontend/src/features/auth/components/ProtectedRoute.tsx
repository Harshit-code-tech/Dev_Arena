import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const requiresUsername = "requiresUsername" in user && Boolean(user.requiresUsername);
  const requiresOnboarding = "requiresOnboarding" in user && Boolean(user.requiresOnboarding);
  if (requiresUsername || requiresOnboarding) return <Navigate to="/choose-username" replace />;

  return children;
}
