import { useState } from "react";
import "../styles/HistoryExportButton.css";

type Props = {
  onExport: () => Promise<void>;
  label?: string;
};

function DownloadIcon() {
  return (
    <span className="history-export-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M12 3v11" />
        <path d="m7.5 10 4.5 4.5 4.5-4.5" />
        <path d="M5 17.5v2h14v-2" />
      </svg>
    </span>
  );
}

export default function HistoryExportButton({ onExport, label = "Export PDF" }: Props) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function runExport() {
    if (exporting) return;
    setError("");
    setExporting(true);

    try {
      await onExport();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The PDF could not be created.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="history-export-control">
      <button
        type="button"
        onClick={() => void runExport()}
        disabled={exporting}
        aria-label={exporting ? "Preparing PDF download" : label}
      >
        {exporting ? (
          <span className="history-export-loader" aria-label="Preparing PDF">
            <i />
            <i />
            <i />
          </span>
        ) : (
          <>
            <span className="history-export-label">{label}</span>
            <DownloadIcon />
          </>
        )}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
