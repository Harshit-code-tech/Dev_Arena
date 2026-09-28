import { useState } from "react";
import type { SubmitEventHandler } from "react";
import "../styles/Support.css";

type FaqItem = {
  question: string;
  answer: string;
};

const faqs: FaqItem[] = [
  {
    question: "How do I update my profile information?",
    answer:
      "Open your profile from the account menu, update the information you want to share, and save your changes.",
  },
  {
    question: "How is my activity streak calculated?",
    answer:
      "Your streak reflects consecutive days with eligible recorded activity. If a day has no qualifying activity, the streak restarts from your next active day.",
  },
  {
    question: "How can I improve the security of my account?",
    answer:
      "Use a strong, unique password and never share verification codes or account credentials with anyone.",
  },
  {
    question: "Why is recent activity not appearing on my dashboard?",
    answer:
      "Refresh the page and confirm your internet connection first. If verified activity is still missing, contact support with the activity type and approximate time it was recorded.",
  },
  {
    question: "How do I report inappropriate community activity?",
    answer:
      "Use the report button on the relevant player profile or community post. Reports are reviewed for harassment, abuse, spam, and other violations of the community rules.",
  },
  {
    question: "What should I include when reporting a bug?",
    answer:
      "Include the page, the action you took, what you expected, what actually happened, and the browser or device you were using. Clear reproduction steps help us investigate faster.",
  },
];

type FormStatus = "idle" | "loading" | "success" | "error";

function Support() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [formStatus, setFormStatus] = useState<FormStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setFormStatus("error");
      setStatusMessage("Please complete every required field before submitting your message.");
      return;
    }

    setFormStatus("loading");
    setStatusMessage("");

    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() }),
      });

      const payload = (await response.json().catch(() => null)) as { success: boolean; message?: string } | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || "Failed to send your message. Please try again.");
      }

      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setFormStatus("success");
      setStatusMessage("Message received. Our support team will review it and follow up as soon as possible.");
    } catch (error: unknown) {
      setFormStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Something went wrong while sending your message. Please try again.");
    }
  };

  return (
    <main className="support-page">
      <div className="support-wrap">
        <header className="support-header">
          <h1>Need help with DevArena?</h1>
          <p>
            Browse common questions below or contact the DevArena support team directly.
          </p>
        </header>

        <div className="support-content-grid">
          <section className="support-faq-panel" aria-labelledby="faq-heading">
            <div className="support-panel-heading">
              <span className="eyebrow">Frequently asked questions</span>
              <h2 id="faq-heading">Practical answers and guidance</h2>
            </div>

            <div className="faq-list">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                const contentId = `faq-answer-${index}`;

                return (
                  <article
                    className={`faq-item ${isOpen ? "open" : ""}`}
                    key={faq.question}
                  >
                    <button
                      type="button"
                      className="faq-question"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      aria-expanded={isOpen}
                      aria-controls={contentId}
                    >
                      <span>{faq.question}</span>
                      <span className="faq-icon" aria-hidden="true">
                        ▾
                      </span>
                    </button>

                    {isOpen && (
                      <div
                        className="faq-content open"
                        id={contentId}
                        role="region"
                      >
                        <p>{faq.answer}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <form className="contact-box" onSubmit={handleSubmit}>
            <div>
              <span className="eyebrow">Contact support</span>
              <h2>Report an issue or share feedback</h2>
              <p>Our support team aims to respond within 24 hours.</p>
              <p>
                Send a bug report, feature request, account question, or other product feedback.
              </p>
            </div>

            <label>
              <span>Your name</span>
              <input
                type="text"
                placeholder="e.g. Linus Torvalds"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={formStatus === "loading" || formStatus === "success"}
              />
            </label>

            <label>
              <span>Your email</span>
              <input
                type="email"
                placeholder="your.actual@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={formStatus === "loading" || formStatus === "success"}
              />
            </label>

            <label>
              <span>Subject</span>
              <input
                type="text"
                placeholder="e.g. Bug report, Feature request, Account issue"
                maxLength={150}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                disabled={formStatus === "loading" || formStatus === "success"}
              />
            </label>

            <label>
              <span>How can we help?</span>
              <textarea
                maxLength={1000}
                placeholder="Describe the issue, question, or feature request with any useful context..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={formStatus === "loading" || formStatus === "success"}
              />
            </label>

            <div className="message-footer">
              <span>{message.length}/1000</span>
            </div>

            <div className="contact-actions">
              {formStatus !== "success" && (
                <button
                  type="submit"
                  disabled={formStatus === "loading"}
                  aria-busy={formStatus === "loading"}
                >
                  {formStatus === "loading" ? "Sending…" : "Send message"}
                </button>
              )}
              {statusMessage && (
                <span
                  className={
                    formStatus === "success"
                      ? "support-status support-status--success"
                      : "support-status support-status--error"
                  }
                  role="status"
                >

                  {statusMessage}
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default Support;
