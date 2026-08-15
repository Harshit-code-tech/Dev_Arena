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
      "Open your profile from the account menu, update the available fields, and save the changes. Your updated information will appear across DevArena after the save completes.",
  },
  {
    question: "How is my activity streak calculated?",
    answer:
      "Your streak increases when qualifying development activity is recorded on consecutive days. Missing a qualifying day ends the active streak and begins a new one the next time activity is logged.",
  },
  {
    question: "How can I improve the security of my account?",
    answer:
      "Use a unique password, protect your email account, and never share the one-time code required for email-password signup or login.",
  },
  {
    question: "Why is recent activity not appearing on my dashboard?",
    answer:
      "Refresh the dashboard and confirm that the activity was saved successfully. A slow connection can delay synchronization. Include the activity type and time in a support message if it remains missing.",
  },
  {
    question: "How do I report inappropriate community activity?",
    answer:
      "Use the support form and include the relevant username, page, and a clear description of the issue. Avoid sharing passwords, private keys, or other sensitive credentials.",
  },
  {
    question: "What information should I include when reporting a problem?",
    answer:
      "Include the page name, the steps that caused the issue, what you expected, what actually happened, and the browser or device you were using. Screenshots can also help the team reproduce the problem.",
  },
];

function Support() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const handleSubmit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();

    if (!name.trim() || !email.trim() || !message.trim()) {
      setStatusMessage("Please fill in every field before sending.");
      return;
    }

    setName("");
    setEmail("");
    setMessage("");
    setStatusMessage(
      "✅ Your message has been received. Our team will review it shortly.",
    );
  };

  return (
    <main className="support-page">
      <div className="support-wrap">
        <header className="support-header">
          <h1>How can we help?</h1>
          <p>
            Browse frequently asked questions or contact the DevArena team
            directly.
          </p>
        </header>

        <div className="support-content-grid">
          <section className="support-faq-panel" aria-labelledby="faq-heading">
            <div className="support-panel-heading">
              <span className="eyebrow">Frequently asked questions</span>
              <h2 id="faq-heading">Find an answer</h2>
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
              <span className="eyebrow">Direct support</span>
              <h2>Contact DevArena Support</h2>
              <p>Our team usually responds within 24 hours.</p>
              <p>
                Share the issue, feature request, or question you want help with.
              </p>
            </div>

            <label>
              <span>Your name</span>
              <input
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label>
              <span>Your email</span>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>

            <label>
              <span>How can we help?</span>
              <textarea
                maxLength={1000}
                placeholder="Describe your issue..."
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </label>

            <div className="message-footer">
              <span>{message.length}/1000</span>
            </div>

            <div className="contact-actions">
              <button type="submit">Send message</button>
              {statusMessage && <span>{statusMessage}</span>}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default Support;
