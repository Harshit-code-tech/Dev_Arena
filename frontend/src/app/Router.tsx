import { lazy, Suspense, useEffect, useLayoutEffect } from "react";
import { Navigate, Routes, Route, useLocation } from "react-router-dom";

import ProtectedRoute from "../features/auth/components/ProtectedRoute";
import PageLoader from "../shared/components/Skeletons/PageLoader";
import AppLayout from "../shared/layouts/AppLayout";

const About = lazy(() => import("../features/home/pages/About"));
const Landing = lazy(() => import("../features/home/pages/Landing"));
const Login = lazy(() => import("../features/auth/pages/desktop/Login"));
const Signup = lazy(() => import("../features/auth/pages/desktop/Signup"));
const ChooseUsername = lazy(() => import("../features/auth/pages/ChooseUsername"));
const Drafts = lazy(() => import("../features/blog/pages/Drafts"));
const Support = lazy(() => import("../features/support/pages/Support"));
const Feedback = lazy(() => import("../features/feedback/pages/Feedback"));
const Updates = lazy(() => import("../features/releases/pages/Updates"));
const Dashboard = lazy(() => import("../features/dashboard/pages/Dashboard"));
const Profile = lazy(() => import("../features/profile/pages/Profile"));
const DSA = lazy(() => import("../features/dsa/pages/DSA"));
const Projects = lazy(() => import("../features/projects/pages/Projects"));
const Settings = lazy(() => import("../features/settings/pages/Settings"));
const Players = lazy(() => import("../features/friends/pages/Friends"));
const Leaderboard = lazy(() => import("../features/leaderboard/pages/Leaderboard"));
const SharedProject = lazy(() => import("../features/projects/pages/SharedProject"));
const PlayerHub = lazy(() => import("../features/player-hub/pages/PlayerHub"));
const PlayerWork = lazy(() => import("../features/player-hub/pages/PlayerWork"));
const Terms = lazy(() => import("../features/legal/pages/Terms"));
const Privacy = lazy(() => import("../features/legal/pages/Privacy"));
const ActivityDay = lazy(() => import("../features/activity/pages/ActivityDay"));
const Tournaments = lazy(() => import("../features/tournaments/pages/Tournaments"));
const Admin = lazy(() => import("../features/admin/pages/Admin"));
const AdminMetrics = lazy(() => import("../features/admin/pages/AdminMetrics"));


function RouteScrollReset() {
  const location = useLocation();

  useEffect(() => {
    if (!("scrollRestoration" in window.history)) {
      return undefined;
    }

    const previousMode = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previousMode;
    };
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previousRootBehavior = root.style.scrollBehavior;
    const previousBodyBehavior = body.style.scrollBehavior;

    root.style.scrollBehavior = "auto";
    body.style.scrollBehavior = "auto";

    const resetScroll = () => {
      window.scrollTo(0, 0);
      document.scrollingElement?.scrollTo(0, 0);

      document.querySelectorAll<HTMLElement>(
        ".app-content, .app-workspace, .route-stage",
      ).forEach((element) => {
        element.scrollTo(0, 0);
      });
    };

    resetScroll();
    const frame = window.requestAnimationFrame(() => {
      resetScroll();
      root.style.scrollBehavior = previousRootBehavior;
      body.style.scrollBehavior = previousBodyBehavior;
    });

    return () => {
      window.cancelAnimationFrame(frame);
      root.style.scrollBehavior = previousRootBehavior;
      body.style.scrollBehavior = previousBodyBehavior;
    };
  }, [location.pathname]);

  return null;
}

export function AppRouter() {
  return (
    <>
      <RouteScrollReset />
      <Suspense fallback={<PageLoader />}>
        <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/drafts" element={<Drafts />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/support" element={<Support />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/choose-username" element={<ChooseUsername />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/shared/projects/:shareSlug" element={<SharedProject />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="dsa" element={<DSA />} />
          <Route path="projects" element={<Projects />} />
          <Route path="players" element={<Players />} />
          <Route path="friends" element={<Navigate to="/players" replace />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="challenges" element={<Navigate to="/tournaments" replace />} />
          <Route path="tournaments" element={<Tournaments />} />
          <Route path="tournaments/:tournamentId" element={<Tournaments />} />
          <Route path="admin" element={<Admin />} />
          <Route path="admin/metrics" element={<AdminMetrics />} />
          <Route path="player-hub" element={<PlayerHub />} />
          <Route path="player-hub/players/:playerId/work" element={<PlayerWork />} />
          <Route path="settings" element={<Settings />} />
          <Route path="feedback" element={<Feedback />} />
          <Route path="activity/:date" element={<ActivityDay />} />
        </Route>
        </Routes>
      </Suspense>
    </>
  );
}
