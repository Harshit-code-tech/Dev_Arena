import { useNavigate, useLocation } from "react-router-dom";
import "../styles/Sidebar.css";
import { useState } from "react";
import QuickLogModal from "./QuickLogModal";

const links = [
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: "bx-grid-alt",
  },
  {
    name: "DSA",
    path: "/dsa",
    icon: "bx-code-alt",
  },
  {
    name: "Projects",
    path: "/projects",
    icon: "bx-folder",
  },
  {
    name: "Leaderboard",
    path: "/leaderboard",
    icon: "bx-trophy",
  },
  {
    name: "Challenges",
    path: "/challenges",
    icon: "bx-target-lock",
  },
  {
    name: "Profile",
    path: "/profile",
    icon: "bx-user",
  },
  {
    name: "Settings",
    path: "/settings",
    icon: "bx-cog",
  },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [quickLogOpen, setQuickLogOpen] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <h2 className="sidebar-logo">
          Dev<span>Arena</span>
        </h2>

        <div className="sidebar-links">
          {links.map((link) => (
            <button
              key={link.path}
              className={
                location.pathname === link.path
                  ? "sidebar-link active"
                  : "sidebar-link"
              }
              onClick={() => navigate(link.path)}
            >
              <i className={`bx ${link.icon}`} />
              <span>{link.name}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="quick-log-btn" onClick={() => setQuickLogOpen(true)}>
        + Quick Log
      </button>

      <QuickLogModal
        open={quickLogOpen}
        onClose={() => setQuickLogOpen(false)}
      />
    </aside>
  );
}
