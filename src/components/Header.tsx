import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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

  const [menuOpen, setMenuOpen] = useState(false);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "auto";
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      {/* Blur Overlay */}
      {menuOpen && (
        <div
          className="menu-backdrop"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <header className="header">

        {/* Logo */}
        <button
          type="button"
          className="logo"
          onClick={() => navigate("/")}
        >
          Dev<span className="logo-accent">Arena</span>
        </button>

        {/* Desktop Navigation */}
        <nav className="nav-links desktop-nav">
          {navLinks.map((link) => (
            <button
              key={link.path}
              className={
                location.pathname === link.path
                  ? "active-nav"
                  : ""
              }
              onClick={() => navigate(link.path)}
            >
              {link.name}
            </button>
          ))}
        </nav>

        {/* Desktop Auth Buttons */}
        <div className="auth-buttons desktop-auth">
          <button
            className="auth-btn"
            onClick={() => navigate("/login")}
          >
            Log in
          </button>

          <button
            className="auth-btn signup-btn"
            onClick={() => navigate("/signup")}
          >
            Get Started
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="menu-btn"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <i
            className={`bx ${
              menuOpen ? "bx-x" : "bx-menu"
            }`}
          ></i>
        </button>
      </header>

      {/* Mobile Drawer */}
      <aside
        className={`mobile-drawer ${
          menuOpen ? "active" : ""
        }`}
      >
        <div className="drawer-header">
          <h2>DevArena</h2>

          <button
            onClick={() => setMenuOpen(false)}
          >
            <i className="bx bx-x"></i>
          </button>
        </div>

        <div className="drawer-links">
          {navLinks.map((link) => (
            <button
              key={link.path}
              className={
                location.pathname === link.path
                  ? "active-nav"
                  : ""
              }
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
        </div>
      </aside>
    </>
  );
}

export default Header;