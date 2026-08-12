import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AnimatedSelect from "../../../shared/components/AnimatedSelect";
import MonitoringLineChart from "../components/MonitoringLineChart";
import { AdminApi } from "../../../services/AdminService";
import "../styles/Admin.css";

type AdminTab = "Overview" | "Tournaments" | "Submissions" | "Users" | "Moderation" | "System";
const tabs: AdminTab[] = ["Overview", "Tournaments", "Submissions", "Users", "Moderation", "System"];

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
  const [tournamentForm, setTournamentForm] = useState<Record<string, unknown>>(initialTournament);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
  }, [tab, selectedTournamentId, access]);

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
  </main>;
}
