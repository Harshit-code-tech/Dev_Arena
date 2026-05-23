import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/header.css";

// Defining Nav links
const navLinks = [
  { name: "Home", path: "/" },
  { name: "About us", path: "/about" },
  { name: "Blog", path: "/blog" },
  { name: "Support", path: "/support" },
];

function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  // Mobile menu state
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header">
      {/* Logo */}
      <button
        type="button"
        className="logo"
        onClick={() => navigate("/")}
        aria-label="Go to home page"
      >
        Dev<span className="logo-accent">Arena</span>
      </button>

      {/* Mobile Menu Icon */}
      <button
        type="button"
        className={`bx bx-menu ${menuOpen ? "bx-x" : ""}`}
        id="menu-icon"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
      >
        <span
          className="animate"
          style={{ "--i": 2 } as React.CSSProperties}
        ></span>
      </button>

      {/* Navigation */}
      <nav
        id="primary-navigation"
        className={`nav-links ${menuOpen ? "active" : ""}`}
      >
        {navLinks.map((link) => (
          <button
            key={link.path}
            type="button"
            className={location.pathname === link.path ? "active-nav" : ""}
            onClick={() => {
              navigate(link.path);
              setMenuOpen(false); // close menu after click
            }}
          >
            {link.name}
          </button>
        ))}

        <span className="active_nav"></span>

        <span
          className="animate"
          style={{ "--i": 2 } as React.CSSProperties}
        ></span>
      </nav>

      {/* Auth Buttons */}
      <div className="auth-buttons">
        <button
          type="button"
          className={
            location.pathname === "/login"
              ? "auth-btn active-auth"
              : "auth-btn"
          }
          onClick={() => navigate("/login")}
        >
          Log in
        </button>

        <button
          type="button"
          className={
            location.pathname === "/signup"
              ? "auth-btn active-auth"
              : "auth-btn"
          }
          onClick={() => navigate("/signup")}
        >
          Sign up
        </button>
      </div>
    </header>
  );
}

export default Header;