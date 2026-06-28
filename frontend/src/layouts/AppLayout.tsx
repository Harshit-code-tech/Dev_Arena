import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import { Outlet } from "react-router-dom";
import "../styles/AppLayout.css";

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="app-content">
        <TopBar />

        <Outlet />
      </main>
    </div>
  );
}
