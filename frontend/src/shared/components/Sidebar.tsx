import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import QuickLogModal from "./QuickLogModal";
import { useAuth } from "../../features/auth/context/AuthContext";
import "../styles/Sidebar.css";

const links = [
  { name: "Dashboard", path: "/dashboard", icon: "bx-grid-alt" },
  { name: "DSA", path: "/dsa", icon: "bx-code-alt" },
  { name: "Projects", path: "/projects", icon: "bx-folder" },
  { name: "Players", path: "/players", icon: "bx-group" },
  { name: "Leaderboard", path: "/leaderboard", icon: "bx-trophy" },
  { name: "Tournaments", path: "/tournaments", icon: "bx-trophy" },
  { name: "Player Hub", path: "/player-hub", icon: "bx-network-chart" },
  { name: "Profile", path: "/profile", icon: "bx-user" },
] as const;

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const visibleLinks = user && "isAdmin" in user && user.isAdmin
    ? [...links, { name: "Admin", path: "/admin", icon: "bx-shield-quarter" } as const]
    : links;

  useEffect(() => {
    onClose?.();
  // Closing the compact drawer is intentionally tied only to route changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      <button
        type="button"
        className={`sidebar-backdrop${open ? " is-visible" : ""}`}
        aria-label="Close navigation"
        onClick={onClose}
      />

      <aside className={`sidebar${open ? " is-open" : ""}`} aria-label="Primary navigation">
        <div className="sidebar-top">
          <NavLink to="/dashboard" className="sidebar-logo" onClick={onClose} aria-label="DevArena dashboard">
            <span className="sidebar-logo-primary">Dev</span>
            <span className="sidebar-logo-secondary">Arena</span>
          </NavLink>
          <p className="sidebar-logo-caption">Developer growth system</p>

          <nav className="sidebar-links">
            {visibleLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={onClose}
                className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
              >
                <i className={`bx ${link.icon}`} aria-hidden="true" />
                <span>{link.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-mission" aria-label="How DevArena works">
            <span>Arena loop</span>
            <strong>Learn · Log · Build · Rank</strong>
            <p>Meaningful evidence moves your score, consistency, and position.</p>
          </div>

          <button className="quick-log-btn" type="button" onClick={() => setQuickLogOpen(true)}>
            <span aria-hidden="true">+</span> Quick Log
          </button>
        </div>

        <QuickLogModal open={quickLogOpen} onClose={() => setQuickLogOpen(false)} />
      </aside>
    </>
  );
}
