import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/DesktopAuthPages.css";
import AuthBackButton from "../../components/AuthBackButton";

import {
  getSocialAuthErrorMessage,
  signInWithSocialProvider,
} from "../../api/SocialAuthService";
import { loginWithEmail } from "../../api/EmailAuthService";
import { storeDeviceToken } from "../../api/AuthStorageService";
import {
  validateEmailLoginInput,
} from "../../api/AuthValidationService";
import type { SocialAuthProvider } from "../../api/AuthTypes";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext";
import { Color2FA } from "../../components/Color2FA";
import { ForgotPasswordModal } from "../../components/ForgotPasswordModal";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginWithToken } = useAuth();
  const [pending2FAToken, setPending2FAToken] = useState<string | null>(null);
  const [verifyGrid, setVerifyGrid] = useState<string[]>([]);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSocialLogin = async (provider: SocialAuthProvider) => {
    try {
      setLoading(true);

      const { token, requiresUsername, requiresOnboarding } = await signInWithSocialProvider(provider);

      if (token) await loginWithToken(token);

      const needsSetup = requiresUsername || requiresOnboarding;
      toast.success(needsSetup ? "Complete your DevArena account setup." : "Welcome to DevArena!");
      navigate(needsSetup ? "/choose-username" : "/dashboard");
    } catch (error) {
      console.error(error);
      toast.error(getSocialAuthErrorMessage(provider, "login", error));
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = () => handleSocialLogin("google");

  const githubLogin = () => handleSocialLogin("github");

  const login = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    setError("");

    const validationError = validateEmailLoginInput({ email, password });
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    try {
      setLoading(true);
      const data = await loginWithEmail({ email, password, remember });

      if (data.requires2FA && data.tempToken) {
        setPending2FAToken(data.tempToken);
        setVerifyGrid(data.verifyGrid || []);
        toast("2FA Required");
        return;
      }

      if (!data.token) {
        throw new Error("Login failed");
      }

      await loginWithToken(data.token);
      toast.success("Login successful!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message;

      if (errorMessage.toLowerCase().includes("invalid")) {
        setError("Incorrect email or password.");
        toast.error("Incorrect email or password.");
      } else {
        setError(errorMessage || "Something went wrong. Please try again.");
        toast.error(errorMessage || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <AuthBackButton />
      <div className="auth-container">
        {/* =========================================
            LEFT SIDE
        ========================================= */}

        <div className="auth-illustration">
          <div className="illustration-glow"></div>

          <svg
            className="illustration-icon"
            viewBox="0 0 280 220"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Monitor Body */}

            <rect
              x="40"
              y="20"
              width="200"
              height="140"
              rx="14"
              fill="rgba(15, 23, 42, 0.85)"
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="1.5"
            />

            {/* Screen */}

            <rect
              x="52"
              y="32"
              width="176"
              height="116"
              rx="8"
              fill="rgba(2, 6, 23, 0.95)"
            />

            {/* Animated Scan Line */}

            <rect
              x="52"
              y="40"
              width="176"
              height="2"
              fill="#ffffff"
              opacity="0.45"
            >
              <animate
                attributeName="y"
                values="40;140;40"
                dur="4s"
                repeatCount="indefinite"
              />
            </rect>

            {/* Code Lines */}

            <rect
              x="66"
              y="50"
              width="60"
              height="5"
              rx="2.5"
              fill="#ffffff"
              opacity="0.8"
            />

            <rect
              x="66"
              y="62"
              width="90"
              height="5"
              rx="2.5"
              fill="rgba(255, 255, 255, 0.35)"
            />

            <rect
              x="66"
              y="74"
              width="45"
              height="5"
              rx="2.5"
              fill="#d8d8dc"
              opacity="0.5"
            />

            <rect
              x="116"
              y="74"
              width="70"
              height="5"
              rx="2.5"
              fill="rgba(255, 255, 255, 0.25)"
            />

            <rect
              x="66"
              y="86"
              width="80"
              height="5"
              rx="2.5"
              fill="rgba(255, 255, 255, 0.3)"
            />

            <rect
              x="66"
              y="98"
              width="55"
              height="5"
              rx="2.5"
              fill="#b8b8bd"
              opacity="0.55"
            />

            <rect
              x="126"
              y="98"
              width="40"
              height="5"
              rx="2.5"
              fill="rgba(255, 255, 255, 0.2)"
            />

            <rect
              x="66"
              y="110"
              width="100"
              height="5"
              rx="2.5"
              fill="rgba(255, 255, 255, 0.35)"
            />

            <rect
              x="66"
              y="122"
              width="35"
              height="5"
              rx="2.5"
              fill="#f0f0fa"
              opacity="0.5"
            />

            {/* Cursor */}

            <rect x="106" y="122" width="2" height="8" rx="1" fill="#ffffff">
              <animate
                attributeName="opacity"
                values="1;0.1;1"
                dur="1.2s"
                repeatCount="indefinite"
              />
            </rect>

            {/* Monitor Stand */}

            <rect
              x="120"
              y="162"
              width="40"
              height="8"
              rx="2"
              fill="rgba(255, 255, 255, 0.15)"
            />

            <rect
              x="105"
              y="170"
              width="70"
              height="6"
              rx="3"
              fill="rgba(255, 255, 255, 0.1)"
            />

            {/* Shield */}

            <g transform="translate(190, 90)">
              <circle cx="22" cy="22" r="22" fill="rgba(255, 255, 255, 0.12)" />

              <circle
                cx="22"
                cy="22"
                r="16"
                fill="rgba(7, 9, 18, 0.95)"
                stroke="#ffffff"
                strokeWidth="1.2"
              />

              <rect
                x="16"
                y="19"
                width="12"
                height="10"
                rx="2"
                fill="#ffffff"
                opacity="0.8"
              />

              <path
                d="M19 19v-3a3 3 0 0 1 6 0v3"
                stroke="#ffffff"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />

              <circle cx="22" cy="23" r="1.2" fill="#000000" />
            </g>

            {/* Floating Particles */}

            <circle cx="35" cy="60" r="2" fill="#ffffff" opacity="0.3">
              <animate
                attributeName="cy"
                values="60;50;60"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>

            <circle cx="250" cy="45" r="1.5" fill="#b8b8bd" opacity="0.4">
              <animate
                attributeName="cy"
                values="45;35;45"
                dur="4s"
                repeatCount="indefinite"
              />
            </circle>

            <circle cx="260" cy="150" r="2" fill="#d8d8dc" opacity="0.3">
              <animate
                attributeName="cy"
                values="150;140;150"
                dur="3.5s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>

          <h2>Welcome back, developer</h2>

          <p>
            Pick up where you left off — your streak, projects, challenges, and
            developer journey are waiting for you.
          </p>
        </div>

        {/* =========================================
            RIGHT SIDE
        ========================================= */}

        <div className="auth-form-panel">
          <div className="form-top">
            <div className="auth-badge">DevArena</div>

            <h1>Log in</h1>

            <p className="auth-subtitle">
              Enter your credentials to access your account
            </p>
          </div>

          {showForgotModal && <ForgotPasswordModal onClose={() => setShowForgotModal(false)} />}

          {/* Error */}

          {error && (
            <div className="auth-error" role="alert">
              <i className="bx bx-error-circle"></i>

              <span>{error}</span>
            </div>
          )}

          {/* Form or 2FA Grid */}

          {pending2FAToken ? (
             <div style={{ margin: "20px 0" }}>
                 <Color2FA 
                    tempToken={pending2FAToken} 
                    verifyGrid={verifyGrid} 
                    onVerifySuccess={async (token, deviceToken) => {
                        storeDeviceToken(deviceToken);
                        await loginWithToken(token);
                        toast.success("Login successful!");
                        navigate("/dashboard");
                    }} 
                 />
             </div>
          ) : (
            <form
              className="auth-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
            {/* Email */}

            <div className="input-group">
              <label htmlFor="login-email">Email</label>

              <div className="input-wrapper">
                <i className="bx bx-envelope"></i>

                <input
                  id="login-email"
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
              <label htmlFor="login-password">Password</label>

              <div className="input-wrapper">
                <i className="bx bx-lock-alt"></i>

                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
            </div>

            {/* Extras */}

            <div className="form-extras">
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />

                <span>Remember me</span>
              </label>

              <button
                type="button"
                className="forgot-link"
                onClick={() => setShowForgotModal(true)}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}

            <button
              type="submit"
              onClick={login}
              className="auth-submit"
              disabled={loading || !email.trim() || !password.trim()}
            >
              {loading ? <span className="btn-loader"></span> : "Sign in"}
            </button>
          </form>
          )}

          {/* Divider */}

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          {/* Social */}

          <div className="social-buttons">
            <button type="button" className="social-btn" onClick={githubLogin}>
              <i className="bx bxl-github"></i>
              GitHub
            </button>

            <button type="button" className="social-btn" onClick={googleLogin}>
              <i className="bx bxl-google"></i>
              Google
            </button>
          </div>

          {/* Footer */}

          <div className="auth-footer">
            Don&apos;t have an account?
            <button type="button" onClick={() => navigate("/signup")}>
              Sign up
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Login;
