import type { ReactNode } from "react";

import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import WorkspaceBrief from "../components/WorkspaceBrief";
import "../styles/AppLayout.css";

interface Props {
  children: ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-workspace">
        <TopBar />
        <main className="app-content">
          <WorkspaceBrief />
          <div className="route-stage">{children}</div>
        </main>
      </div>
    </div>
  );
}
