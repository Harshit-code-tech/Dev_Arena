import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AnimatedSelect from "../../../shared/components/AnimatedSelect";
import MonitoringLineChart from "../components/MonitoringLineChart";
import { AdminApi } from "../../../services/AdminService";
import "../styles/Admin.css";

type AdminTab = "Overview" | "Tournaments" | "Submissions" | "Users" | "Moderation" | "Challenges" | "Support" | "System";
const tabs: AdminTab[] = ["Overview", "Tournaments", "Submissions", "Users", "Moderation", "Challenges", "Support", "System"];

const initialTournament = {
  title: "", description: "", rules: "", type: "DSA", mode: "Solo", status: "Draft", difficulty: "Mixed",
  registrationOpensAt: "", registrationClosesAt: "", startsAt: "", endsAt: "", teamSizeMin: 1, teamSizeMax: 1,
  maxParticipants: 100, allowedLanguages: "C++, Java, Python, JavaScript, TypeScript", theme: "", requiredFeatures: "",
  submissionChecklist: "", requireDeployment: false, firstPlacePoints: 100, secondPlacePoints: 70, thirdPlacePoints: 50,
  topTenPercentPoints: 25, participationPoints: 5,
};

function valueOf(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
  return event.target.type === "checkbox" ? (event.target as HTMLInputElement).checked : event.target.value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}


function humanLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function readableValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "Not set";
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(parsed.getTime())) return formatDate(value);
    return value.replaceAll("_", " ");
  }
  if (Array.isArray(value)) {
    if (!value.length) return "None";
    const simple = value.filter((item) => ["string", "number", "boolean"].includes(typeof item));
    return simple.length === value.length ? simple.map(readableValue).join(", ") : `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .slice(0, 6);
    if (!entries.length) return "No details";
    return entries.map(([key, item]) => `${humanLabel(key)}: ${readableValue(item)}`).join(" · ");
  }
  return String(value);
}

function IdentityBlock({ person, fallback = "Account unavailable" }: { person?: { name?: string | null; username?: string | null; email?: string | null } | null; fallback?: string }) {
  if (!person) return <span className="admin-muted">{fallback}</span>;
  return <div className="admin-person">
    <strong>{person.name || "Unnamed account"}</strong>
    <span>{person.username ? `@${person.username}` : "Username unavailable"}</span>
    <span>{person.email || "Email unavailable"}</span>
  </div>;
}

function StatusBadge({ value }: { value?: string | null }) {
  const text = String(value || "Unknown").replaceAll("_", " ");
  return <span className={`admin-status-badge status-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>{text}</span>;
}

function auditChanges(item: any) {
  const before = item?.before && typeof item.before === "object" && !Array.isArray(item.before) ? item.before as Record<string, unknown> : {};
  const after = item?.after && typeof item.after === "object" && !Array.isArray(item.after) ? item.after as Record<string, unknown> : {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => readableValue(before[key]) !== readableValue(after[key]))
    .slice(0, 12);
  if (!keys.length && Object.keys(after).length) return Object.keys(after).slice(0, 12).map((key) => ({ key, before: undefined, after: after[key] }));
  return keys.map((key) => ({ key, before: before[key], after: after[key] }));
}

function FeedbackOperations({ items }: { items: any[] }) {
  if (!items.length) return <div className="admin-empty-readable">No feedback submissions.</div>;
  return <div className="admin-readable-list">{items.map((item) => <article className="admin-operation-card" key={item.id}>
    <header><div><span className="admin-operation-kicker">Feedback topic</span><h3>{item.feature || "General feedback"}</h3></div><StatusBadge value={item.status} /></header>
    <div className="admin-operation-grid">
      <div><span>Submitted by</span><IdentityBlock person={item.user} /></div>
      <div><span>Submitted</span><strong>{formatDate(item.createdAt)}</strong>{item.updatedAt && item.updatedAt !== item.createdAt && <small>Updated {formatDate(item.updatedAt)}</small>}</div>
    </div>
    <div className="admin-operation-message"><span>Feedback</span><p>{item.feedback || "No feedback text was provided."}</p></div>
  </article>)}</div>;
}

function ReportOperations({ items }: { items: any[] }) {
  if (!items.length) return <div className="admin-empty-readable">No reports.</div>;
  return <div className="admin-readable-list">{items.map((item) => <article className="admin-operation-card" key={item.id}>
    <header><div><span className="admin-operation-kicker">{humanLabel(item.subjectType || "Report")}</span><h3>{item.subject?.label || item.reason || "Reported item"}</h3></div><StatusBadge value={item.status} /></header>
    <div className="admin-operation-grid">
      <div><span>Reported by</span><IdentityBlock person={item.reporter} /></div>
      <div><span>Reported item</span><strong>{item.subject?.label || humanLabel(item.subjectType || "Item")}</strong>{item.subject?.owner && <IdentityBlock person={item.subject.owner} fallback="Owner unavailable" />}</div>
      <div><span>Reason</span><strong>{item.reason || "No reason supplied"}</strong></div>
      <div><span>Submitted</span><strong>{formatDate(item.createdAt)}</strong></div>
    </div>
    {item.details && <div className="admin-operation-message"><span>Report details</span><p>{item.details}</p></div>}
  </article>)}</div>;
}

function AuditOperations({ items }: { items: any[] }) {
  if (!items.length) return <div className="admin-empty-readable">No audit events.</div>;
  return <div className="admin-readable-list">{items.map((item) => {
    const changes = auditChanges(item);
    return <article className="admin-operation-card admin-audit-card" key={item.id}>
      <header><div><span className="admin-operation-kicker">Administrative action</span><h3>{humanLabel(item.action || "Action")}</h3></div><span className="admin-operation-time">{formatDate(item.createdAt)}</span></header>
      <div className="admin-operation-grid">
        <div><span>Administrator</span><IdentityBlock person={item.actor} /></div>
        <div><span>Affected area</span><strong>{humanLabel(item.entityType || "System")}</strong>{item.entityLabel && <small>{item.entityLabel}</small>}</div>
        {item.reason && <div className="admin-operation-wide"><span>Reason</span><strong>{item.reason}</strong></div>}
      </div>
      {changes.length > 0 && <div className="admin-change-list"><span>Recorded changes</span>{changes.map((change) => <div key={change.key}><strong>{humanLabel(change.key)}</strong><span>{change.before === undefined ? readableValue(change.after) : `${readableValue(change.before)} → ${readableValue(change.after)}`}</span></div>)}</div>}
    </article>;
  })}</div>;
}

function dateWithHiddenTime(value: unknown, hour: number, minute: number) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return raw;
  return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateDisplayValue(value: string) {
  const date = parseDateInput(value);
  if (!date) return "dd-mm-yyyy";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function DateField({ label, value, required = false, onChange }: { label: string; value: string; required?: boolean; onChange: (value: string) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedDate = parseDateInput(value);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => selectedDate || new Date());

  useEffect(() => {
    if (selectedDate) setViewMonth(selectedDate);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(viewMonth);
  const firstDay = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstDay.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
  const todayValue = dateInputValue(new Date());

  function choose(date: Date) {
    onChange(dateInputValue(date));
    setOpen(false);
  }

  return <div className="admin-date-field">
    <span>{label}</span>
    <div className={`admin-date-picker${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="admin-date-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required}
        aria-label={`${label}: ${value ? dateDisplayValue(value) : "Choose date"}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={value ? "" : "is-placeholder"}>{dateDisplayValue(value)}</span>
        <svg className="admin-date-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 2v3M17 2v3M3.5 9h17M5 4h14a1.5 1.5 0 0 1 1.5 1.5v14A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-14A1.5 1.5 0 0 1 5 4Z" />
        </svg>
      </button>
      <div className="admin-date-menu" role="dialog" aria-label={`${label} calendar`} aria-hidden={!open}>
        <div className="admin-date-menu-head">
          <button type="button" aria-label="Previous month" onClick={() => setViewMonth(new Date(year, month - 1, 1))}>←</button>
          <strong>{monthLabel}</strong>
          <button type="button" aria-label="Next month" onClick={() => setViewMonth(new Date(year, month + 1, 1))}>→</button>
        </div>
        <div className="admin-date-weekdays">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="admin-date-days">{days.map((date) => {
          const dayValue = dateInputValue(date);
          const outside = date.getMonth() !== month;
          const selected = dayValue === value;
          const today = dayValue === todayValue;
          return <button
            type="button"
            key={dayValue}
            className={`${outside ? "is-outside" : ""}${selected ? " is-selected" : ""}${today ? " is-today" : ""}`}
            aria-pressed={selected}
            onClick={() => choose(date)}
          >{date.getDate()}</button>;
        })}</div>
        <div className="admin-date-menu-foot">
          <button type="button" onClick={() => { const today = new Date(); setViewMonth(today); choose(today); }}>Today</button>
        </div>
      </div>
    </div>
  </div>;
}

function compactPresenceHistory(items: Array<{ bucketAt: string; onlineCount: number }>, maxPoints = 48) {
  if (items.length <= maxPoints) return items;
  const chunkSize = Math.ceil(items.length / maxPoints);
  const compacted: Array<{ bucketAt: string; onlineCount: number }> = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);
    if (!chunk.length) continue;
    const peak = Math.max(...chunk.map((item) => Math.max(0, Number(item.onlineCount) || 0)));
    compacted.push({ bucketAt: chunk[Math.floor(chunk.length / 2)]?.bucketAt || chunk[0].bucketAt, onlineCount: peak });
  }
  return compacted;
}


export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("Overview");
  const [access, setAccess] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [history, setHistory] = useState<Array<{ bucketAt: string; onlineCount: number }>>([]);
  const [presenceHours, setPresenceHours] = useState("24");
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [submissions, setSubmissions] = useState<{ dsa: any[]; projects: any[] }>({ dsa: [], projects: [] });
  const [moderation, setModeration] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [competitionTasks, setCompetitionTasks] = useState<any[]>([]);
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [tournamentForm, setTournamentForm] = useState<Record<string, unknown>>(initialTournament);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Challenge admin form state
  const [competitionForm, setCompetitionForm] = useState({ title: "", weekStart: "", opensAt: "", closesAt: "" });
  const [taskForm, setTaskForm] = useState({ competitionId: "", type: "DSA", title: "", description: "", difficulty: "Medium", weightPercentage: 50, timeLimitMs: 3000, memoryLimitMb: 256 });
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [testCaseForm, setTestCaseForm] = useState({ taskId: "", input: "", expectedOutput: "", isHidden: false, weight: 1 });
  const [aiGenerateTopic, setAiGenerateTopic] = useState("");
  const [aiGenerateDifficulty, setAiGenerateDifficulty] = useState("Medium");
  const [aiGenerating, setAiGenerating] = useState(false);

  const selectedTournament = useMemo(() => tournaments.find((item) => item.id === selectedTournamentId), [tournaments, selectedTournamentId]);
  const chartHistory = useMemo(() => compactPresenceHistory(history), [history]);
  const presencePeak = useMemo(() => Math.max(0, ...history.map((item) => Number(item.onlineCount) || 0)), [history]);
  const presenceAverage = useMemo(() => history.length ? history.reduce((sum, item) => sum + (Number(item.onlineCount) || 0), 0) / history.length : 0, [history]);

  async function loadBase() {
    setBusy(true); setMessage("");
    try {
      const result = await AdminApi.access();
      setAccess(result.allowed);
      if (!result.allowed) return;
      const [overviewData, historyData, tournamentData] = await Promise.all([AdminApi.overview(), AdminApi.presenceHistory(24), AdminApi.tournaments()]);
      setOverview(overviewData); setHistory(historyData); setTournaments(tournamentData);
      if (!selectedTournamentId && tournamentData[0]?.id) setSelectedTournamentId(tournamentData[0].id);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Admin data could not be loaded."); }
    finally { setBusy(false); }
  }

  useEffect(() => { void loadBase(); }, []);

  useEffect(() => {
    if (!access || tab !== "Users") return;
    void AdminApi.presenceHistory(Number(presenceHours)).then(setHistory).catch((reason) => setMessage(reason instanceof Error ? reason.message : "Presence history could not be loaded."));
  }, [presenceHours, tab, access]);

  useEffect(() => {
    if (!access) return;
    if (tab === "Submissions") void AdminApi.submissions(selectedTournamentId || undefined).then(setSubmissions).catch((reason) => setMessage(reason instanceof Error ? reason.message : "Submissions could not be loaded."));
    if (tab === "Moderation") void AdminApi.moderation().then(setModeration).catch((reason) => setMessage(reason instanceof Error ? reason.message : "Moderation data could not be loaded."));
    if (tab === "System") void AdminApi.systemHealth().then(setHealth).catch((reason) => setMessage(reason instanceof Error ? reason.message : "System health could not be loaded."));
    if (tab === "Challenges") void AdminApi.challengeCompetitions().then(setCompetitions).catch((reason) => setMessage(reason instanceof Error ? reason.message : "Challenge competitions could not be loaded."));
    if (tab === "Support") void AdminApi.supportMessages().then(setSupportMessages).catch((reason) => setMessage(reason instanceof Error ? reason.message : "Support messages could not be loaded."));
  }, [tab, selectedTournamentId, access]);

  // Load tasks for selected competition (for test case form)
  useEffect(() => {
    if (!access || !selectedCompetitionId) return;
    void AdminApi.listCompetitionTasks(selectedCompetitionId)
      .then(setCompetitionTasks)
      .catch(() => setCompetitionTasks([]));
  }, [selectedCompetitionId, access]);

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setMessage("");
    try { await action(); setMessage(success); await loadBase(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Admin action failed."); }
    finally { setBusy(false); }
  }

  async function createTournament(event: FormEvent) {
    event.preventDefault();
    const missingDate = [
      tournamentForm.registrationOpensAt,
      tournamentForm.registrationClosesAt,
      tournamentForm.startsAt,
      tournamentForm.endsAt,
    ].some((value) => !String(value || "").trim());
    if (missingDate) {
      setMessage("Choose registration opening, registration closing, start, and end dates.");
      return;
    }
    const payload = {
      ...tournamentForm,
      registrationOpensAt: dateWithHiddenTime(tournamentForm.registrationOpensAt, 0, 0),
      registrationClosesAt: dateWithHiddenTime(tournamentForm.registrationClosesAt, 12, 0),
      startsAt: dateWithHiddenTime(tournamentForm.startsAt, 13, 0),
      endsAt: dateWithHiddenTime(tournamentForm.endsAt, 23, 59),
      allowedLanguages: String(tournamentForm.allowedLanguages || "").split(",").map((item) => item.trim()).filter(Boolean),
    };
    await run(() => AdminApi.createTournament(payload), "Tournament created.");
    setTournamentForm(initialTournament);
  }

  if (access === false) return <main className="admin-page"><section className="admin-denied"><p>Protected system area</p><h1>Administrator access required.</h1><span>Add your email to `ADMIN_EMAILS` or assign the Admin role in Prisma.</span></section></main>;

  return <main className="admin-page">
    <header className="admin-hero">
      <p>DevArena control room</p><h1>Admin</h1><span>Create tournaments, review submissions, monitor active users, moderate reports, and audit sensitive actions.</span>
    </header>
    <nav className="admin-tabs">{tabs.map((item) => <button type="button" key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {message && <div className="admin-message" role="status">{message}</div>}
    {busy && !overview && <section className="admin-loading">Loading admin control room…</section>}

    {tab === "Overview" && overview && <section className="admin-stack">
      <div className="admin-metrics">{Object.entries(overview.metrics || {}).map(([key, value]) => <article key={key}><span>{key.replaceAll(/([A-Z])/g, " $1")}</span><strong>{String(value)}</strong></article>)}</div>
      <article className="admin-panel"><header><p>Presence</p><h2>Users online now</h2></header><div className="admin-table">{(overview.onlineUsers || []).map((item: any) => <div key={item.id}><span>@{item.user.username}</span><span>{item.route || "Unknown route"}</span><span>{formatDate(item.lastSeenAt)}</span></div>)}</div></article>
      <article className="admin-panel"><header><p>Traffic</p><h2>Active routes</h2></header><div className="admin-table">{(overview.byRoute || []).map((item: [string, number]) => <div key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong></div>)}</div></article>
    </section>}

    {tab === "Users" && <section className="admin-panel admin-presence-panel">
      <header className="admin-monitor-header">
        <div>
          <p>DevArena monitoring</p>
          <h2>Users active at a particular time</h2>
          <span className="admin-panel-note">Unique signed-in users seen during each presence window.</span>
        </div>
        <button type="button" className="admin-underline-action admin-view-metrics" onClick={() => navigate("/admin/metrics")}>View all metrics</button>
      </header>
      <div className="admin-monitor-toolbar">
        <div className="admin-presence-summary">
          <span>Peak <strong>{presencePeak}</strong></span>
          <span>Average <strong>{presenceAverage.toFixed(1)}</strong></span>
          <span>Snapshots <strong>{history.length}</strong></span>
        </div>
        <AnimatedSelect value={presenceHours} onChange={setPresenceHours} options={[{ value: "1", label: "Last hour" }, { value: "24", label: "Last 24 hours" }, { value: "168", label: "Last 7 days" }, { value: "720", label: "Last 30 days" }]} />
      </div>
      <MonitoringLineChart
        data={chartHistory.map((item) => ({ at: item.bucketAt, value: Number(item.onlineCount) || 0 }))}
        hours={Number(presenceHours)}
        ariaLabel="Historical DevArena concurrency"
        valueLabel="active users"
        emptyMessage="No presence snapshots exist for this period yet. Keep DevArena open with signed-in users for a few minutes and the chart will begin to populate."
      />
    </section>}

    {tab === "Tournaments" && <section className="admin-two-column">
      <form className="admin-panel admin-form" onSubmit={createTournament}>
        <header><p>Tournament manager</p><h2>Create competition</h2></header>
        <label><span>Title</span><input required value={String(tournamentForm.title || "")} onChange={(event) => setTournamentForm((current) => ({ ...current, title: valueOf(event) }))} /></label>
        <label><span>Type</span><AnimatedSelect value={String(tournamentForm.type)} onChange={(value) => setTournamentForm((current) => ({ ...current, type: value, mode: value === "DSA" ? "Solo" : current.mode }))} options={[{ value: "DSA", label: "DSA" }, { value: "Project", label: "Project" }]} /></label>
        {tournamentForm.type === "Project" && <label><span>Mode</span><AnimatedSelect value={String(tournamentForm.mode)} onChange={(value) => setTournamentForm((current) => ({ ...current, mode: value }))} options={[{ value: "Solo", label: "Solo" }, { value: "Team", label: "Team" }, { value: "Both", label: "Solo or Team" }]} /></label>}
        <label><span>Status</span><AnimatedSelect value={String(tournamentForm.status)} onChange={(value) => setTournamentForm((current) => ({ ...current, status: value }))} options={["Draft", "Published", "Registration_Open", "Live", "Judging", "Completed", "Cancelled"].map((value) => ({ value, label: value.replaceAll("_", " ") }))} /></label>
        <label className="wide"><span>Description</span><textarea required value={String(tournamentForm.description || "")} onChange={(event) => setTournamentForm((current) => ({ ...current, description: valueOf(event) }))} /></label>
        <label className="wide"><span>Rules</span><textarea required value={String(tournamentForm.rules || "")} onChange={(event) => setTournamentForm((current) => ({ ...current, rules: valueOf(event) }))} /></label>
        <DateField label="Registration opens" required value={String(tournamentForm.registrationOpensAt || "")} onChange={(value) => setTournamentForm((current) => ({ ...current, registrationOpensAt: value }))} />
        <DateField label="Registration closes" required value={String(tournamentForm.registrationClosesAt || "")} onChange={(value) => setTournamentForm((current) => ({ ...current, registrationClosesAt: value }))} />
        <DateField label="Tournament starts" required value={String(tournamentForm.startsAt || "")} onChange={(value) => setTournamentForm((current) => ({ ...current, startsAt: value }))} />
        <DateField label="Tournament ends" required value={String(tournamentForm.endsAt || "")} onChange={(value) => setTournamentForm((current) => ({ ...current, endsAt: value }))} />
        <label><span>Max participants</span><input type="number" min="1" value={Number(tournamentForm.maxParticipants)} onChange={(event) => setTournamentForm((current) => ({ ...current, maxParticipants: Number(event.target.value) }))} /></label>
        <label><span>Allowed languages</span><input value={String(tournamentForm.allowedLanguages || "")} onChange={(event) => setTournamentForm((current) => ({ ...current, allowedLanguages: valueOf(event) }))} /></label>
        {tournamentForm.type === "Project" && <>
          {(tournamentForm.mode === "Team" || tournamentForm.mode === "Both") && <>
            <label><span>Minimum team size</span><input type="number" min="1" value={Number(tournamentForm.teamSizeMin)} onChange={(event) => setTournamentForm((current) => ({ ...current, teamSizeMin: Number(event.target.value) }))} /></label>
            <label><span>Maximum team size</span><input type="number" min="1" value={Number(tournamentForm.teamSizeMax)} onChange={(event) => setTournamentForm((current) => ({ ...current, teamSizeMax: Number(event.target.value) }))} /></label>
          </>}
          <label className="wide"><span>Theme / project problem</span><textarea value={String(tournamentForm.theme || "")} onChange={(event) => setTournamentForm((current) => ({ ...current, theme: valueOf(event) }))} /></label>
          <label className="wide"><span>Required features</span><AnimatedSelect value={String(tournamentForm.requiredFeatures || "")} onChange={(value) => setTournamentForm((current) => ({ ...current, requiredFeatures: value }))} options={[
            { value: "", label: "Defined in tournament rules" },
            { value: "Core functionality", label: "Core functionality" },
            { value: "Frontend and backend", label: "Frontend + Backend" },
            { value: "Authentication and database", label: "Authentication + Database" },
            { value: "API integration", label: "API integration" },
            { value: "AI/ML functionality", label: "AI / ML functionality" },
            { value: "Mobile application", label: "Mobile application" },
            { value: "Testing and documentation", label: "Testing + Documentation" },
          ]} /></label>
          <label className="wide"><span>Submission checklist</span><textarea value={String(tournamentForm.submissionChecklist || "")} onChange={(event) => setTournamentForm((current) => ({ ...current, submissionChecklist: valueOf(event) }))} /></label>
          <label className="wide admin-checkbox"><input type="checkbox" checked={Boolean(tournamentForm.requireDeployment)} onChange={(event) => setTournamentForm((current) => ({ ...current, requireDeployment: event.target.checked }))} /><span>Require a deployment URL</span></label>
        </>}
        <button className="admin-underline-action wide" type="submit" disabled={busy}>Create tournament</button>
      </form>
      <section className="admin-panel"><header><p>Competition inventory</p><h2>All tournaments</h2></header><div className="admin-cards">{tournaments.map((item) => <article key={item.id} className={selectedTournamentId === item.id ? "selected" : ""}><span>{item.type} / {item.mode}</span><h3>{item.title}</h3><p>{item.status} · {item._count.registrations} registrations · {item._count.dsaSubmissions + item._count.projectSubmissions} submissions</p><div className="admin-review-actions"><button type="button" className="admin-underline-action" onClick={() => { setSelectedTournamentId(item.id); setTab("Submissions"); }}>Review submissions</button><button type="button" className="admin-underline-action" onClick={() => void run(() => AdminApi.updateTournament(item.id, { status: "Registration_Open" }), "Registration opened.")}>Open registration</button><button type="button" className="admin-underline-action" onClick={() => void run(() => AdminApi.updateTournament(item.id, { status: "Live" }), "Tournament marked live.")}>Go live</button><button type="button" className="admin-underline-action" onClick={() => void run(() => AdminApi.updateTournament(item.id, { status: "Judging" }), "Tournament moved to judging.")}>Start judging</button><button type="button" className="admin-underline-action" onClick={() => void run(() => AdminApi.publishResults(item.id), "Results published and Arena Points awarded.")}>Publish results</button></div></article>)}</div>{selectedTournament && <form className="admin-announcement" onSubmit={(event) => { event.preventDefault(); void run(() => AdminApi.announce(selectedTournament.id, { title: announcementTitle, message: announcementMessage }), "Tournament announcement sent.").then(() => { setAnnouncementTitle(""); setAnnouncementMessage(""); }); }}><h3>Send announcement to {selectedTournament.title}</h3><label><span>Title</span><input required value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} /></label><label><span>Message</span><textarea required value={announcementMessage} onChange={(event) => setAnnouncementMessage(event.target.value)} /></label><button className="admin-underline-action" type="submit" disabled={busy}>Send announcement</button></form>}</section>
    </section>}


    {tab === "Submissions" && <section className="admin-stack">
      <label className="admin-filter"><span>Tournament</span><AnimatedSelect value={selectedTournamentId} onChange={setSelectedTournamentId} options={[{ value: "", label: "All tournaments" }, ...tournaments.map((item) => ({ value: item.id, label: item.title }))]} /></label>
      <article className="admin-panel"><header><p>DSA judging</p><h2>Code submissions</h2></header><div className="admin-submission-list">{submissions.dsa.map((item) => <article key={item.id}><div><span>{item.tournament.title} / {item.question.title}</span><h3>@{item.user.username} · {item.language}</h3><p>{item.status} · {item.score} points · {formatDate(item.submittedAt)}</p></div><details><summary>Inspect code</summary><pre>{item.code}</pre></details><div className="admin-review-actions"><button className="admin-underline-action" type="button" onClick={() => void run(() => AdminApi.reviewDsa(item.id, { status: "Accepted", score: item.question.points, passedTests: item.totalTests, totalTests: item.totalTests }), "DSA submission accepted.")}>Accept</button><button className="admin-underline-action" type="button" onClick={() => void run(() => AdminApi.reviewDsa(item.id, { status: "Wrong_Answer", score: 0 }), "DSA submission marked wrong answer.")}>Wrong answer</button><button className="admin-underline-action" type="button" onClick={() => void run(() => AdminApi.reviewDsa(item.id, { status: "Disqualified", score: 0 }), "DSA submission disqualified.")}>Disqualify</button></div></article>)}</div></article>
      <article className="admin-panel"><header><p>Project judging</p><h2>GitHub submissions</h2></header><div className="admin-submission-list">{submissions.projects.map((item) => <article key={item.id}><div><span>{item.tournament.title}</span><h3>{item.team?.name || `@${item.user?.username}`}</h3><p>{item.repositoryPrivate ? "Private repository" : item.repositoryFullName} · automated {item.automatedScore} · final {item.finalScore}</p></div><a href={item.repositoryUrl} target="_blank" rel="noreferrer">Open repository</a><div className="admin-review-actions"><button className="admin-underline-action" type="button" onClick={() => { const score = Number(window.prompt("Manual rubric score, 0–25", "20")); if (Number.isFinite(score)) void run(() => AdminApi.reviewProject(item.id, { manualScore: score, status: "Scored", rubricScores: { manual: score } }), "Project submission scored."); }}>Score project</button><button className="admin-underline-action" type="button" onClick={() => void run(() => AdminApi.reviewProject(item.id, { manualScore: 0, status: "Disqualified" }), "Project submission disqualified.")}>Disqualify</button></div></article>)}</div></article>
    </section>}

    {tab === "Moderation" && moderation && <section className="admin-stack">
      <article className="admin-panel"><header><p>Operations</p><h2>Feedback</h2><span className="admin-panel-note">Readable product feedback with the account, topic, message, status, and submission time.</span></header><FeedbackOperations items={moderation.feedback || []} /></article>
      <article className="admin-panel"><header><p>Operations</p><h2>Reports</h2><span className="admin-panel-note">Reports are shown as people and content records instead of internal database objects.</span></header><ReportOperations items={moderation.reports || []} /></article>
      <article className="admin-panel"><header><p>Operations</p><h2>Audit logs</h2><span className="admin-panel-note">Administrative actions are translated into readable changes. Internal UUIDs and raw JSON are intentionally hidden.</span></header><AuditOperations items={moderation.auditLogs || []} /></article>
    </section>}
    {tab === "System" && health && <section className="admin-panel"><header><p>Infrastructure</p><h2>System health</h2></header><div className="admin-metrics">{Object.entries(health).map(([key, value]) => <article key={key}><span>{key.replaceAll(/([A-Z])/g, " $1")}</span><strong>{String(value)}</strong></article>)}</div></section>}

    {tab === "Challenges" && <section className="admin-stack">
      {/* ── Competition list ── */}
      <article className="admin-panel">
        <header><p>Weekly Challenge engine</p><h2>Competitions</h2><span className="admin-panel-note">Workflow: <strong>1)</strong> Create competition → <strong>2)</strong> Add tasks (Draft only) → <strong>3)</strong> Add test cases per task → <strong>4)</strong> Activate. The "Select" button loads tasks for the test-case form below.</span></header>
        <div className="admin-cards">{competitions.map((c) => <article key={c.id} className={selectedCompetitionId === c.id ? "selected" : ""}>
          <span>{c.status} · {c._count.tasks} task{c._count.tasks === 1 ? "" : "s"}</span>
          <h3>{c.title}</h3>
          <p>{c.weekStart?.slice(0, 10)}{c.opensAt ? ` · opens ${formatDate(c.opensAt)}` : ""}{c.closesAt ? ` · closes ${formatDate(c.closesAt)}` : ""}</p>
          <div className="admin-review-actions">
            <button type="button" className="admin-underline-action" onClick={() => { setSelectedCompetitionId(c.id); setTaskForm((f) => ({ ...f, competitionId: c.status === "Draft" ? c.id : f.competitionId })); void AdminApi.listCompetitionTasks(c.id).then(setCompetitionTasks).catch(() => setCompetitionTasks([])); }}>Select (load tasks)</button>
            {c.status === "Draft" && <button type="button" className="admin-underline-action" onClick={() => void run(() => AdminApi.activateCompetition(c.id), `✅ "${c.title}" activated — now open for submissions.`).then(() => AdminApi.challengeCompetitions().then(setCompetitions))}>Activate</button>}
            {(c.status === "Active" || c.status === "Evaluating") && <button type="button" className="admin-underline-action" onClick={() => void run(() => AdminApi.aggregateResults(c.id), `✅ Results aggregated for "${c.title}".`).then(() => AdminApi.challengeCompetitions().then(setCompetitions))}>Aggregate results</button>}
          </div>
        </article>)}
        {competitions.length === 0 && <div className="admin-empty-readable">No competitions yet. Create one below.</div>}
        </div>
      </article>

      <div className="admin-three-column">
        {/* ── 🤖 AI Challenge Generator ── */}
        <form className="admin-panel admin-form" onSubmit={async (e) => {
          e.preventDefault();
          if (!aiGenerateTopic.trim()) return;
          setAiGenerating(true); setMessage("");
          try {
            const generated = await AdminApi.generateChallenge(aiGenerateTopic.trim(), aiGenerateDifficulty);
            // Pre-fill task form with generated values
            setTaskForm((f) => ({
              ...f,
              title: generated.title ?? f.title,
              description: generated.description ?? f.description,
              difficulty: generated.difficulty ?? aiGenerateDifficulty,
            }));
            setMessage(`✨ AI generated "${generated.title}" — review and save it in the Add Task form. ${generated.sampleTestCases?.length ?? 0} sample test cases included (add them manually below).`);
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "AI generation failed.");
          } finally {
            setAiGenerating(false);
          }
        }}>
          <header><p>Gemini Flash Latest</p><h2>🤖 Generate task</h2><span className="admin-panel-note">Enter a topic and difficulty — Gemini will write a complete challenge. Results pre-fill the Add Task form for review before saving.</span></header>
          <label className="wide"><span>Topic</span><input required value={aiGenerateTopic} onChange={(e) => setAiGenerateTopic(e.target.value)} placeholder="e.g. Binary search trees, Dynamic programming, Graph BFS" /></label>
          <label><span>Difficulty</span>
            <select value={aiGenerateDifficulty} onChange={(e) => setAiGenerateDifficulty(e.target.value)} style={{ width: "100%", padding: "10px 12px", background: "#0a0a0a", border: "1px solid #3a3a3f", color: "#fff" }}>
              <option>Easy</option><option>Medium</option><option>Hard</option><option>Expert</option>
            </select>
          </label>
          <button className="admin-underline-action wide" type="submit" disabled={aiGenerating || busy}>{aiGenerating ? "Generating…" : "Generate with AI"}</button>
        </form>

        {/* ── Create competition ── */}
        <form className="admin-panel admin-form" onSubmit={(e) => { e.preventDefault(); void run(() => AdminApi.createCompetition({ ...competitionForm, opensAt: competitionForm.opensAt || null, closesAt: competitionForm.closesAt || null }), "✅ Competition created — now add tasks to it using Step 2.").then(() => { setCompetitionForm({ title: "", weekStart: "", opensAt: "", closesAt: "" }); void AdminApi.challengeCompetitions().then(setCompetitions); }); }}>
          <header><p>Step 1 · Create competition</p><h2>New week</h2><span className="admin-panel-note">Creates a Draft competition container. Add tasks next.</span></header>
          <label><span>Title</span><input required value={competitionForm.title} onChange={(e) => setCompetitionForm((f) => ({ ...f, title: e.target.value }))} placeholder="Week 42 — November Challenge" /></label>
          <DateField label="Week start" required value={competitionForm.weekStart} onChange={(v) => setCompetitionForm((f) => ({ ...f, weekStart: v }))} />
          <DateField label="Opens at" value={competitionForm.opensAt} onChange={(v) => setCompetitionForm((f) => ({ ...f, opensAt: v }))} />
          <DateField label="Closes at" value={competitionForm.closesAt} onChange={(f) => setCompetitionForm((ff) => ({ ...ff, closesAt: f }))} />
          <button className="admin-underline-action wide" type="submit" disabled={busy}>Create competition</button>
        </form>

        {/* ── Create task ── */}
        <form className="admin-panel admin-form" onSubmit={(e) => {
          e.preventDefault();
          const resolvedCompetitionId = taskForm.competitionId || selectedCompetitionId;
          if (!resolvedCompetitionId) { setMessage("⚠ Select a Draft competition first."); return; }
          const isDraft = competitions.some((c) => c.id === resolvedCompetitionId && c.status === "Draft");
          if (!isDraft) { setMessage("⚠ Tasks can only be added to Draft competitions. This competition is already active or completed."); return; }
          void run(
            () => AdminApi.createTask({ ...taskForm, competitionId: resolvedCompetitionId }),
            "✅ Task created — now add at least one test case to it in Step 3 below.",
          ).then(() => {
            setTaskForm((f) => ({ ...f, title: "", description: "" }));
            void AdminApi.challengeCompetitions().then(setCompetitions);
            void AdminApi.listCompetitionTasks(resolvedCompetitionId).then(setCompetitionTasks).catch(() => setCompetitionTasks([]));
          });
        }}>
          <header><p>Step 2 · Requires Draft competition</p><h2>Add task</h2><span className="admin-panel-note">Tasks can only be added to <strong>Draft</strong> competitions. Click "Select (load tasks)" on a card above to pre-select a competition.</span></header>
          {competitions.filter((c) => c.status === "Draft").length === 0 && <p style={{ fontSize: 12, color: "#f87171", margin: "0 0 12px", padding: "8px 12px", background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 6 }}>⚠ No Draft competitions. Create one in Step 1 first.</p>}
          <label><span>Competition (Draft only)</span>
            <select value={taskForm.competitionId || selectedCompetitionId} onChange={(e) => { setTaskForm((f) => ({ ...f, competitionId: e.target.value })); setSelectedCompetitionId(e.target.value); void AdminApi.listCompetitionTasks(e.target.value).then(setCompetitionTasks).catch(() => setCompetitionTasks([])); }} style={{ width: "100%", padding: "10px 12px", background: "#0a0a0a", border: "1px solid #3a3a3f", color: "#fff" }}>
              <option value="">Select Draft competition…</option>
              {competitions.filter((c) => c.status === "Draft").map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>
          <label><span>Type</span>
            <select value={taskForm.type} onChange={(e) => setTaskForm((f) => ({ ...f, type: e.target.value }))} style={{ width: "100%", padding: "10px 12px", background: "#0a0a0a", border: "1px solid #3a3a3f", color: "#fff" }}>
              <option>DSA</option><option>Development</option><option>Debugging</option>
            </select>
          </label>
          <label><span>Title</span><input required value={taskForm.title} onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))} /></label>
          <label><span>Difficulty</span>
            <select value={taskForm.difficulty} onChange={(e) => setTaskForm((f) => ({ ...f, difficulty: e.target.value }))} style={{ width: "100%", padding: "10px 12px", background: "#0a0a0a", border: "1px solid #3a3a3f", color: "#fff" }}>
              <option>Easy</option><option>Medium</option><option>Hard</option><option>Expert</option>
            </select>
          </label>
          <label><span>Weight % of competition score</span><input type="number" min={1} max={100} value={taskForm.weightPercentage} onChange={(e) => setTaskForm((f) => ({ ...f, weightPercentage: Number(e.target.value) }))} /></label>
          <label><span>Time limit (ms)</span><input type="number" min={500} value={taskForm.timeLimitMs} onChange={(e) => setTaskForm((f) => ({ ...f, timeLimitMs: Number(e.target.value) }))} /></label>
          <label><span>Memory limit (MB)</span><input type="number" min={16} value={taskForm.memoryLimitMb} onChange={(e) => setTaskForm((f) => ({ ...f, memoryLimitMb: Number(e.target.value) }))} /></label>
          <label className="wide"><span>Problem description</span><textarea required value={taskForm.description} onChange={(e) => setTaskForm((f) => ({ ...f, description: e.target.value }))} /></label>
          <button className="admin-underline-action wide" type="submit" disabled={busy}>Add task</button>
        </form>
      </div>

      {/* ── Add test case ── */}
      <form className="admin-panel admin-form" onSubmit={(e) => {
        e.preventDefault();
        if (!testCaseForm.taskId) { setMessage("⚠ Select a task first."); return; }
        void run(() => AdminApi.createTestCase(testCaseForm), "✅ Test case added. Keeping the same task selected so you can add more.").then(() => {
          // Keep taskId to allow adding multiple test cases to the same task rapidly
          setTestCaseForm((f) => ({ taskId: f.taskId, input: "", expectedOutput: "", isHidden: false, weight: 1 }));
          if (selectedCompetitionId) void AdminApi.listCompetitionTasks(selectedCompetitionId).then(setCompetitionTasks).catch(() => setCompetitionTasks([]));
          void AdminApi.challengeCompetitions().then(setCompetitions);
        });
      }}>
        <header><p>Step 3 · Click "Select (load tasks)" on a competition card above first</p><h2>Add test case</h2><span className="admin-panel-note">Test cases run via Piston sandbox. Hidden cases are invisible to players. Every task needs ≥ 1 test case before the competition can be activated. <strong>After submitting, the task stays selected so you can add more cases.</strong></span></header>
        {selectedCompetitionId && competitionTasks.length === 0 && <p style={{ fontSize: 12, color: "#fbbf24", margin: "0 0 12px", padding: "8px 12px", background: "rgba(251,191,36,.08)", border: "1px solid rgba(251,191,36,.3)", borderRadius: 6 }}>No tasks found. Add tasks in Step 2 first.</p>}
        <label><span>Task</span>
          <select value={testCaseForm.taskId} onChange={(e) => setTestCaseForm((f) => ({ ...f, taskId: e.target.value }))} style={{ width: "100%", padding: "10px 12px", background: "#0a0a0a", border: "1px solid #3a3a3f", color: "#fff" }}>
            <option value="">Select task… (click "Select (load tasks)" on a card above)</option>
            {competitionTasks.map((t) => <option key={t.id} value={t.id}>{t.title} ({t._count.testCases} test case{t._count.testCases === 1 ? "" : "s"})</option>)}
          </select>
        </label>
        <label className="wide"><span>Input (stdin)</span><textarea required value={testCaseForm.input} onChange={(e) => setTestCaseForm((f) => ({ ...f, input: e.target.value }))} placeholder={"5\n1 2 3 4 5"} /></label>
        <label className="wide"><span>Expected output (stdout)</span><textarea required value={testCaseForm.expectedOutput} onChange={(e) => setTestCaseForm((f) => ({ ...f, expectedOutput: e.target.value }))} placeholder="15" /></label>
        <label><span>Weight</span><input type="number" min={1} value={testCaseForm.weight} onChange={(e) => setTestCaseForm((f) => ({ ...f, weight: Number(e.target.value) }))} /></label>
        <label className="wide admin-checkbox"><input type="checkbox" checked={testCaseForm.isHidden} onChange={(e) => setTestCaseForm((f) => ({ ...f, isHidden: e.target.checked }))} /><span>Hidden test case (not shown to players)</span></label>
        <button className="admin-underline-action wide" type="submit" disabled={busy || !testCaseForm.taskId}>Add test case</button>
      </form>
    </section>}

    {tab === "Support" && <section className="admin-stack">
      <article className="admin-panel">
        <header><p>Support inbox</p><h2>Messages</h2><span className="admin-panel-note">All support form submissions — even ones where email delivery failed. Delivered = email was sent successfully.</span></header>
        {supportMessages.length === 0
          ? <div className="admin-empty-readable">No support messages yet.</div>
          : <div className="admin-table admin-support-table">
              <div className="admin-table-head"><span>Date</span><span>Name</span><span>Email</span><span>Status</span><span>Message</span></div>
              {supportMessages.map((m) => <div key={m.id} className="admin-support-row">
                <span className="admin-muted" style={{ fontSize: 11 }}>{formatDate(m.createdAt)}</span>
                <strong>{m.name}</strong>
                <a href={`mailto:${m.email}`} style={{ color: "#818cf8", fontSize: 12 }}>{m.email}</a>
                <StatusBadge value={m.delivered ? "Delivered" : "Undelivered"} />
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.72)", gridColumn: "1 / -1", paddingTop: 8, borderTop: "1px solid #1a1a1e", lineHeight: 1.6 }}>{m.message}</p>
              </div>)}
            </div>
        }
      </article>
    </section>}
  </main>;
}
