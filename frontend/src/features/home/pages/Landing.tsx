import { Navigate } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";
import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import Home from "./Home";

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (user) {
    const requiresUsername = "requiresUsername" in user && Boolean(user.requiresUsername);
    const requiresOnboarding = "requiresOnboarding" in user && Boolean(user.requiresOnboarding);
    return <Navigate to={requiresUsername || requiresOnboarding ? "/choose-username" : "/dashboard"} replace />;
  }

  return <Home />;
}
