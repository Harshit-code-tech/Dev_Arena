import { cloneElement, isValidElement, useCallback, useEffect, useId, useMemo, useState, type FormEvent, type ReactElement } from "react";
import toast from "react-hot-toast";

import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import HistoryExportButton from "../../../shared/components/HistoryExportButton";
import LiveDateTime from "../../../shared/components/LiveDateTime";
import { useAuth } from "../../auth/context/AuthContext";
import { downloadHistoryPdf } from "../../../services/PdfExportService";
import TrackingModal from "../../../shared/components/TrackingModal";
import AnimatedSelect from "../../../shared/components/AnimatedSelect";
import {
  canEdit,
  displayActivityDateTime,
  trackingApi,
  type Difficulty,
  type DsaData,
  type DsaLog,
  type PracticeData,
  type PracticeLog,
  type PracticeType,
} from "../../../services/TrackingService";
import "../styles/DSA.css";

type Tab = "dsa" | "revision" | "learning";

type DsaForm = {
  problemName: string;
  problemUrl: string;
  solutionUrl: string;
  difficulty: Difficulty;
  timeTaken: string;
  timeComplexity: string;
  spaceComplexity: string;
  notes: string;
};

type PracticeForm = {
  title: string;
  notes: string;
  timeSpent: string;
  proofLink: string;
};

const emptyDsaForm = (): DsaForm => ({
  problemName: "",
  problemUrl: "",
  solutionUrl: "",
  difficulty: "Easy",
  timeTaken: "",
  timeComplexity: "",
  spaceComplexity: "",
  notes: "",
});

const emptyPracticeForm = (): PracticeForm => ({
  title: "",
  notes: "",
  timeSpent: "",
  proofLink: "",
});

export default function DSA() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("dsa");
  const [dsaData, setDsaData] = useState<DsaData | null>(null);
  const [practiceData, setPracticeData] = useState<PracticeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dsaForm, setDsaForm] = useState<DsaForm>(emptyDsaForm);
  const [practiceForm, setPracticeForm] = useState<PracticeForm>(emptyPracticeForm);
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dsa, practice] = await Promise.all([
        trackingApi.getDsa(),
        trackingApi.getPractice(),
      ]);
      setDsaData(dsa);
      setPracticeData(practice);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load tracking data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const practiceType: PracticeType = activeTab === "revision" ? "DSA_Revision" : "Concept_Explanation";
  const allPracticeLogs = useMemo(
    () => practiceData?.logs.filter((log) => log.type === practiceType) ?? [],
    [practiceData, practiceType],
  );
  const recentDsaLogs = useMemo(() => dsaData?.logs.slice(0, 10) ?? [], [dsaData]);
  const recentPracticeLogs = useMemo(() => allPracticeLogs.slice(0, 10), [allPracticeLogs]);

  function openCreateForm() {
    setEditingId(null);
    setDsaForm(emptyDsaForm());
    setPracticeForm(emptyPracticeForm());
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setEditingId(null);
    setFormError("");
  }

  function editDsa(log: DsaLog) {
    setActiveTab("dsa");
    setEditingId(log.id);
    setDsaForm({
      problemName: log.problemName,
      problemUrl: log.url || "",
      solutionUrl: log.solutionUrl || "",
      difficulty: log.difficulty,
      timeTaken: String(log.timeTaken),
      timeComplexity: log.timeComplexity || "",
      spaceComplexity: log.spaceComplexity || "",
      notes: log.notes || "",
    });
    setFormError("");
    setFormOpen(true);
  }

  function editPractice(log: PracticeLog) {
    setActiveTab(log.type === "DSA_Revision" ? "revision" : "learning");
    setEditingId(log.id);
    setPracticeForm({
      title: log.title,
      notes: log.notes || "",
      timeSpent: String(log.timeSpent),
      proofLink: log.proofLink || "",
    });
    setFormError("");
    setFormOpen(true);
  }

  async function submitDsa(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = { ...dsaForm, timeTaken: Number(dsaForm.timeTaken) };
      if (editingId) await trackingApi.updateDsa(editingId, payload);
      else await trackingApi.createDsa(payload);
      toast.success(editingId ? "DSA entry updated and daily points recalculated." : "Problem logged and daily difficulty points recalculated.");
      setFormOpen(false);
      setEditingId(null);
      await loadData();
      window.dispatchEvent(new Event("devarena:activity-updated"));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save the DSA entry.");
    } finally {
      setSaving(false);
    }
  }

  async function submitPractice(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        ...practiceForm,
        type: practiceType,
        timeSpent: Number(practiceForm.timeSpent),
      };
      if (editingId) await trackingApi.updatePractice(editingId, payload);
      else await trackingApi.createPractice(payload);
      toast.success(editingId ? "Practice entry updated." : activeTab === "revision" ? "Revision logged for 2 points." : "Learning session logged for 3 points.");
      setFormOpen(false);
      setEditingId(null);
      await loadData();
      window.dispatchEvent(new Event("devarena:activity-updated"));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save the practice entry.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDsa(id: string) {
    if (!window.confirm("Delete this DSA entry? Its points will be removed.")) return;
    try {
      await trackingApi.deleteDsa(id);
      toast.success("DSA entry deleted.");
      await loadData();
      window.dispatchEvent(new Event("devarena:activity-updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the entry.");
    }
  }

  async function deletePractice(id: string) {
    if (!window.confirm("Delete this practice entry? Its points will be removed.")) return;
    try {
      await trackingApi.deletePractice(id);
      toast.success("Practice entry deleted.");
      await loadData();
      window.dispatchEvent(new Event("devarena:activity-updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the entry.");
    }
  }

  async function exportDsaHistory() {
    if (!dsaData || !practiceData) throw new Error("DSA history is still loading.");
    const name = user?.displayName || "DevArena Player";
    const username = "username" in (user ?? {}) ? (user as { username?: string }).username : "";
    const revisions = practiceData.logs.filter((log) => log.type === "DSA_Revision");
    const learning = practiceData.logs.filter((log) => log.type === "Concept_Explanation");
    await downloadHistoryPdf({
      filename: `devarena-dsa-history-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: "DSA History",
      subtitle: "Problems, revision sessions, and structured learning evidence.",
      identity: [name, username ? `Username: ${username}` : null],
      sections: [
        {
          title: "DSA Problems",
          summary: [`Total problems: ${dsaData.logs.length}`, `This week: ${dsaData.summary.weeklySolved} problems / ${dsaData.summary.weeklyPoints} points`],
          rows: dsaData.logs.map((log) => ({
            title: log.problemName,
            details: [
              `${log.difficulty} - ${log.points} point(s) - ${log.timeTaken} minutes`,
              `Date and time: ${displayActivityDateTime(log.createdAt)}`,
              `Time: ${log.timeComplexity || "Not added"} / Space: ${log.spaceComplexity || "Not added"}`,
              log.notes,
              log.url,
              log.solutionUrl,
            ],
          })),
        },
        {
          title: "Revision",
          rows: revisions.map((log) => ({ title: log.title, details: [`${log.points} points - ${log.timeSpent} minutes`, `Date and time: ${displayActivityDateTime(log.createdAt)}`, log.notes, log.proofLink] })),
        },
        {
          title: "Learning",
          rows: learning.map((log) => ({ title: log.title, details: [`${log.points} points - ${log.timeSpent} minutes`, `Date and time: ${displayActivityDateTime(log.createdAt)}`, log.notes, log.proofLink] })),
        },
      ],
    });
  }

  if (loading || !dsaData || !practiceData) return <PageLoader variant="dsa" />;

  const activeTitle = activeTab === "dsa" ? "Problem Log" : activeTab === "revision" ? "Revision Log" : "Learning Log";
  const activeDescription = activeTab === "dsa"
    ? "Track deliberate problem solving with complexity analysis and honest time data."
    : activeTab === "revision"
      ? "Revisit solved problems or rebuild techniques from memory to strengthen retention."
      : "Explain a concept in structured notes to convert passive knowledge into recall.";
  const activeTotal = activeTab === "dsa" ? dsaData.logs.length : allPracticeLogs.length;
  const visibleCount = activeTab === "dsa" ? recentDsaLogs.length : recentPracticeLogs.length;

  return (
    <main className="tracking-page dsa-page animated-page">
      <header className="tracking-hero page-reveal">
        <div>
          <p className="tracking-eyebrow">Structured Skill Tracking</p>
          <h1>DSA</h1>
          <p>{activeDescription}</p>
        </div>
        <div className="tracking-hero-actions">
          <button className="tracking-action" onClick={openCreateForm}>+ Log activity</button>
        </div>
      </header>

      <nav className="tracking-tabs page-reveal" aria-label="DSA tracking modules">
        {(["dsa", "revision", "learning"] as const).map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => {
              setActiveTab(tab);
              setFormOpen(false);
              setEditingId(null);
            }}
          >
            {tab === "dsa" ? "DSA Problems" : tab === "revision" ? "Revision" : "Learning"}
          </button>
        ))}
      </nav>

      {activeTab === "dsa" ? (
        <section className="tracking-summary-grid dsa-summary-grid--problems page-reveal" aria-label="DSA weekly summary">
          <Summary label="Solved this week" value={dsaData.summary.weeklySolved} note="Target 8–12" />
          <Summary label="Points this week" value={dsaData.summary.weeklyPoints} note="Daily diminishing-return tiers" />
          <Summary label="Easy" value={dsaData.summary.breakdown.Easy} note="1 / 0.5 / 0.2 daily tiers" />
          <Summary label="Medium" value={dsaData.summary.breakdown.Medium} note="4 / 3 / 2 daily tiers" />
          <Summary label="Hard" value={dsaData.summary.breakdown.Hard} note="10 points each" />
        </section>
      ) : (
        <section className="tracking-summary-grid dsa-summary-grid--practice page-reveal" aria-label="Practice weekly summary">
          <Summary label="Practice this week" value={practiceData.summary.weeklyActivities} note="Revision + learning" />
          <Summary label="Points this week" value={practiceData.summary.weeklyPoints} note="2 / 3 by activity" />
          <Summary label="Revisions" value={practiceData.summary.revisions} note="2 points each" />
          <Summary label="Learning sessions" value={practiceData.summary.learningSessions} note="3 points each" />
        </section>
      )}

      <TrackingModal
        open={formOpen}
        title={activeTitle}
        eyebrow={editingId ? "Edit within 24 hours" : "New structured entry"}
        saving={saving}
        error={formError}
        onClose={closeForm}
      >
        {activeTab === "dsa" ? (
          <form className="tracking-form" onSubmit={submitDsa}>
            <Field label="Problem name"><input required placeholder=" " value={dsaForm.problemName} onChange={(event) => { setFormError(""); setDsaForm({ ...dsaForm, problemName: event.target.value }); }} /></Field>
            <Field label="Problem URL"><input required type="url" placeholder=" " value={dsaForm.problemUrl} onChange={(event) => { setFormError(""); setDsaForm({ ...dsaForm, problemUrl: event.target.value }); }} /></Field>
            <Field label="Solution or code URL (optional)"><input type="url" placeholder=" " value={dsaForm.solutionUrl} onChange={(event) => { setFormError(""); setDsaForm({ ...dsaForm, solutionUrl: event.target.value }); }} /></Field>
            <Field label="Difficulty" raised><AnimatedSelect value={dsaForm.difficulty} onChange={(difficulty) => { setFormError(""); setDsaForm({ ...dsaForm, difficulty }); }} options={[{ value: "Easy", label: "Easy", description: "Daily tiers: 1 / 0.5 / 0.2" }, { value: "Medium", label: "Medium", description: "Daily tiers: 4 / 3 / 2" }, { value: "Hard", label: "Hard", description: "10 points" }]} /></Field>
            <Field label="Time taken (minutes)"><input required min="1" max="720" type="number" placeholder=" " value={dsaForm.timeTaken} onChange={(event) => { setFormError(""); setDsaForm({ ...dsaForm, timeTaken: event.target.value }); }} /></Field>
            <Field label="Time complexity"><input placeholder=" " value={dsaForm.timeComplexity} onChange={(event) => { setFormError(""); setDsaForm({ ...dsaForm, timeComplexity: event.target.value }); }} /></Field>
            <Field label="Space complexity"><input placeholder=" " value={dsaForm.spaceComplexity} onChange={(event) => { setFormError(""); setDsaForm({ ...dsaForm, spaceComplexity: event.target.value }); }} /></Field>
            <Field label="Notes" wide><textarea rows={4} placeholder=" " value={dsaForm.notes} onChange={(event) => { setFormError(""); setDsaForm({ ...dsaForm, notes: event.target.value }); }} /></Field>
            <SubmitButton saving={saving} label={editingId ? "Update problem" : "Save problem"} />
          </form>
        ) : (
          <form className="tracking-form" onSubmit={submitPractice}>
            <Field label={activeTab === "revision" ? "Problem or topic revisited" : "Concept explained"}><input required placeholder=" " value={practiceForm.title} onChange={(event) => { setFormError(""); setPracticeForm({ ...practiceForm, title: event.target.value }); }} /></Field>
            <Field label="Time spent (minutes)"><input required min="1" max="720" type="number" placeholder=" " value={practiceForm.timeSpent} onChange={(event) => { setFormError(""); setPracticeForm({ ...practiceForm, timeSpent: event.target.value }); }} /></Field>
            <Field label="Proof link (optional)"><input type="url" placeholder=" " value={practiceForm.proofLink} onChange={(event) => { setFormError(""); setPracticeForm({ ...practiceForm, proofLink: event.target.value }); }} /></Field>
            <Field label="Structured notes" wide><textarea required minLength={10} rows={5} placeholder=" " value={practiceForm.notes} onChange={(event) => { setFormError(""); setPracticeForm({ ...practiceForm, notes: event.target.value }); }} /></Field>
            <SubmitButton saving={saving} label={editingId ? "Update activity" : "Save activity"} />
          </form>
        )}
      </TrackingModal>

      <section className="tracking-history page-reveal">
        <div className="tracking-section-heading">
          <div>
            <p className="tracking-eyebrow">Recent evidence</p>
            <h2>{activeTitle}</h2>
          </div>
          <div className="tracking-section-actions">
            <span className="tracking-count">Latest {visibleCount} / {activeTotal}</span>
            <HistoryExportButton onExport={exportDsaHistory} label="Export DSA PDF" />
          </div>
        </div>

        <div className="tracking-list tracking-list-scroll">
          {activeTab === "dsa" ? recentDsaLogs.map((log) => (
            <article className="tracking-entry" key={log.id}>
              <div className="tracking-entry-score">+{log.points}</div>
              <div className="tracking-entry-main">
                <p className="tracking-entry-meta">{log.difficulty} · {log.timeTaken} min · <LiveDateTime value={log.createdAt} /></p>
                <h3>{log.problemName}</h3>
                <p>{log.timeComplexity || "Complexity not added"} / {log.spaceComplexity || "Space not added"}</p>
                {log.notes && <small>{log.notes}</small>}
              </div>
              <EntryActions editable={canEdit(log.createdAt)} proof={log.url} proofLabel="Open problem" code={log.solutionUrl} onEdit={() => editDsa(log)} onDelete={() => void deleteDsa(log.id)} />
            </article>
          )) : recentPracticeLogs.map((log) => (
            <article className="tracking-entry" key={log.id}>
              <div className="tracking-entry-score">+{log.points}</div>
              <div className="tracking-entry-main">
                <p className="tracking-entry-meta">{log.type === "DSA_Revision" ? "Revision" : "Concept explanation"} · {log.timeSpent} min · <LiveDateTime value={log.createdAt} /></p>
                <h3>{log.title}</h3>
                <small>{log.notes}</small>
              </div>
              <EntryActions editable={canEdit(log.createdAt)} proof={log.proofLink} onEdit={() => editPractice(log)} onDelete={() => void deletePractice(log.id)} />
            </article>
          ))}

          {activeTotal === 0 && (
            <div className="tracking-empty"><strong>No entries yet.</strong><span>Start with one specific, meaningful activity.</span></div>
          )}
        </div>
      </section>
    </main>
  );
}

function Summary({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <article className="tracking-summary"><p>{label}</p><strong>{value}</strong><span>{note}</span></article>;
}

function Field({ label, wide = false, raised = false, children }: { label: string; wide?: boolean; raised?: boolean; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  const child = isValidElement(children) ? cloneElement(children, { id }) : children;
  return <div className={`tracking-field${wide ? " tracking-field-wide" : ""}${raised ? " tracking-field--raised" : ""}`}><label htmlFor={id}>{label}</label>{child}</div>;
}

function SubmitButton({ saving, label }: { saving: boolean; label: string }) {
  return <button className="tracking-submit" disabled={saving} type="submit">{saving ? <span className="tracking-loader" aria-label="Saving"><i /><i /><i /></span> : label}</button>;
}

function EntryActions({ editable, proof, proofLabel = "Open proof", code = null, onEdit, onDelete }: { editable: boolean; proof: string | null; proofLabel?: string; code?: string | null; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="tracking-entry-actions">
      {proof && <a href={proof} target="_blank" rel="noreferrer">{proofLabel}</a>}
      {code && <a href={code} target="_blank" rel="noreferrer">Open code</a>}
      {editable ? <><button onClick={onEdit}>Edit</button><button onClick={onDelete}>Delete</button></> : <span>Locked after 24h</span>}
    </div>
  );
}
