import "../styles/QuickLogModal.css";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getStoredAuthToken } from "../../features/auth/api/AuthStorageService";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function QuickLogModal({ open, onClose }: Props) {
  const [activity, setActivity] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };

    document.body.classList.add("quicklog-open");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("quicklog-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open, saving]);

  if (!open) return null;

  const saveLog = async () => {
    setError("");
    if (!activity.trim()) {
      setError("Please enter a specific activity.");
      return;
    }

    const token = getStoredAuthToken();
    if (!token) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/dashboard/quick-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ activity: activity.trim() }),
      });
      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Failed to save activity.");
      }

      setSaved(true);
      toast.success("Activity Saved");
      window.dispatchEvent(new CustomEvent("devarena:activity-updated"));

      window.setTimeout(() => {
        setActivity("");
        setSaved(false);
        onClose();
      }, 620);
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Failed to save activity.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="quicklog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className={saved ? "quicklog-modal quicklog-modal-saved" : "quicklog-modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quicklog-title"
      >
        <div className="quicklog-kicker-row">
          <span>Quick Log</span>
          <button className="quicklog-close" type="button" onClick={onClose} disabled={saving} aria-label="Close quick log">×</button>
        </div>

        <div className="quicklog-intro">
          <p className="quicklog-step">01 / Capture the outcome</p>
          <h2 id="quicklog-title">What did you build today?</h2>
          <p>Record one specific result. Clear evidence creates a useful developer history and keeps your scoring honest.</p>
        </div>

        <div className="quicklog-signal-grid" aria-hidden="true">
          <span><strong>Specific</strong><small>One completed outcome</small></span>
          <span><strong>Meaningful</strong><small>Avoid vague bulk logs</small></span>
        </div>

        <label className="quicklog-field">
          <span>Activity</span>
          <textarea
            autoFocus
            maxLength={500}
            placeholder="Example: Implemented JWT refresh-token rotation and added three API tests."
            value={activity}
            onChange={(event) => { setError(""); setActivity(event.target.value); }}
          />
          <div className="quicklog-field-footer">
            <span className="quicklog-writing-track"><i style={{ width: `${Math.min(100, (activity.length / 120) * 100)}%` }} /></span>
            <small>{activity.length}/500</small>
          </div>
        </label>

        {error && <div className="quicklog-error" role="alert">{error}</div>}

        <button className="save-log-btn" onClick={() => void saveLog()} disabled={saving || saved}>
          {saved ? (
            <span className="quicklog-success"><i className="bx bx-check" aria-hidden="true" /> Saved</span>
          ) : saving ? (
            <span className="quicklog-loader" aria-label="Saving activity"><i /><i /><i /></span>
          ) : (
            "Save Activity"
          )}
        </button>
      </section>
    </div>,
    document.body,
  );
}
