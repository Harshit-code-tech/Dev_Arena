import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import ProtectedRoute from "../features/auth/components/ProtectedRoute";
import PageLoader from "../shared/components/Skeletons/PageLoader";
import AppLayout from "../shared/layouts/AppLayout";

const About = lazy(() => import("../features/home/pages/About"));
const Landing = lazy(() => import("../features/home/pages/Landing"));
const MobileLogin = lazy(() => import("../features/auth/pages/mobile/MobileLogin"));
const DesktopLogin = lazy(() => import("../features/auth/pages/desktop/DesktopLogin"));
const MobileSignup = lazy(() => import("../features/auth/pages/mobile/MobileSignup"));
const DesktopSignup = lazy(() => import("../features/auth/pages/desktop/DesktopSignup"));
const Drafts = lazy(() => import("../features/blog/pages/Drafts"));
const Support = lazy(() => import("../features/support/pages/Support"));
const Updates = lazy(() => import("../features/releases/pages/Updates"));
const Dashboard = lazy(() => import("../features/dashboard/pages/Dashboard"));
const Profile = lazy(() => import("../features/profile/pages/Profile"));

function Placeholder({ name }: { name: string }) {
  return (
    <main className="page placeholder-page">
      <h1>{name}</h1>
      <p>This page will be built later.</p>
    </main>
  );
}

export function AppRouter() {
  const isMobile = window.innerWidth < 830;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/drafts" element={<Drafts />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/support" element={<Support />} />

        <Route
          path="/login"
          element={isMobile ? <MobileLogin /> : <DesktopLogin />}
        />

        <Route
          path="/signup"
          element={isMobile ? <MobileSignup /> : <DesktopSignup />}
        />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="dsa" element={<Placeholder name="DSA" />} />
          <Route path="projects" element={<Placeholder name="Projects" />} />
          <Route
            path="leaderboard"
            element={<Placeholder name="Leaderboard" />}
          />
          <Route
            path="challenges"
            element={<Placeholder name="Challenges" />}
          />
          <Route path="settings" element={<Placeholder name="Settings" />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
