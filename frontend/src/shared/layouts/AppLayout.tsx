import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { startRealtimeSync } from "../../services/RealtimeService";
import { sendPresenceHeartbeat } from "../../services/PresenceService";
import "../styles/AppLayout.css";

export default function AppLayout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add("authenticated-shell");
    const stopRealtime = startRealtimeSync();
    return () => {
      document.body.classList.remove("authenticated-shell");
      stopRealtime();
    };
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    void sendPresenceHeartbeat(location.pathname);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void sendPresenceHeartbeat(location.pathname);
    }, 45_000);
    const onVisible = () => { if (document.visibilityState === "visible") void sendPresenceHeartbeat(location.pathname); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [location.pathname]);

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="app-workspace">
        <TopBar onMenuToggle={() => setSidebarOpen((current) => !current)} />
        <main className="app-content">
          <div className="route-stage" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
