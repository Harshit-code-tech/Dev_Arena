// import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
} from "firebase/firestore";

import { db } from "../config/fireBase";

import { useAuth } from "../context/AuthContext";

import { useState, useEffect } from "react";

import PageLoader from "../components/Skeletons/PageLoader";

function Dashboard() {
  const { user } = useAuth();

  const userName = user?.displayName || "Developer";

  interface HeatmapCell {
    date: string;
    count: number;
    month: number;
    day: number;
    weekIndex: number;
  }

  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);

  const [logs, setLogs] = useState<any[]>([]);


  const [arenaScore, setArenaScore] = useState<number | null>(null);

  const [logsLoaded, setLogsLoaded] = useState(false);

  const [userLoaded, setUserLoaded] = useState(false);

  const [dashboardReady, setDashboardReady] = useState(false);

  const [mostActiveDay, setMostActiveDay] = useState("");

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(date.getDate()).padStart(2, "0")}`;
  };

  if (!user) {
    return <PageLoader />;
  }

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "logs"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activities = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setLogs(activities);

      setLogsLoaded(true);
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const ref = doc(db, "users", user.uid);

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data();

      setArenaScore(data?.arenaScore ?? 0);

      setUserLoaded(true);
    });

    return unsubscribe;
  }, [user]);

  const generateRollingDays = (): HeatmapCell[] => {
    const days: HeatmapCell[] = [];

    const today = new Date();

    const startDate = new Date(today);

    // 53 weeks × 7 days = 371 cells
    const dayOfWeek = today.getDay();

    startDate.setDate(today.getDate() - (52 * 7 + dayOfWeek));

    const current = new Date(startDate);

    while (current <= today) {
      const weekIndex = Math.floor(
        (current.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7),
      );

      days.push({
        date: formatDateKey(current),
        count: 0,
        month: current.getMonth(),
        day: current.getDate(),
        weekIndex,
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  };
  useEffect(() => {
    const yearDays = generateRollingDays();

    const activityMap = new Map<string, number>();

    logs.forEach((log) => {
      if (!log.createdAt) return;

      const date = log.createdAt.toDate();

      const localDate = new Date(date);

      localDate.setHours(0, 0, 0, 0);

      const key = formatDateKey(localDate);

      activityMap.set(key, (activityMap.get(key) || 0) + 1);
    });

    const populated = yearDays.map((day) => ({
      ...day,
      count: activityMap.get(day.date) || 0,
    }));

    let highestCount = 0;
    let highestDate = "";

    activityMap.forEach((count, date) => {
      if (count > highestCount) {
        highestCount = count;
        highestDate = date;
      }
    });
    setMostActiveDay(highestDate);

    setHeatmap(populated);
  }, [logs]);

  useEffect(() => {
    console.log("HEATMAP STATE:", heatmap);
  }, [heatmap]);

  useEffect(() => {
    if (user && logsLoaded && userLoaded) {
      setDashboardReady(true);
    }
  }, [user, logsLoaded, userLoaded]);

  if (!dashboardReady) {
    return <PageLoader />;
  }

  // dynamic months labels based on selected year

  const monthLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const monthStarts = heatmap.filter((cell) => cell.day === 1);

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
          <h2>{arenaScore === null ? "..." : arenaScore}</h2>
          <p>+5 to every log</p>
        </div>

        <div className="stat-card">
          <h3>Global Rank</h3>
          <h2>#124</h2>
          <p>↑ 18 places</p>
        </div>

        <div className="stat-card">
          <h3>Contest Rating</h3>
          <h2>1670</h2>
          <p>Top 12%</p>
        </div>

        <div className="stat-card">
          <h3>Current Streak</h3>
          <h2>11 Days</h2>
          <p>🔥 Consistent</p>
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
              <span>{logs.length}</span>
              <p>Total Logs</p>
            </div>

            <div>
              <span>{arenaScore === null ? "..." : arenaScore}</span>
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
            {monthStarts.map((cell) => (
              <span
                key={cell.date}
                style={{
                  gridColumnStart: cell.weekIndex + 1,
                }}
              >
                {monthLabels[cell.month]}
              </span>
            ))}
          </div>

          <div className="heatmap-dashboard-inside">
            {heatmap.map((cell, index) => {
              let level = "";

              if (cell.count >= 1) level = "low";
              if (cell.count >= 3) level = "medium";
              if (cell.count >= 5) level = "high";
              if (cell.count >= 8) level = "max";

              return (
                <div
                  key={index}
                  title={
                    cell.count === 0
                      ? `No activity on ${cell.date}`
                      : `${cell.count} activities pushed to the Arena on ${cell.date}`
                  }
                  className={`heat-cell-dashboard ${level}`}
                />
              );
            })}
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
            {logs.length === 0 ? (
              <li>No activity logged yet.</li>
            ) : (
              logs.slice(0, 5).map((log) => <li key={log.id}>{log.text}</li>)
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
