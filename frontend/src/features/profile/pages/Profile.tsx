import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";

import "../styles/Profile.css";
import { db } from "../../../config/Firebase";
import { useAuth } from "../../auth/context/AuthContext";
import {
  buildProfileHeatmapViewModel,
  type ProfileHeatmapViewModel,
} from "../../../services/ProfileService";

function Profile() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();

  const [profileData, setProfileData] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [accountYear, setAccountYear] = useState(currentYear);
  const [heatmapViewModel, setHeatmapViewModel] = useState<ProfileHeatmapViewModel>(() =>
    buildProfileHeatmapViewModel([], currentYear),
  );

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

  useEffect(() => {
    setHeatmapViewModel(buildProfileHeatmapViewModel(logs, selectedYear));
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
