import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../features/auth/context/AuthContext";
import LiveDateTime from "./LiveDateTime";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "../../services/NotificationService";
import "../styles/NotificationPanel.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NotificationPanel({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshNotifications = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const nextNotifications = await getNotifications();
      setNotifications(nextNotifications);
    } catch {
      // Keep the latest successful notification state during temporary network failures.
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshNotifications(true);

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshNotifications();
    }, 30000);
    const refreshOnFocus = () => void refreshNotifications();
    const refreshFromAppEvent = () => void refreshNotifications();

    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("devarena:notifications-refresh", refreshFromAppEvent);

    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("devarena:notifications-refresh", refreshFromAppEvent);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    void refreshNotifications();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, refreshNotifications]);

  if (!open) return null;

  const displayName = user?.displayName || "Developer";
  const profileInitial = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "D";
  const useInitials = Boolean(user && "useInitials" in user && user.useInitials);

  const goToSettings = () => {
    onClose();
    navigate("/settings");
  };

  const handleLogout = () => {
    onClose();
    logout();
    navigate("/");
  };

  async function openNotification(notification: AppNotification) {
    if (!notification.isRead) {
      await markNotificationRead(notification.id).catch(() => undefined);
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, isRead: true } : item));
      window.dispatchEvent(new Event("devarena:notifications-refresh"));
    }
    if (notification.link) {
      onClose();
      navigate(notification.link);
    }
  }

  async function markEverythingRead() {
    await markAllNotificationsRead().catch(() => undefined);
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
    window.dispatchEvent(new Event("devarena:notifications-refresh"));
  }

  return (
    <>
      <button type="button" className="profile-sidebar-backdrop" aria-label="Close profile sidebar" onClick={onClose} />
      <aside id="profile-sidebar" className="profile-sidebar" role="dialog" aria-modal="true" aria-labelledby="profile-sidebar-title">
        <header className="profile-sidebar-header">
          <div className="profile-sidebar-identity">
            <div className="profile-sidebar-avatar" aria-hidden="true">
              {user?.photoURL && !useInitials ? <img src={user.photoURL} alt="" /> : <span>{profileInitial}</span>}
            </div>
            <div>
              <p className="profile-sidebar-eyebrow">Signed in as</p>
              <h2 id="profile-sidebar-title">{displayName}</h2>
              <p className="profile-sidebar-email">{user?.email || ""}</p>
            </div>
          </div>
          <button type="button" className="profile-sidebar-close" aria-label="Close profile sidebar" onClick={onClose}><i className="bx bx-x" aria-hidden="true" /></button>
        </header>

        <section className="profile-sidebar-notifications" aria-labelledby="notification-title">
          <div className="profile-sidebar-section-heading">
            <div><p>Activity centre</p><h3 id="notification-title">Notifications</h3></div>
            {notifications.some((item) => !item.isRead) && <button type="button" className="notification-read-all" onClick={() => void markEverythingRead()}>Mark all read</button>}
          </div>

          <div className="profile-sidebar-notification-list">
            {loading && Array.from({ length: 3 }, (_, index) => <div className="notification-skeleton" key={index}><span /><div><i /><i /></div></div>)}
            {!loading && notifications.map((notification) => (
              <button type="button" className={`profile-sidebar-notification${notification.isRead ? " read" : ""}`} key={notification.id} onClick={() => void openNotification(notification)}>
                <span className="profile-sidebar-notification-dot" aria-hidden="true" />
                <div><h4>{notification.type}</h4><p>{notification.message}</p><LiveDateTime value={notification.createdAt} /></div>
              </button>
            ))}
            {!loading && notifications.length === 0 && <div className="notification-empty"><strong>All clear.</strong><span>New network and tracking updates will appear here.</span></div>}
          </div>
        </section>

        <footer className="profile-sidebar-actions">
          <button type="button" onClick={goToSettings}><i className="bx bx-cog" aria-hidden="true" /><span>Settings</span></button>
          <button type="button" onClick={handleLogout}><i className="bx bx-log-out" aria-hidden="true" /><span>Log out</span></button>
        </footer>
      </aside>
    </>
  );
}
