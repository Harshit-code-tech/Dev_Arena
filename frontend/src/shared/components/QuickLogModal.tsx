import "../styles/QuickLogModal.css";
import { createPortal } from "react-dom";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { getStoredAuthToken } from "../../features/auth/api/AuthStorageService";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function QuickLogModal({ open, onClose }: Props) {
  if (!open) return null;
  const [activity, setActivity] = useState("");

  const [saving, setSaving] = useState(false);

  const saveLog = async () => {
    if (!activity.trim()) {
      toast.error("Please enter an activity.");
      return;
    }

    const token = getStoredAuthToken();
    if (!token) {
      toast.error("You must be logged in to log activity.");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch("/api/dashboard/me/quick-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: activity }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to save activity.");
      }

      toast.success("+5 Arena Score 🚀");

      setActivity("");

      onClose();
    } catch (error) {
      console.error(error);

      toast.error("Failed to save activity.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="quicklog-overlay" onClick={onClose}>
      <div className="quicklog-modal" onClick={(e) => e.stopPropagation()}>
        <h2>What did you build today?</h2>

        <textarea
          placeholder="Solved 3 Leetcode problems..."
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
        />

        <button className="save-log-btn" onClick={saveLog} disabled={saving}>
          {saving ? "Saving..." : "Save Activity"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
