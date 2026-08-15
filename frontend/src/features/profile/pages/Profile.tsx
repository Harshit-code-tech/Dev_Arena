import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Profile.css";
import { useAuth } from "../../auth/context/AuthContext";
import { getRankFromPoints } from "../../dashboard/utils/RankSystem";
import {
  getDashboardViewModel,
  type DashboardLog,
} from "../../../services/DashboardService";
import RankBadge from "../../../shared/components/RankBadge";
import HistoryExportButton from "../../../shared/components/HistoryExportButton";
import LiveDateTime from "../../../shared/components/LiveDateTime";
import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import { downloadHistoryPdf } from "../../../services/PdfExportService";
import { trackingApi, displayActivityDateTime } from "../../../services/TrackingService";
import { GitHubApi, type TopTechStack } from "../../../services/GitHubService";
import {
  buildProfileHeatmapViewModel,
  type ProfileHeatmapViewModel,
} from "../../../services/ProfileService";

function Profile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const [logs, setLogs] = useState<DashboardLog[]>([]);
  const [activityStats, setActivityStats] = useState({ arenaScore: 0, streak: 0 });
  const [recentActivity, setRecentActivity] = useState<DashboardLog[]>([]);
  const [totalActivityLogs, setTotalActivityLogs] = useState(0);
  const [currentRank, setCurrentRank] = useState("Unranked");
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityLoadFailed, setActivityLoadFailed] = useState(false);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [accountYear, setAccountYear] = useState(currentYear);
  const [heatmapViewModel, setHeatmapViewModel] = useState<ProfileHeatmapViewModel>(() =>
    buildProfileHeatmapViewModel([], currentYear),
  );
  const [topTechStack, setTopTechStack] = useState<TopTechStack>({ items: [], eligibleProjectCount: 0, updatedAt: null });

  useEffect(() => {
    if (!user) return;

    if ("metadata" in user && user.metadata.creationTime) {
      const createdDate = new Date(user.metadata.creationTime);
      if (!Number.isNaN(createdDate.getTime())) {
        setAccountYear(createdDate.getFullYear());
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const loadActivity = async (showLoader = false) => {
      if (showLoader) {
        setActivityLoading(true);
        setActivityLoadFailed(false);
      }

      try {
        const viewModel = await getDashboardViewModel();
        if (!isMounted) return;

        setLogs(viewModel.logs);
        setRecentActivity(viewModel.recentLogs);
        setTotalActivityLogs(viewModel.totalLogs);
        setCurrentRank(getRankFromPoints(viewModel.seasonPoints).name);
        setActivityStats({
          arenaScore: viewModel.arenaScore,
          streak: viewModel.streak,
        });
        setActivityLoadFailed(false);
      } catch (error) {
        console.error(error);
        if (isMounted) setActivityLoadFailed(true);
      } finally {
        if (isMounted) setActivityLoading(false);
      }
    };

    void loadActivity(true);

    const handleActivityUpdate = () => {
      void loadActivity();
    };
    window.addEventListener("devarena:activity-updated", handleActivityUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener("devarena:activity-updated", handleActivityUpdate);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = () => GitHubApi.topTechStack()
      .then((value) => { if (active) setTopTechStack(value); })
      .catch(() => undefined);
    void load();
    window.addEventListener("devarena:profile-updated", load);
    window.addEventListener("devarena:activity-updated", load);
    return () => {
      active = false;
      window.removeEventListener("devarena:profile-updated", load);
      window.removeEventListener("devarena:activity-updated", load);
    };
  }, [user]);

  useEffect(() => {
    setHeatmapViewModel(buildProfileHeatmapViewModel(logs, selectedYear));
  }, [logs, selectedYear]);

  const { heatmap, heatmapMonthMarkers } = heatmapViewModel;

  async function exportCompleteHistory() {
    const [dsa, practice, fullstack, projects] = await Promise.all([
      trackingApi.getDsa(),
      trackingApi.getPractice(),
      trackingApi.getFullstack(),
      trackingApi.getProjects(),
    ]);
    const username = user && "username" in user ? (user as { username?: string }).username : "";
    const revisions = practice.logs.filter((log) => log.type === "DSA_Revision");
    const learning = practice.logs.filter((log) => log.type === "Concept_Explanation");
    await downloadHistoryPdf({
      filename: `devarena-complete-history-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "Complete Activity History",
      subtitle: "A complete DevArena evidence export across general logs, DSA, practice, Fullstack, and projects.",
      identity: [user?.displayName || "DevArena Player", username ? `Username: ${username}` : null, user?.email ? `Email: ${user.email}` : null],
      sections: [
        { title: "Quick and Unified Activity", rows: logs.map((log) => ({ title: log.text, details: [`Date and time: ${displayActivityDateTime(log.createdAt)}`] })) },
        { title: "DSA Problems", rows: dsa.logs.map((log) => ({ title: log.problemName, details: [`${log.difficulty} - ${log.points} points - ${log.timeTaken} minutes`, `Date and time: ${displayActivityDateTime(log.createdAt)}`, log.notes, log.url] })) },
        { title: "Revision", rows: revisions.map((log) => ({ title: log.title, details: [`${log.points} points - ${log.timeSpent} minutes`, `Date and time: ${displayActivityDateTime(log.createdAt)}`, log.notes, log.proofLink] })) },
        { title: "Learning", rows: learning.map((log) => ({ title: log.title, details: [`${log.points} points - ${log.timeSpent} minutes`, `Date and time: ${displayActivityDateTime(log.createdAt)}`, log.notes, log.proofLink] })) },
        { title: "Fullstack", rows: fullstack.logs.map((log) => ({ title: log.title, details: [`${log.category} - ${log.type} - ${log.points} points`, `${log.timeSpent} minutes - ${displayActivityDateTime(log.createdAt)}`, log.description, log.proofLink] })) },
        { title: "Projects", rows: projects.projects.map((project) => ({ title: project.title, details: [`${project.domain} - ${project.status} - ${project.metrics.score} points`, project.description, `${project.metrics.totalSessions} sessions - ${project.metrics.completedMilestones}/${project.metrics.totalMilestones} milestones`] })) },
        { title: "Project Work Sessions", rows: projects.projects.flatMap((project) => project.logs.map((log) => ({ title: `${project.title}: ${log.description}`, details: [`${log.timeSpent} minutes - ${displayActivityDateTime(log.createdAt)}`, log.proofLink] }))) },
        { title: "Milestones", rows: projects.projects.flatMap((project) => project.milestones.map((milestone) => ({ title: `${project.title}: ${milestone.title}`, details: [milestone.status, milestone.description, `Created: ${displayActivityDateTime(milestone.createdAt)}`] }))) },
      ],
    });
  }

  if (activityLoading && logs.length === 0) {
    return <PageLoader variant="profile" />;
  }

  return (
    <main className="profile-page animated-page">
      <section className="profile-header">
        <div className="profile-avatar" aria-label="Profile avatar">
          {user?.photoURL && !(user && "useInitials" in user && user.useInitials) ? (
            <img src={user.photoURL} alt="" />
          ) : (
            <span>
              {(user?.displayName || "Developer")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part.charAt(0).toUpperCase())
                .join("")}
            </span>
          )}
        </div>

        <div className="profile-info">
          <h1>{user?.displayName}</h1>
          <p>{user?.email}</p>
        </div>

        <div className="profile-stats">
          <div className="profile-stat">
            <h2 data-private-value="true">{activityStats.streak}</h2>
            <p>Streak</p>
          </div>

          <div className="profile-stat">
            <h2 data-private-value="true">{activityStats.arenaScore}</h2>
            <p>Arena Score</p>
          </div>

          <div className="profile-stat profile-rank-stat">
            <RankBadge rank={currentRank} size="medium" />
            <p>Rank</p>
          </div>
        </div>
      </section>

      <section className="profile-card profile-top-tech-card">
        <div className="profile-top-tech-heading">
          <div><span>Verified GitHub evidence</span><h2>Top Tech Stack</h2></div>
          <small>{topTechStack.eligibleProjectCount} eligible project{topTechStack.eligibleProjectCount === 1 ? "" : "s"}</small>
        </div>
        {topTechStack.items.length ? (
          <div className="profile-top-tech-list">
            {topTechStack.items.map((item, index) => (
              <article key={item.name}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{item.name}</strong><small>{item.projectCount} project{item.projectCount === 1 ? "" : "s"}</small></div>
                <b>{item.percentage.toFixed(item.percentage < 10 ? 1 : 0)}%</b>
              </article>
            ))}
          </div>
        ) : <p className="profile-top-tech-empty">No verified project technologies yet. Add an eligible GitHub project to build this profile automatically.</p>}
      </section>

      <section className="profile-card">
        <div className="profile-heatmap-header">
          <h2>Contribution History</h2>

          <div className="year-selector">
            <button
              type="button"
              aria-label="Show previous year"
              disabled={selectedYear <= accountYear}
              onClick={() => setSelectedYear(selectedYear - 1)}
            >
              ←
            </button>

            <span>{selectedYear}</span>

            <button
              type="button"
              aria-label="Show next year"
              disabled={selectedYear >= currentYear}
              onClick={() => setSelectedYear(selectedYear + 1)}
            >
              →
            </button>
          </div>
        </div>

        <div className="profile-heatmap-wrapper">
          <div className="profile-month-row">
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

          <div className="profile-heatmap-grid">
            {heatmap.map((cell) => (
              <button
                type="button"
                key={cell.date}
                title={`${cell.title}. Open daily details.`}
                aria-label={`Open activity for ${cell.date}`}
                className={`profile-heat-cell ${cell.level}`}
                onClick={() => navigate(`/activity/${cell.date}`)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="profile-grid">
        <article className="profile-card profile-activity-analytics-card">
          <aside className="profile-analytics-sidebar" aria-label="Total activity logs">
            <span>Total Logs</span>
            <strong data-private-value="true">{activityLoading ? "—" : totalActivityLogs}</strong>
            <p>Completed to date</p>
          </aside>

          <div className="profile-analytics-content">
            <h2>Activity Analytics</h2>
            <p>
              Your completed logs across DSA, projects, full-stack work and practice are
              collected here.
            </p>
          </div>
        </article>
      </section>

      <section className="profile-card profile-recent-activity-card">
        <div className="profile-recent-activity-header">
          <h2>Recent Activity</h2>
          <HistoryExportButton onExport={exportCompleteHistory} label="Export complete PDF" />
        </div>

        <ul className="profile-activity-list" aria-live="polite">
          {activityLoading ? (
            <li className="profile-activity-status">Loading recent activity…</li>
          ) : activityLoadFailed ? (
            <li className="profile-activity-status">Recent activity could not be loaded.</li>
          ) : recentActivity.length === 0 ? (
            <li className="profile-activity-status">No activity logged yet.</li>
          ) : (
            recentActivity.map((log) => (
              <li key={log.id}>
                <span>{log.text}</span>
                <LiveDateTime value={log.createdAt} />
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}

export default Profile;
