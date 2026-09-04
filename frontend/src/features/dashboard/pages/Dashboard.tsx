import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import "../styles/Dashboard.css";
import { useAuth } from "../../auth/context/AuthContext";
import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import RankBadge from "../../../shared/components/RankBadge";
import {
  getDashboardViewModel,
  type DashboardViewModel,
} from "../../../services/DashboardService";

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardViewModel | null>(null);

  const userName = user?.displayName || "Developer";

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const loadDashboard = async (showLoader = false) => {
      if (showLoader) {
        setDashboard(null);
      }

      try {
        const viewModel = await getDashboardViewModel();
        if (isMounted) {
          setDashboard(viewModel);
        }
      } catch (error) {
        console.error(error);
      }
    };

    void loadDashboard(true);

    const handleActivityUpdate = () => {
      void loadDashboard();
    };

    window.addEventListener("devarena:activity-updated", handleActivityUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("devarena:activity-updated", handleActivityUpdate);
    };
  }, [user]);

  if (!user || !dashboard) {
    return <PageLoader />;
  }

  const {
    activeDays,
    arenaScore,
    daysRemaining,
    heatmap,
    heatmapMonthMarkers,
    leaderboardPreview,
    nextRank,
    rank,
    remainingPoints,
    seasonNumber,
    seasonPoints,
    streak,
  } = dashboard;

  return (
    <main className="dashboard">
      <section className="dashboard-hero">
        <div>
          <p className="dashboard-label">Developer Growth Platform</p>
          <h1 className="dashboard-welcome-title">
            <span className="dashboard-welcome-copy">Welcome back,</span>
            <span className="dashboard-welcome-name">{userName}</span>
          </h1>
          <p className="dashboard-subtitle">Keep building. Keep shipping.</p>
        </div>
      </section>

      <div className="dashboard-overview-row">
        <section
          className="dashboard-card dashboard-summary-card"
          aria-label="Developer overview"
        >
          <article className="dashboard-summary-line">
            <div><span>Arena Score</span><b aria-hidden="true">:</b><strong data-private-value="true">{arenaScore}</strong></div>
            <p><i aria-hidden="true">←</i> Weighted activity points</p>
          </article>

          <article className="dashboard-summary-line">
            <div><span>Season Points</span><b aria-hidden="true">:</b><strong data-private-value="true">{seasonPoints}</strong></div>
            <p><i aria-hidden="true">←</i> {activeDays} Active {activeDays === 1 ? "Day" : "Days"}</p>
          </article>

          <article className="dashboard-summary-line">
            <div><span>Current Streak</span><b aria-hidden="true">:</b><strong data-private-value="true">{streak} {streak === 1 ? "Day" : "Days"}</strong></div>
            <p><i aria-hidden="true">←</i> {streak === 0 ? "Start building" : "Consistent"}</p>
          </article>
        </section>

        <section
          className="dashboard-card dashboard-rank-season-card"
          aria-label="Rank and season status"
        >
          <article className="dashboard-rank-panel">
            <p className="dashboard-stat-label">Developer Rank</p>
            <h2 className="dashboard-rank-title">
              <RankBadge rank={rank} size="large" />
            </h2>
            <p className="dashboard-rank-copy" data-private-value="true">
              {seasonPoints} SP <span aria-hidden="true">•</span> {remainingPoints} Remaining
            </p>
            <div className="dashboard-next-rank">
              <span aria-hidden="true">➜</span>
              <RankBadge rank={nextRank} size="small" />
            </div>
          </article>

          <article className="dashboard-season-panel">
            <p className="dashboard-stat-label">Season Status</p>
            <h2>Season #{seasonNumber}</h2>
            <p className="dashboard-season-copy">Ends in {daysRemaining} Days</p>
          </article>
        </section>
      </div>

      <section className="dashboard-card dashboard-insights-card">
        <div className="dashboard-consistency-pane">
          <div className="consistency-header">
            <div>
              <p className="dashboard-stat-label">Yearly activity</p>
              <h2>Developer Consistency</h2>
            </div>
            <span className="consistency-range">Last 53 Weeks</span>
          </div>

          <div className="dev-heatmap-wrapper">
            <div className="month-row" aria-hidden="true">
              {heatmapMonthMarkers.map((marker) => (
                <span
                  key={marker.date}
                  style={{ gridColumnStart: marker.weekIndex + 1 }}
                >
                  {marker.label}
                </span>
              ))}
            </div>

            <div className="heatmap-dashboard-inside" aria-label="Developer contribution heatmap">
              {heatmap.map((cell) => (
                <button
                  type="button"
                  key={cell.date}
                  title={`${cell.title}. Open daily details.`}
                  aria-label={`Open activity for ${cell.date}`}
                  className={`heat-cell-dashboard ${cell.level}`}
                  onClick={() => navigate(`/activity/${cell.date}`)}
                />
              ))}
            </div>
          </div>

          <div className="heatmap-footer">
            <span>Less</span>
            <div className="legend" aria-hidden="true">
              <div className="heat-cell-dashboard" />
              <div className="heat-cell-dashboard low" />
              <div className="heat-cell-dashboard medium" />
              <div className="heat-cell-dashboard high" />
              <div className="heat-cell-dashboard max" />
            </div>
            <span>More</span>
          </div>
        </div>

        <aside className="dashboard-leaderboard-pane" aria-labelledby="leaderboard-preview-title">
          <div className="card-header">
            <h2 id="leaderboard-preview-title">Leaderboard Preview</h2>
          </div>

          <div className="leaderboard" aria-live="polite">
            {leaderboardPreview.map((entry) => (
              <div
                className={`leaderboard-row${entry.isCurrentUser ? " active-user" : ""}`}
                key={entry.id}
              >
                <span>#{entry.position}</span>
                <span>{entry.isCurrentUser ? `${entry.name} · You` : entry.name}</span>
                <span data-private-value="true">{entry.competitionScore}</span>
              </div>
            ))}
            {leaderboardPreview.length === 0 && (
              <p className="leaderboard-empty">Your live arena position will appear here.</p>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

export default Dashboard;
