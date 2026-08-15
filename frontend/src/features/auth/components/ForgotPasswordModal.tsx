import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  requestPasswordResetOtp,
  resetPasswordWithOtp,
} from "../api/PasswordResetService";
import type {
  ForgotPasswordModalProps,
  ForgotPasswordStep,
} from "../api/AuthTypes";

export function ForgotPasswordModal({ onClose }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<ForgotPasswordStep>("email");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSendOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) {
      setErrorMessage("Please enter your email.");
      return;
    }

    setErrorMessage("");
    setLoading(true);
    try {
      const data = await requestPasswordResetOtp(email);
      toast.success(data.message || "Password reset instructions were sent.");
      if (data.useFirebaseReset) {
        setStep("firebase_sent");
        return;
      }
      if (!data.tempToken) throw new Error("Password reset session could not be created.");
      setTempToken(data.tempToken);
      setStep("otp_and_reset");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "The password reset code could not be sent."));
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp) || !newPassword.trim()) {
      setErrorMessage("Enter the 6-digit code and your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setErrorMessage("");
    setLoading(true);
    try {
      await resetPasswordWithOtp({ tempToken, otp, newPassword });
      toast.success("Password reset successfully. You can now log in.");
      onClose();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "The password could not be reset."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-modal-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="reset-password-title">
        <header className="auth-modal-header">
          <div>
            <p className="auth-badge">DevArena / Account recovery</p>
            <h2 id="reset-password-title">Reset password</h2>
          </div>
          <button type="button" className="auth-modal-close text-action" onClick={onClose} aria-label="Close password reset">
            Close
          </button>
        </header>

        <p className="auth-modal-copy">
          {step === "email"
            ? "Enter the email address associated with your DevArena account."
            : step === "firebase_sent"
              ? "Firebase sent a secure password-reset link to your email. Open that message to choose a new password."
              : "This is a legacy DevArena account. Enter the one-time code from your email and choose a new password; the account will migrate to Firebase the next time you sign in."}
        </p>

        {errorMessage && (
          <div className="auth-error" role="alert">
            <i className="bx bx-error-circle" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {step === "email" ? (
          <form className="auth-form auth-modal-form" onSubmit={handleSendOtp} noValidate>
            <div className={`floating-field${email ? " has-value" : ""}`}>
              <input
                id="reset-email"
                type="email"
                placeholder=" "
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setErrorMessage("");
                  setEmail(event.target.value);
                }}
              />
              <label htmlFor="reset-email">Email address</label>
            </div>
            <button type="submit" className="auth-submit underline-action" disabled={loading || !email.trim()}>
              {loading ? <span className="btn-loader" /> : "Send reset code"}
            </button>
          </form>
        ) : step === "firebase_sent" ? (
          <div className="auth-form auth-modal-form">
            <button type="button" className="auth-submit underline-action" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <form className="auth-form auth-modal-form" onSubmit={handleResetPassword} noValidate>
            <div className={`floating-field auth-otp-field${otp ? " has-value" : ""}`}>
              <input
                id="reset-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder=" "
                maxLength={6}
                value={otp}
                onChange={(event) => {
                  setErrorMessage("");
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                }}
              />
              <label htmlFor="reset-otp">One-time code</label>
            </div>

            <div className={`floating-field${newPassword ? " has-value" : ""}`}>
              <input
                id="reset-new-password"
                type="password"
                placeholder=" "
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => {
                  setErrorMessage("");
                  setNewPassword(event.target.value);
                }}
              />
              <label htmlFor="reset-new-password">New password</label>
            </div>

            <div className={`floating-field${confirmPassword ? " has-value" : ""}`}>
              <input
                id="reset-confirm-password"
                type="password"
                placeholder=" "
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  setErrorMessage("");
                  setConfirmPassword(event.target.value);
                }}
              />
              <label htmlFor="reset-confirm-password">Confirm password</label>
            </div>

            <button
              type="submit"
              className="auth-submit underline-action"
              disabled={loading || otp.length !== 6 || !newPassword || !confirmPassword}
            >
              {loading ? <span className="btn-loader" /> : "Reset password"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
