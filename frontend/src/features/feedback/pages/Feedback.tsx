import { useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import AnimatedSelect from "../../../shared/components/AnimatedSelect";
import { FEEDBACK_FEATURES, submitFeedback } from "../../../services/FeedbackService";
import "../styles/Feedback.css";

export default function Feedback() {
  const navigate = useNavigate();
  const [feature, setFeature] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!feature || feedback.trim().length < 10) return;
    try {
      setSending(true);
      await submitFeedback({ feature, feedback: feedback.trim() });
      toast.success("Feedback launched! Thanks for keeping us honest (or roasting our bugs).");
      setFeedback("");
      setFeature("");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Feedback could not be submitted.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="feedback-page animated-page">
      <button type="button" className="feedback-back dev-back-button" onClick={() => navigate(-1)}><span aria-hidden="true">←</span><span>Back</span></button>
      <header className="feedback-hero page-reveal">
        <p>Bug Reports &amp; Petty Complaints</p>
        <h1>Did something break, or is it user error?</h1>
        <span>Don't worry, we won't judge your code. Much.</span>
      </header>
      <form className="feedback-card page-reveal" style={{ "--reveal-order": 1 } as CSSProperties} onSubmit={submit}>
        <div className="feedback-field">
          <label>Which feature decided to misbehave?</label>
          <AnimatedSelect
            value={feature}
            onChange={setFeature}
            ariaLabel="Choose the affected DevArena feature"
            searchable
            options={FEEDBACK_FEATURES.map((item) => ({ label: item, value: item }))}
          />
        </div>
        <label className="feedback-textarea">
          <span>Spill the tea</span>
          <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={4000} placeholder="Describe what broke, what exploded, or how we ruined your day. Don't hold back..." />
          <small>{feedback.length}/4000</small>
        </label>
        <button className="feedback-submit" type="submit" disabled={sending || !feature || feedback.trim().length < 10}>
          {sending ? "Launching into the void…" : "Launch feedback 🚀"}
        </button>
      </form>
    </main>
  );
}
