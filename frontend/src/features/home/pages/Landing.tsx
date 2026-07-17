import Home from "./Home";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
import PageLoader from "../../../shared/components/Skeletons/PageLoader";

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Home />;
}
