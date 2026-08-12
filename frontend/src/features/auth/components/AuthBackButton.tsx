import { useNavigate } from "react-router-dom";

export default function AuthBackButton() {
  const navigate = useNavigate();

  const returnHome = () => {
    navigate("/");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  };

  return (
    <button
      type="button"
      className="auth-back-btn dev-back-button"
      onClick={returnHome}
      aria-label="Back to the DevArena home page"
    >
      <span aria-hidden="true">←</span>
      Back
    </button>
  );
}
