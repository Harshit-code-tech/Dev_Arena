import "../styles/QuickLogModal.css";
import { createPortal } from "react-dom";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { auth, db } from "../../config/Firebase";
import { doc, updateDoc, increment } from "firebase/firestore";

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

    try {
      setSaving(true);

      await addDoc(collection(db, "logs"), {
        uid: auth.currentUser?.uid,

        text: activity,

        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "users", auth.currentUser!.uid), {
        arenaScore: increment(5),
      });

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
