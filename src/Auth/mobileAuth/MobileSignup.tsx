import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import "../../styles/authMPage.css";

function Signup() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // PASSWORD STRENGTH
  const getPasswordStrength = (password: string) => {
    if (password.length < 6) {
      return {
        text: "Weak",
        color: "#ef4444",
      };
    }

    const strongRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/;

    if (strongRegex.test(password)) {
      return {
        text: "Strong",
        color: "#22c55e",
      };
    }

    return {
      text: "Medium",
      color: "#facc15",
    };
  };

  const strength = getPasswordStrength(formData.password);

  // HANDLE INPUTS
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // SOCIAL LOGIN
  const socialLogin = (provider: string): void => {
    toast.loading(`Connecting with ${provider}...`, {
      id: "social-login",
    });

    setTimeout(() => {
      toast.success(`${provider} connected successfully!`, {
        id: "social-login",
      });

      navigate("/");
    }, 1500);
  };

  // SIGNUP
  const handleSignup = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    const { name, email, password } = formData;

    // VALIDATION
    if (!name || !email || !password) {
      toast.error("Please fill all fields");
      return;
    }

    if (!email.includes("@")) {
      toast.error("Invalid email address");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (!acceptedTerms) {
      toast.error("Please accept Terms & Privacy Policy");
      return;
    }

    try {
      setLoading(true);

      // DEMO API DELAY
      await new Promise((resolve) => setTimeout(resolve, 2000));

      toast.success("Account created successfully!");

      navigate("/");
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      {/* BACKGROUND BLOBS */}
      
      

      <div className="auth-card">
        {/* LOGO / BRAND */}
        <div className="brand">
          <div className="logo-circle">D</div>

          <h1>DevArena</h1>

          <p className="tagline">
            Build. Compete. Grow.
          </p>
        </div>

        <h2>Create your account</h2>

        <p className="sub">
          Join the developer arena and level up your
          skills.
        </p>

        {/* SOCIAL BUTTONS */}
        <div className="social-btns">
          <button
            type="button"
            className="social-btn"
            onClick={() => socialLogin("Google")}
          >
            <i className="fab fa-google g-icon"></i>
            Continue with Google
          </button>

          <button
            type="button"
            className="social-btn"
            onClick={() => socialLogin("GitHub")}
          >
            <i className="fab fa-github gh-icon"></i>
            Continue with GitHub
          </button>

          <button
            type="button"
            className="social-btn"
            onClick={() => socialLogin("LinkedIn")}
          >
            <i className="fab fa-linkedin li-icon"></i>
            Continue with LinkedIn
          </button>
        </div>

        {/* DIVIDER */}
        <div className="divider">
          <span>or sign up with email</span>
        </div>

        {/* FORM */}
        <form onSubmit={handleSignup}>
          {/* FULL NAME */}
          <div className="input-group">
            <label>Full Name</label>

            <input
              className="auth-input"
              type="text"
              name="name"
              placeholder="Enter your full name"
              value={formData.name}
              onChange={handleChange}
            />
          </div>

          {/* EMAIL */}
          <div className="input-group">
            <label>Email Address</label>

            <input
              className="auth-input"
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
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
                value={formData.password}
                onChange={handleChange}
              />

              <button
                type="button"
                className="show-pass"
                onClick={() =>
                  setShowPassword(!showPassword)
                }
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            {/* PASSWORD STRENGTH */}
            {formData.password && (
              <div
                className="password-strength"
                style={{
                  color: strength.color,
                }}
              >
                Password Strength: {strength.text}
              </div>
            )}
          </div>

          {/* TERMS */}
          <div className="terms-wrap">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={() =>
                setAcceptedTerms(!acceptedTerms)
              }
            />

            <p>
              I agree to the{" "}
              <span>Terms</span> and{" "}
              <span>Privacy Policy</span>
            </p>
          </div>

          {/* SUBMIT */}
          <button
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Creating account..."
              : "Create account"}
          </button>
        </form>

        {/* LOGIN SWITCH */}
        <p className="auth-switch">
          Already have an account?{" "}
          <a onClick={() => navigate("/login")}>
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}

export default Signup;