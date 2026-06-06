import { useNavigate } from "react-router-dom";
import { auth } from "../config/fireBase";
import "../styles/Dashboard.css";

function Dashboard() {
  const userName =
  auth.currentUser?.displayName || "Developer";
  const navigate = useNavigate();
  return (
    <main className="dashboard-page">
      <div className="dashboard-wrap">
        <h2>Welcome back, {userName}</h2>
        <p>
          Here you can manage your projects, track your progress, and connect
          with other developers.
        </p>
        <button className="dashboard-btn" onClick={() => navigate("/Support")}>
          Need help? Contact support →
        </button>
      </div>
    </main>
  );
}
export default Dashboard;
