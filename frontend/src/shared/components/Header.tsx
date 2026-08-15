import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { signOut } from "firebase/auth";
import { auth } from "../../config/Firebase";
import { useAuth } from "../../features/auth/context/AuthContext";
import "../styles/Header.css";

const publicLinks = [
  { label: "About", path: "/about" },
  { label: "Updates", path: "/updates" },
  { label: "Support", path: "/support" },
] as const;

function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [profileMenu, setProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateToTop = (path: string) => {
    navigate(path);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigateToTop("/");
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <header className="header public-header">
      <button type="button" className="logo public-wordmark" onClick={() => navigateToTop("/")}>
        <span className="public-wordmark-primary">Dev</span>
        <span className="public-wordmark-secondary">Arena</span>
      </button>

      <nav className="nav-links public-nav" aria-label="Public navigation">
        {publicLinks.map((link) => (
          <button
            key={link.path}
            type="button"
            className={location.pathname === link.path ? "active-nav" : ""}
            onClick={() => navigateToTop(link.path)}
          >
            {link.label}
          </button>
        ))}
      </nav>

      <div className="auth-buttons">
        {user ? (
          <div className="logged-in-section">
            <div className="profile-wrapper" ref={profileRef}>
              <button className="profile-btn" onClick={() => setProfileMenu(!profileMenu)} aria-label="Open profile menu">
                {user.photoURL ? <img src={user.photoURL} alt="" className="profile-avatar" /> : <i className="bx bx-user" aria-hidden="true" />}
              </button>
              {profileMenu && (
                <div className="profile-dropdown">
                  <div className="profile-user-info">
                    <strong>{user.displayName || "Developer"}</strong>
                    <span>{user.email}</span>
                  </div>
                  <button onClick={() => navigate("/dashboard")}>Dashboard</button>
                  <button onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <button className="auth-btn" onClick={() => navigate("/login")}>Log in</button>
            <button className="auth-btn signup-btn" onClick={() => navigate("/signup")}>Get Started</button>
          </>
        )}
      </div>
    </header>
  );
}

export default Header;
