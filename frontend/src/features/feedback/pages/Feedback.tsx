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
      toast.success("Feedback submitted. Thank you for improving DevArena.");
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
        <p>Support &amp; feedback</p>
        <h1>Tell us what went wrong.</h1>
        <span>Your report is linked to your signed-in account so the DevArena team can investigate it.</span>
      </header>
      <form className="feedback-card page-reveal" style={{ "--reveal-order": 1 } as CSSProperties} onSubmit={submit}>
        <div className="feedback-field">
          <label>What feature went wrong?</label>
          <AnimatedSelect
            value={feature}
            onChange={setFeature}
            ariaLabel="Choose the affected DevArena feature"
            searchable
            options={FEEDBACK_FEATURES.map((item) => ({ label: item, value: item }))}
          />
        </div>
        <label className="feedback-textarea">
          <span>Your feedback</span>
          <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={4000} placeholder="Describe what happened, what you expected, and any steps that reproduce the issue." />
          <small>{feedback.length}/4000</small>
        </label>
        <button className="feedback-submit" type="submit" disabled={sending || !feature || feedback.trim().length < 10}>
          {sending ? "Submitting…" : "Submit feedback"}
        </button>
      </form>
    </main>
  );
}
