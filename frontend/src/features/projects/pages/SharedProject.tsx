import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import LiveDateTime from "../../../shared/components/LiveDateTime";
import "../styles/SharedProject.css";

type SharedProjectData = {
  id: string;
  title: string;
  description: string | null;
  domain: "Fullstack" | "App" | "AI" | "Other";
  status: "In_Progress" | "Completed";
  startDate: string;
  sharedAt: string | null;
  updatedAt: string;
  github: {
    languages: Array<{ name: string; percentage: number }> | null;
    languagesFetchedAt: string | null;
  } | null;
  owner: {
    name: string;
    username: string;
    avatarUrl: string | null;
    useInitials: boolean;
  };
  milestones: Array<{
    id: string;
    title: string;
    description: string | null;
    status: "Pending" | "Completed";
    createdAt: string;
  }>;
  metrics: {
    completedMilestones: number;
    totalMilestones: number;
    milestoneProgress: number;
    lastActivityDate: string;
  };
};

type Envelope<T> = { success: boolean; data: T; message?: string };

function ownerInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "DA";
}

export default function SharedProject() {
  const navigate = useNavigate();
  const { shareSlug = "" } = useParams();
  const [project, setProject] = useState<SharedProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch(`/api/projects/shared/${encodeURIComponent(shareSlug)}`)
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as Envelope<SharedProjectData> | null;
        if (!response.ok || !payload?.success) throw new Error(payload?.message || "Shared project unavailable.");
        if (mounted) setProject(payload.data);
      })
      .catch((reason) => {
        if (mounted) setError(reason instanceof Error ? reason.message : "Shared project unavailable.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [shareSlug]);

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate("/player-hub?section=projects");
  }

  if (loading) return <PageLoader />;

  if (!project) {
    return (
      <main className="shared-project-page shared-project-error">
        <button type="button" className="shared-project-back dev-back-button" onClick={goBack}><span aria-hidden="true">←</span><span>Back</span></button>
        <p>Public project / Unavailable</p>
        <h1>Link not active</h1>
        <span>{error || "The owner may have made this project private."}</span>
      </main>
    );
  }

  return (
    <main className="shared-project-page animated-page">
      <button type="button" className="shared-project-back page-reveal dev-back-button" onClick={goBack}><span aria-hidden="true">←</span><span>Back</span></button>
      <header className="shared-project-hero page-reveal">
        <div className="shared-project-owner">
          <span className="shared-owner-avatar">
            {project.owner.avatarUrl && !project.owner.useInitials
              ? <img src={project.owner.avatarUrl} alt="" />
              : ownerInitials(project.owner.name)}
          </span>
          <div><strong>{project.owner.name}</strong><span>@{project.owner.username}</span></div>
        </div>
        <p>Shared DevArena Project / {project.domain}</p>
        <h1>{project.title}</h1>
        <span>{project.description || "No public description was added."}</span>
      </header>

      <section className="shared-project-metrics page-reveal">
        <article><span>Status</span><strong>{project.status === "Completed" ? "Completed" : "In Progress"}</strong></article>
        <article><span>Milestones</span><strong>{project.metrics.completedMilestones}/{project.metrics.totalMilestones}</strong></article>
        <article><span>Progress</span><strong>{project.metrics.milestoneProgress}%</strong></article>
        <article><span>Last Activity</span><strong><LiveDateTime value={project.metrics.lastActivityDate} /></strong></article>
      </section>

      {project.github && (
        <section className="shared-project-repository page-reveal">
          <header>
            <div><p>GitHub language percentages</p><h2>{project.title}</h2></div>
            <span>Language data only</span>
          </header>
          <div className="shared-language-grid">
            {(project.github.languages || []).map((language) => (
              <article key={language.name}>
                <span>{language.name}</span>
                <strong>{language.percentage.toFixed(2)}%</strong>
                <i><u style={{ width: `${Math.max(1, language.percentage)}%` }} /></i>
              </article>
            ))}
            {!project.github.languages?.length && <p>GitHub returned no language data for this repository.</p>}
          </div>
          <footer>
            <span>{project.github.languagesFetchedAt ? <>Updated <LiveDateTime value={project.github.languagesFetchedAt} /></> : "Language refresh time unavailable"}</span>
          </footer>
        </section>
      )}

      <section className="shared-project-milestones page-reveal">
        <div><p>Public progress evidence</p><h2>Milestones</h2></div>
        <div className="shared-milestone-list">
          {project.milestones.length === 0 ? (
            <p className="shared-project-empty">No milestones have been published for this project.</p>
          ) : project.milestones.map((milestone, index) => (
            <article key={milestone.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{milestone.title}</strong><p>{milestone.description || "No description."}</p><LiveDateTime value={milestone.createdAt} /></div>
              <b>{milestone.status}</b>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
