import Header from "./components/Header";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute";
import PageLoader from "./components/Skeletons/PageLoader";
import { useAuth } from "./context/AuthContext";
import { lazy, Suspense } from "react";
import AppLayout from "./layouts/AppLayout";
import { Color2FADemo } from "./components/Color2FADemo";

const About = lazy(() => import("./pages/About"));
const Landing = lazy(() => import("./pages/Landing"));

const MobileLogin = lazy(() => import("./Auth/mobileAuth/MobileLogin"));
const DesktopLogin = lazy(() => import("./Auth/desktopAuth/DesktopLogin"));
const MobileSignup = lazy(() => import("./Auth/mobileAuth/MobileSignup"));
const DesktopSignup = lazy(() => import("./Auth/desktopAuth/DesktopSignup"));
const Drafts = lazy(() => import("./pages/Drafts"));
const Support = lazy(() => import("./pages/Support"));
const Updates = lazy(() => import("./pages/Updates"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Profile = lazy(() => import("./pages/Profile"));

function Placeholder({ name }: { name: string }) {
  return (
    <main className="page placeholder-page">
      <h1>{name}</h1>
      <p>This page will be built later.</p>
    </main>
  );
}

function App() {
  const isMobile = window.innerWidth < 830;
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }
  return (
    <div className="app">
      {!user && <Header />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          {/* <Route path="/blog" element={<Blog />} />
        
        <Route path="/newblog" element={<NewBlog />} /> */}
          <Route path="/colorsetup" element={<Color2FADemo />} />
          <Route path="/about" element={<About />} />
          <Route path="/drafts" element={<Drafts />} />
          <Route path="/updates" element={<Updates />} />
          <Route
            path="/login"
            element={isMobile ? <MobileLogin /> : <DesktopLogin />}
          />

          <Route
            path="/signup"
            element={isMobile ? <MobileSignup /> : <DesktopSignup />}
          />
          <Route path="/support" element={<Support />} />
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
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
