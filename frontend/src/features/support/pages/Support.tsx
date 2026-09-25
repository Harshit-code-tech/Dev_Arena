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
      "Head to your profile from the account menu, polish up your bio, and hit save. Just don't claim you're a 10x engineer with 20 years of Rust experience if you just learned console.log.",
  },
  {
    question: "How is my activity streak calculated?",
    answer:
      "Show up every single day and log real code or problem solving. Miss a day? Your streak resets to zero. No exceptions, no mercy, no backdating to save face.",
  },
  {
    question: "How can I improve the security of my account?",
    answer:
      "Use a real password, don't use 'password123', and never ever share your OTP verification code with anyone — not even if they claim they're Linus Torvalds.",
  },
  {
    question: "Why is recent activity not appearing on my dashboard?",
    answer:
      "First, hit refresh and check your internet connection before accusing our database of theft. If you actually logged real work and it vanished, scream at us through the contact form.",
  },
  {
    question: "How do I report inappropriate community activity?",
    answer:
      "Use the report button on the offending player's profile or post. We tolerate friendly trash talk and healthy rivalries, but real toxicity gets booted out of the Arena real fast.",
  },
  {
    question: "What should I include when reporting a bug?",
    answer:
      "Don't just say 'it's broken'. Tell us what page you were on, what you clicked, what exploded, and what browser you're using. Help us help you!",
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
      setStatusMessage("Fill in every field first! We can't read your mind (yet).");
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
      setStatusMessage("Message launched into our inbox! We'll look into it before you can say 'it worked on my machine'.");
    } catch (error: unknown) {
      setFormStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Something exploded on our end. Try again in a second!");
    }
  };

  return (
    <main className="support-page">
      <div className="support-wrap">
        <header className="support-header">
          <h1>Stuck? Broken code? Skill issue? We got you.</h1>
          <p>
            Browse the FAQs below or contact the DevArena crew directly.
          </p>
        </header>

        <div className="support-content-grid">
          <section className="support-faq-panel" aria-labelledby="faq-heading">
            <div className="support-panel-heading">
              <span className="eyebrow">Frequently asked (and occasionally dumb) questions</span>
              <h2 id="faq-heading">Answers to your existential questions</h2>
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
              <span className="eyebrow">Direct Line</span>
              <h2>Roast us, complain, or report bugs</h2>
              <p>Our crew usually responds within 24 hours (or whenever we finish debugging).</p>
              <p>
                Drop your bug, feature request, or rant below.
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
                placeholder="Tell us what broke, who hurt you, or what feature we need to build..."
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
                  {formStatus === "loading" ? "Firing message…" : "Launch message 🚀"}
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
                  {formStatus === "success" ? "✅ " : "⚠ "}
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
