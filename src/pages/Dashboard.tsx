// import { useNavigate } from "react-router-dom";
import "../styles/Dashboard.css";
import { useAuth } from "../context/AuthContext";

import { useState, useEffect } from "react";

import PageLoader from "../components/Skeletons/PageLoader";
import {
  getRankFromPoints,
  getRankProgress,
  getNextRank,
} from "../utils/rankSystem";

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

  const [streak, setStreak] = useState(0);

  const [activeDays, setActiveDays] = useState(0);

  const [seasonPoints, setSeasonPoints] = useState(0);

  const [seasonNumber, setSeasonNumber] = useState(1);

  const [rankProgress, setRankProgress] = useState(0);

  const [remainingPoints, setRemainingPoints] = useState(0);

  const [nextRank, setNextRank] = useState("Mud");

  const [rank, setRank] = useState("Unranked");

  const [daysRemaining, setDaysRemaining] = useState(14);

  const [currentRankMaxPoints, setCurrentRankMaxPoints] = useState(0);

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(date.getDate()).padStart(2, "0")}`;
  };

  if (!user) {
    return <PageLoader />;
  }

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!user || !token) return;

    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/dashboard/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch dashboard");
        
        const data = await res.json();
        
        // Map logs so createdAt is a Date object (simulating Firestore's toDate())
        const parsedLogs = data.logs.map((log: any) => ({
          ...log,
          createdAt: { toDate: () => new Date(log.createdAt) }
        }));
        setLogs(parsedLogs);
        setLogsLoaded(true);

        const stats = data.stats;
        let seasonStartDate = stats.seasonStartDate ? new Date(stats.seasonStartDate) : null;
        let finalSeasonNumber = stats.seasonNumber;

        if (seasonStartDate) {
          const today = new Date();
          const seasonAge = Math.floor((today.getTime() - seasonStartDate.getTime()) / (1000 * 60 * 60 * 24));
          setDaysRemaining(Math.max(14 - seasonAge, 0));

          if (seasonAge > 14) {
            finalSeasonNumber = (stats.seasonNumber || 1) + 1;
            fetch("/api/dashboard/me", {
              method: "PUT",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                activeDays: 0,
                streak: 0,
                seasonPoints: 0,
                rank: "Unranked",
                weeklyBonusClaimed: false,
                seasonBonusClaimed: false,
                seasonNumber: finalSeasonNumber,
                resetSeason: true
              })
            }).catch(console.error);
          }
        }

        setArenaScore(stats.arenaScore ?? 0);
        setStreak(stats.streak ?? 0);
        setActiveDays(stats.activeDays ?? 0);
        setSeasonPoints(stats.seasonPoints ?? 0);
        setSeasonNumber(finalSeasonNumber ?? 1);
        setRank(stats.rank ?? "Unranked");
        setUserLoaded(true);
      } catch (err) {
        console.error(err);
      }
    };

    fetchDashboard();
  }, [user, token]);

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

  // streak calculation logic

  useEffect(() => {
    if (!user || logs.length === 0) return;

    const dailyLogs = new Map<string, number>();

    logs.forEach((log) => {
      if (!log.createdAt) return;

      const date = log.createdAt.toDate();

      const key = formatDateKey(date);

      dailyLogs.set(key, (dailyLogs.get(key) || 0) + 1);
    });

    const activeDayList = Array.from(dailyLogs.entries())
      .filter(([_, count]) => count >= 2)
      .map(([date]) => date)
      .sort()
      .reverse();

    let currentStreak = 0;

    let cursor = new Date();

    cursor.setHours(0, 0, 0, 0);

    while (true) {
      const key = formatDateKey(cursor);

      if (activeDayList.includes(key)) {
        currentStreak++;

        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    let calculatedSeasonPoints = 0;

    activeDayList.forEach((date) => {
      const logsOnDay = dailyLogs.get(date) || 0;

      calculatedSeasonPoints += 10;

      if (logsOnDay > 2) {
        calculatedSeasonPoints += (logsOnDay - 2) * 5;
      }
    });

    let weeklyBonusClaimed = false;

    if (currentStreak >= 7) {
      calculatedSeasonPoints += 50;
      weeklyBonusClaimed = true;
    }

    let seasonBonusClaimed = false;

    if (currentStreak >= 14) {
      calculatedSeasonPoints += 150;
      seasonBonusClaimed = true;
    }

    const totalActiveDays = activeDayList.length;

    const rankData = getRankFromPoints(calculatedSeasonPoints);

    const calculatedRank = rankData.name;

    setStreak(currentStreak);

    setActiveDays(totalActiveDays);

    setSeasonPoints(calculatedSeasonPoints);

    setRank(calculatedRank);

    const needsUpdate =
      streak !== currentStreak ||
      activeDays !== totalActiveDays ||
      seasonPoints !== calculatedSeasonPoints ||
      rank !== calculatedRank;

    if (needsUpdate) {
      fetch("/api/dashboard/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          streak: currentStreak,
          activeDays: totalActiveDays,
          seasonPoints: calculatedSeasonPoints,
          rank: calculatedRank,
          weeklyBonusClaimed,
          seasonBonusClaimed,
        })
      }).catch(console.error);
    }

    console.log("Current Streak:", currentStreak);
  }, [logs]);

  // heatmap logic

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

  // progress calculator
  useEffect(() => {
    setRankProgress(getRankProgress(seasonPoints));

    const next = getNextRank(seasonPoints);

    setNextRank(next?.name ?? "Developer");

    if (next) {
      setRemainingPoints(Math.max(next.points - seasonPoints, 0));

      setCurrentRankMaxPoints(next.points);
    } else {
      setRemainingPoints(0);

      setCurrentRankMaxPoints(seasonPoints);
    }
  }, [seasonPoints]);

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

  const getCurrentRankMax = () => {
    const next = getNextRank(seasonPoints);

    if (!next) {
      return seasonPoints;
    }

    return next.points;
  };

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
