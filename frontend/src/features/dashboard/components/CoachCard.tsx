import { useEffect, useState } from "react";
import { apiRequest } from "../../../services/ApiClient";
import "../styles/CoachCard.css";

type CoachTone = "roast" | "motivational" | "strong";

interface CoachFeedback {
  message: string;
  tone: CoachTone;
  activeDays: number;
}

const TONE_CONFIG: Record<
  CoachTone,
  { modifier: string; icon: string; label: string }
> = {
  roast: {
    modifier: "coach-card--roast",
    icon: "💀",
    label: "AI Coach is cooking you",
  },
  motivational: {
    modifier: "coach-card--motivational",
    icon: "⚡",
    label: "AI Coach gives reluctant respect",
  },
  strong: {
    modifier: "coach-card--strong",
    icon: "🔥",
    label: "AI Coach is terrified of you",
  },
};

function CoachCard() {
  const [feedback, setFeedback] = useState<CoachFeedback | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiRequest<CoachFeedback>("/api/coach")
      .then((data) => { if (isMounted) setFeedback(data); })
      .catch(() => { /* silently skip if coach fails */ })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, []);

  if (loading || !feedback) return null;

  const config = TONE_CONFIG[feedback.tone] ?? TONE_CONFIG.motivational;

  return (
    <section
      className={`coach-card ${config.modifier}`}
      aria-label="AI Coach feedback"
    >
      <div className="coach-card-icon" aria-hidden="true">
        {config.icon}
      </div>
      <div className="coach-card-body">
        <p className="coach-card-label">
          {config.label}
          {" "}
          <span className="coach-card-days">
            · {feedback.activeDays} active {feedback.activeDays === 1 ? "day" : "days"} this week
          </span>
        </p>
        <p className="coach-card-message">"{feedback.message}"</p>
      </div>
    </section>
  );
}

export default CoachCard;
