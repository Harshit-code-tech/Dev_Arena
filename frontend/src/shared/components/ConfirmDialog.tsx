import { createPortal } from "react-dom";
import { useEffect } from "react";
import "../styles/ConfirmDialog.css";

export type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  icon?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = true,
  isLoading = false,
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
        onCancel();
      }
    };

    document.body.classList.add("app-dialog-open");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("app-dialog-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="app-dialog-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isLoading) onCancel();
      }}
      role="presentation"
    >
      <div
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
      >
        <div className={`app-dialog-icon-wrap ${isDestructive ? "destructive" : "info"}`}>
          <i
            className={`bx ${icon || (isDestructive ? "bx-trash" : "bx-info-circle")}`}
            aria-hidden="true"
          />
        </div>

        <h3 id="app-dialog-title" className="app-dialog-title">
          {title}
        </h3>

        <p className="app-dialog-message">{message}</p>

        <div className="app-dialog-actions">
          <button
            type="button"
            className="app-dialog-cancel-btn"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`app-dialog-confirm-btn ${isDestructive ? "destructive" : "primary"}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="bx bx-loader-alt bx-spin" aria-hidden="true" />
                <span>Processing...</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
