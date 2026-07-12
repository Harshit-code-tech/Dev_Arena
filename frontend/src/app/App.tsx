import Header from "../shared/components/Header";
import PageLoader from "../shared/components/Skeletons/PageLoader";
import { useAuth } from "../features/auth/context/AuthContext";
import { AppRouter } from "./Router";

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="app">
      {!user && <Header />}
      <AppRouter />
    </div>
  );
}
