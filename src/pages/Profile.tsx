import "./../styles/Profile.css";
import { useEffect, useState } from "react";

import { doc, onSnapshot } from "firebase/firestore";

import { db } from "../config/fireBase";
import { useAuth } from "../context/AuthContext";

import { collection, query, where, orderBy } from "firebase/firestore";

function Profile() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<any>(null);

  interface HeatmapCell {
    date: string;
    count: number;
    month: number;
    day: number;
    weekIndex: number;
  }

  const [logs, setLogs] = useState<any[]>([]);

  const [heatmap, setHeatmap] = useState<HeatmapCell[]>([]);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [accountYear, setAccountYear] = useState(new Date().getFullYear());

  const currentYear = new Date().getFullYear();

  // firestone listener for profile data.
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
      if (!snapshot.exists()) return;

      const data = snapshot.data();

      setProfileData(data);

      if (data?.createdAt) {
        const createdDate = data.createdAt.toDate();

        setAccountYear(createdDate.getFullYear());
      }
    });

    return unsubscribe;
  }, [user]);

  // firestone listener for user logs.

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
    });

    return unsubscribe;
  }, [user]);

  // helper function to format date.

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(date.getDate()).padStart(2, "0")}`;
  };

  // yearly generator for heatmap.

  const generateYearDays = (year: number): HeatmapCell[] => {
    const days: HeatmapCell[] = [];

    const startDate = new Date(year, 0, 1);

    const endDate = new Date(year, 11, 31);

    const current = new Date(startDate);

    while (current <= endDate) {
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

  // yearly heatmap generator.

  useEffect(() => {
    const yearDays = generateYearDays(selectedYear);

    const activityMap = new Map<string, number>();

    logs.forEach((log) => {
      if (!log.createdAt) return;

      const date = log.createdAt.toDate();

      const key = formatDateKey(date);

      activityMap.set(key, (activityMap.get(key) || 0) + 1);
    });

    const populated = yearDays.map((day) => ({
      ...day,
      count: activityMap.get(day.date) || 0,
    }));

    setHeatmap(populated);
  }, [logs, selectedYear]);

  // adding month labels.
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
    <main className="profile-page">
      <section className="profile-header">
        <img
          className="profile-avatar"
          src={user?.photoURL || "https://ui-avatars.com/api/?name=Developer"}
          alt="avatar"
        />

        <div className="profile-info">
          <h1>{user?.displayName}</h1>

          <p>{user?.email}</p>
        </div>

        <div className="profile-stats">
          <div className="profile-stat">
            <h2>{profileData?.streak ?? 0}</h2>
            <p>Streak</p>
          </div>

          <div className="profile-stat">
            <h2>{profileData?.arenaScore ?? 0}</h2>
            <p>Arena Score</p>
          </div>

          <div className="profile-stat">
            <h2>{profileData?.rank ?? "Mud"}</h2>
            <p>Rank</p>
          </div>
        </div>
      </section>

      <section className="profile-card">
        <div className="profile-heatmap-header">
          <h2>Contribution History</h2>

          <div className="year-selector">
            <button
              disabled={selectedYear <= accountYear}
              onClick={() => setSelectedYear(selectedYear - 1)}
            >
              ◀
            </button>

            <span>{selectedYear}</span>

            <button
              disabled={selectedYear >= currentYear}
              onClick={() => setSelectedYear(selectedYear + 1)}
            >
              ▶
            </button>
          </div>
        </div>
        <div className="profile-heatmap-wrapper">
          <div className="profile-month-row">
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

          <div className="profile-heatmap-grid">
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
                      : `${cell.count} activities on ${cell.date}`
                  }
                  className={`profile-heat-cell ${level}`}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className="profile-grid">
        <div className="profile-card">
          <h2>Activity Analytics</h2>
        </div>

        <div className="profile-card">
          <h2>Project Analytics</h2>
        </div>

        <div className="profile-card">
          <h2>Recent Projects</h2>
        </div>

        <div className="profile-card">
          <h2>Recent DSA Solves</h2>
        </div>
      </section>
    </main>
  );
}

export default Profile;
