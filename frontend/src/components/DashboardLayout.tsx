import { useState, useRef, useEffect } from "react";

import Sidebar from "./Sidebar";
import NotificationPanel from "./NotificationPanel";

interface Props {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutside);

    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <>
      <Sidebar />

      <main
        style={{
          marginLeft: "260px",
          padding: "30px",
        }}
      >
        <button
          disabled={notificationsOpen}
          className={notificationsOpen ? "bell disabled" : "bell"}
        >
          🔔
        </button>

        {children}
      </main>

      <div ref={panelRef}>
        <NotificationPanel open={notificationsOpen} />
      </div>
    </>
  );
}
