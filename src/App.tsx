import Header from './components/Header';
import { Routes, Route } from 'react-router-dom';
import NewBlog from './pages/NewBlog';
import Blog from './pages/Blog';
import { Toaster } from "react-hot-toast";
import PageLoader from "./components/Skeletons/PageLoader";
import { lazy, Suspense } from "react";

const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));
const MobileLogin = lazy(() => import("./Auth/mobileAuth/MobileLogin"));
const DesktopLogin = lazy(() => import("./Auth/desktopAuth/DesktopLogin"));
const MobileSignup = lazy(() => import("./Auth/mobileAuth/MobileSignup"));
const DesktopSignup = lazy(() => import("./Auth/desktopAuth/DesktopSignup"));
const Drafts = lazy(() => import("./pages/Drafts"));
const Support = lazy(() => import("./pages/Support"));
const Updates = lazy(() => import("./pages/Updates"));
const Dashboard = lazy(() => import("./pages/Dashboard"));

function Placeholder({ name }: { name: string }) {
  return (
    <main className="page placeholder-page">
      <h1>{name}</h1>
      <p>This page will be built later.</p>
    </main>
  )
}

// const isMobile = window.innerWidth < 768;

function App() {
  const isMobile = window.innerWidth < 830;
  return (
    <div className="app">
      <Header />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/templates" element={<Placeholder name="Templates" />} />
          {/* <Route path="/blog" element={<Blog />} />
        
        <Route path="/newblog" element={<NewBlog />} /> */}
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
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Suspense>
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
