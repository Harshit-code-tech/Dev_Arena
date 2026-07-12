import { useEffect, useState } from "react";

import "../styles/Dashboard.css";
import { useAuth } from "../../auth/context/AuthContext";
import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import {
  getDashboardViewModel,
  type DashboardViewModel,
} from "../../../services/DashboardService";

function Dashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardViewModel | null>(null);

  const userName = user?.displayName || "Developer";

  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    setDashboard(null);

    getDashboardViewModel()
      .then((viewModel) => {
        if (isMounted) {
          setDashboard(viewModel);
        }
      })
      .catch(console.error);

    return () => {
      isMounted = false;
    };
  }, [user]);

  if (!user || !dashboard) {
    return <PageLoader />;
  }

  const {
    activeDays,
    arenaScore,
    currentRankMaxPoints,
    daysRemaining,
    heatmap,
    heatmapMonthMarkers,
    mostActiveDay,
    nextRank,
    rank,
    rankProgress,
    recentLogs,
    remainingPoints,
    seasonNumber,
    seasonPoints,
    streak,
    totalLogs,
  } = dashboard;

  return (
    <main className="dashboard">
      {/* HERO */}

      <section className="dashboard-hero">
        <div>
          <p className="dashboard-label">Developer Growth Platform</p>

          <h1>Welcome back, {userName}</h1>

          <p className="dashboard-subtitle">Keep building. Keep shipping.</p>
        </div>
      </section>

      {/* STATS */}

      <section className="stats-grid">
        <div className="stat-card">
          <h3>Arena Score</h3>
          <h2>{arenaScore}</h2>
          <p>+5 to every log</p>
        </div>

        <div className="stat-card">
          <h3>Season Points</h3>
          <h2>{seasonPoints}</h2>
          <p>{activeDays} Active Days</p>
        </div>

        <div className="stat-card rank-card">
          <h3>Developer Rank</h3>

          <h2>{rank}</h2>

          <p>
            {seasonPoints} SP • {remainingPoints} Remaining
          </p>

          <small className="next-rank-label">➜ {nextRank}</small>

          <div className="rank-progress">
            <div
              className="rank-progress-fill"
              style={{
                width: `${rankProgress}%`,
              }}
            />
          </div>
        </div>

        <div className="stat-card">
          <h3>Season Status</h3>

          <h2>Season #{seasonNumber}</h2>

          <p>Ends in {daysRemaining} Days</p>

          <div style={{ marginTop: "12px" }}>
            <strong>{rank}</strong>
          </div>

          <div style={{ marginTop: "8px" }}>
            {seasonPoints} / {currentRankMaxPoints} SP
          </div>
        </div>

        <div className="stat-card">
          <h3>Current Streak</h3>
          <h2>{streak} Days</h2>

          <p>{streak === 0 ? "Start building 🚀" : "🔥 Consistent"}</p>
        </div>
      </section>

      {/* HEATMAP */}

      <section className="dashboard-card consistency-card-inside">
        <div className="consistency-header">
          <div>
            <h2>Developer Consistency</h2>
          </div>

          <div className="consistency-stats">
            <div>
              <span>{totalLogs}</span>
              <p>Total Logs</p>
            </div>

            <div>
              <span>{arenaScore}</span>
              <p>Arena Score</p>
            </div>
          </div>
        </div>

        <div className="contribution-summary">
          <div>
            <strong>{mostActiveDay || "N/A"}</strong>
            <p>Most Active Day</p>
          </div>
        </div>

        {/* Heatmap Grid */}

        <div className="dev-heatmap-wrapper">
          <div className="heatmap-title-row">
            <h3>Contribution Activity</h3>

            <span>Last 53 Weeks</span>
          </div>

          <div className="month-row">
            {heatmapMonthMarkers.map((marker) => (
              <span
                key={marker.date}
                style={{
                  gridColumnStart: marker.weekIndex + 1,
                }}
              >
                {marker.label}
              </span>
            ))}
          </div>

          <div className="heatmap-dashboard-inside">
            {heatmap.map((cell) => (
              <div
                key={cell.date}
                title={cell.title}
                className={`heat-cell-dashboard ${cell.level}`}
              />
            ))}
          </div>
        </div>

        {/* PHASE 7 GOES HERE */}

        <div className="heatmap-footer">
          <span>Less</span>

          <div className="legend">
            <div className="heat-cell-dashboard"></div>

            <div className="heat-cell-dashboard low"></div>

            <div className="heat-cell-dashboard medium"></div>

            <div className="heat-cell-dashboard high"></div>

            <div className="heat-cell-dashboard max"></div>
          </div>

          <span>More</span>
        </div>
      </section>

      <section className="dashboard-bottom-grid">
        {/* RECENT ACTIVITY */}

        <div className="dashboard-card">
          <div className="card-header">
            <h2>Recent Activity</h2>
          </div>

          <ul className="activity-list">
            {recentLogs.length === 0 ? (
              <li>No activity logged yet.</li>
            ) : (
              recentLogs.map((log) => <li key={log.id}>{log.text}</li>)
            )}
          </ul>
        </div>

        {/* LEADERBOARD */}

        <div className="dashboard-card">
          <div className="card-header">
            <h2>Leaderboard Preview</h2>
          </div>

          <div className="leaderboard">
            <div className="leaderboard-row">
              <span>#1</span>
              <span>Arpan</span>
              <span>1842</span>
            </div>
            <div className="leaderboard-row active-user">
              <span>#2</span>
              <span>You</span>
              <span>1542</span>
            </div>
            <div className="leaderboard-row">
              <span>#3</span>
              <span>Riya</span>
              <span>1490</span>
            </div>
            <div className="leaderboard-row">
              <span>#4</span>
              <span>Harshit</span>
              <span>1490</span>
            </div>
            <div className="leaderboard-row">
              <span>#5</span>
              <span>Priya</span>
              <span>1490</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Dashboard;
