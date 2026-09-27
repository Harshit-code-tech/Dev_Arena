import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useAuth } from "../../features/auth/context/AuthContext";
import "../styles/Sidebar.css";

const links = [
  { name: "Dashboard", path: "/dashboard", icon: "bx-grid-alt" },
  { name: "DSA", path: "/dsa", icon: "bx-code-alt" },
  { name: "Projects", path: "/projects", icon: "bx-folder" },
  { name: "Players", path: "/players", icon: "bx-group" },
  { name: "Leaderboard", path: "/leaderboard", icon: "bx-trophy" },
  { name: "Challenges", path: "/challenges", icon: "bx-target-lock" },
  { name: "Tournaments", path: "/tournaments", icon: "bx-trophy" },
  { name: "Player Hub", path: "/player-hub", icon: "bx-network-chart" },
  { name: "Profile", path: "/profile", icon: "bx-user" },
] as const;

const routePrefetchers: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("../../features/dashboard/pages/Dashboard"),
  "/dsa": () => import("../../features/dsa/pages/DSA"),
  "/projects": () => import("../../features/projects/pages/Projects"),
  "/players": () => import("../../features/friends/pages/Friends"),
  "/leaderboard": () => import("../../features/leaderboard/pages/Leaderboard"),
  "/challenges": () => import("../../features/challenges/pages/Challenges"),
  "/tournaments": () => import("../../features/tournaments/pages/Tournaments"),
  "/player-hub": () => import("../../features/player-hub/pages/PlayerHub"),
  "/profile": () => import("../../features/profile/pages/Profile"),
  "/admin": () => import("../../features/admin/pages/Admin"),
};

function prefetchRoute(path: string) {
  void routePrefetchers[path]?.();
}

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
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
          <p className="sidebar-logo-caption">Where devs compete &amp; excuses die</p>

          <nav className="sidebar-links">
            {visibleLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                onClick={onClose}
                onMouseEnter={() => prefetchRoute(link.path)}
                onFocus={() => prefetchRoute(link.path)}
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
            <span>The Daily Ritual</span>
            <strong>Code · Run · Flex · Repeat</strong>
            <p>Fake commits won't save you. Ship real code or get left behind.</p>
          </div>
        </div>
      </aside>
    </>
  );
}

