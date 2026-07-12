import { useState } from "react";
import type { SubmitEventHandler } from "react";
import "../styles/Support.css";

type FaqItem = {
  question: string;
  answer: string;
};

const faqs: FaqItem[] = [
  {
    question: "How do I create a blog post?",
    answer:
      "Open the Blog page, choose Write a post, add your title and content, then publish it when you are ready.",
  },
  {
    question: "Where are my draft blogs saved?",
    answer:
      "Drafts are saved in your browser for now. You can open them from Blog > Drafts and continue editing later.",
  },
  {
    question: "Can I edit a draft before publishing?",
    answer:
      "Yes. Open the draft collection, select Edit, update the content, and publish or save the draft again.",
  },
  {
    question: "Why do my posts disappear in another browser?",
    answer:
      "The current version stores posts locally in your browser. A backend account system can sync posts across devices later.",
  },
  {
    question: "How do I report a problem?",
    answer:
      "Send a message from the support form with the page name, what happened, and what you expected to happen.",
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
    <div className="support-page">
      <div className="support-wrap">
        <div className="support-header">
          <h1>How can we help?</h1>
          <p>
            Browse frequently asked questions, manage your content, or contact
            the DevArena team directly.
          </p>
        </div>

        <div className="faq-list" aria-label="Frequently asked questions">
          {faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;

            return (
              <div
                className={`faq-item ${isOpen ? "open" : ""}`}
                key={faq.question}
              >
                <button
                  type="button"
                  className="faq-question"
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                >
                  <span>{faq.question}</span>
                  <span className="faq-icon">▾</span>
                </button>

                <div className={`faq-content ${isOpen ? "open" : ""}`}>
                  <p>{faq.answer}</p>
                </div>
              </div>
            );
          })}
        </div>

        <form className="contact-box" onSubmit={handleSubmit}>
          <div>
            <h2>Contact DevArena Support</h2>

            <p>Our team usually responds within 24 hours.</p>
            <p>
              Share the issue, feature request, or question you want help with.
            </p>
          </div>

          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />

          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <textarea
            maxLength={1000}
            placeholder="Describe your issue..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

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
  );
}

export default Support;
