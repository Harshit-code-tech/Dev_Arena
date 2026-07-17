import "../styles/NotificationPanel.css";

interface Props {
  open: boolean;
}

export default function NotificationPanel({
  open,
}: Props) {
  return (
    <div
      className={
        open
          ? "notification-panel open"
          : "notification-panel"
      }
    >
      <h3>Notifications</h3>

      <div className="notification-item">
        Contest starts in 2 hours
      </div>

      <div className="notification-item">
        New follower joined
      </div>

      <div className="notification-item">
        Daily challenge available
      </div>
    </div>
  );
}