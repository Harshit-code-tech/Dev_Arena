import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { auth } from "../../../config/Firebase";
import { GitHubApi, type GitHubConnectionStatus } from "../../../services/GitHubService";
import AuthScreenTransition, {
  getAuthTransitionOrigin,
  type AuthTransitionOrigin,
} from "../components/AuthScreenTransition";
import { useAuth } from "../context/AuthContext";
import { saveFirestoreUsername } from "../api/FirestoreUserService";
import {
  checkUsernameAvailability,
  choosePermanentUsername,
  completeDevArenaOnboarding,
} from "../api/UsernameService";
import "../styles/ChooseUsername.css";

function needsUsername(user: ReturnType<typeof useAuth>["user"]) {
  return Boolean(user && "requiresUsername" in user && user.requiresUsername);
}

function needsOnboarding(user: ReturnType<typeof useAuth>["user"]) {
  return Boolean(user && "requiresOnboarding" in user && user.requiresOnboarding);
}

function currentUsername(user: ReturnType<typeof useAuth>["user"]) {
  if (!user || !("username" in user)) return "";
  return typeof user.username === "string" ? user.username : "";
}

export default function ChooseUsername() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading, refreshUser, logout } = useAuth();
  const enterButtonRef = useRef<HTMLButtonElement>(null);

  const [username, setUsername] = useState("");
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [message, setMessage] = useState("Use 3–24 lowercase letters, numbers, dots, or underscores.");
  const [savingUsername, setSavingUsername] = useState(false);
  const [githubStatus, setGithubStatus] = useState<GitHubConnectionStatus | null>(null);
  const [githubLoading, setGithubLoading] = useState(true);
  const [githubAction, setGithubAction] = useState<"connect" | "install" | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [transitionOrigin, setTransitionOrigin] = useState<AuthTransitionOrigin | null>(null);

  const usernameRequired = needsUsername(user);
  const onboardingRequired = needsOnboarding(user);
  const normalizedUsername = useMemo(() => username.trim().replace(/^@/, ""), [username]);
  const validFormat = /^[a-z0-9._]{3,24}$/.test(normalizedUsername) && !normalizedUsername.startsWith("__pending_");
  const usernameComplete = usernameSaved || (!usernameRequired && Boolean(currentUsername(user)));
  const githubReady = Boolean(githubStatus?.connected && githubStatus.privateRepositoryAccess);
  const currentStep = usernameComplete && onboardingRequired ? "github" : "username";
  const canEnter = usernameComplete && (!onboardingRequired || githubReady);

  useEffect(() => {
    if (!user) return;
    const existingUsername = currentUsername(user);
    setUsername(existingUsername);
    setUsernameSaved(!needsUsername(user) && Boolean(existingUsername));
  }, [user]);

  async function loadGitHubStatus() {
    try {
      setGithubLoading(true);
      setGithubStatus(await GitHubApi.status());
    } catch (error) {
      setGithubStatus(null);
      toast.error(error instanceof Error ? error.message : "GitHub connection status could not be loaded.");
    } finally {
      setGithubLoading(false);
    }
  }

  useEffect(() => {
    if (!user || currentStep !== "github") return;
    void loadGitHubStatus();
  }, [user?.uid, currentStep]);

  useEffect(() => {
    const githubResult = searchParams.get("github");
    if (!githubResult) return;

    if (githubResult === "installed") {
      toast.success("GitHub connected. Repository access is ready for public and selected private repositories.");
      void loadGitHubStatus();
    } else if (githubResult === "connected") {
      toast.success("GitHub connected. Complete repository access selection to continue.");
      void loadGitHubStatus();
    } else {
      toast.error(searchParams.get("message") || "GitHub connection could not be completed.");
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setAvailable(null);
    if (usernameComplete) {
      setMessage("Your permanent username is saved.");
      return;
    }
    if (!validFormat) {
      setMessage("Use 3–24 lowercase letters, numbers, dots, or underscores. Capital letters are not allowed.");
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      setChecking(true);
      checkUsernameAvailability(normalizedUsername)
        .then((result) => {
          if (!active) return;
          setAvailable(result.available);
          setMessage(result.available ? "Username is available" : "Username already taken");
        })
        .catch((error) => {
          if (!active) return;
          setAvailable(false);
          setMessage(error instanceof Error ? error.message : "Could not check username.");
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    }, 320);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [normalizedUsername, usernameComplete, validFormat]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!usernameRequired && !onboardingRequired) return <Navigate to="/dashboard" replace />;

  async function saveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (usernameComplete || !validFormat || available !== true || savingUsername) return;

    try {
      setSavingUsername(true);
      await choosePermanentUsername(normalizedUsername);
      if (auth.currentUser) await saveFirestoreUsername(auth.currentUser, normalizedUsername);
      setUsernameSaved(true);
      setAvailable(true);
      setMessage("Your permanent username is saved.");
      await refreshUser();
      toast.success(onboardingRequired ? "Username saved. Now connect GitHub." : "Your DevArena username is now permanent.");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Could not save username.";
      setAvailable(false);
      setMessage(text.includes("taken") ? "Username already taken" : text);
      toast.error(text);
    } finally {
      setSavingUsername(false);
    }
  }

  async function connectGitHub() {
    try {
      setGithubAction("connect");
      const result = await GitHubApi.startConnection();
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GitHub connection could not start.");
      setGithubAction(null);
    }
  }

  async function manageRepositoryAccess() {
    try {
      setGithubAction("install");
      const result = await GitHubApi.startInstallation();
      window.location.assign(result.installationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GitHub repository access could not be opened.");
      setGithubAction(null);
    }
  }

  async function enterDevArena() {
    if (!canEnter || finishing) return;

    try {
      setFinishing(true);
      await completeDevArenaOnboarding();
      toast.success("Welcome to DevArena.");
      setTransitionOrigin(getAuthTransitionOrigin(enterButtonRef.current));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Onboarding could not be completed.");
      setFinishing(false);
    }
  }

  const stepTitle = currentStep === "username" ? "Create your identity" : "Connect your GitHub";
  const stepCopy = currentStep === "username"
    ? "Choose one permanent DevArena username. GitHub setup will appear only after this step is saved."
    : "Authorize the DevArena GitHub App, then allow all repositories or only the public and private repositories whose language data DevArena may fetch.";

  return (
    <main className="username-onboarding-page">
      <section className="username-onboarding-card" aria-labelledby="required-setup-title">
        <div className="username-onboarding-shell">
          <p className="username-onboarding-eyebrow">DevArena account / Required setup</p>
          <h1 id="required-setup-title">{stepTitle}</h1>
          <p className="username-onboarding-copy">{stepCopy}</p>

          {onboardingRequired && (
            <div className="onboarding-steps" aria-label="Onboarding progress">
              <span className={currentStep === "username" ? "active" : "complete"}>01 Username</span>
              <span className={currentStep === "github" ? "active" : ""}>02 GitHub</span>
            </div>
          )}

          <div className="onboarding-stage" key={currentStep}>
            {currentStep === "username" ? (
              <form className="username-onboarding-form" onSubmit={saveUsername}>
                <div className="onboarding-section-heading">
                  <div>
                    <p>01 / Public identity</p>
                    <h2>Permanent username</h2>
                  </div>
                  <span>{usernameComplete ? "Saved" : "Required"}</span>
                </div>

                <label className={`username-floating-field${normalizedUsername ? " has-value" : ""}`}>
                  <span aria-hidden="true">@</span>
                  <input
                    autoFocus
                    value={username}
                    onChange={(event) => setUsername(event.target.value.replace(/[^a-z0-9._]/g, ""))}
                    placeholder=" "
                    autoComplete="username"
                    aria-describedby="username-status"
                  />
                  <strong>Permanent username</strong>
                </label>

                <div
                  id="username-status"
                  className={`username-status${checking ? " is-checking" : available === true ? " is-available" : available === false ? " is-unavailable" : ""}`}
                  aria-live="polite"
                >
                  {checking && <i aria-hidden="true" />}
                  {message}
                </div>

                {!usernameComplete && (
                  <button className="username-confirm-action" type="submit" disabled={!validFormat || available !== true || savingUsername}>
                    {savingUsername ? <span className="username-button-loader" aria-label="Saving username" /> : onboardingRequired ? "Save and continue" : "Save username"}
                  </button>
                )}

                {!onboardingRequired && usernameComplete && (
                  <button ref={enterButtonRef} className="username-confirm-action onboarding-enter-action" type="button" disabled={!canEnter || finishing} onClick={() => void enterDevArena()}>
                    {finishing ? <span className="username-button-loader" aria-label="Opening DevArena" /> : "Enter DevArena"}
                  </button>
                )}
              </form>
            ) : (
              <section className="github-onboarding-section" aria-labelledby="github-onboarding-title">
                <div className="onboarding-section-heading">
                  <div>
                    <p>02 / Repository access</p>
                    <h2 id="github-onboarding-title">Connect GitHub</h2>
                  </div>
                  <span className={githubReady ? "is-complete" : ""}>{githubReady ? "Ready" : "Required"}</span>
                </div>

                <div className={`github-onboarding-card${githubReady ? " is-ready" : ""}`}>
                  <div className="github-onboarding-icon" aria-hidden="true"><i className="bx bxl-github" /></div>
                  <div className="github-onboarding-details">
                    <p>{githubStatus?.connected ? "Connected GitHub account" : "GitHub App connection"}</p>
                    <h3>{githubStatus?.githubLogin ? `@${githubStatus.githubLogin}` : githubLoading ? "Checking connection…" : "Not connected"}</h3>
                    <span>
                      {githubReady
                        ? "Repository access is configured. DevArena can fetch language percentages from the public and private repositories you selected."
                        : githubStatus?.connected
                          ? "Continue to GitHub and select all repositories or the specific public and private repositories DevArena may access."
                          : "Connect GitHub, then choose all repositories or only the public and private repositories DevArena may access."}
                    </span>
                  </div>
                </div>

                {githubStatus?.accessError && <p className="github-onboarding-error">{githubStatus.accessError}</p>}

                <div className="github-onboarding-actions">
                  {!githubStatus?.connected ? (
                    <button type="button" className="username-confirm-action" disabled={githubLoading || githubAction !== null} onClick={() => void connectGitHub()}>
                      {githubAction === "connect" ? <span className="username-button-loader" aria-label="Opening GitHub" /> : "Connect GitHub"}
                    </button>
                  ) : (
                    <button type="button" className="username-confirm-action" disabled={githubLoading || githubAction !== null} onClick={() => void manageRepositoryAccess()}>
                      {githubAction === "install" ? <span className="username-button-loader" aria-label="Opening repository access" /> : githubReady ? "Manage repository access" : "Choose repositories"}
                    </button>
                  )}

                  <button type="button" className="username-signout-action onboarding-check-action" disabled={githubLoading} onClick={() => void loadGitHubStatus()}>
                    {githubLoading ? "Checking GitHub…" : "Check connection"}
                  </button>
                </div>

                <div className="onboarding-enter-row">
                  <button ref={enterButtonRef} className="username-confirm-action onboarding-enter-action" type="button" disabled={!githubReady || finishing} onClick={() => void enterDevArena()}>
                    {finishing ? <span className="username-button-loader" aria-label="Opening DevArena" /> : "Continue to DevArena"}
                  </button>
                  {!githubReady && <span>Connect GitHub and grant repository access to continue.</span>}
                </div>
              </section>
            )}
          </div>

          <button className="username-signout-action onboarding-account-switch" type="button" onClick={logout}>Use another account</button>
        </div>
      </section>

      <aside className="username-onboarding-visual" aria-hidden="true">
        <span>DEV</span>
        <span>ARENA</span>
        <p>One identity.<br />Verified builds.</p>
      </aside>

      {transitionOrigin && (
        <AuthScreenTransition
          origin={transitionOrigin}
          onCovered={() => {
            void refreshUser().then(() => navigate("/dashboard", { replace: true }));
          }}
        />
      )}
    </main>
  );
}
