import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AnimatedSelect from "../../../shared/components/AnimatedSelect";
import {
  TournamentApi,
  type TournamentDetail,
  type TournamentSummary,
  type TournamentTab,
  type TournamentLeaderboardGroup,
  type TournamentLeaderboardRow,
} from "../../../services/TournamentService";
import "../styles/Tournaments.css";

const tabs: TournamentTab[] = ["Live", "Upcoming", "Completed", "My Tournaments", "Leaderboard"];
const participationModes = ["Solo", "Auto Team", "Existing Team"] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}


function readableStructuredValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(readableStructuredValue).join(", ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key.replaceAll("_", " ")}: ${readableStructuredValue(item)}`).join(" · ");
  return String(value);
}

function StructuredCases({ title, data }: { title: string; data: unknown }) {
  if (!Array.isArray(data) || data.length === 0) return null;
  return <section className="tournament-case-section">
    <h4>{title}</h4>
    <div className="tournament-case-list">{data.map((entry, index) => {
      const fields = entry && typeof entry === "object" && !Array.isArray(entry) ? Object.entries(entry as Record<string, unknown>) : [["Value", entry] as [string, unknown]];
      return <article key={`${title}-${index}`}><span>{title.replace(/s$/i, "")} {index + 1}</span><dl>{fields.map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{readableStructuredValue(value)}</dd></div>)}</dl></article>;
    })}</div>
  </section>;
}

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = Math.max(0, new Date(until).getTime() - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return <span className="tournament-countdown">{days ? `${days}d ` : ""}{String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span>;
}

function TournamentCard({ tournament, open }: { tournament: TournamentSummary; open: () => void }) {
  return (
    <article className="tournament-card page-reveal">
      <header>
        <div>
          <p>{tournament.type} / {tournament.mode}</p>
          <h2>{tournament.title}</h2>
        </div>
        <span className={`tournament-status status-${tournament.effectiveStatus.toLowerCase()}`}>{tournament.effectiveStatus.replaceAll("_", " ")}</span>
      </header>
      <p>{tournament.description}</p>
      <dl>
        <div><dt>Starts</dt><dd>{formatDate(tournament.startsAt)}</dd></div>
        <div><dt>Registered</dt><dd>{tournament._count.registrations}{tournament.maxParticipants ? ` / ${tournament.maxParticipants}` : ""}</dd></div>
        <div><dt>Difficulty</dt><dd>{tournament.difficulty}</dd></div>
        <div><dt>Questions / teams</dt><dd>{tournament.type === "DSA" ? tournament._count.questions : tournament._count.teams}</dd></div>
      </dl>
      <footer>
        {tournament.registration && <span>Registered · {tournament.registration.participationMode}</span>}
        <button type="button" className="tournament-underline-action" onClick={open}>Open tournament</button>
      </footer>
    </article>
  );
}

function Detail({ detail, reload }: { detail: TournamentDetail; reload: () => Promise<void> }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<string>(detail.type === "DSA" ? "Solo" : detail.mode === "Team" ? "Auto Team" : "Solo");
  const [teamCode, setTeamCode] = useState("");
  const [preferredRole, setPreferredRole] = useState("");
  const [availability, setAvailability] = useState("");
  const [questionId, setQuestionId] = useState(detail.questions[0]?.id || "");
  const selectedQuestion = detail.questions.find((item) => item.id === questionId) || detail.questions[0];
  const [language, setLanguage] = useState(selectedQuestion?.allowedLanguages[0] || "");
  const [code, setCode] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState(detail.projectSubmission?.repositoryUrl || "");
  const [deploymentUrl, setDeploymentUrl] = useState(detail.projectSubmission?.deploymentUrl || "");
  const [demoVideoUrl, setDemoVideoUrl] = useState(detail.projectSubmission?.demoVideoUrl || "");
  const [notes, setNotes] = useState(detail.projectSubmission?.notes || "");
  const [leaderboard, setLeaderboard] = useState<TournamentLeaderboardRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const isRegistrationOpen = detail.effectiveStatus === "Registration_Open";
  const isLive = detail.effectiveStatus === "Live";

  useEffect(() => {
    let timer = 0;
    const handleRealtime = (event: Event) => {
      const detailEvent = (event as CustomEvent<{ type?: string; entityId?: string }>).detail;
      if (!detailEvent?.type?.startsWith("tournaments.") || detailEvent.entityId !== detail.id) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void reload(); }, 250);
    };
    window.addEventListener("devarena:realtime-event", handleRealtime);
    return () => { window.clearTimeout(timer); window.removeEventListener("devarena:realtime-event", handleRealtime); };
  }, [detail.id, reload]);

  useEffect(() => {
    if (!selectedQuestion) return;
    if (!selectedQuestion.allowedLanguages.includes(language)) setLanguage(selectedQuestion.allowedLanguages[0] || "");
  }, [selectedQuestion, language]);

  async function act(action: () => Promise<unknown>, success: string) {
    setBusy(true); setMessage("");
    try { await action(); setMessage(success); await reload(); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Request failed."); }
    finally { setBusy(false); }
  }

  async function loadLeaderboard() {
    setBusy(true); setMessage("");
    try { setLeaderboard(await TournamentApi.leaderboard(detail.id)); }
    catch (reason) { setMessage(reason instanceof Error ? reason.message : "Leaderboard could not be loaded."); }
    finally { setBusy(false); }
  }

  return (
    <main className="tournaments-page tournament-detail-page">
      <button type="button" className="tournament-back tournament-underline-action dev-back-button" onClick={() => navigate("/tournaments")}><span aria-hidden="true">←</span><span>Back</span></button>
      <header className="tournament-detail-hero page-reveal">
        <p>{detail.type} tournament / {detail.mode}</p>
        <h1>{detail.title}</h1>
        <span>{detail.description}</span>
        <div className="tournament-detail-meta">
          <b>{detail.effectiveStatus.replaceAll("_", " ")}</b>
          <span>{isLive ? "Ends in" : "Starts in"} <Countdown until={isLive ? detail.endsAt : detail.startsAt} /></span>
          <span>{detail._count.registrations} registered</span>
        </div>
      </header>

      {message && <div className="tournament-message" role="status">{message}</div>}

      <section className="tournament-detail-grid">
        <article className="tournament-panel page-reveal" style={{ "--reveal-order": 1 } as CSSProperties}>
          <p className="tournament-eyebrow">Rules and format</p>
          <h2>Competition brief</h2>
          <div className="tournament-rich-text">{detail.rules}</div>
          {detail.theme && <><h3>Theme</h3><p>{detail.theme}</p></>}
          {detail.requiredFeatures && <><h3>Required features</h3><p>{detail.requiredFeatures}</p></>}
          <dl className="tournament-facts">
            <div><dt>Registration closes</dt><dd>{formatDate(detail.registrationClosesAt)}</dd></div>
            <div><dt>Ends</dt><dd>{formatDate(detail.endsAt)}</dd></div>
            <div><dt>Allowed languages</dt><dd>{detail.allowedLanguages.join(", ") || "Any"}</dd></div>
            <div><dt>Team size</dt><dd>{detail.type === "DSA" ? "Solo" : `${detail.teamSizeMin}–${detail.teamSizeMax}`}</dd></div>
          </dl>
        </article>

        <article className="tournament-panel page-reveal" style={{ "--reveal-order": 2 } as CSSProperties}>
          <p className="tournament-eyebrow">Registration</p>
          <h2>{detail.registration ? "You are registered" : "Enter the arena"}</h2>
          {detail.registration ? (
            <div className="tournament-registration-summary">
              <strong>{detail.registration.participationMode}</strong>
              <span>Status: {detail.registration.status}</span>
              {detail.registration.team && <>
                <span>Team: {detail.registration.team.name}</span>
                <span>Join code: {detail.registration.team.joinCode}</span>
                <ul>{detail.registration.team.members.map((member) => <li key={member.user.id}>@{member.user.username}</li>)}</ul>
              </>}
            </div>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); void act(() => TournamentApi.register(detail.id, { participationMode: mode, teamCode, preferredRole, availability }), "Tournament registration completed."); }}>
              {detail.type === "Project" && detail.mode !== "Solo" && <label>
                <span>Participation</span>
                <AnimatedSelect value={mode} onChange={setMode} options={participationModes.filter((item) => detail.mode === "Both" || item !== "Solo").map((item) => ({ value: item, label: item }))} />
              </label>}
              {mode === "Existing Team" && <label><span>Team code</span><input value={teamCode} onChange={(event) => setTeamCode(event.target.value)} /></label>}
              {mode !== "Solo" && <label><span>Preferred role</span><input value={preferredRole} onChange={(event) => setPreferredRole(event.target.value)} placeholder="Frontend, backend, AI/ML…" /></label>}
              <label><span>Availability</span><input value={availability} onChange={(event) => setAvailability(event.target.value)} placeholder="Evenings, weekends, 8–12 hours…" /></label>
              <button className="tournament-underline-action" type="submit" disabled={!isRegistrationOpen || busy}>{busy ? "Registering…" : "Register"}</button>
              {!isRegistrationOpen && <small>Registration is not currently open.</small>}
            </form>
          )}
        </article>
      </section>

      {detail.announcements.length > 0 && <section className="tournament-announcements">
        <header><p>Live updates</p><h2>Announcements</h2></header>
        {detail.announcements.map((item) => <article key={item.id}><span>{formatDate(item.createdAt)}</span><h3>{item.title}</h3><p>{item.message}</p></article>)}
      </section>}

      {detail.type === "DSA" && detail.registration && <section className="tournament-workspace">
        <header><p>DSA arena</p><h2>Questions and submissions</h2></header>
        {!isLive && detail.questions.length === 0 ? <p>Questions unlock when the tournament goes live.</p> : <div className="tournament-dsa-layout">
          <aside>{detail.questions.map((question) => <button key={question.id} className={question.id === selectedQuestion?.id ? "active" : ""} type="button" onClick={() => setQuestionId(question.id)}><span>{question.difficulty}</span><strong>{question.title}</strong><small>{question.points} pts</small></button>)}</aside>
          {selectedQuestion && <article className="tournament-question">
            <p>{selectedQuestion.difficulty} / {selectedQuestion.points} points</p>
            <h3>{selectedQuestion.title}</h3>
            <div className="tournament-rich-text">{selectedQuestion.statement}</div>
            {selectedQuestion.inputFormat && <><h4>Input</h4><p>{selectedQuestion.inputFormat}</p></>}
            {selectedQuestion.outputFormat && <><h4>Output</h4><p>{selectedQuestion.outputFormat}</p></>}
            {selectedQuestion.constraints && <><h4>Constraints</h4><p>{selectedQuestion.constraints}</p></>}
            <StructuredCases title="Examples" data={selectedQuestion.examples} />
            <StructuredCases title="Visible test cases" data={selectedQuestion.visibleTestCases} />
            <form onSubmit={(event) => { event.preventDefault(); void act(() => TournamentApi.submitDsa(detail.id, { questionId: selectedQuestion.id, language, code }), "Code submitted for judging."); }}>
              <label><span>Language</span><AnimatedSelect value={language} onChange={setLanguage} options={selectedQuestion.allowedLanguages.map((item) => ({ value: item, label: item }))} /></label>
              <label><span>Code</span><textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} /></label>
              <button className="tournament-underline-action" type="submit" disabled={!isLive || busy || code.trim().length < 10}>Submit code</button>
            </form>
          </article>}
        </div>}
      </section>}

      {detail.type === "Project" && detail.registration && <section className="tournament-workspace">
        <header><p>Project arena</p><h2>GitHub submission</h2><span>Connect the tournament repository early to capture a baseline, then submit the final state before the deadline.</span></header>
        <form className="tournament-project-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void act(() => TournamentApi.saveProject(detail.id, { repositoryUrl, deploymentUrl, demoVideoUrl, notes, finalize: false }), "Repository baseline saved."); }}>
          <label><span>GitHub repository</span><input type="url" required value={repositoryUrl} onChange={(event) => setRepositoryUrl(event.target.value)} placeholder="https://github.com/owner/repository" /></label>
          <label><span>Deployment URL</span><input type="url" value={deploymentUrl} onChange={(event) => setDeploymentUrl(event.target.value)} /></label>
          <label><span>Demo video URL</span><input type="url" value={demoVideoUrl} onChange={(event) => setDemoVideoUrl(event.target.value)} /></label>
          <label className="wide"><span>Submission notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <div className="wide tournament-form-actions">
            <button className="tournament-underline-action" type="submit" disabled={busy}>Save repository baseline</button>
            <button className="tournament-underline-action" type="button" disabled={busy || !isLive} onClick={() => void act(() => TournamentApi.saveProject(detail.id, { repositoryUrl, deploymentUrl, demoVideoUrl, notes, finalize: true }), "Final project submitted for judging.")}>Submit final project</button>
          </div>
        </form>
      </section>}

      <section className="tournament-leaderboard-section">
        <header><div><p>Tournament standings</p><h2>Leaderboard</h2></div><button type="button" className="tournament-underline-action" onClick={() => void loadLeaderboard()} disabled={busy}>Refresh standings</button></header>
        {leaderboard.length === 0 ? <p>Load the live standings when submissions begin.</p> : <div className="tournament-leaderboard-list">{leaderboard.map((entry) => {
          const identity = entry.submission?.team?.name || entry.team?.name || entry.submission?.user?.username || entry.user?.username || "Participant";
          const subtitle = entry.submission?.team ? `${entry.submission.team.members?.length || 0} team members` : entry.participationMode || entry.user?.rank || "Solo";
          return <article key={`${entry.rank}-${identity}`} className={entry.isCurrentUser ? "current" : ""}>
            <strong>#{entry.rank}</strong><div><h3>{identity.startsWith("@") ? identity : entry.submission?.team || entry.team ? identity : `@${identity}`}</h3><span>{subtitle}</span></div>
            <b>{Number(entry.score || 0).toFixed(2)} pts</b>{typeof entry.solved === "number" && <small>{entry.solved} solved · {entry.penalty || 0} penalty</small>}
          </article>;
        })}</div>}
      </section>
    </main>
  );
}

export default function Tournaments() {
  const { tournamentId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TournamentTab>("Upcoming");
  const [items, setItems] = useState<TournamentSummary[]>([]);
  const [detail, setDetail] = useState<TournamentDetail | null>(null);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<TournamentLeaderboardGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadList() {
    setLoading(true); setError("");
    try {
      if (tab === "Leaderboard") {
        setGlobalLeaderboard(await TournamentApi.globalLeaderboard());
        setItems([]);
      } else {
        setItems(await TournamentApi.list(tab));
        setGlobalLeaderboard([]);
      }
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Tournaments could not be loaded."); }
    finally { setLoading(false); }
  }

  async function loadDetail() {
    if (!tournamentId) return;
    setLoading(true); setError("");
    try { setDetail(await TournamentApi.detail(tournamentId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Tournament could not be loaded."); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (tournamentId) void loadDetail(); else void loadList(); }, [tournamentId, tab]);
  const counts = useMemo(() => ({ total: items.length, dsa: items.filter((item) => item.type === "DSA").length, project: items.filter((item) => item.type === "Project").length }), [items]);

  if (tournamentId && detail) return <Detail detail={detail} reload={loadDetail} />;

  return <main className="tournaments-page">
    <header className="tournaments-hero page-reveal">
      <p>Competitive developer arena</p>
      <h1>Tournaments</h1>
      <span>Compete solo in DSA or build alone and in Tech Stack-matched teams with verified GitHub evidence.</span>
      <dl><div><dt>Visible now</dt><dd>{counts.total}</dd></div><div><dt>DSA</dt><dd>{counts.dsa}</dd></div><div><dt>Project</dt><dd>{counts.project}</dd></div></dl>
    </header>
    <nav className="tournament-tabs" aria-label="Tournament filters">{tabs.map((item) => <button type="button" key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>
    {error && <div className="tournament-message" role="alert">{error}</div>}
    {loading ? <section className="tournament-loading">Loading tournament arena…</section> : tab === "Leaderboard" ? (
      globalLeaderboard.length === 0 ? <section className="tournament-empty"><p>No tournament standings yet.</p><span>Live and completed standings will appear here after valid submissions are scored.</span></section> :
      <section className="tournament-global-leaderboards">{globalLeaderboard.map((group) => <article className="tournament-panel" key={group.id}>
        <header><div><p>{group.type} / {group.effectiveStatus.replaceAll("_", " ")}</p><h2>{group.title}</h2></div><button type="button" className="tournament-underline-action" onClick={() => navigate(`/tournaments/${group.id}`)}>Open tournament</button></header>
        {group.rows.length === 0 ? <p>No scored submissions yet.</p> : <div className="tournament-leaderboard-list">{group.rows.map((row) => { const team = row.team || row.submission?.team; const user = row.user || row.submission?.user || undefined; return <article key={`${group.id}-${row.rank}-${user?.id || team?.id}`} className={row.isCurrentUser ? "current" : ""}><strong>#{row.rank}</strong><div><h3>{team?.name || `@${user?.username || "participant"}`}</h3><span>{user?.rank || row.participationMode || (group.leaderboardFrozen ? "Frozen standing" : "Tournament participant")}</span></div><b>{row.score.toFixed(2)} pts</b>{row.arenaPointsAwarded ? <small>+{row.arenaPointsAwarded} Arena</small> : null}</article>; })}</div>}
      </article>)}</section>
    ) : items.length === 0 ? <section className="tournament-empty"><p>No tournaments in this view yet.</p><span>Published competitions will appear here automatically.</span></section> : <section className="tournament-card-grid">{items.map((item) => <TournamentCard key={item.id} tournament={item} open={() => navigate(`/tournaments/${item.id}`)} />)}</section>}
  </main>;
}
