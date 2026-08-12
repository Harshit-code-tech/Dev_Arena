import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/DesktopAuthPages.css";
import AuthBackButton from "../../components/AuthBackButton";

import {
  getSocialAuthErrorMessage,
  signInWithSocialProvider,
} from "../../api/SocialAuthService";
import { loginWithEmail } from "../../api/EmailAuthService";
import { validateEmailLoginInput } from "../../api/AuthValidationService";
import type { SocialAuthProvider } from "../../api/AuthTypes";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { ForgotPasswordModal } from "../../components/ForgotPasswordModal";
import AuthScreenTransition, {
  getAuthTransitionOrigin,
  type AuthTransitionOrigin,
} from "../../components/AuthScreenTransition";

function Login() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [transitionOrigin, setTransitionOrigin] = useState<AuthTransitionOrigin | null>(null);
  const signInButtonRef = useRef<HTMLButtonElement>(null);
  const githubButtonRef = useRef<HTMLButtonElement>(null);
  const googleButtonRef = useRef<HTMLButtonElement>(null);
  const pendingLoginOrigin = useRef<AuthTransitionOrigin | null>(null);
  const transitionDestination = useRef("/dashboard");

  const revealDestination = useCallback(() => navigate(transitionDestination.current, { replace: true }), [navigate]);

  const beginDashboardTransition = useCallback((origin?: AuthTransitionOrigin | null) => {
    setTransitionOrigin(origin || pendingLoginOrigin.current || getAuthTransitionOrigin(signInButtonRef.current));
  }, []);

  const handleSocialLogin = async (provider: SocialAuthProvider, source: HTMLButtonElement | null) => {
    const origin = getAuthTransitionOrigin(source);
    pendingLoginOrigin.current = origin;
    try {
      setLoading(true);
      const { token, requiresUsername, requiresOnboarding } = await signInWithSocialProvider(provider);

      if (!token) throw new Error("Login failed");
      await loginWithToken(token);
      const needsSetup = requiresUsername || requiresOnboarding;
      transitionDestination.current = needsSetup ? "/choose-username" : "/dashboard";

      toast.success(needsSetup ? "Complete your DevArena account setup." : "Welcome to DevArena!");
      beginDashboardTransition(origin);
    } catch (socialError) {
      console.error(socialError);
      toast.error(getSocialAuthErrorMessage(provider, "login", socialError));
    } finally {
      setLoading(false);
    }
  };

  const login = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    pendingLoginOrigin.current = getAuthTransitionOrigin(signInButtonRef.current);

    const validationError = validateEmailLoginInput({ email, password });
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    try {
      setLoading(true);
      const data = await loginWithEmail({ email, password, remember });
      await loginWithToken(data.token);

      const needsSetup = data.requiresUsername || data.requiresOnboarding;
      transitionDestination.current = needsSetup ? "/choose-username" : "/dashboard";
      toast.success(
        data.migratedFromLegacy
          ? "Account migrated to Firebase Authentication. Welcome back!"
          : needsSetup
            ? "Complete your DevArena account setup."
            : "Login successful!",
      );
      beginDashboardTransition();
    } catch (loginError: any) {
      console.error(loginError);
      const errorMessage = loginError.message || "Something went wrong. Please try again.";

      if (errorMessage.toLowerCase().includes("invalid") || errorMessage.toLowerCase().includes("incorrect")) {
        setError("Incorrect email or password.");
        toast.error("Incorrect email or password.");
      } else {
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page auth-page--login">
      <AuthBackButton />

      <div className="auth-container">
        <section className="auth-form-panel" aria-labelledby="login-heading">
          <div className="auth-form-shell">
            <div className="form-top">
              <p className="auth-badge">DevArena / Secure access</p>
              <h1 id="login-heading">Log in</h1>
              <p className="auth-subtitle">
                Sign in with your Firebase email/password account to continue your developer journey.
              </p>
            </div>

            {showForgotModal && (
              <ForgotPasswordModal onClose={() => setShowForgotModal(false)} />
            )}

            {error && (
              <div className="auth-error" role="alert">
                <i className="bx bx-error-circle" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form className="auth-form" noValidate onSubmit={login}>
                <div className={`floating-field${email ? " has-value" : ""}`}>
                  <input
                    id="login-email"
                    type="email"
                    name="email"
                    placeholder=" "
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <label htmlFor="login-email">Email address</label>
                </div>

                <div className={`floating-field floating-field--password${password ? " has-value" : ""}`}>
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder=" "
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>

                <div className="form-extras">
                  <label className="auth-check remember-me">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                    />
                    <span className="auth-check-box" aria-hidden="true" />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    className="text-action forgot-link"
                    onClick={() => setShowForgotModal(true)}
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  ref={signInButtonRef}
                  type="submit"
                  className="auth-submit underline-action"
                  disabled={loading || !email.trim() || !password.trim()}
                >
                  {loading ? <span className="btn-loader" /> : "Sign in"}
                </button>
              </form>

            <div className="auth-divider" aria-hidden="true">
                <span>or continue with</span>
              </div>

              <div className="social-buttons">
                <button
                  ref={githubButtonRef}
                  type="button"
                  className="social-btn"
                  onClick={() => handleSocialLogin("github", githubButtonRef.current)}
                  disabled={loading}
                >
                  <i className="bx bxl-github" aria-hidden="true" />
                  GitHub
                </button>
                <button
                  ref={googleButtonRef}
                  type="button"
                  className="social-btn"
                  onClick={() => handleSocialLogin("google", googleButtonRef.current)}
                  disabled={loading}
                >
                  <i className="bx bxl-google" aria-hidden="true" />
                  Google
                </button>
              </div>

              <div className="auth-footer">
                <span>Don&apos;t have an account?</span>
                <button
                  type="button"
                  className="text-action"
                  onClick={() => navigate("/signup")}
                >
                  Sign up
                </button>
              </div>

              <p className="auth-legal-note">
                Review the <button type="button" onClick={() => navigate("/terms")}>Terms of Service</button>
                {" "}and{" "}
                <button type="button" onClick={() => navigate("/privacy")}>Privacy Policy</button>.
              </p>
          </div>
        </section>

        <section className="auth-illustration" aria-label="Welcome back to DevArena">
          <span className="auth-wordmark" aria-hidden="true"><span className="auth-wordmark-dev">Dev</span><span className="auth-wordmark-arena">Arena</span></span>

          <svg
            className="illustration-icon illustration-icon--monitor"
            viewBox="0 0 420 330"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="210" cy="158" r="148" stroke="rgba(255,255,255,.18)" />
            <circle cx="210" cy="158" r="119" stroke="rgba(255,255,255,.08)" strokeDasharray="5 8" />
            <rect x="74" y="62" width="272" height="176" rx="8" fill="#090b0d" stroke="rgba(255,255,255,.72)" strokeWidth="2" />
            <rect x="88" y="76" width="244" height="148" rx="3" fill="#030303" stroke="rgba(255,255,255,.16)" />
            <rect x="106" y="98" width="78" height="6" fill="#f3f3f3" />
            <rect x="106" y="116" width="138" height="5" fill="#77787d" />
            <rect x="106" y="133" width="94" height="5" fill="#45464b" />
            <rect x="207" y="133" width="70" height="5" fill="#919297" />
            <rect x="106" y="150" width="158" height="5" fill="#626368" />
            <rect x="106" y="167" width="62" height="5" fill="#e4e4e4" />
            <rect x="175" y="167" width="116" height="5" fill="#393a3f" />
            <rect x="106" y="184" width="128" height="5" fill="#76777c" />
            <rect x="106" y="201" width="48" height="5" fill="#ededed" />
            <rect x="158" y="199" width="2" height="10" fill="#fff">
              <animate attributeName="opacity" values="1;.1;1" dur="1.2s" repeatCount="indefinite" />
            </rect>
            <rect x="186" y="239" width="48" height="13" rx="2" fill="#303136" />
            <rect x="151" y="251" width="118" height="8" rx="4" fill="#191a1e" stroke="rgba(255,255,255,.18)" />
            <g transform="translate(280 156)">
              <circle cx="30" cy="30" r="29" fill="#08090b" stroke="#fff" />
              <rect x="20" y="28" width="20" height="17" rx="3" fill="#d8d8d8" />
              <path d="M24 28v-5a6 6 0 0 1 12 0v5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
              <circle cx="30" cy="36" r="2" fill="#050505" />
            </g>
            <circle cx="45" cy="122" r="3" fill="#fff" opacity=".5" />
            <circle cx="375" cy="93" r="2" fill="#fff" opacity=".3" />
            <circle cx="358" cy="250" r="3" fill="#fff" opacity=".4" />
          </svg>

          <div className="auth-visual-copy">
            <p className="auth-visual-kicker">Resume your trajectory</p>
            <h2>Welcome back, developer</h2>
            <p>
              Pick up where you left off — your streak, projects, challenges,
              and developer journey are waiting for you.
            </p>
          </div>
        </section>
      </div>

      {transitionOrigin && (
        <AuthScreenTransition origin={transitionOrigin} onCovered={revealDestination} />
      )}
    </main>
  );
}

export default Login;
