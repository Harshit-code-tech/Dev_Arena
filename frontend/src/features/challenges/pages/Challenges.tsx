import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import {
  getActiveCompetition,
  submitCode,
  type ActiveCompetition,
  type CompetitionTask,
  type UserSubmission,
} from "../../../services/ChallengeService";
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
      toast.error("Please enter your code before submitting.");
      return;
    }

    try {
      setSubmitting(true);
      const submission = await submitCode(task.id, code, language);
      toast.success("Code submitted successfully!");
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

export default function Challenges() {
  const [competition, setCompetition] = useState<ActiveCompetition | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);

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
            <p>Weekly Competition / Challenge Engine</p>
            <h1>Challenges</h1>
            <span>Compete weekly with objective, standardized tasks.</span>
          </div>
        </header>

        <section className="challenges-empty page-reveal">
          <span className="challenges-empty-icon" aria-hidden="true">⚡</span>
          <h2>No Active Competition</h2>
          <p>
            There is no competition running this week. Competitions are published weekly
            and contain DSA, Development, and Debugging tasks. Check back soon!
          </p>
        </section>
      </main>
    );
  }

  const deadline = formatDeadline(competition.closesAt);

  return (
    <main className="challenges-page animated-page">
      <header className="challenges-hero page-reveal">
        <div>
          <p>Weekly Competition / Challenge Engine</p>
          <h1>{competition.title}</h1>
          <span>Compete with objective, standardized tasks. Your rank is determined by correctness, efficiency, and speed.</span>
        </div>
        <span className="challenges-status-pill" data-status={competition.status}>
          {competition.status}
        </span>
      </header>

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
    </main>
  );
}
