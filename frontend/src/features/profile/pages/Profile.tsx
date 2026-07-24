import { useEffect, useState } from "react";

import "../styles/Profile.css";
import { useAuth } from "../../auth/context/AuthContext";
import { getStoredAuthToken } from "../../auth/api/AuthStorageService";
import {
  buildProfileHeatmapViewModel,
  type ProfileHeatmapViewModel,
} from "../../../services/ProfileService";

type ProfileStats = {
  arenaScore: number;
  streak: number;
  rank: string;
};

type ProfileLog = {
  id: string;
  text: string;
  createdAt: string;
};

type ProfileApiResponse = {
  stats: ProfileStats;
  logs: ProfileLog[];
  createdAt: string;
};

function Profile() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();

  const [profileStats, setProfileStats] = useState<ProfileStats | null>(null);
  const [logs, setLogs] = useState<ProfileLog[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [accountYear, setAccountYear] = useState(currentYear);
  const [heatmapViewModel, setHeatmapViewModel] = useState<ProfileHeatmapViewModel>(() =>
    buildProfileHeatmapViewModel([], currentYear),
  );

  // Fetch profile data from the Neon backend.
  useEffect(() => {
    if (!user) return;

    const token = getStoredAuthToken();
    if (!token) return;

    let isMounted = true;

    fetch("/api/dashboard/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch profile");
        return res.json() as Promise<ProfileApiResponse>;
      })
      .then((data) => {
        if (!isMounted) return;

        setProfileStats(data.stats);
        setLogs(data.logs);

        if (data.createdAt) {
          const createdDate = new Date(data.createdAt);
          setAccountYear(createdDate.getFullYear());
        }
      })
      .catch(console.error);

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Rebuild heatmap when logs or selected year change.
  useEffect(() => {
    const mappedLogs = logs.map((log) => ({
      createdAt: new Date(log.createdAt),
    }));
    setHeatmapViewModel(buildProfileHeatmapViewModel(mappedLogs, selectedYear));
  }, [logs, selectedYear]);

  const { heatmap, heatmapMonthMarkers } = heatmapViewModel;

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
            <h2>{profileStats?.streak ?? 0}</h2>
            <p>Streak</p>
          </div>

          <div className="profile-stat">
            <h2>{profileStats?.arenaScore ?? 0}</h2>
            <p>Arena Score</p>
          </div>

          <div className="profile-stat">
            <h2>{profileStats?.rank ?? "Mud"}</h2>
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
              <div
                key={cell.date}
                title={cell.title}
                className={`profile-heat-cell ${cell.level}`}
              />
            ))}
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
