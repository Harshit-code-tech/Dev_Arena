import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import LiveDateTime from "../../../shared/components/LiveDateTime";
import {
  PlayerHubApi,
  type HubPerson,
  type PlayerWork as PlayerWorkData,
  type PlayerWorkProject,
} from "../../../services/PlayerHubService";
import "../styles/PlayerWork.css";

type WorkTab = "dsa" | "projects";

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "DA";
}

function Avatar({ person }: { person: Pick<HubPerson, "name" | "avatarUrl" | "useInitials"> }) {
  return (
    <span className="player-work-avatar" aria-hidden="true">
      {person.avatarUrl && !person.useInitials
        ? <img src={person.avatarUrl} alt="" referrerPolicy="no-referrer" />
        : initials(person.name)}
    </span>
  );
}

function safeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function LanguageList({ project }: { project: PlayerWorkProject }) {
  const languages = (project.languages || []).slice(0, 6);
  if (languages.length === 0) return <p className="player-work-muted">No GitHub language percentages are available.</p>;

  return (
    <div className="player-work-language-list" aria-label={`Languages used in ${project.title}`}>
      {languages.map((language) => (
        <div key={language.name}>
          <span>{language.name}</span>
          <i><em style={{ width: `${Math.max(language.percentage, 1)}%` }} /></i>
          <b>{language.percentage.toFixed(language.percentage < 10 ? 1 : 0)}%</b>
        </div>
      ))}
    </div>
  );
}

export default function PlayerWork() {
  const { playerId = "" } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<WorkTab>("dsa");
  const [data, setData] = useState<PlayerWorkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    PlayerHubApi.playerWork(playerId)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason) => {
        const message = reason instanceof Error ? reason.message : "Could not load this player's work.";
        if (active) setError(message);
        toast.error(message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [playerId]);

  const totalDsaPoints = useMemo(
    () => data?.dsa.logs.reduce((sum, log) => sum + log.points, 0) ?? 0,
    [data],
  );

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/player-hub?section=discover");
  }

  if (loading) return <PageLoader variant="player-hub" />;

  if (!data || error) {
    return (
      <main className="player-work-page animated-page">
        <button type="button" className="player-work-back dev-back-button" onClick={goBack}><span aria-hidden="true">←</span><span>Back</span></button>
        <section className="player-work-error">
          <i className="bx bx-error-circle" />
          <h1>Work unavailable</h1>
          <p>{error || "This player's public work could not be loaded."}</p>
          <button type="button" onClick={() => navigate("/player-hub?section=discover")}>Return to Discover Players</button>
        </section>
      </main>
    );
  }

  const { player } = data;

  return (
    <main className="player-work-page animated-page">
      <button type="button" className="player-work-back dev-back-button" onClick={goBack}><span aria-hidden="true">←</span><span>Back</span></button>

      <header className="player-work-hero page-reveal">
        <div className="player-work-identity">
          <Avatar person={player} />
          <div>
            <p>Player Hub / Public work</p>
            <h1>{player.name}</h1>
            <span>@{player.username} · {player.rank}</span>
            <div className="player-work-top-stack" aria-label={`${player.name}'s Top Tech Stack`}>
              {(player.topTechStack || []).length ? (player.topTechStack || []).slice(0, 3).map((item) => (
                <b key={item.name}>{item.name} <small>{item.percentage.toFixed(item.percentage < 10 ? 1 : 0)}%</small></b>
              )) : <em>No verified project technologies yet</em>}
            </div>
          </div>
        </div>
        <div className="player-work-stats" aria-label="Player work summary">
          <article><span>Arena Score</span><strong>{player.arenaScore}</strong></article>
          <article><span>DSA Logs</span><strong>{data.dsa.total}</strong></article>
          <article><span>Shared Projects</span><strong>{data.projects.total}</strong></article>
          <article><span>Active Days</span><strong>{player.activeDays}</strong></article>
        </div>
      </header>

      <nav className="player-work-tabs page-reveal" aria-label="Player work sections">
        <button type="button" className={activeTab === "dsa" ? "active" : ""} onClick={() => setActiveTab("dsa")}>
          <span>01</span><strong>DSA</strong><small>{data.dsa.total} entries · {totalDsaPoints} points</small>
        </button>
        <button type="button" className={activeTab === "projects" ? "active" : ""} onClick={() => setActiveTab("projects")}>
          <span>02</span><strong>Projects</strong><small>{data.projects.total} shared projects</small>
        </button>
      </nav>

      {activeTab === "dsa" ? (
        <section className="player-work-section page-reveal">
          <header>
            <div><p>Problem-solving evidence</p><h2>DSA Activity</h2></div>
            <span>Read-only public view</span>
          </header>

          {data.dsa.logs.length === 0 ? (
            <div className="player-work-empty"><i className="bx bx-code-alt" /><strong>No DSA entries yet</strong><span>This player has not logged any DSA problems.</span></div>
          ) : (
            <div className="player-work-dsa-list">
              {data.dsa.logs.map((log) => {
                const problemUrl = safeExternalUrl(log.url);
                const solutionUrl = safeExternalUrl(log.solutionUrl);
                return (
                  <article key={log.id}>
                    <div className={`player-work-difficulty difficulty-${log.difficulty.toLowerCase()}`}>
                      <span>{log.difficulty}</span><strong>+{log.points}</strong>
                    </div>
                    <div className="player-work-dsa-main">
                      <p>{log.timeTaken} min · <LiveDateTime value={log.activityDate} mode="full" /></p>
                      <h3>{log.problemName}</h3>
                      <dl>
                        <div><dt>Time</dt><dd>{log.timeComplexity || "Not added"}</dd></div>
                        <div><dt>Space</dt><dd>{log.spaceComplexity || "Not added"}</dd></div>
                      </dl>
                      {log.notes && <small>{log.notes}</small>}
                    </div>
                    <div className="player-work-actions">
                      {problemUrl && <a href={problemUrl} target="_blank" rel="noreferrer">Open Problem</a>}
                      {solutionUrl && <a href={solutionUrl} target="_blank" rel="noreferrer">Open Code</a>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="player-work-section page-reveal">
          <header>
            <div><p>Shared proof of work</p><h2>Projects</h2></div>
            <span>Only projects shared by @{player.username}</span>
          </header>

          {data.projects.items.length === 0 ? (
            <div className="player-work-empty"><i className="bx bx-folder-open" /><strong>No shared projects</strong><span>This player has not made a project public in Player Hub.</span></div>
          ) : (
            <div className="player-work-project-grid">
              {data.projects.items.map((project) => {
                const repositoryUrl = safeExternalUrl(project.repositoryUrl);
                return (
                  <article key={project.id}>
                    <header>
                      <div><p>{project.domain}</p><h3>{project.title}</h3></div>
                      <span>{project.status.replaceAll("_", " ")}</span>
                    </header>
                    <p>{project.description || "No project description was added."}</p>
                    <LanguageList project={project} />
                    <dl>
                      <div><dt>Sessions</dt><dd>{project.metrics.totalSessions}</dd></div>
                      <div><dt>Milestones</dt><dd>{project.metrics.completedMilestones}/{project.metrics.totalMilestones}</dd></div>
                      <div><dt>Progress</dt><dd>{project.metrics.milestoneProgress}%</dd></div>
                      <div><dt>Last activity</dt><dd><LiveDateTime value={project.metrics.lastActivityDate} mode="date" /></dd></div>
                    </dl>
                    <div className="player-work-actions">
                      {project.shareSlug && <Link to={`/shared/projects/${project.shareSlug}`}>Open Project</Link>}
                      {repositoryUrl && <a href={repositoryUrl} target="_blank" rel="noreferrer">Open Code</a>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
