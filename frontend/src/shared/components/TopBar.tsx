import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../../features/auth/context/AuthContext";
import NotificationPanel from "./NotificationPanel";
import { getUnreadNotificationCount } from "../../services/NotificationService";
import "../styles/TopBar.css";

const pageDetails: Record<string, { title: string; description: string }> = {
  "/dashboard": {
    title: "Dashboard",
    description: "Arena score, streaks, season movement, and your nearest competitors.",
  },
  "/dsa": {
    title: "DSA",
    description: "Log problems, revision, and learning evidence in one focused workspace.",
  },
  "/projects": {
    title: "Projects",
    description: "Track builds, full-stack practice, milestones, sessions, and shared work.",
  },
  "/players": {
    title: "Players",
    description: "Discover developers, manage requests, and grow your trusted network.",
  },
  "/friends": {
    title: "Players",
    description: "Discover developers, manage requests, and grow your trusted network.",
  },
  "/leaderboard": {
    title: "Leaderboard",
    description: "Compare Arena Score, rank movement, and the current top performers.",
  },
  "/tournaments": {
    title: "Tournaments",
    description: "Compete in solo DSA rounds and GitHub-verified project tournaments with matched teams.",
  },
  "/admin": {
    title: "Admin",
    description: "Manage tournaments, questions, judging, users, moderation, and platform health.",
  },
  "/player-hub": {
    title: "Player Hub",
    description: "A future home for collaboration, teams, events, and shared developer missions.",
  },
  "/profile": {
    title: "Profile",
    description: "Review rank, consistency, analytics, and your latest verified activity.",
  },
  "/settings": {
    title: "Settings",
    description: "Control your identity, privacy, notifications, account, and player preferences.",
  },
};

type TopBarProps = {
  onMenuToggle?: () => void;
};

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const location = useLocation();
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  const closeProfilePanel = useCallback(() => setProfilePanelOpen(false), []);

  useEffect(() => {
    let mounted = true;
    const refreshUnreadCount = async () => {
      try {
        const count = await getUnreadNotificationCount();
        if (mounted) setUnreadCount(count);
      } catch {
        // Keep the most recent badge count while the connection recovers.
      }
    };

    void refreshUnreadCount();
    const fallback = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshUnreadCount();
    }, 30000);
    const refresh = () => void refreshUnreadCount();
    window.addEventListener("devarena:notifications-refresh", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      mounted = false;
      window.clearInterval(fallback);
      window.removeEventListener("devarena:notifications-refresh", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const displayName = user?.displayName || "Developer";
  const profileInitial = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "D";
  const useInitials = Boolean(user && "useInitials" in user && user.useInitials);
  const page = useMemo(
    () => location.pathname.startsWith("/tournaments/")
      ? { title: "Tournament", description: "Registration, live questions, GitHub submissions, and tournament standings." }
      : location.pathname.startsWith("/activity/")
      ? {
          title: "Daily Activity",
          description: "Audit the complete DSA, project, learning, and challenge evidence for one day.",
        }
      : pageDetails[location.pathname] || {
          title: "DevArena",
          description: "Build evidence, measure consistency, and keep moving your developer career forward.",
        },
    [location.pathname],
  );

  return (
    <header className="topbar">
      <button type="button" className="topbar-menu-button" onClick={onMenuToggle} aria-label="Open navigation">
        <i className="bx bx-menu" aria-hidden="true" />
      </button>

      <div className="topbar-page-copy" aria-live="polite">
        <strong>{page.title}</strong>
        <p>{page.description}</p>
      </div>

      <button
        type="button"
        className="profile-avatar-button"
        aria-label={unreadCount > 0 ? `Open profile and notifications, ${unreadCount} unread` : "Open profile and notifications"}
        aria-controls="profile-sidebar"
        aria-expanded={profilePanelOpen}
        onClick={() => setProfilePanelOpen(true)}
      >
        {user?.photoURL && !useInitials ? (
          <img src={user.photoURL} alt="" />
        ) : (
          <span aria-hidden="true">{profileInitial}</span>
        )}
        {unreadCount > 0 && (
          <b className="profile-notification-badge" aria-hidden="true">
            {unreadCount > 99 ? "99+" : unreadCount}
          </b>
        )}
      </button>

      <NotificationPanel open={profilePanelOpen} onClose={closeProfilePanel} />
    </header>
  );
}
