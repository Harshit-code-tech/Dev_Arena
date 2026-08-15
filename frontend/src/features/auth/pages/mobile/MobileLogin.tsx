import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/MobileAuthPages.css";
import AuthBackButton from "../../components/AuthBackButton";

import toast from "react-hot-toast";
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
import { useAuth } from "../../context/AuthContext";
import { Color2FA } from "../../components/Color2FA";
import { ForgotPasswordModal } from "../../components/ForgotPasswordModal";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginWithToken } = useAuth();
  const [pending2FAToken, setPending2FAToken] = useState<string | null>(null);
  const [verifyGrid, setVerifyGrid] = useState<string[]>([]);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const handleSocialLogin = async (provider: SocialAuthProvider) => {
    try {
      setLoading(true);

      const { token } = await signInWithSocialProvider(provider);

      if (token) await loginWithToken(token);

      toast.success("Welcome to DevArena!");
      navigate("/dashboard");
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
      const data = await loginWithEmail({ email, password });

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
    <div className="auth-wrap">
      <AuthBackButton />
      {/* BACKGROUND BLOBS */}
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <div className="auth-card">
        {/* BRAND */}
        <div className="brand">
          <div className="logo-circle">D</div>

          <h1>DevArena</h1>

          <p className="tagline">Build. Compete. Grow.</p>
        </div>

        {/* TITLE */}
        <h2>Welcome Back</h2>

        <p className="sub">Log in and continue your developer journey.</p>

        {/* SOCIAL BUTTONS */}
        <div className="social-btns">
          <button type="button" className="social-btn" onClick={googleLogin}>
            <i className="fab fa-google g-icon"></i>
            Continue with Google
          </button>

          <button type="button" className="social-btn" onClick={githubLogin}>
            <i className="fab fa-github gh-icon"></i>
            Continue with GitHub
          </button>
        </div>

        {/* DIVIDER */}
        <div className="divider">
          <span>or log in with email</span>
        </div>

        {error && (
          <div className="auth-error" role="alert">
            <i className="bx bx-error-circle"></i>

            <span>{error}</span>
          </div>
        )}

        {/* FORGOT MODAL */}
        {showForgotModal && <ForgotPasswordModal onClose={() => setShowForgotModal(false)} />}

        {/* FORM OR 2FA */}
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
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          {/* EMAIL */}
          <div className="input-group">
            <label>Email Address</label>

            <input
              className="auth-input"
              type="email"
              name="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* PASSWORD */}
          <div className="input-group">
            <label>Password</label>

            <div className="password-wrap">
              <input
                className="auth-input"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                type="button"
                className="show-pass"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* FORGOT PASSWORD */}
          <div className="forgot-wrap">
            <span onClick={() => setShowForgotModal(true)}>
              Forgot Password?
            </span>
          </div>

          {/* SUBMIT */}
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

        {/* SWITCH */}
        <p className="auth-switch">
          Don&apos;t have an account?{" "}
          <a onClick={() => navigate("/signup")}>Sign up</a>
        </p>
      </div>
    </div>
  );
}

export default Login;
