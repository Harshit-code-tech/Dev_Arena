import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/authDPages.css";

import { signInWithPopup } from "firebase/auth";
import {
  auth,
  googleProvider,
  githubProvider,
} from "../../config/fireBase";
import toast from "react-hot-toast";
import { saveUser } from "../../components/saveUser";
import { useAuth } from "../../context/AuthContext";
import { Color2FA } from "../../components/Color2FA";

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

  const googleLogin = async () => {
    try {
      setLoading(true);

      const result = await signInWithPopup(auth, googleProvider);

      console.log(result.user);

      await saveUser(result.user, "google");

      toast.success("Welcome to DevArena!");

      navigate("/dashboard");
    } catch (error: any) {
      console.error(error);

      switch (error.code) {
        case "auth/popup-closed-by-user":
          toast.error("Google sign-in was cancelled.");
          break;

        case "auth/popup-blocked":
          toast.error("Popup blocked. Please allow popups.");
          break;

        case "auth/network-request-failed":
          toast.error("No internet connection detected.");
          break;

        default:
          toast.error("Google login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const githubLogin = async () => {
    try {
      setLoading(true);

      const result = await signInWithPopup(auth, githubProvider);

      await saveUser(result.user, "github");

      toast.success("Welcome to DevArena!");

      navigate("/dashboard");
    } catch (error: any) {
      console.error(error);

      switch (error.code) {
        case "auth/popup-closed-by-user":
          toast.error("GitHub sign-in was cancelled.");
          break;

        case "auth/popup-blocked":
          toast.error("Popup blocked. Please allow popups.");
          break;

        case "auth/network-request-failed":
          toast.error("No internet connection detected.");
          break;

        case "auth/account-exists-with-different-credential":
          toast.error("Account already exists with another login method.");
          break;

        default:
          toast.error("GitHub login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    if (!email.trim()) {
      setError("Email is required.");
      toast.error("Email is required.");
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError("Password is required.");
      toast.error("Password is required.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email.trim(), 
          password,
          remember,
          deviceToken: localStorage.getItem("deviceToken")
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      if (data.requires2FA) {
        setPending2FAToken(data.tempToken);
        setVerifyGrid(data.verifyGrid || []);
        toast("2FA Required", { icon: "🔒" });
        return; // Don't redirect yet
      }

      if (data.deviceToken) {
          localStorage.setItem("deviceToken", data.deviceToken);
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
              stroke="rgba(125, 211, 252, 0.3)"
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
              fill="#38bdf8"
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
              fill="#7dd3fc"
              opacity="0.8"
            />

            <rect
              x="66"
              y="62"
              width="90"
              height="5"
              rx="2.5"
              fill="rgba(125, 211, 252, 0.35)"
            />

            <rect
              x="66"
              y="74"
              width="45"
              height="5"
              rx="2.5"
              fill="#34d399"
              opacity="0.5"
            />

            <rect
              x="116"
              y="74"
              width="70"
              height="5"
              rx="2.5"
              fill="rgba(125, 211, 252, 0.25)"
            />

            <rect
              x="66"
              y="86"
              width="80"
              height="5"
              rx="2.5"
              fill="rgba(125, 211, 252, 0.3)"
            />

            <rect
              x="66"
              y="98"
              width="55"
              height="5"
              rx="2.5"
              fill="#a78bfa"
              opacity="0.55"
            />

            <rect
              x="126"
              y="98"
              width="40"
              height="5"
              rx="2.5"
              fill="rgba(125, 211, 252, 0.2)"
            />

            <rect
              x="66"
              y="110"
              width="100"
              height="5"
              rx="2.5"
              fill="rgba(125, 211, 252, 0.35)"
            />

            <rect
              x="66"
              y="122"
              width="35"
              height="5"
              rx="2.5"
              fill="#fbbf24"
              opacity="0.5"
            />

            {/* Cursor */}

            <rect x="106" y="122" width="2" height="8" rx="1" fill="#7dd3fc">
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
              fill="rgba(125, 211, 252, 0.15)"
            />

            <rect
              x="105"
              y="170"
              width="70"
              height="6"
              rx="3"
              fill="rgba(125, 211, 252, 0.1)"
            />

            {/* Shield */}

            <g transform="translate(190, 90)">
              <circle cx="22" cy="22" r="22" fill="rgba(125, 211, 252, 0.12)" />

              <circle
                cx="22"
                cy="22"
                r="16"
                fill="rgba(7, 9, 18, 0.95)"
                stroke="#7dd3fc"
                strokeWidth="1.2"
              />

              <rect
                x="16"
                y="19"
                width="12"
                height="10"
                rx="2"
                fill="#7dd3fc"
                opacity="0.8"
              />

              <path
                d="M19 19v-3a3 3 0 0 1 6 0v3"
                stroke="#7dd3fc"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />

              <circle cx="22" cy="23" r="1.2" fill="#07111f" />
            </g>

            {/* Floating Particles */}

            <circle cx="35" cy="60" r="2" fill="#7dd3fc" opacity="0.3">
              <animate
                attributeName="cy"
                values="60;50;60"
                dur="3s"
                repeatCount="indefinite"
              />
            </circle>

            <circle cx="250" cy="45" r="1.5" fill="#a78bfa" opacity="0.4">
              <animate
                attributeName="cy"
                values="45;35;45"
                dur="4s"
                repeatCount="indefinite"
              />
            </circle>

            <circle cx="260" cy="150" r="2" fill="#34d399" opacity="0.3">
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
                        if (deviceToken) {
                            localStorage.setItem("deviceToken", deviceToken);
                        }
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
                onClick={() => navigate("/forgot-password")}
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
