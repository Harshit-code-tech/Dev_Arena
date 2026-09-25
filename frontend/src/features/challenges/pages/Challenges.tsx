import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import {
  getActiveCompetition,
  getCompetitionResults,
  refreshActiveCompetition,
  submitCode,
  type ActiveCompetition,
  type CompetitionResultEntry,
  type CompetitionResults,
  type CompetitionTask,
  type UserSubmission,
} from "../../../services/ChallengeService";
import { apiRequest } from "../../../services/ApiClient";
import "../styles/Challenges.css";

const LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "C++",
  "C",
  "Go",
  "Rust",
  "C#",
  "Ruby",
  "Kotlin",
  "Swift",
] as const;

function formatDeadline(dateStr: string | null) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const now = Date.now();
  const diff = date.getTime() - now;
  if (diff <= 0) return "Closed";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h remaining`;
  return `${hours}h ${minutes}m remaining`;
}

// ── AI Hint ──────────────────────────────────────────────────────

function AiHintSection({ taskId, canSubmit }: { taskId: string; canSubmit: boolean }) {
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  if (!canSubmit) return null;

  const fetchHint = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const data = await apiRequest<{ hint: string }>("/api/challenge/hint", {
        method: "POST",
        body: JSON.stringify({ taskId }),
      });
      setHint(data.hint);
      setVisible(true);
    } catch {
      toast.error("The AI is too scared to help right now. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="challenge-hint-container">
      <button
        type="button"
        className="challenge-hint-btn"
        onClick={() => void fetchHint()}
        disabled={loading}
      >
        {loading ? "Consulting the oracle..." : hint ? "🔄 Get Another Hint" : "💡 Get AI Hint"}
      </button>
      {visible && hint && (
        <div className="challenge-hint-box">
          <span className="challenge-hint-label">✨ AI Hint (Gemini)</span>
          <p>{hint}</p>
          <button
            type="button"
            className="challenge-hint-dismiss"
            onClick={() => setVisible(false)}
          >
            dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// ── Task card ────────────────────────────────────────────────────

function TaskCard({
  task,
  competitionStatus,
  onSubmitted,
}: {
  task: CompetitionTask;
  competitionStatus: string;
  onSubmitted: (taskId: string, submission: UserSubmission) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<string>(LANGUAGES[0]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = competitionStatus === "Active";

  const handleSubmit = async () => {
    if (!code.trim()) {
      toast.error("You can't submit invisible code, genius. Type something in first!");
      return;
    }

    try {
      setSubmitting(true);
      const submission = await submitCode(task.id, code, language);
      toast.success("Code flung into the grader! Praying for your test cases... 🙏");
      onSubmitted(task.id, submission);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="challenge-task-card">
      <div
        className="challenge-task-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="challenge-task-meta">
          <span className="challenge-task-badge" data-type={task.type}>{task.type}</span>
          <h3>{task.title}</h3>
          <span className="challenge-task-difficulty">{task.difficulty}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="challenge-task-weight">{task.weightPercentage}% of score</span>
          {task.userSubmission && (
            <span
              className="challenge-status-tag"
              data-status={task.userSubmission.status}
            >
              {task.userSubmission.status}
            </span>
          )}
          <span style={{ fontSize: 18, opacity: .4 }}>{expanded ? "▾" : "▸"}</span>
        </div>
      </div>

      {expanded && (
        <div className="challenge-task-body">
          <p className="challenge-task-description">{task.description}</p>

          {task.sampleTestCases.length > 0 && (
            <div className="challenge-sample-tests">
              <h4>Sample Test Cases</h4>
              {task.sampleTestCases.map((tc, i) => (
                <div key={i} className="challenge-test-case">
                  <pre>{tc.input}</pre>
                  <pre>{tc.expectedOutput}</pre>
                </div>
              ))}
            </div>
          )}

          {task.timeLimitMs && (
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginBottom: 16 }}>
              Time limit: {task.timeLimitMs}ms
              {task.memoryLimitMb ? ` · Memory limit: ${task.memoryLimitMb}MB` : ""}
            </p>
          )}

          {task.userSubmission && (
            <div className="challenge-submission-result">
              <article>
                <span>Status</span>
                <span className="challenge-status-tag" data-status={task.userSubmission.status}>
                  {task.userSubmission.status}
                </span>
              </article>
              <article>
                <span>Correctness</span>
                <strong>{task.userSubmission.correctness}%</strong>
              </article>
              <article>
                <span>Efficiency</span>
                <strong>{task.userSubmission.efficiency}%</strong>
              </article>
              <article>
                <span>Tests Passed</span>
                <strong>{task.userSubmission.testsPassed}/{task.userSubmission.testsTotal}</strong>
              </article>
            </div>
          )}

          {/* AI Hint — only visible when competition is Active */}
          <AiHintSection taskId={task.id} canSubmit={canSubmit} />

          {canSubmit && (
            <div className="challenge-submission-form">
              <label>
                Language
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </label>

              <label>
                Your Code
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Paste or write your solution here..."
                  spellCheck={false}
                />
              </label>

              <button
                type="button"
                className="challenge-submit-btn"
                onClick={() => void handleSubmit()}
                disabled={submitting || !code.trim()}
              >
                {submitting ? "Submitting..." : task.userSubmission ? "Resubmit" : "Submit Solution"}
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ── Results leaderboard ──────────────────────────────────────────

function positionLabel(pos: number): string {
  if (pos === 1) return "🥇";
  if (pos === 2) return "🥈";
  if (pos === 3) return "🥉";
  return `#${pos}`;
}

function ResultsPanel({ competitionId }: { competitionId?: string }) {
  const [results, setResults] = useState<CompetitionResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getCompetitionResults()
      .then((data) => { if (mounted) setResults(data); })
      .catch(() => { if (mounted) toast.error("Could not load results."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [competitionId]);

  if (loading) {
    return (
      <section className="challenges-results-loading">
        <span>Tallying the carnage...</span>
      </section>
    );
  }

  if (!results || results.results.length === 0) {
    return (
      <section className="challenges-empty">
        <span className="challenges-empty-icon" aria-hidden="true">📊</span>
        <h2>No Results Yet</h2>
        <p>Results will appear here once the competition is evaluated. Check back after submissions close.</p>
      </section>
    );
  }

  const renderRow = (entry: CompetitionResultEntry) => (
    <tr
      key={entry.userId}
      className={`challenge-results-row${entry.isCurrentUser ? " challenge-results-row--you" : ""}`}
    >
      <td className="challenge-results-pos">{positionLabel(entry.position)}</td>
      <td className="challenge-results-player">
        <div className="challenge-results-avatar">
          {entry.avatarUrl && !entry.useInitials
            ? <img src={entry.avatarUrl} alt={entry.name} />
            : <span>{entry.name.charAt(0).toUpperCase()}</span>}
        </div>
        <div>
          <strong>{entry.name}</strong>
          {entry.isCurrentUser && <span className="challenge-results-you-tag"> (you)</span>}
          <span className="challenge-results-rank-label">{entry.rank}</span>
        </div>
      </td>
      <td className="challenge-results-score">{entry.score.toFixed(1)}</td>
      <td>{entry.correctness.toFixed(1)}%</td>
      <td>{entry.problemsSolved}</td>
      <td>{entry.efficiency.toFixed(1)}%</td>
      <td>{entry.completionTime != null ? `${entry.completionTime}m` : "—"}</td>
    </tr>
  );

  return (
    <section className="challenges-results page-reveal">
      <header className="challenges-results-header">
        <h2>{results.competition.title}</h2>
        <span className="challenges-status-pill" data-status={results.competition.status}>
          {results.competition.status}
        </span>
      </header>

      {results.currentUser && (
        <div className="challenges-results-you-card">
          <span>Your position</span>
          <strong>{positionLabel(results.currentUser.position)}</strong>
          <span>Score: {results.currentUser.score.toFixed(1)} · Solved: {results.currentUser.problemsSolved} · Correctness: {results.currentUser.correctness.toFixed(1)}%</span>
        </div>
      )}

      <div className="challenges-results-table-wrap">
        <table className="challenges-results-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Score</th>
              <th>Correctness</th>
              <th>Solved</th>
              <th>Efficiency</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {results.results.map(renderRow)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Main page ────────────────────────────────────────────────────

type Tab = "competition" | "results";

export default function Challenges() {
  const [competition, setCompetition] = useState<ActiveCompetition | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("competition");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const PENDING_STATUSES = new Set(["Pending", "Evaluating"]);

  function hasPendingSubmission(comp: ActiveCompetition | null | undefined): boolean {
    if (!comp) return false;
    return comp.tasks.some((t) => t.userSubmission && PENDING_STATUSES.has(t.userSubmission.status));
  }

  // Poll every 3s while any submission is Pending or Evaluating (Piston running)
  useEffect(() => {
    if (!competition || !hasPendingSubmission(competition)) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) return; // already polling

    pollRef.current = setInterval(() => {
      refreshActiveCompetition()
        .then((fresh) => {
          if (!fresh) return;
          setCompetition((prev) => {
            if (!prev) return fresh;
            // Merge fresh submission statuses into current state
            return {
              ...prev,
              tasks: prev.tasks.map((task) => {
                const freshTask = fresh.tasks.find((ft) => ft.id === task.id);
                if (!freshTask) return task;
                return { ...task, userSubmission: freshTask.userSubmission };
              }),
            };
          });
          if (!hasPendingSubmission(fresh)) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            toast.success("Results in! Check your submission status 🔥");
          }
        })
        .catch(() => { /* silently ignore poll errors */ });
    }, 3000);

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [competition]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await getActiveCompetition();
        if (mounted) setCompetition(data);
      } catch (error) {
        console.error(error);
        toast.error("Could not load competition data.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();

    return () => { mounted = false; };
  }, []);

  const handleSubmitted = (taskId: string, submission: UserSubmission) => {
    setCompetition((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId ? { ...task, userSubmission: submission } : task,
        ),
      };
    });
  };

  if (loading) return <PageLoader />;

  if (!competition) {
    return (
      <main className="challenges-page animated-page">
        <header className="challenges-hero page-reveal">
          <div>
            <p>Gladiator Arena / Speed &amp; Brains</p>
            <h1>Challenges</h1>
            <span>Where algorithms fight, memory limits destroy dreams, and only the fastest survive.</span>
          </div>
        </header>

        {/* Show results tab even when no active competition */}
        <div className="challenges-tabs page-reveal">
          <button
            type="button"
            className={`challenges-tab${tab === "competition" ? " challenges-tab--active" : ""}`}
            onClick={() => setTab("competition")}
          >
            Competition
          </button>
          <button
            type="button"
            className={`challenges-tab${tab === "results" ? " challenges-tab--active" : ""}`}
            onClick={() => setTab("results")}
          >
            Results
          </button>
        </div>

        {tab === "competition" ? (
          <section className="challenges-empty page-reveal">
            <span className="challenges-empty-icon" aria-hidden="true">⚔️</span>
            <h2>The Arena is Quiet... Too Quiet.</h2>
            <p>
              No live wars this week. Sharpen your algorithms, hydrate, and prep your fingers for the next bloodbath. Check back soon!
            </p>
          </section>
        ) : (
          <ResultsPanel />
        )}
      </main>
    );
  }

  const deadline = formatDeadline(competition.closesAt);
  const isCompleted = competition.status === "Completed" || competition.status === "Evaluating";

  return (
    <main className="challenges-page animated-page">
      <header className="challenges-hero page-reveal">
        <div>
          <p>Gladiator Arena / Speed &amp; Brains</p>
          <h1>{competition.title}</h1>
          <span>Compete with objective, standardized tasks. Your rank is determined by correctness, efficiency, and speed.</span>
        </div>
        <span className="challenges-status-pill" data-status={competition.status}>
          {competition.status}
        </span>
      </header>

      {/* Tabs — Results always available when competition exists */}
      <div className="challenges-tabs page-reveal">
        <button
          type="button"
          className={`challenges-tab${tab === "competition" ? " challenges-tab--active" : ""}`}
          onClick={() => setTab("competition")}
        >
          Competition
        </button>
        <button
          type="button"
          className={`challenges-tab${tab === "results" ? " challenges-tab--active" : ""}`}
          onClick={() => setTab("results")}
        >
          Results
          {isCompleted && <span className="challenges-tab-dot" />}
        </button>
      </div>

      {tab === "competition" ? (
        <>
          {deadline && (
            <div className="challenges-deadline-bar page-reveal">
              <span>Submission deadline</span>
              <strong>{deadline}</strong>
            </div>
          )}

          <section className="challenges-task-list page-reveal">
            {competition.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                competitionStatus={competition.status}
                onSubmitted={handleSubmitted}
              />
            ))}
          </section>
        </>
      ) : (
        <ResultsPanel competitionId={competition.id} />
      )}
    </main>
  );
}
