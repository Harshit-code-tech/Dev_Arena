import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import "../../styles/authMPage.css";

function Login() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] =
    useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  // HANDLE INPUTS
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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
      toast.success(`${provider} connected!`, {
        id: "social-login",
      });

      navigate("/");
    }, 1500);
  };

  // LOGIN
  const handleLogin = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    const { email, password } = formData;

    // VALIDATION
    if (!email || !password) {
      toast.error("Please fill all fields");
      return;
    }

    if (!email.includes("@")) {
      toast.error("Invalid email address");
      return;
    }

    if (password.length < 6) {
      toast.error(
        "Password must be at least 6 characters"
      );
      return;
    }

    try {
      setLoading(true);

      // DEMO LOGIN DELAY
      await new Promise((resolve) =>
        setTimeout(resolve, 2000)
      );

      toast.success("Logged in successfully!");

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
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>

      <div className="auth-card">
        {/* BRAND */}
        <div className="brand">
          <div className="logo-circle">D</div>

          <h1>DevArena</h1>

          <p className="tagline">
            Build. Compete. Grow.
          </p>
        </div>

        {/* TITLE */}
        <h2>Welcome Back</h2>

        <p className="sub">
          Log in and continue your developer
          journey.
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
            onClick={() =>
              socialLogin("LinkedIn")
            }
          >
            <i className="fab fa-linkedin li-icon"></i>
            Continue with LinkedIn
          </button>
        </div>

        {/* DIVIDER */}
        <div className="divider">
          <span>or log in with email</span>
        </div>

        {/* FORM */}
        <form onSubmit={handleLogin}>
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
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
              />

              <button
                type="button"
                className="show-pass"
                onClick={() =>
                  setShowPassword(
                    !showPassword
                  )
                }
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>
          </div>

          {/* FORGOT PASSWORD */}
          <div className="forgot-wrap">
            <span
              onClick={() =>
                toast("Forgot password feature soon!")
              }
            >
              Forgot Password?
            </span>
          </div>

          {/* SUBMIT */}
          <button
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Logging in..."
              : "Log in"}
          </button>
        </form>

        {/* SWITCH */}
        <p className="auth-switch">
          Don&apos;t have an account?{" "}
          <a onClick={() => navigate("/signup")}>
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
}

export default Login;