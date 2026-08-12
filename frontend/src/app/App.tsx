import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import Header from "../shared/components/Header";
import Footer from "../shared/components/Footer";
import PageLoader from "../shared/components/Skeletons/PageLoader";
import { useAuth } from "../features/auth/context/AuthContext";
import { AppRouter } from "./Router";

export function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isAuthRoute = ["/login", "/signup", "/choose-username"].includes(location.pathname);

  useEffect(() => {
    const privacyMode = user && "username" in user ? Boolean(user.privacyMode) : false;
    const compactWorkspace = user && "username" in user ? Boolean(user.compactWorkspace) : false;

    document.body.classList.toggle("privacy-mode", privacyMode);
    document.body.classList.toggle("compact-workspace", compactWorkspace);

    return () => {
      document.body.classList.remove("privacy-mode", "compact-workspace");
    };
  }, [user]);

  useEffect(() => {
    const shouldHideScrollbars = location.pathname !== "/";
    document.documentElement.classList.toggle("hide-page-scrollbars", shouldHideScrollbars);
    document.body.classList.toggle("hide-page-scrollbars", shouldHideScrollbars);

    return () => {
      document.documentElement.classList.remove("hide-page-scrollbars");
      document.body.classList.remove("hide-page-scrollbars");
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!isAuthRoute) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("auth-view-active");
    document.documentElement.classList.add("auth-view-active");

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.classList.remove("auth-view-active");
      document.documentElement.classList.remove("auth-view-active");
    };
  }, [isAuthRoute]);

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className={`app${isAuthRoute ? " auth-route" : ""}`}>
      {!user && !isAuthRoute && <Header />}
      <AppRouter />
      {!user && !isAuthRoute && <Footer />}
    </div>
  );
}
