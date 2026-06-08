import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/authMPage.css";

import { signInWithPopup } from "firebase/auth";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, googleProvider, githubProvider } from "../../config/fireBase";
import toast from "react-hot-toast";
import { saveUser } from "../../components/saveUser";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      console.log(userCredential.user);

      await saveUser(userCredential.user, "email");

      toast.success("Login successful!");

      navigate("/dashboard");
    } catch (error: any) {
      console.log(error);

      switch (error.code) {
        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          toast.error("Please enter a valid email address.");
          break;

        case "auth/invalid-credential":
          setError("Incorrect email or password.");
          toast.error("Incorrect email or password.");
          break;

        case "auth/user-disabled":
          setError("This account has been disabled.");
          toast.error("This account has been disabled.");
          break;

        case "auth/too-many-requests":
          setError("Too many failed attempts. Please try again later.");
          toast.error("Too many failed attempts. Please try again later.");
          break;

        case "auth/network-request-failed":
          setError("Network error. Check your internet connection.");
          toast.error("Network error. Check your internet connection.");
          break;

        default:
          setError("Something went wrong. Please try again.");
          toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
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

        {/* FORM */}
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
            <span onClick={() => toast("Forgot password feature soon!")}>
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
