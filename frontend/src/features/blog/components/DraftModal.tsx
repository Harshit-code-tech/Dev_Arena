import "../styles/DraftModal.css";

type DraftModalProps = {
  onSave: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
};

function DraftModal({ onSave, onDiscard, onKeepEditing }: DraftModalProps) {
  return (
    <div className="draft-modal-backdrop">
      <div className="draft-modal">
        <h2>Save as draft?</h2>

        <p>You have unsaved blog content. Do you want to save it as a draft?</p>

        <div className="draft-modal-actions">
          <button type="button" className="save-btn" onClick={onSave}>
            Yes, save draft
          </button>

          <button type="button" className="discard-btn" onClick={onDiscard}>
            No, discard
          </button>

          <button type="button" className="keep-editing-btn" onClick={onKeepEditing}>
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}

export default DraftModal;
