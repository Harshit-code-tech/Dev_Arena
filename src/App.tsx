import Header from './components/Header';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import NewBlog from './pages/NewBlog';
import Drafts from './pages/Drafts';
import Support from './pages/Support'
import Updates from "./pages/Updates";
import Blog from './pages/Blog';
import MobileLogin from './Auth/mobileAuth/MobileLogin';
import DesktopLogin from './Auth/desktopAuth/DesktopLogin';
import MobileSignup from './Auth/mobileAuth/MobileSignup';
import DesktopSignup from './Auth/desktopAuth/DesktopSignup';
import { Toaster } from "react-hot-toast";


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
  return (
    <div className='app'>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/templates" element={<Placeholder name="Templates" />} />
        <Route path="/about" element={<About />} />
        <Route path="/login" element={(() => {
          const isMobile = window.innerWidth < 830;
          return isMobile ? <MobileLogin /> : <DesktopLogin />;
        })()} />
        <Route path="/signup" element={(() => {
          const isMobile = window.innerWidth < 830;
          return isMobile ? <MobileSignup /> : <DesktopSignup />;
        })()} />
        <Route path="/support" element={<Support />} />
        <Route path="/updates" element={<Updates />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/new" element={<NewBlog />} />
        <Route path="/blog/drafts" element={<Drafts />} />
      </Routes>

      <Toaster position="bottom-right" />

    </div>

  )
}

export default App
