import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import "../../styles/DesktopAuthPages.css";
import AuthBackButton from "../../components/AuthBackButton";
import {
  getSocialAuthErrorMessage,
  signInWithSocialProvider,
} from "../../api/SocialAuthService";
import { registerWithEmail } from "../../api/EmailAuthService";
import {
  getPasswordStrength,
  validateEmailSignupInput,
} from "../../api/AuthValidationService";
import type { SocialAuthProvider } from "../../api/AuthTypes";
import { useAuth } from "../../context/AuthContext";
import { claimEmailInvite } from "../../../../services/FriendsService";
import AuthScreenTransition, {
  getAuthTransitionOrigin,
  type AuthTransitionOrigin,
} from "../../components/AuthScreenTransition";

function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const inviteToken = searchParams.get("invite") || "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [transitionOrigin, setTransitionOrigin] = useState<AuthTransitionOrigin | null>(null);
  const [rocketLaunching, setRocketLaunching] = useState(false);
  const [rocketLaunchDistance, setRocketLaunchDistance] = useState(0);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const githubButtonRef = useRef<HTMLButtonElement>(null);
  const googleButtonRef = useRef<HTMLButtonElement>(null);
  const rocketRef = useRef<SVGGElement>(null);
  const pendingSignupOrigin = useRef<AuthTransitionOrigin | null>(null);
  const transitionDestination = useRef("/dashboard");

  const revealDestination = useCallback(() => navigate(transitionDestination.current, { replace: true }), [navigate]);

  const beginSignupTransition = useCallback((fallbackOrigin?: AuthTransitionOrigin | null) => {
    const rocketRect = rocketRef.current?.getBoundingClientRect();
    const hasVisibleRocket = Boolean(rocketRect && rocketRect.width > 0 && rocketRect.height > 0);

    if (!hasVisibleRocket || !rocketRect) {
      setTransitionOrigin(fallbackOrigin || pendingSignupOrigin.current || getAuthTransitionOrigin(createButtonRef.current));
      return;
    }

    const impactX = Math.max(0, Math.min(window.innerWidth - 24, rocketRect.left + rocketRect.width / 2 - 12));
    setRocketLaunchDistance(rocketRect.top + rocketRect.height * 0.34);
    setRocketLaunching(true);

    window.setTimeout(() => {
      setTransitionOrigin({ top: 0, left: impactX, width: 24, height: 24, borderRadius: 12 });
    }, 620);
  }, []);

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const claimPendingInvite = async () => {
    if (!inviteToken) return;
    try {
      const invite = await claimEmailInvite(inviteToken);
      toast.success(invite.message);
    } catch (inviteError) {
      toast.error(inviteError instanceof Error ? inviteError.message : "The email invitation could not be accepted.");
    }
  };

  const handleSocialSignup = async (provider: SocialAuthProvider, source: HTMLButtonElement | null) => {
    if (!agreeTerms) {
      const legalMessage = "Please accept the Terms of Service and Privacy Policy before creating an account.";
      setError(legalMessage);
      toast.error(legalMessage);
      return;
    }

    const origin = getAuthTransitionOrigin(source);
    pendingSignupOrigin.current = origin;
    try {
      setLoading(true);
      const { token, requiresOnboarding } = await signInWithSocialProvider(provider, { acceptLegal: true });

      if (!token) throw new Error("Signup failed");
      await loginWithToken(token);
      await claimPendingInvite();
      transitionDestination.current = requiresOnboarding ? "/choose-username" : "/dashboard";

      toast.success(requiresOnboarding ? "Complete your DevArena username and GitHub setup." : "Welcome to DevArena!");
      beginSignupTransition(origin);
    } catch (socialError) {
      console.error(socialError);
      toast.error(getSocialAuthErrorMessage(provider, "signup", socialError));
    } finally {
      setLoading(false);
    }
  };

  const signup = async () => {
    setError("");
    pendingSignupOrigin.current = getAuthTransitionOrigin(createButtonRef.current);

    const validationError = validateEmailSignupInput({
      firstName,
      lastName,
      email,
      password,
      agreeTerms,
      passwordStrength: strength,
    });

    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    try {
      setLoading(true);
      const data = await registerWithEmail({
        firstName,
        lastName,
        email,
        password,
        agreeTerms,
        passwordStrength: strength,
      });

      await loginWithToken(data.token);
      await claimPendingInvite();
      transitionDestination.current = data.requiresOnboarding ? "/choose-username" : "/dashboard";
      toast.success(
        data.requiresOnboarding
          ? "Account created in Firebase. Complete your DevArena username and GitHub setup."
          : `Welcome to DevArena, ${firstName}!`,
      );
      beginSignupTransition();
    } catch (signupError: any) {
      console.error(signupError);
      const errorMessage = signupError.message || "Something went wrong. Please try again.";

      if (errorMessage.includes("already exists")) {
        setError("An account with this email already exists.");
        toast.error("An account with this email already exists.");
      } else {
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await signup();
  };

  return (
    <main className="auth-page auth-page--signup">
      <AuthBackButton />

      <div className="auth-container">
        <section className="auth-form-panel" aria-labelledby="signup-heading">
          <div className="auth-form-shell">
            <div className="form-top">
              <p className="auth-badge">DevArena / New account</p>
              <h1 id="signup-heading">Create account</h1>
              <p className="auth-subtitle">
                Create your Firebase email/password identity, then continue with DevArena setup.
              </p>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                <i className="bx bx-error-circle" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <form className="auth-form" onSubmit={handleSubmit} noValidate>
                <div className="name-row">
                  <div className={`floating-field${firstName ? " has-value" : ""}`}>
                    <input
                      id="signup-firstname"
                      type="text"
                      name="firstName"
                      placeholder=" "
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                    <label htmlFor="signup-firstname">First name</label>
                  </div>

                  <div className={`floating-field${lastName ? " has-value" : ""}`}>
                    <input
                      id="signup-lastname"
                      type="text"
                      name="lastName"
                      placeholder=" "
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                    />
                    <label htmlFor="signup-lastname">Last name</label>
                  </div>
                </div>



                <div className={`floating-field${email ? " has-value" : ""}`}>
                  <input
                    id="signup-email"
                    type="email"
                    name="email"
                    placeholder=" "
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                  <label htmlFor="signup-email">Email address</label>
                </div>

                <div className={`floating-field floating-field--password${password ? " has-value" : ""}`}>
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder=" "
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <label htmlFor="signup-password">Password</label>
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

                {password && (
                  <div className="password-feedback" aria-live="polite">
                    <div className="password-strength" aria-hidden="true">
                      {[1, 2, 3, 4].map((item) => (
                        <span
                          key={item}
                          className={`strength-bar${
                            item <= strength.score ? ` active ${strength.label}` : ""
                          }`}
                        />
                      ))}
                    </div>
                    <span className={`strength-label ${strength.label}`}>
                      {strength.label}
                    </span>
                  </div>
                )}

                <label className="auth-check terms-check">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(event) => setAgreeTerms(event.target.checked)}
                  />
                  <span className="auth-check-box" aria-hidden="true" />
                  <span>
                    I agree to the{" "}
                    <button type="button" onClick={() => navigate("/terms")}>
                      Terms of Service
                    </button>{" "}
                    and{" "}
                    <button type="button" onClick={() => navigate("/privacy")}>
                      Privacy Policy
                    </button>
                  </span>
                </label>

                <button
                  ref={createButtonRef}
                  type="submit"
                  className="auth-submit underline-action"
                  disabled={
                    loading ||
                    !firstName.trim() ||
                    !lastName.trim() ||
                    !email.trim() ||
                    !password.trim()
                  }
                >
                  {loading ? <span className="btn-loader" /> : "Create account"}
                </button>
              </form>

            <div className="auth-divider" aria-hidden="true">
                <span>or sign up with</span>
              </div>

              <div className="social-buttons">
                <button
                  ref={githubButtonRef}
                  type="button"
                  className="social-btn"
                  onClick={() => handleSocialSignup("github", githubButtonRef.current)}
                  disabled={loading}
                >
                  <i className="bx bxl-github" aria-hidden="true" />
                  GitHub
                </button>
                <button
                  ref={googleButtonRef}
                  type="button"
                  className="social-btn"
                  onClick={() => handleSocialSignup("google", googleButtonRef.current)}
                  disabled={loading}
                >
                  <i className="bx bxl-google" aria-hidden="true" />
                  Google
                </button>
              </div>

              <div className="auth-footer">
                <span>Already have an account?</span>
                <button
                  type="button"
                  className="text-action"
                  onClick={() => navigate("/login")}
                >
                  Log in
                </button>
              </div>
          </div>
        </section>

        <section className="auth-illustration" aria-label="Launch your DevArena journey">
          <span className="auth-wordmark" aria-hidden="true"><span className="auth-wordmark-dev">Dev</span><span className="auth-wordmark-arena">Arena</span></span>

          <svg
            className="illustration-icon illustration-icon--rocket"
            viewBox="0 0 420 360"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="210" cy="170" r="152" stroke="rgba(255,255,255,.16)" />
            <ellipse cx="210" cy="178" rx="176" ry="58" stroke="rgba(255,255,255,.13)" strokeDasharray="7 9" />
            <circle cx="70" cy="190" r="10" fill="#191a1e" stroke="rgba(255,255,255,.5)" />
            <circle cx="345" cy="92" r="4" fill="#fff" opacity=".45" />
            <circle cx="60" cy="76" r="3" fill="#fff" opacity=".35" />
            <circle cx="330" cy="275" r="3" fill="#fff" opacity=".28" />
            <g transform="translate(138 30)">
              <g
                ref={rocketRef}
                className={`illustration-rocket-body${rocketLaunching ? " is-launching" : ""}`}
                style={{ "--rocket-launch-distance": `${rocketLaunchDistance}px` } as CSSProperties}
              >
              <path d="M72 8C32 45 20 90 30 164H114C124 90 112 45 72 8Z" fill="#0b0c0f" stroke="#f4f4f4" strokeWidth="2" />
              <circle cx="72" cy="82" r="23" fill="#050505" stroke="#fff" strokeWidth="2" />
              <circle cx="72" cy="82" r="14" fill="#26272c" />
              <circle cx="66" cy="76" r="4" fill="#fff" opacity=".55" />
              <path d="M31 133L4 177L35 166" fill="#141519" stroke="rgba(255,255,255,.65)" strokeWidth="2" />
              <path d="M113 133L140 177L109 166" fill="#141519" stroke="rgba(255,255,255,.65)" strokeWidth="2" />
              <path d="M51 165C51 165 54 213 72 245C90 213 93 165 93 165H51Z" fill="#b6b6b8" opacity=".45">
                <animate attributeName="d" values="M51 165C51 165 54 213 72 245C90 213 93 165 93 165H51Z;M53 165C53 165 57 224 72 258C87 224 91 165 91 165H53Z;M51 165C51 165 54 213 72 245C90 213 93 165 93 165H51Z" dur=".7s" repeatCount="indefinite" />
              </path>
              <path d="M61 165C61 165 63 198 72 221C81 198 83 165 83 165H61Z" fill="#fff" opacity=".68">
                <animate attributeName="opacity" values=".68;.35;.68" dur=".45s" repeatCount="indefinite" />
              </path>
              </g>
            </g>
          </svg>

          <div className="auth-visual-copy">
            <p className="auth-visual-kicker">Begin your ascent</p>
            <h2>Launch your dev career</h2>
            <p>
              Build projects, improve your skills, track your progress, and
              climb the DevArena leaderboard.
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

export default Signup;
