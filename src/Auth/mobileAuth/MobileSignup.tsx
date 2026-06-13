import { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import "../../styles/authMPage.css";

import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, githubProvider } from "../../config/fireBase";
import { saveUser } from "../../components/saveUser";
import { useAuth } from "../../context/AuthContext";
import { Color2FA } from "../../components/Color2FA";

function getStrength(pw: string): {
  score: number;
  label: string;
} {
  if (!pw) {
    return {
      score: 0,
      label: "",
    };
  }

  let score = 0;

  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const labels = ["", "weak", "fair", "good", "strong"];

  return {
    score,
    label: labels[score],
  };
}

function Signup() {
  const navigate = useNavigate();

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
  const { loginWithToken } = useAuth();
  const [show2FASetup, setShow2FASetup] = useState(false);

  const googleSignup = async () => {
    try {
      setLoading(true);

      const result = await signInWithPopup(auth, googleProvider);

      console.log(result.user);

      toast.success("Welcome to DevArena!");

      navigate("/dashboard");
    } catch (error: any) {
      console.error(error);

      switch (error.code) {
        case "auth/popup-closed-by-user":
          toast.error("Google signup was cancelled.");
          break;

        case "auth/popup-blocked":
          toast.error("Popup blocked. Please allow popups.");
          break;

        case "auth/network-request-failed":
          toast.error("No internet connection.");
          break;

        default:
          toast.error("Google signup failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const githubSignup = async () => {
    try {
      setLoading(true);

      const result = await signInWithPopup(auth, githubProvider);

      console.log(result.user);

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
          toast.error("GitHub Signup failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const signup = async () => {
    setError("");

    // ===============================
    // Validation
    // ===============================

    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !password.trim()
    ) {
      setError("Please fill in all fields.");
      toast.error("Please fill in all fields.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      toast.error("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      toast.error("Password must contain at least 8 characters.");
      return;
    }

    if (strength.score < 2) {
      setError(
        "Password is too weak. Use uppercase letters, numbers, and symbols.",
      );

      toast.error(
        "Password is too weak. Use uppercase letters, numbers, and symbols.",
      );

      return;
    }

    if (!agreeTerms) {
      setError("You must agree to the Terms and Privacy Policy.");

      toast.error("You must agree to the Terms and Privacy Policy.");

      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${firstName.trim()} ${lastName.trim()}`,
          email: email.trim(),
          password: password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

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

  const strength = useMemo(() => getStrength(password), [password]);

  /* =========================================================
     SUBMIT
  ========================================================= */

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    await signup();
  };

  return (
    <div className="auth-wrap">
      {/* BACKGROUND BLOBS */}

      <div className="auth-card">
        {/* LOGO / BRAND */}
        <div className="brand">
          <div className="logo-circle">D</div>

          <h1>DevArena</h1>

          <p className="tagline">Build. Compete. Grow.</p>
        </div>

        <h2>Create your account</h2>

        <p className="sub">
          Join the developer arena and level up your skills.
        </p>

        {/* SOCIAL BUTTONS */}
        <div className="social-btns">
          <button type="button" className="social-btn" onClick={googleSignup}>
            <i className="fab fa-google g-icon"></i>
            Continue with Google
          </button>

          <button type="button" className="social-btn" onClick={githubSignup}>
            <i className="fab fa-github gh-icon"></i>
            Continue with GitHub
          </button>
        </div>

        {/* DIVIDER */}
        <div className="divider">
          <span>or sign up with email</span>
        </div>

        {/* {error} */}

        {error && (
          <div className="auth-error" role="alert">
            <i className="bx bx-error-circle"></i>

            <span>{error}</span>
          </div>
        )}

        {/* FORM OR 2FA SETUP */}
        {show2FASetup ? (
            <div style={{ margin: "20px 0" }}>
                <Color2FA 
                    isSetup={true} 
                    onSetupComplete={() => {
                        navigate("/dashboard");
                    }} 
                />
            </div>
        ) : (
        <form onSubmit={handleSubmit} noValidate>
          {/* FULL NAME */}
          <div className="name-row">
            {/* First Name */}

            <div className="input-group">
              <label htmlFor="signup-firstname">First name</label>

              <div className="input-wrapper">

                <input
                  id="signup-firstname"
                  type="text"
                  placeholder="Enter your first name"
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

                <input
                  id="signup-lastname"
                  type="text"
                  placeholder="Enter your last name"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
          </div>

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
                placeholder="Create a password"
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

            {/* PASSWORD STRENGTH */}
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

          {/* TERMS */}
          <div className="terms-wrap">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
            />

            <p>
              I agree to the <span>Terms</span> and <span>Privacy Policy</span>
            </p>
          </div>

          {/* SUBMIT */}
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
            {loading ? <span className="btn-loader"></span> : "Create account"}
          </button>
        </form>
        )}

        {/* LOGIN SWITCH */}
        <p className="auth-switch">
          Already have an account?{" "}
          <a onClick={() => navigate("/login")}>Log in</a>
        </p>
      </div>
    </div>
  );
}

export default Signup;
