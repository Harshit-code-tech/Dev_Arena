import { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import "../../styles/MobileAuthPages.css";
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

  const handleSocialSignup = async (provider: SocialAuthProvider) => {
    try {
      setLoading(true);

      const { token } = await signInWithSocialProvider(provider, { acceptLegal: true });

      if (token) await loginWithToken(token);

      toast.success("Welcome to DevArena!");
      navigate("/dashboard");
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
    <div className="auth-wrap">
      <AuthBackButton />
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
