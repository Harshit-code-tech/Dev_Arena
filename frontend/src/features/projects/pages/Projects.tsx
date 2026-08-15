import { cloneElement, isValidElement, useCallback, useEffect, useId, useMemo, useState, type FormEvent, type ReactElement, type ReactNode } from "react";
import toast from "react-hot-toast";
import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import HistoryExportButton from "../../../shared/components/HistoryExportButton";
import LiveDateTime from "../../../shared/components/LiveDateTime";
import { useAuth } from "../../auth/context/AuthContext";
import { downloadHistoryPdf } from "../../../services/PdfExportService";
import { GitHubApi, type VerifiedGitHubRepository } from "../../../services/GitHubService";
import TrackingModal from "../../../shared/components/TrackingModal";
import AnimatedSelect from "../../../shared/components/AnimatedSelect";
import {
  canEdit,
  displayActivityDateTime,
  trackingApi,
  type FullstackCategory,
  type FullstackData,
  type FullstackLog,
  type FullstackType,
  type Project,
  type ProjectData,
  type ProjectDomain,
  type ProjectLog,
  type ProjectStatus,
} from "../../../services/TrackingService";
import "../styles/Projects.css";

type Tab = "projects" | "fullstack";
type PanelMode = "project" | "repository" | "session" | "milestone" | "fullstack" | null;

const blankProject = () => ({
  title: "",
  description: "",
  domain: "Fullstack" as ProjectDomain,
  status: "In_Progress" as ProjectStatus,
  githubRepositoryUrl: "",
});

const blankSession = () => ({
  description: "",
  timeSpent: "",
  proofLink: "",
});

const blankMilestone = () => ({ title: "", description: "" });

const blankFullstack = () => ({
  title: "",
  description: "",
  category: "Course_Progress" as FullstackCategory,
  type: "Learning" as FullstackType,
  timeSpent: "",
  proofLink: "",
});

export default function Projects() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("projects");
  const [projectsData, setProjectsData] = useState<ProjectData | null>(null);
  const [fullstackData, setFullstackData] = useState<FullstackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingFullstackId, setEditingFullstackId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState(blankProject);
  const [repositoryPreview, setRepositoryPreview] = useState<VerifiedGitHubRepository | null>(null);
  const [verifyingRepository, setVerifyingRepository] = useState(false);
  const [sessionForm, setSessionForm] = useState(blankSession);
  const [milestoneForm, setMilestoneForm] = useState(blankMilestone);
  const [fullstackForm, setFullstackForm] = useState(blankFullstack);
  const [formError, setFormError] = useState("");
  const [busyRepositoryId, setBusyRepositoryId] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [projects, fullstack] = await Promise.all([
        trackingApi.getProjects(),
        trackingApi.getFullstack(),
      ]);
      setProjectsData(projects);
      setFullstackData(fullstack);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load project tracking.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedProject = useMemo(
    () => projectsData?.projects.find((project) => project.id === selectedProjectId) ?? null,
    [projectsData, selectedProjectId],
  );


  function closePanel() {
    if (saving) return;
    setFormError("");
    setPanelMode(null);
    setSelectedProjectId(null);
    setEditingLogId(null);
    setEditingFullstackId(null);
    setRepositoryPreview(null);
  }

  function openProjectForm() {
    setFormError("");
    setProjectForm(blankProject());
    setRepositoryPreview(null);
    setPanelMode("project");
  }

  function openRepository(project: Project) {
    setFormError("");
    setSelectedProjectId(project.id);
    setProjectForm((current) => ({ ...current, githubRepositoryUrl: "" }));
    setRepositoryPreview(null);
    setPanelMode("repository");
  }

  function openSession(project: Project, log?: ProjectLog) {
    setFormError("");
    setSelectedProjectId(project.id);
    setEditingLogId(log?.id ?? null);
    setSessionForm(log ? {
      description: log.description,
      timeSpent: String(log.timeSpent),
      proofLink: log.proofLink || "",
    } : blankSession());
    setPanelMode("session");
  }

  function openMilestone(project: Project) {
    setFormError("");
    setSelectedProjectId(project.id);
    setMilestoneForm(blankMilestone());
    setPanelMode("milestone");
  }

  function openFullstack(log?: FullstackLog) {
    setFormError("");
    setEditingFullstackId(log?.id ?? null);
    setFullstackForm(log ? {
      title: log.title,
      description: log.description || "",
      category: log.category,
      type: log.type,
      timeSpent: String(log.timeSpent),
      proofLink: log.proofLink || "",
    } : blankFullstack());
    setPanelMode("fullstack");
  }

  async function verifyRepository() {
    const repositoryUrl = projectForm.githubRepositoryUrl.trim();
    if (!repositoryUrl) {
      setFormError("A GitHub repository URL is required for every project.");
      return null;
    }
    try {
      setFormError("");
      setVerifyingRepository(true);
      const verified = await GitHubApi.verifyRepository(repositoryUrl);
      setRepositoryPreview(verified);
      setProjectForm((current) => ({ ...current, githubRepositoryUrl: verified.url }));
      return verified;
    } catch (error) {
      setRepositoryPreview(null);
      setFormError(error instanceof Error ? error.message : "GitHub repository verification failed.");
      return null;
    } finally {
      setVerifyingRepository(false);
    }
  }

  async function submitProject(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const repositoryUrl = projectForm.githubRepositoryUrl.trim();
      if (!repositoryUrl) throw new Error("A GitHub repository URL is required.");
      await trackingApi.createProject({ ...projectForm, githubRepositoryUrl: repositoryUrl });
      toast.success("Project created.");
      setPanelMode(null);
      setSelectedProjectId(null);
      setEditingLogId(null);
      setEditingFullstackId(null);
      setRepositoryPreview(null);
      await loadData();
      window.dispatchEvent(new Event("devarena:activity-updated"));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create the project.");
    } finally {
      setSaving(false);
    }
  }

  async function submitRepository(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!selectedProject) return;
    setSaving(true);
    try {
      const repositoryUrl = projectForm.githubRepositoryUrl.trim();
      if (!repositoryUrl) throw new Error("A GitHub repository URL is required.");
      await trackingApi.attachProjectRepository(selectedProject.id, repositoryUrl);
      toast.success("GitHub language percentages saved to the project.");
      closePanel();
      await loadData();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not connect the GitHub repository.");
    } finally {
      setSaving(false);
    }
  }

  async function submitSession(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!selectedProject) return;
    setSaving(true);
    try {
      const payload = { ...sessionForm, timeSpent: Number(sessionForm.timeSpent) };
      if (editingLogId) await trackingApi.updateProjectLog(selectedProject.id, editingLogId, payload);
      else await trackingApi.addProjectLog(selectedProject.id, payload);
      toast.success(editingLogId ? "Work session updated." : "Work session logged for 3 points.");
      setPanelMode(null);
      setSelectedProjectId(null);
      setEditingLogId(null);
      setEditingFullstackId(null);
      await loadData();
      window.dispatchEvent(new Event("devarena:activity-updated"));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save the work session.");
    } finally {
      setSaving(false);
    }
  }

  async function submitMilestone(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!selectedProject) return;
    setSaving(true);
    try {
      await trackingApi.addMilestone(selectedProject.id, { ...milestoneForm, status: "Pending" });
      toast.success("Milestone added.");
      setPanelMode(null);
      setSelectedProjectId(null);
      setEditingLogId(null);
      setEditingFullstackId(null);
      await loadData();
      window.dispatchEvent(new Event("devarena:activity-updated"));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not add the milestone.");
    } finally {
      setSaving(false);
    }
  }

  async function submitFullstack(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = { ...fullstackForm, timeSpent: Number(fullstackForm.timeSpent) };
      if (editingFullstackId) await trackingApi.updateFullstack(editingFullstackId, payload);
      else await trackingApi.createFullstack(payload);
      const activityLabel = fullstackForm.category === "Course_Progress"
        ? "Course progress"
        : fullstackForm.type;
      toast.success(editingFullstackId ? "Fullstack entry updated." : `${activityLabel} logged for ${fullstackForm.type === "Learning" ? 2 : 4} points.`);
      setPanelMode(null);
      setSelectedProjectId(null);
      setEditingLogId(null);
      setEditingFullstackId(null);
      await loadData();
      window.dispatchEvent(new Event("devarena:activity-updated"));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save the fullstack entry.");
    } finally {
      setSaving(false);
    }
  }

  async function copyShareLink(project: Project) {
    if (!project.shareSlug) return;
    const link = `${window.location.origin}/shared/projects/${project.shareSlug}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Project share link copied.");
    } catch {
      window.prompt("Copy this project link:", link);
    }
  }

  async function toggleSharing(project: Project) {
    try {
      const updated = await trackingApi.updateProjectSharing(project.id, !project.isShared);
      if (updated.isShared) {
        toast.success("Project is now public through a private share link.");
        await copyShareLink(updated);
      } else {
        toast.success("Project sharing disabled.");
      }
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update project sharing.");
    }
  }

  async function refreshRepository(project: Project) {
    try {
      setBusyRepositoryId(project.id);
      await trackingApi.refreshProjectRepository(project.id);
      toast.success("GitHub access, languages, and technologies refreshed.");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Repository language data could not be refreshed.");
    } finally {
      setBusyRepositoryId("");
    }
  }

  async function toggleProject(project: Project) {
    try {
      const status = project.status === "Completed" ? "In_Progress" : "Completed";
      await trackingApi.updateProject(project.id, { status });
      toast.success(
        status === "Completed"
          ? project.completionAwardedAt
            ? "Project completed. The verified project score was recalculated."
            : "Project completed. Repository evidence and sustained work were recalculated."
          : "Project returned to active work. Earned completion points remain protected.",
      );
      await loadData();
      window.dispatchEvent(new Event("devarena:activity-updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update project status.");
    }
  }

  async function toggleMilestone(project: Project, milestoneId: string, completed: boolean) {
    try {
      await trackingApi.updateMilestone(project.id, milestoneId, { status: completed ? "Pending" : "Completed" });
      const milestone = project.milestones.find((item) => item.id === milestoneId);
      toast.success(
        completed
          ? "Milestone reopened. Earned points remain protected."
          : milestone?.completionAwardedAt
            ? "Milestone completed. The project evidence score was recalculated."
            : "Milestone completed. The project evidence score was recalculated.",
      );
      await loadData();
      window.dispatchEvent(new Event("devarena:activity-updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the milestone.");
    }
  }

  async function deleteSession(projectId: string, logId: string) {
    if (!window.confirm("Delete this work session? The evidence-based project score will be recalculated.")) return;
    try {
      await trackingApi.deleteProjectLog(projectId, logId);
      toast.success("Work session deleted.");
      await loadData();
      window.dispatchEvent(new Event("devarena:activity-updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the session.");
    }
  }

  async function deleteFullstack(logId: string) {
    if (!window.confirm("Delete this fullstack entry? Its points will be removed.")) return;
    try {
      await trackingApi.deleteFullstack(logId);
      toast.success("Fullstack entry deleted.");
      await loadData();
      window.dispatchEvent(new Event("devarena:activity-updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the entry.");
    }
  }

  async function exportProjectHistory() {
    if (!projectsData || !fullstackData) throw new Error("Project history is still loading.");
    await trackingApi.reverifyProjectRepositories();
    const freshProjectsData = await trackingApi.getProjects();
    setProjectsData(freshProjectsData);
    const name = user?.displayName || "DevArena Player";
    const username = "username" in (user ?? {}) ? (user as { username?: string }).username : "";
    const projectRows = freshProjectsData.projects.map((project) => ({
      title: project.title,
      details: [
        `${domainLabel(project.domain)} - ${project.status === "Completed" ? "Completed" : "In progress"} - ${project.metrics.score} points`,
        project.description,
        project.githubRepositoryUrl ? `GitHub repository: ${project.githubRepositoryUrl}` : null,
        project.githubLanguages?.length ? `Languages: ${project.githubLanguages.map((item) => `${item.name} ${item.percentage}%`).join(", ")}` : "Languages: None returned by GitHub",
        project.githubLanguagesFetchedAt ? `Languages refreshed: ${displayActivityDateTime(project.githubLanguagesFetchedAt)}` : null,
        `${project.metrics.totalSessions} sessions - ${project.metrics.completedMilestones}/${project.metrics.totalMilestones} milestones completed`,
        `Created: ${displayActivityDateTime(project.createdAt)}`,
        project.isShared ? `Shared project slug: ${project.shareSlug || "Enabled"}` : "Private project",
      ],
    }));
    const sessions = freshProjectsData.projects.flatMap((project) => project.logs.map((log) => ({
      title: `${project.title}: ${log.description}`,
      details: [`${log.timeSpent} minutes - 3 points`, `Date and time: ${displayActivityDateTime(log.createdAt)}`, log.proofLink],
    })));
    const milestones = freshProjectsData.projects.flatMap((project) => project.milestones.map((milestone) => ({
      title: `${project.title}: ${milestone.title}`,
      details: [milestone.status, milestone.description, `Created: ${displayActivityDateTime(milestone.createdAt)}`, milestone.completionAwardedAt ? "Included in evidence-based project score" : null],
    })));
    await downloadHistoryPdf({
      filename: `devarena-project-history-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "Project History",
      subtitle: "Projects, work sessions, milestones, and full-stack evidence.",
      identity: [name, username ? `Username: ${username}` : null],
      sections: [
        { title: "Projects", summary: [`Total projects: ${freshProjectsData.summary.totalProjects}`, `Project points: ${freshProjectsData.summary.projectPoints}`], rows: projectRows },
        { title: "Project Work Sessions", rows: sessions },
        { title: "Milestones", rows: milestones },
        { title: "Fullstack Log", summary: [`Weekly points: ${fullstackData.summary.weeklyPoints}`], rows: fullstackData.logs.map((log) => ({ title: log.title, details: [`${log.category} - ${log.type} - ${log.points} points`, `${log.timeSpent} minutes - ${displayActivityDateTime(log.createdAt)}`, log.description, log.proofLink] })) },
      ],
    });
  }

  const recentProjects = useMemo(() => {
    if (!projectsData) return [];
    return [...projectsData.projects]
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, 10);
  }, [projectsData]);
  const recentFullstackLogs = useMemo(() => fullstackData?.logs.slice(0, 10) ?? [], [fullstackData]);

  if (loading || !projectsData || !fullstackData) return <PageLoader variant="projects" />;

  const modalTitle = panelMode === "project"
    ? "Create Project"
    : panelMode === "repository"
      ? "Add GitHub Languages"
      : panelMode === "session"
        ? "Project Work Session"
        : panelMode === "milestone"
          ? "New Milestone"
          : "Fullstack Activity";
  const modalEyebrow = panelMode === "project"
    ? "Long-term build"
    : panelMode === "repository"
      ? selectedProject?.title || "Repository verification"
      : panelMode === "fullstack"
        ? "Primary source · Full-Stack"
        : selectedProject?.title || "Structured evidence";

  return (
    <main className="tracking-page projects-page animated-page">
      <header className="tracking-hero page-reveal">
        <div>
          <p className="tracking-eyebrow">Build / Learn / Ship</p>
          <h1>Projects</h1>
          <p>{activeTab === "projects" ? "Track long-running technical work through specific sessions and meaningful milestones." : "Track focused full-stack learning or implementation work."}</p>
        </div>
        <div className="tracking-hero-actions">
          <button className="tracking-action" onClick={() => activeTab === "projects" ? openProjectForm() : openFullstack()}>
            + {activeTab === "projects" ? "Create project" : "Log fullstack"}
          </button>
        </div>
      </header>

      <nav className="tracking-tabs page-reveal" aria-label="Project tracking modules">
        <button className={activeTab === "projects" ? "active" : ""} onClick={() => { setActiveTab("projects"); closePanel(); }}>Project system</button>
        <button className={activeTab === "fullstack" ? "active" : ""} onClick={() => { setActiveTab("fullstack"); closePanel(); }}>Full-Stack</button>
      </nav>

      <TrackingModal open={panelMode !== null} title={modalTitle} eyebrow={modalEyebrow} saving={saving} error={formError} onClose={closePanel}>
        {panelMode === "project" && (
          <form className="tracking-form" onInput={() => setFormError("")} onSubmit={submitProject}>
            <Field label="Project title"><input required placeholder=" " value={projectForm.title} onChange={(event) => setProjectForm({ ...projectForm, title: event.target.value })} /></Field>
            <Field label="Domain" raised><AnimatedSelect value={projectForm.domain} onChange={(domain) => { setFormError(""); setProjectForm({ ...projectForm, domain }); }} options={[{ value: "Fullstack", label: "Fullstack", description: "Web platforms and services" }, { value: "App", label: "App Development", description: "Mobile and native applications" }, { value: "AI", label: "AI / ML", description: "Models, data, and intelligence" }, { value: "Other", label: "Other", description: "Any technical build" }]} /></Field>
            <Field label="Initial status" raised><AnimatedSelect value={projectForm.status} onChange={(status) => { setFormError(""); setProjectForm({ ...projectForm, status }); }} options={[{ value: "In_Progress", label: "In progress", description: "Active project work" }, { value: "Completed", label: "Completed", description: "Create as completed and award points" }]} /></Field>
            <Field label="GitHub repository URL" wide><input required type="url" placeholder=" " value={projectForm.githubRepositoryUrl} onChange={(event) => { setFormError(""); setRepositoryPreview(null); setProjectForm({ ...projectForm, githubRepositoryUrl: event.target.value }); }} /></Field>
            <div className="github-verify-row tracking-field-wide">
              <button type="button" className="tracking-secondary-action" disabled={verifyingRepository || !projectForm.githubRepositoryUrl.trim()} onClick={() => void verifyRepository()}>{verifyingRepository ? "Reading languages…" : "Fetch GitHub languages"}</button>
              <span>Public repositories work directly. Connect GitHub in Settings only when the repository is private.</span>
            </div>
            {repositoryPreview && <RepositoryEvidence repository={repositoryPreview} />}
            <Field label="Description" wide><textarea required minLength={10} rows={4} placeholder=" " value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} /></Field>
            <Submit saving={saving || verifyingRepository} label="Create project" />
          </form>
        )}

        {panelMode === "repository" && selectedProject && (
          <form className="tracking-form" onInput={() => setFormError("")} onSubmit={submitRepository}>
            <p className="tracking-form-intro tracking-field-wide">Paste the repository root URL. DevArena will fetch and save only its GitHub language percentages.</p>
            <Field label="GitHub repository URL" wide><input required type="url" placeholder=" " value={projectForm.githubRepositoryUrl} onChange={(event) => { setFormError(""); setRepositoryPreview(null); setProjectForm({ ...projectForm, githubRepositoryUrl: event.target.value }); }} /></Field>
            <div className="github-verify-row tracking-field-wide">
              <button type="button" className="tracking-secondary-action" disabled={verifyingRepository || !projectForm.githubRepositoryUrl.trim()} onClick={() => void verifyRepository()}>{verifyingRepository ? "Reading languages…" : "Fetch GitHub languages"}</button>
              <span>Connect GitHub in Settings only for private repositories.</span>
            </div>
            {repositoryPreview && <RepositoryEvidence repository={repositoryPreview} />}
            <Submit saving={saving || verifyingRepository} label="Connect repository" />
          </form>
        )}

        {panelMode === "session" && selectedProject && (
          <form className="tracking-form" onInput={() => setFormError("")} onSubmit={submitSession}>
            <Field label="Time spent (minutes)"><input required type="number" min="1" max="960" placeholder=" " value={sessionForm.timeSpent} onChange={(event) => setSessionForm({ ...sessionForm, timeSpent: event.target.value })} /></Field>
            <Field label="Proof link (optional)"><input type="url" placeholder=" " value={sessionForm.proofLink} onChange={(event) => setSessionForm({ ...sessionForm, proofLink: event.target.value })} /></Field>
            <Field label="Specific task completed" wide><textarea required minLength={10} rows={4} placeholder=" " value={sessionForm.description} onChange={(event) => setSessionForm({ ...sessionForm, description: event.target.value })} /></Field>
            <Submit saving={saving} label={editingLogId ? "Update work session" : "Save work session"} />
          </form>
        )}

        {panelMode === "milestone" && selectedProject && (
          <form className="tracking-form" onInput={() => setFormError("")} onSubmit={submitMilestone}>
            <Field label="Milestone title"><input required placeholder=" " value={milestoneForm.title} onChange={(event) => setMilestoneForm({ ...milestoneForm, title: event.target.value })} /></Field>
            <Field label="Description" wide><textarea rows={4} placeholder=" " value={milestoneForm.description} onChange={(event) => setMilestoneForm({ ...milestoneForm, description: event.target.value })} /></Field>
            <Submit saving={saving} label="Add milestone" />
          </form>
        )}

        {panelMode === "fullstack" && (
          <form className="tracking-form" onInput={() => setFormError("")} onSubmit={submitFullstack}>
            <Field label="Tracking category" raised>
              <AnimatedSelect
                value={fullstackForm.category}
                onChange={(category) => { setFormError(""); setFullstackForm({ ...fullstackForm, category, type: category === "Course_Progress" ? "Learning" : fullstackForm.type }); }}
                options={[{ value: "Course_Progress", label: "Course Progress", description: "Full-stack course section completed" }, { value: "Practical_Work", label: "Practical Work", description: "Learning or building evidence" }]}
              />
            </Field>
            {fullstackForm.category === "Practical_Work" ? (
              <Field label="Activity type" raised><AnimatedSelect value={fullstackForm.type} onChange={(type) => { setFormError(""); setFullstackForm({ ...fullstackForm, type }); }} options={[{ value: "Learning", label: "Learning", description: "2 points" }, { value: "Building", label: "Building", description: "4 points" }]} /></Field>
            ) : (
              <Field label="Learning source"><input value="Full-Stack" placeholder=" " readOnly /></Field>
            )}
            <Field label={fullstackForm.category === "Course_Progress" ? "Section / part completed" : "Task title"}><input required placeholder=" " value={fullstackForm.title} onChange={(event) => setFullstackForm({ ...fullstackForm, title: event.target.value })} /></Field>
            <Field label="Time spent (minutes)"><input required type="number" min="1" max="960" placeholder=" " value={fullstackForm.timeSpent} onChange={(event) => setFullstackForm({ ...fullstackForm, timeSpent: event.target.value })} /></Field>
            <Field label="Proof link (optional)"><input type="url" placeholder=" " value={fullstackForm.proofLink} onChange={(event) => setFullstackForm({ ...fullstackForm, proofLink: event.target.value })} /></Field>
            <Field label={fullstackForm.category === "Course_Progress" ? "Key concepts learned" : fullstackForm.type === "Learning" ? "What did you learn?" : "Implementation completed"} wide><textarea required minLength={10} rows={5} placeholder=" " value={fullstackForm.description} onChange={(event) => setFullstackForm({ ...fullstackForm, description: event.target.value })} /></Field>
            <Submit saving={saving} label={editingFullstackId ? "Update activity" : "Save activity"} />
          </form>
        )}
      </TrackingModal>

      {activeTab === "projects" ? (
        <>
          <section className="tracking-summary-grid page-reveal">
            <ProjectSummary label="Active projects" value={projectsData.summary.activeProjects} note="At least one recommended" />
            <ProjectSummary label="Completed" value={projectsData.summary.completedProjects} note="Evidence-based completion value" />
            <ProjectSummary label="Work sessions" value={projectsData.summary.totalSessions} note="Capped sustained-work evidence" />
            <ProjectSummary label="Project points" value={projectsData.summary.projectPoints} note="GitHub size + contribution + activity" />
          </section>

          <section className="project-board page-reveal">
            <div className="tracking-section-heading">
              <div><p className="tracking-eyebrow">Portfolio of work</p><h2>Your Projects</h2></div>
              <div className="tracking-section-actions">
                <span className="tracking-count">Latest {recentProjects.length} / {projectsData.summary.totalProjects}</span>
                <HistoryExportButton onExport={exportProjectHistory} label="Export project PDF" />
              </div>
            </div>

            <div className="project-list project-list-scroll">
              {recentProjects.map((project) => {
                const expanded = expandedProjectId === project.id;
                const lastActivity = project.logs[0]?.createdAt || project.updatedAt;
                const recentMilestones = [...project.milestones]
                  .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
                  .slice(0, 10);
                const recentSessions = project.logs.slice(0, 10);
                return (
                  <article className="project-card" key={project.id}>
                    <header className="project-card-header">
                      <div>
                        <p className="tracking-entry-meta">{domainLabel(project.domain)} · {project.status === "Completed" ? "Completed" : "In progress"}</p>
                        <h3>{project.title}</h3>
                        <p>{project.description || "No description added."}</p>
                        {project.githubRepositoryUrl && (
                          <div className="project-github-summary">
                            <span><i className="bx bxl-github" /> {repositoryLabel(project.githubRepositoryUrl)}</span>
                            <b>{project.githubLanguages?.length || 0} languages</b>
                          </div>
                        )}
                      </div>
                      <div className="project-score"><strong>{project.metrics.score}</strong><span>points</span></div>
                    </header>

                    <div className="project-metrics">
                      <Metric value={project.metrics.totalSessions} label="Sessions" />
                      <Metric value={`${project.metrics.completedMilestones}/${project.metrics.totalMilestones}`} label="Milestones" />
                      <Metric value={`${project.metrics.milestoneProgress}%`} label="Milestone progress" />
                      <Metric value={lastActivity ? <LiveDateTime value={lastActivity} /> : "No activity"} label="Last activity" />
                    </div>

                    {project.githubRepositoryUrl && <ProjectRepositoryPanel project={project} />}

                    <div className="project-actions">
                      {!project.githubRepositoryUrl && <button onClick={() => openRepository(project)}>Add GitHub repository</button>}
                      <button onClick={() => openSession(project)}>+ Work session</button>
                      <button onClick={() => openMilestone(project)}>+ Milestone</button>
                      <button onClick={() => void toggleProject(project)}>{project.status === "Completed" ? "Resume project" : "Mark completed"}</button>
                      <button onClick={() => void toggleSharing(project)}>{project.isShared ? "Make private" : "Share project"}</button>
                      {project.isShared && project.shareSlug && <button onClick={() => void copyShareLink(project)}>Copy share link</button>}
                      {project.githubRepositoryUrl && <button disabled={busyRepositoryId === project.id} onClick={() => void refreshRepository(project)}>{busyRepositoryId === project.id ? "Refreshing…" : "Refresh GitHub languages"}</button>}
                      <button onClick={() => setExpandedProjectId(expanded ? null : project.id)}>{expanded ? "Hide details" : "View details"}</button>
                    </div>

                    {expanded && (
                      <div className="project-details">
                        <div>
                          <h4>Milestones</h4>
                          {recentMilestones.length === 0 && <p className="project-empty-copy">No milestones yet.</p>}
                          <div className="project-detail-scroll">
                            {recentMilestones.map((milestone) => (
                              <div className="project-detail-row" key={milestone.id}>
                                <div><strong>{milestone.title}</strong><span>{milestone.description || "No description"} · <LiveDateTime value={milestone.completionAwardedAt || milestone.createdAt} /></span></div>
                                <button onClick={() => void toggleMilestone(project, milestone.id, milestone.status === "Completed")}>{milestone.status === "Completed" ? "Completed · reopen" : "Complete milestone"}</button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4>Work Sessions</h4>
                          {recentSessions.length === 0 && <p className="project-empty-copy">No work sessions yet.</p>}
                          <div className="project-detail-scroll">
                            {recentSessions.map((log) => (
                              <div className="project-detail-row" key={log.id}>
                                <div><strong>{log.description}</strong><span>{log.timeSpent} min · <LiveDateTime value={log.createdAt} /></span></div>
                                <div className="project-row-actions">
                                  {log.proofLink && <a href={log.proofLink} target="_blank" rel="noreferrer">Proof</a>}
                                  {canEdit(log.createdAt) ? <><button onClick={() => openSession(project, log)}>Edit</button><button onClick={() => void deleteSession(project.id, log.id)}>Delete</button></> : <span>Locked</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {projectsData.projects.length === 0 && <div className="tracking-empty"><strong>No projects yet.</strong><span>Create a real build and track meaningful progress.</span></div>}
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="tracking-summary-grid page-reveal">
            <ProjectSummary label="Course progress" value={fullstackData.summary.courseProgress} note="Target 2–4 sections" />
            <ProjectSummary label="Practical work" value={fullstackData.summary.practicalTasks} note="Target 3–5 tasks" />
            <ProjectSummary label="Points this week" value={fullstackData.summary.weeklyPoints} note="Learning 2 / Building 4" />
            <ProjectSummary label="Learning / Building" value={`${fullstackData.summary.learning} / ${fullstackData.summary.building}`} note="Weighted by activity type" />
          </section>

          <section className="tracking-history page-reveal">
            <div className="tracking-section-heading">
              <div><p className="tracking-eyebrow">Course and practical evidence</p><h2>Fullstack Log</h2></div>
              <div className="tracking-section-actions">
                <span className="tracking-count">Latest {recentFullstackLogs.length} / {fullstackData.logs.length}</span>
                <HistoryExportButton onExport={exportProjectHistory} label="Export project PDF" />
              </div>
            </div>
            <div className="tracking-list tracking-list-scroll">
              {recentFullstackLogs.map((log) => (
                <article className="tracking-entry" key={log.id}>
                  <div className="tracking-entry-score">+{log.points}</div>
                  <div className="tracking-entry-main">
                    <p className="tracking-entry-meta">{log.category === "Course_Progress" ? "Course progress" : `Practical work · ${log.type}`} · {log.timeSpent} min · <LiveDateTime value={log.createdAt} /></p>
                    <h3>{log.title}</h3>
                    <small>{log.description}</small>
                  </div>
                  <div className="tracking-entry-actions">
                    {log.proofLink && <a href={log.proofLink} target="_blank" rel="noreferrer">Open proof</a>}
                    {canEdit(log.createdAt) ? <><button onClick={() => openFullstack(log)}>Edit</button><button onClick={() => void deleteFullstack(log.id)}>Delete</button></> : <span>Locked after 24h</span>}
                  </div>
                </article>
              ))}
              {fullstackData.logs.length === 0 && <div className="tracking-empty"><strong>No fullstack entries yet.</strong><span>Log one section or one implementation task.</span></div>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Field({ label, wide = false, raised = false, children }: { label: string; wide?: boolean; raised?: boolean; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  const child = isValidElement(children) ? cloneElement(children, { id }) : children;
  return <div className={`tracking-field${wide ? " tracking-field-wide" : ""}${raised ? " tracking-field--raised" : ""}`}><label htmlFor={id}>{label}</label>{child}</div>;
}

function Submit({ saving, label }: { saving: boolean; label: string }) {
  return <button className="tracking-submit" disabled={saving} type="submit">{saving ? <span className="tracking-loader" aria-label="Saving"><i /><i /><i /></span> : label}</button>;
}

function ProjectSummary({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <article className="tracking-summary"><p>{label}</p><strong>{value}</strong><span>{note}</span></article>;
}

function Metric({ value, label }: { value: ReactNode; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function RepositoryEvidence({ repository }: { repository: VerifiedGitHubRepository }) {
  return (
    <div className="repository-evidence-preview tracking-field-wide">
      <header>
        <span><i className="bx bxl-github" /> {repository.fullName}</span>
        <b>Language percentages from GitHub</b>
      </header>
      <LanguageBreakdown languages={repository.languages} />
      <p className={`repository-tech-eligibility ${repository.techStackEligible ? "eligible" : "excluded"}`}>
        <i className={`bx ${repository.techStackEligible ? "bx-check-shield" : "bx-info-circle"}`} />
        {repository.eligibilityReason}
      </p>
    </div>
  );
}

function ProjectRepositoryPanel({ project }: { project: Project }) {
  const languages = project.githubLanguages || [];
  return (
    <section className="project-repository-panel">
      <header>
        <div>
          <p>GitHub language data</p>
          <h4>{repositoryLabel(project.githubRepositoryUrl)}</h4>
        </div>
        <span>{languages.length} detected</span>
      </header>
      <LanguageBreakdown languages={languages} />
      <p className={`repository-tech-eligibility ${project.githubEligibleForTechStack ? "eligible" : "excluded"}`}>
        <i className={`bx ${project.githubEligibleForTechStack ? "bx-check-shield" : "bx-info-circle"}`} />
        {project.githubEligibilityReason || (project.githubEligibleForTechStack ? "Included in your live Top Tech Stack." : "Contribution verification is pending.")}
      </p>
      <footer>
        {project.githubRepositoryUrl && <a href={project.githubRepositoryUrl} target="_blank" rel="noreferrer">Open on GitHub</a>}
        <span>{project.githubLanguagesFetchedAt ? <>Updated <LiveDateTime value={project.githubLanguagesFetchedAt} /></> : "Language data pending"}</span>
      </footer>
    </section>
  );
}

function repositoryLabel(repositoryUrl: string | null) {
  if (!repositoryUrl) return "Repository";
  try {
    const url = new URL(repositoryUrl);
    return url.pathname.replace(/^\/+|\/+$/g, "") || "Repository";
  } catch {
    return repositoryUrl;
  }
}

function LanguageBreakdown({ languages }: { languages: Array<{ name: string; percentage: number }> }) {
  if (languages.length === 0) return <p className="repository-empty">No language data was returned by GitHub.</p>;
  return (
    <div className="repository-language-list">
      {languages.slice(0, 8).map((language) => (
        <div key={language.name}>
          <span><b>{language.name}</b><em>{language.percentage.toFixed(2)}%</em></span>
          <i><u style={{ width: `${Math.max(1, language.percentage)}%` }} /></i>
        </div>
      ))}
    </div>
  );
}

function domainLabel(domain: ProjectDomain) {
  if (domain === "App") return "App Development";
  if (domain === "AI") return "AI / ML";
  return domain;
}
