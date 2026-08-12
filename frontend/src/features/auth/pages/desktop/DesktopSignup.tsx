import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { Color2FA } from "../../components/Color2FA";

function Signup() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  /* =========================================================
     STATES
  ========================================================= */

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [agreeTerms, setAgreeTerms] = useState(false);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  const [show2FASetup, setShow2FASetup] = useState(false);

  const handleSocialSignup = async (provider: SocialAuthProvider) => {
    if (!agreeTerms) {
      const legalMessage = "Confirm that you are at least 18 and accept the Terms of Service and Privacy Policy before creating an account.";
      setError(legalMessage);
      toast.error(legalMessage);
      return;
    }

    try {
      setLoading(true);

      const { token, requiresOnboarding } = await signInWithSocialProvider(provider, { acceptLegal: true });

      if (token) await loginWithToken(token);

      toast.success(requiresOnboarding ? "Complete your DevArena username and GitHub setup." : "Welcome to DevArena!");
      navigate(requiresOnboarding ? "/choose-username" : "/dashboard");
    } catch (error) {
      console.error(error);
      toast.error(getSocialAuthErrorMessage(provider, "signup", error));
    } finally {
      setLoading(false);
    }
  };

  const googleSignup = () => handleSocialSignup("google");

  const githubSignup = () => handleSocialSignup("github");

  const signup = async () => {
    setError("");

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

      toast.success(`Welcome to DevArena, ${firstName}! Let's setup your 2FA.`);
      setShow2FASetup(true);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message;

      if (errorMessage.includes("already exists")) {
        setError("An account with this email already exists.");
        toast.error("An account with this email already exists.");
      } else {
        setError(errorMessage || "Something went wrong. Please try again.");
        toast.error(errorMessage || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const strength = useMemo(() => getPasswordStrength(password), [password]);

  /* =========================================================
     SUBMIT
  ========================================================= */

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    await signup();
  };

  return (
    <main className="auth-page">
      <AuthBackButton />
      <div className="auth-container">
        {/* =====================================================
            LEFT SIDE
        ===================================================== */}

        <div className="auth-illustration">
          <div className="illustration-glow"></div>

          <svg
            className="illustration-icon"
            viewBox="0 0 280 240"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Rocket */}

            <g transform="translate(90, 10)">
              <ellipse
                cx="50"
                cy="120"
                rx="22"
                ry="60"
                fill="rgba(15, 23, 42, 0.88)"
                stroke="rgba(255, 255, 255, 0.35)"
                strokeWidth="1.5"
              />

              {/* Window */}

              <circle
                cx="50"
                cy="90"
                r="12"
                fill="rgba(2, 6, 23, 0.9)"
                stroke="#ffffff"
                strokeWidth="1.2"
              />

              <circle cx="50" cy="90" r="7" fill="rgba(255, 255, 255, 0.15)" />

              {/* Reflection */}

              <circle cx="47" cy="87" r="2" fill="rgba(255,255,255,0.5)" />

              {/* Left Fin */}

              <path
                d="M28 140 L10 170 L28 165"
                fill="rgba(255, 255, 255, 0.12)"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="1"
              />

              {/* Right Fin */}

              <path
                d="M72 140 L90 170 L72 165"
                fill="rgba(255, 255, 255, 0.12)"
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="1"
              />

              {/* Flames */}

              <ellipse
                cx="50"
                cy="185"
                rx="10"
                ry="18"
                fill="rgba(255, 255, 255, 0.4)"
              >
                <animate
                  attributeName="ry"
                  values="18;22;18"
                  dur="0.4s"
                  repeatCount="indefinite"
                />
              </ellipse>

              <ellipse
                cx="50"
                cy="185"
                rx="6"
                ry="14"
                fill="rgba(255, 255, 255, 0.5)"
              >
                <animate
                  attributeName="ry"
                  values="14;18;14"
                  dur="0.3s"
                  repeatCount="indefinite"
                />
              </ellipse>

              <ellipse
                cx="50"
                cy="185"
                rx="3"
                ry="10"
                fill="rgba(255,255,255,0.5)"
              >
                <animate
                  attributeName="ry"
                  values="10;13;10"
                  dur="0.35s"
                  repeatCount="indefinite"
                />
              </ellipse>
            </g>

            {/* Orbit */}

            <ellipse
              cx="140"
              cy="130"
              rx="120"
              ry="30"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="0.8"
              strokeDasharray="6 4"
            />

            {/* Planet */}

            <circle
              cx="45"
              cy="140"
              r="6"
              fill="rgba(255, 255, 255, 0.25)"
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="0.8"
            />

            {/* Stars */}

            <circle cx="30" cy="40" r="1.5" fill="#f8fafc" opacity="0.5">
              <animate
                attributeName="opacity"
                values="0.5;0.15;0.5"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>

            <circle cx="250" cy="60" r="2" fill="#ffffff" opacity="0.4">
              <animate
                attributeName="opacity"
                values="0.4;0.1;0.4"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>

            <circle cx="220" cy="180" r="1.5" fill="#b8b8bd" opacity="0.5">
              <animate
                attributeName="opacity"
                values="0.5;0.15;0.5"
                dur="2.5s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>

          <h2>Launch your dev career</h2>

          <p>
            Join thousands of developers building projects, improving skills,
            tracking progress, and climbing the DevArena leaderboard.
          </p>
        </div>

        {/* =====================================================
            RIGHT SIDE
        ===================================================== */}

        <div className="auth-form-panel">
          <div className="form-top">
            <div className="auth-badge">DevArena</div>

            <h1>Create account</h1>

            <p className="auth-subtitle">Start your developer journey</p>
          </div>

          {/* Error */}

          {error && (
            <div className="auth-error" role="alert">
              <i className="bx bx-error-circle"></i>

              <span>{error}</span>
            </div>
          )}

          {/* Form or 2FA Setup */}

          {show2FASetup ? (
             <div style={{ margin: "20px 0" }}>
                 <Color2FA 
                    isSetup={true} 
                    onSetupComplete={() => {
                        navigate("/choose-username");
                    }} 
                 />
             </div>
          ) : (
             <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {/* Name Row */}

            <div className="name-row">
              {/* First Name */}

              <div className="input-group">
                <label htmlFor="signup-firstname">First name</label>

                <div className="input-wrapper">
                  <i className="bx bx-user"></i>

                  <input
                    id="signup-firstname"
                    type="text"
                    placeholder="Jane"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
              </div>

              {/* Last Name */}

              <div className="input-group">
                <label htmlFor="signup-lastname">Last name</label>

                <div className="input-wrapper">
                  <i className="bx bx-user"></i>

                  <input
                    id="signup-lastname"
                    type="text"
                    placeholder="Doe"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Email */}

            <div className="input-group">
              <label htmlFor="signup-email">Email</label>

              <div className="input-wrapper">
                <i className="bx bx-envelope"></i>

                <input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}

            <div className="input-group">
              <label htmlFor="signup-password">Password</label>

              <div className="input-wrapper">
                <i className="bx bx-lock-alt"></i>

                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {/* Strength */}

              {password && (
                <>
                  <div className="password-strength">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`strength-bar ${
                          i <= strength.score ? `active ${strength.label}` : ""
                        }`}
                      />
                    ))}
                  </div>

                  <span className={`strength-label ${strength.label}`}>
                    {strength.label}
                  </span>
                </>
              )}
            </div>

            {/* Terms */}

            <label className="terms-check">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />

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

            {/* Submit */}

            <button
              type="submit"
              className="auth-submit"
              disabled={
                loading ||
                !firstName.trim() ||
                !lastName.trim() ||
                !email.trim() ||
                !password.trim()
              }
            >
              {loading ? (
                <span className="btn-loader"></span>
              ) : (
                "Create account"
              )}
            </button>
          </form>
          )}

          {/* Divider */}

          <div className="auth-divider">
            <span>or sign up with</span>
          </div>

          {/* Social */}

          <div className="social-buttons">
            <button type="button" className="social-btn" onClick={githubSignup}>
              <i className="bx bxl-github"></i>
              GitHub
            </button>

            <button type="button" className="social-btn" onClick={googleSignup}>
              <i className="bx bxl-google"></i>
              Google
            </button>
          </div>

          {/* Footer */}

          <div className="auth-footer">
            Already have an account?
            <button type="button" onClick={() => navigate("/login")}>
              Log in
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Signup;
