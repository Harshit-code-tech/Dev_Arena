import { useState, useRef, useEffect } from "react";
import NotificationPanel from "./NotificationPanel";
import { useAuth } from "../context/AuthContext";
import ProfileDropdown from "./ProfileDropdown";
import "../styles/TopBar.css";

export default function TopBar() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);

  const { user } = useAuth();

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);

    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div className="topbar">
      <div className="notification-wrapper" ref={panelRef}>
        <button
          className="notification-btn"
          disabled={notificationsOpen}
          onClick={() => setNotificationsOpen(true)}
        >
          🔔
        </button>

        <NotificationPanel open={notificationsOpen} />
      </div>

      <div className="profile-wrapper" ref={panelRef}>
        <button
          className="profile-btn"
          onClick={() => setProfileOpen(!profileOpen)}
        >
          <img src={user?.photoURL || "/avatar-default.png"} alt="profile" />

          <span>{user?.displayName || "Developer"}</span>

          <i
            className={`bx ${
              profileOpen ? "bx-chevron-up" : "bx-chevron-down"
            }`}
          />
        </button>

        <ProfileDropdown open={profileOpen} />
      </div>
    </div>
  );
}
