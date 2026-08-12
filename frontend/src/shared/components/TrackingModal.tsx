import { createPortal } from "react-dom";
import { useEffect, useState, type ReactNode } from "react";

import "../styles/TrackingModal.css";

type TrackingModalProps = {
  open: boolean;
  eyebrow: string;
  title: string;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  children: ReactNode;
};

export default function TrackingModal({
  open,
  eyebrow,
  title,
  saving = false,
  error = null,
  onClose,
  children,
}: TrackingModalProps) {
  const [rendered, setRendered] = useState(open);
  const [active, setActive] = useState(false);

  useEffect(() => {
    let firstFrame = 0;
    let secondFrame = 0;
    let timer = 0;

    if (open) {
      setRendered(true);
      document.body.classList.add("tracking-modal-open");
      firstFrame = window.requestAnimationFrame(() => {
        secondFrame = window.requestAnimationFrame(() => setActive(true));
      });
    } else if (rendered) {
      setActive(false);
      timer = window.setTimeout(() => {
        setRendered(false);
        document.body.classList.remove("tracking-modal-open");
      }, 520);
    }

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(timer);
    };
  }, [open, rendered]);

  useEffect(() => {
    if (!rendered) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, rendered, saving]);

  useEffect(() => () => document.body.classList.remove("tracking-modal-open"), []);

  if (!rendered) return null;

  return createPortal(
    <div
      className={`tracking-modal-overlay${active ? " active" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="tracking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tracking-modal-title"
      >
        <header className="tracking-modal-header">
          <div>
            <p>{eyebrow}</p>
            <h2 id="tracking-modal-title">{title}</h2>
          </div>
          <button
            type="button"
            className="tracking-modal-close"
            onClick={onClose}
            disabled={saving}
            aria-label="Close form"
          >
            ×
          </button>
        </header>
        <div className="tracking-modal-body">
          {error && <div className="tracking-modal-error" role="alert">{error}</div>}
          {children}
        </div>
      </section>
    </div>,
    document.body,
  );
}
