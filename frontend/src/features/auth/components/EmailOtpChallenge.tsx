import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { resendEmailAuthOtp, verifyEmailAuthOtp } from "../api/EmailAuthService";
import type { EmailOtpChallengeProps } from "../api/AuthTypes";

export default function EmailOtpChallenge({
  purpose,
  tempToken,
  email,
  resendAfterSeconds = 60,
  onVerified,
  onBack,
}: EmailOtpChallengeProps) {
  const [activeToken, setActiveToken] = useState(tempToken);
  const [maskedEmail, setMaskedEmail] = useState(email);
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(resendAfterSeconds);
  const [action, setAction] = useState<"verify" | "resend" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setActiveToken(tempToken);
    setMaskedEmail(email);
    setCountdown(resendAfterSeconds);
    setOtp("");
    setError("");
  }, [email, resendAfterSeconds, tempToken]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const resendLabel = useMemo(() => {
    if (countdown <= 0) return "Resend code";
    const minutes = Math.floor(countdown / 60);
    const seconds = String(countdown % 60).padStart(2, "0");
    return `Resend in ${minutes}:${seconds}`;
  }, [countdown]);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the complete 6-digit verification code.");
      return;
    }

    try {
      setAction("verify");
      const result = await verifyEmailAuthOtp(activeToken, otp);
      toast.success(purpose === "signup" ? "Email verified." : "Login verified.");
      await onVerified(result);
    } catch (verificationError) {
      const message = verificationError instanceof Error
        ? verificationError.message
        : "The verification code could not be checked.";
      setError(message);
      toast.error(message);
    } finally {
      setAction(null);
    }
  }

  async function resend() {
    if (countdown > 0 || action) return;
    setError("");
    try {
      setAction("resend");
      const result = await resendEmailAuthOtp(activeToken);
      setActiveToken(result.tempToken);
      setMaskedEmail(result.email);
      setCountdown(result.resendAfterSeconds || 60);
      setOtp("");
      toast.success(result.message || "A new verification code was sent.");
    } catch (resendError) {
      const message = resendError instanceof Error
        ? resendError.message
        : "A new verification code could not be sent.";
      setError(message);
      toast.error(message);
    } finally {
      setAction(null);
    }
  }

  return (
    <section className="auth-otp-panel" aria-label="Email verification">
      <p className="auth-otp-copy">
        Enter the six-digit code sent to <strong>{maskedEmail}</strong>. The code expires in 10 minutes and can be used once.
      </p>

      {error && (
        <div className="auth-error" role="alert">
          <i className="bx bx-error-circle" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form className="auth-form auth-otp-form" onSubmit={verify} noValidate>
        <div className={`floating-field auth-otp-field${otp ? " has-value" : ""}`}>
          <input
            id={`${purpose}-email-otp`}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder=" "
            maxLength={6}
            value={otp}
            onChange={(event) => {
              setError("");
              setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
            }}
            autoFocus
          />
          <label htmlFor={`${purpose}-email-otp`}>One-time code</label>
        </div>

        <button
          type="submit"
          className="auth-submit underline-action"
          disabled={action !== null || otp.length !== 6}
        >
          {action === "verify" ? <span className="btn-loader" /> : purpose === "signup" ? "Verify and create account" : "Verify and log in"}
        </button>
      </form>

      <div className="auth-otp-actions">
        <button
          type="button"
          className="text-action"
          onClick={resend}
          disabled={countdown > 0 || action !== null}
        >
          {action === "resend" ? "Sending code" : resendLabel}
        </button>
        <button type="button" className="text-action dev-back-button" onClick={onBack} disabled={action !== null}>
          <span aria-hidden="true">←</span><span>Back</span>
        </button>
      </div>
    </section>
  );
}
