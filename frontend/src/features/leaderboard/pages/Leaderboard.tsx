import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import RankBadge from "../../../shared/components/RankBadge";
import {
  getLeaderboard,
  type LeaderboardData,
  type LeaderboardEntry,
} from "../../../services/LeaderboardService";
import "../styles/Leaderboard.css";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "DA";
}

function ArenaAvatar({ entry, large = false }: { entry: LeaderboardEntry; large?: boolean }) {
  return (
    <span className={`arena-avatar${large ? " arena-avatar--large" : ""}`} aria-hidden="true">
      {entry.avatarUrl && !entry.useInitials ? <img src={entry.avatarUrl} alt="" /> : initials(entry.name)}
    </span>
  );
}

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async (showLoader = false) => {
      if (showLoader && mounted) setLoading(true);
      try {
        const response = await getLeaderboard(10);
        if (mounted) setData(response);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load the arena.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load(true);
    const refresh = () => void load();
    window.addEventListener("devarena:activity-updated", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("devarena:activity-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const currentUser = data?.currentUser;
  const scorePercentile = useMemo(() => {
    if (!currentUser || !data?.totalDevelopers) return 0;
    return Math.max(1, Math.round(((data.totalDevelopers - currentUser.position + 1) / data.totalDevelopers) * 100));
  }, [currentUser, data?.totalDevelopers]);


  if (loading || !data || !currentUser) return <PageLoader />;

  return (
    <main className="leaderboard-page animated-page">
      <header className="leaderboard-hero page-reveal">
        <div>
          <p>Arena Intelligence / Live ranking</p>
          <h1>Leaderboard</h1>
          <span>Real scores, stable tie-breaking, and the top ten performers across DevArena.</span>
        </div>
        <strong>{data.totalDevelopers.toLocaleString("en-IN")} Developers</strong>
      </header>

      <section className="leaderboard-self page-reveal" aria-labelledby="your-arena-position">
        <div className="leaderboard-self-identity">
          <ArenaAvatar entry={currentUser} large />
          <div>
            <p>Your account</p>
            <h2 id="your-arena-position">{currentUser.name}</h2>
            <span>@{currentUser.username}{currentUser.email ? ` · ${currentUser.email}` : ""}</span>
          </div>
        </div>

        <div className="leaderboard-self-metrics">
          <article><span>Position</span><strong>#{currentUser.position || "—"}</strong><small>Top {scorePercentile}% of arena</small></article>
          <article><span>Competition Score</span><strong data-private-value="true">{currentUser.competitionScore}</strong><small>{currentUser.activeDays} active days</small></article>
          <article><span>Season Points</span><strong data-private-value="true">{currentUser.seasonPoints}</strong><small>Current season</small></article>
          <article className="leaderboard-self-rank"><span>Developer Rank</span><RankBadge rank={currentUser.rank} size="large" /></article>
        </div>
      </section>

      <section className="leaderboard-top-ten page-reveal" aria-labelledby="top-ten-title">
        <div className="leaderboard-section-heading">
          <div><p>Arena standings</p><h2 id="top-ten-title">Top 10 Performers</h2></div>
          <span>Score · Season · Activity · Rank</span>
        </div>

        <div className="leaderboard-table" role="table" aria-label="Top ten DevArena performers">
          <div className="leaderboard-table-head" role="row">
            <span>Position</span><span>Developer</span><span>Rank</span><span>Active</span><span>Score</span>
          </div>
          {data.topPerformers.map((entry) => (
            <article key={entry.id} className={entry.isCurrentUser ? "is-current" : ""} role="row">
              <span className="leaderboard-position">#{entry.position}</span>
              <div className="leaderboard-user-cell"><ArenaAvatar entry={entry} /><div><strong>{entry.name}</strong><span>@{entry.username}</span></div></div>
              <RankBadge rank={entry.rank} size="small" />
              <span>{entry.activeDays} days</span>
              <b data-private-value="true">{entry.competitionScore}</b>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
