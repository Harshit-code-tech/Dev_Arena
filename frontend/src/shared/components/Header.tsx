import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import { useAuth } from "../../features/auth/context/AuthContext";

import "../styles/Header.css";

const navLinks = [
  { name: "Home", path: "/" },
  { name: "About us", path: "/about" },
  { name: "Updates", path: "/updates" },
  { name: "Support", path: "/support" },
];

function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, logout } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenu, setProfileMenu] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "auto";
  }, [menuOpen]);

  // Close menu on route change
 useEffect(() => {
  setMenuOpen(false);
  setProfileMenu(false);
}, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <>
      {/* Blur Overlay */}
      {menuOpen && (
        <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
      )}

      <header className="header">
        {/* Logo */}
        <button type="button" className="logo" onClick={() => navigate("/")}>
          Dev<span className="logo-accent">Arena</span>
        </button>

        {/* Desktop Navigation */}
        <nav className="nav-links desktop-nav">
          {navLinks.map((link) => (
            <button
              key={link.path}
              className={location.pathname === link.path ? "active-nav" : ""}
              onClick={() => navigate(link.path)}
            >
              {link.name}
            </button>
          ))}
        </nav>

        {/* Desktop Auth Buttons */}
        <div className="auth-buttons desktop-auth">
          {user ? (
            <div className="logged-in-section">
              <div className="notification-wrapper">
                <button className="notification-btn">🔔</button>

                <span className="notification-badge">3</span>
              </div>

              <div className="profile-wrapper" ref={profileRef}>
                <button
                  className="profile-btn"
                  onClick={() => setProfileMenu(!profileMenu)}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Profile"
                      className="profile-avatar"
                    />
                  ) : (
                    "👤"
                  )}
                </button>

                {profileMenu && (
                  <div className="profile-dropdown">
                    <div className="profile-user-info">
                      <strong>{user?.displayName || "Developer"}</strong>

                      <span>{user?.email}</span>
                    </div>
                    <button
                      onClick={() => {
                        navigate("/dashboard");
                        setProfileMenu(false);
                      }}
                    >
                      Dashboard
                    </button>

                    <button
                      onClick={() => {
                        navigate("/profile");
                        setProfileMenu(false);
                      }}
                    >
                      Profile
                    </button>

                    <button
                      onClick={() => {
                        setProfileMenu(false);
                      }}
                    >
                      Settings
                    </button>

                    <button onClick={handleLogout}>Logout</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <button className="auth-btn" onClick={() => navigate("/login")}>
                Log in
              </button>

              <button
                className="auth-btn signup-btn"
                onClick={() => navigate("/signup")}
              >
                Get Started
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button className="menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
          <i className={`bx ${menuOpen ? "bx-x" : "bx-menu"}`}></i>
        </button>
      </header>

      {/* Mobile Drawer */}
      <aside className={`mobile-drawer ${menuOpen ? "active" : ""}`}>
        <div className="drawer-header">
          <h2>DevArena</h2>

          <button onClick={() => setMenuOpen(false)}>
            <i className="bx bx-x"></i>
          </button>
        </div>

        <div className="drawer-links">
          {navLinks.map((link) => (
            <button
              key={link.path}
              className={location.pathname === link.path ? "active-nav" : ""}
              onClick={() => {
                navigate(link.path);
                setMenuOpen(false);
              }}
            >
              {link.name}
            </button>
          ))}
        </div>

        <div className="drawer-auth">
          {user ? (
            <>
              <button
                className="drawer-signup"
                onClick={() => navigate("/dashboard")}
              >
                Dashboard
              </button>

              <button className="drawer-login" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                className="drawer-login"
                onClick={() => navigate("/login")}
              >
                Log in
              </button>

              <button
                className="drawer-signup"
                onClick={() => navigate("/signup")}
              >
                Get Started
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export default Header;
