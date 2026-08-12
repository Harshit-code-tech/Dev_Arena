import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { toast } from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../../auth/context/AuthContext";
import PageLoader from "../../../shared/components/Skeletons/PageLoader";
import LiveDateTime from "../../../shared/components/LiveDateTime";
import ProfilePhotoCropper from "../components/ProfilePhotoCropper";
import {
  confirmIdentityChange,
  deleteAccount,
  downloadAccountData,
  getSettings,
  requestIdentityChange,
  updateProfilePhoto,
  updateSettingsPreferences,
  type DevArenaSettings,
  type SettingsPreferenceKey,
} from "../../../services/SettingsService";
import { GitHubApi, type GitHubConnectionStatus } from "../../../services/GitHubService";
import {
  getFriendOverview,
  removeFriend,
  type FriendOverview,
} from "../../../services/FriendsService";
import "../styles/Settings.css";

const preferenceGroups: Array<{
  title: string;
  eyebrow: string;
  items: Array<{ key: SettingsPreferenceKey; title: string; copy: string }>;
}> = [
  {
    eyebrow: "Experience",
    title: "User preferences",
    items: [
      { key: "activityReminders", title: "Activity reminders", copy: "Keep gentle nudges visible when your weekly developer activity slows down." },
      { key: "privacyMode", title: "Privacy mode", copy: "Hide scores and activity totals when sharing your screen." },
      { key: "compactWorkspace", title: "Compact workspace", copy: "Prefer denser cards, tighter lists, and reduced spacing across tracking pages." },
    ],
  },
  {
    eyebrow: "Notifications",
    title: "Preference center",
    items: [
      { key: "friendRequestEmails", title: "Player request emails", copy: "Allow email invitations and player request updates." },
      { key: "streakReminderEmails", title: "Streak reminder emails", copy: "Receive reminders when your current developer streak is at risk." },
      { key: "challengeNotifications", title: "Tournament and season updates", copy: "Receive tournament openings, rank changes, and season deadline updates." },
      { key: "inAppNotifications", title: "In-app notifications", copy: "Show network, tracking, tournament, and account events inside DevArena." },
    ],
  },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "DA";
}


export default function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<DevArenaSettings | null>(null);
  const [friends, setFriends] = useState<FriendOverview | null>(null);
  const [githubStatus, setGithubStatus] = useState<GitHubConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState("");
  const [cropOpen, setCropOpen] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [identityOtp, setIdentityOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const identityChanged = Boolean(
    settings && (
      newName.trim() !== settings.name ||
      newEmail.trim().toLowerCase() !== settings.email.toLowerCase()
    ),
  );

  const visibleFriends = useMemo(() => {
    const q = friendQuery.trim().toLowerCase();
    if (!friends) return [];
    if (!q) return friends.friends;
    return friends.friends.filter(({ friend }) =>
      [friend.name, friend.email, friend.username].some((value) => value.toLowerCase().includes(q)),
    );
  }, [friendQuery, friends]);

  async function loadPage() {
    try {
      setLoading(true);
      const [settingsData, friendData, githubData] = await Promise.all([
        getSettings(),
        getFriendOverview(),
        GitHubApi.status().catch(() => null),
      ]);
      setSettings(settingsData);
      setFriends(friendData);
      setGithubStatus(githubData);
      setNewName(settingsData.name);
      setNewEmail(settingsData.email);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, []);

  useEffect(() => {
    const githubResult = searchParams.get("github");
    if (!githubResult) return;
    if (githubResult === "connected") toast.success("GitHub connected. Public repositories already work; install the app only for private repositories.");
    else if (githubResult === "installed") toast.success("GitHub App access updated for private repositories.");
    else toast.error(searchParams.get("message") || "GitHub connection could not be completed.");
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => () => {
    if (selectedPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(selectedPreviewUrl);
  }, [selectedPreviewUrl]);

  if (loading || !settings || !friends) return <PageLoader variant="settings" />;

  const pendingPreviewSource = selectedPreviewUrl || imageUrl.trim();
  const previewSource = pendingPreviewSource || (!settings.useInitials ? settings.avatarUrl || "" : "");

  async function updateToggle(key: SettingsPreferenceKey, value: boolean) {
    try {
      setSavingKey(key);
      const next = await updateSettingsPreferences({ [key]: value });
      setSettings(next);
      window.dispatchEvent(new CustomEvent("devarena:profile-updated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Preference could not be saved.");
    } finally {
      setSavingKey(null);
    }
  }

  async function uploadProfilePhoto(payload: { imageData?: string; imageUrl?: string }) {
    try {
      setPhotoError("");
      setSavingKey("photo");
      const next = await updateProfilePhoto(payload);
      setSettings(next);
      setSelectedFile(null);
      setSelectedPreviewUrl("");
      setImageUrl("");
      setPhotoError("");
      setCropOpen(false);
      if (fileRef.current) fileRef.current.value = "";
      window.dispatchEvent(new CustomEvent("devarena:profile-updated"));
      toast.success("Profile photo updated in high quality.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Profile photo could not be updated.";
      if (cropOpen) setPhotoError(message);
      else toast.error(message);
    } finally {
      setSavingKey(null);
    }
  }

  function savePhoto() {
    if (selectedFile && selectedPreviewUrl) {
      setPhotoError("");
      setCropOpen(true);
      return;
    }
    if (imageUrl.trim()) void uploadProfilePhoto({ imageUrl: imageUrl.trim() });
  }

  function selectProfileFile(file: File | null) {
    setSelectedFile(file);
    setPhotoError("");
    setCropOpen(false);
    setImageUrl("");
    setSelectedPreviewUrl((current) => {
      if (current.startsWith("blob:")) URL.revokeObjectURL(current);
      return file ? URL.createObjectURL(file) : "";
    });
  }

  async function requestVerification() {
    try {
      setSavingKey("identity-request");
      const result = await requestIdentityChange({ name: newName, email: newEmail });
      setOtpRequested(true);
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification code could not be sent.");
    } finally {
      setSavingKey(null);
    }
  }

  async function verifyIdentity() {
    try {
      setSavingKey("identity-confirm");
      const next = await confirmIdentityChange(identityOtp);
      setSettings(next);
      setNewName(next.name);
      setNewEmail(next.email);
      setIdentityOtp("");
      setOtpRequested(false);
      window.dispatchEvent(new CustomEvent("devarena:profile-updated"));
      toast.success("Public identity updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Identity change could not be verified.");
    } finally {
      setSavingKey(null);
    }
  }

  async function connectGitHub() {
    try {
      setSavingKey("github-connect");
      const result = await GitHubApi.startConnection();
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GitHub connection could not start.");
      setSavingKey(null);
    }
  }

  async function installGitHubApp() {
    try {
      setSavingKey("github-install");
      const result = await GitHubApi.startInstallation();
      window.location.assign(result.installationUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GitHub App installation could not start.");
      setSavingKey(null);
    }
  }

  async function refreshGitHubStatus() {
    try {
      setSavingKey("github-refresh");
      const next = await GitHubApi.status();
      setGithubStatus(next);
      if (next.connected) toast.success("GitHub connection is active for private repository language requests.");
      else toast("GitHub is not connected. Public repository language requests still work.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GitHub repository access could not be refreshed.");
    } finally {
      setSavingKey(null);
    }
  }

  async function disconnectGitHub() {
    if (!window.confirm("Disconnect GitHub from DevArena? Existing language evidence remains, but it cannot be refreshed.")) return;
    try {
      setSavingKey("github-disconnect");
      await GitHubApi.disconnect();
      setGithubStatus(await GitHubApi.status());
      toast.success("GitHub disconnected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GitHub could not be disconnected.");
    } finally {
      setSavingKey(null);
    }
  }

  async function exportData() {
    try {
      setSavingKey("export");
      const blob = await downloadAccountData();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `devarena-data-report-${new Date().toISOString().slice(0, 10)}.html`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Your readable data report is ready.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Data export failed.");
    } finally {
      setSavingKey(null);
    }
  }

  function clearLocalSettings() {
    const token = localStorage.getItem("token");
    localStorage.clear();
    if (token) localStorage.setItem("token", token);
    toast.success("Local interface settings cleared.");
  }

  async function permanentlyDeleteAccount() {
    try {
      setSavingKey("delete");
      await deleteAccount(deleteConfirmation);
      logout();
      navigate("/", { replace: true });
      toast.success("Account deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account could not be deleted.");
    } finally {
      setSavingKey(null);
    }
  }

  async function confirmRemoveFriend(friendId: string) {
    if (removingFriendId !== friendId) {
      setRemovingFriendId(friendId);
      return;
    }
    try {
      setSavingKey(`friend-${friendId}`);
      await removeFriend(friendId);
      setFriends((current) => current ? { ...current, friends: current.friends.filter(({ friend }) => friend.id !== friendId) } : current);
      setRemovingFriendId(null);
      toast.success("Player removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Player could not be removed.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <main className="settings-page animated-page">
      <header className="settings-hero page-reveal">
        <div>
          <p className="settings-eyebrow">Account command centre</p>
          <h1>Settings</h1>
        </div>
        <p>Control how your identity, workspace, network, and notifications operate across DevArena.</p>
      </header>

      <div className="settings-layout">
        <section className="settings-section settings-photo-section page-reveal" style={{ "--reveal-order": 1 } as CSSProperties}>
          <div className="settings-section-heading">
            <div><p>01 / Profile privacy</p><h2>Photo display</h2></div>
            <Toggle checked={settings.useInitials} busy={savingKey === "useInitials"} onChange={(value) => void updateToggle("useInitials", value)} label="Use initials instead of photo" />
          </div>
          <p className="settings-copy">Hide your profile picture and show first and last initials to players.</p>

          <div className="photo-workspace">
            <div className="profile-preview-card">
              <p>Profile preview</p>
              <div className="settings-avatar" aria-label="Profile preview">
                {previewSource ? <img src={previewSource} alt="Profile preview" decoding="async" /> : <span>{initials(settings.name)}</span>}
              </div>
              <strong>{settings.name}</strong>
              <span>@{settings.username}</span>
            </div>

            <div className="photo-update-card">
              <p className="settings-kicker">Profile photo update</p>
              <h3>Upload securely</h3>
              <p>New file uploads are stored on Cloudinary. A direct image URL remains available as a fallback.</p>
              <label className="file-line">
                <span>Upload profile photo</span>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => selectProfileFile(event.target.files?.[0] || null)} />
                <em>{selectedFile?.name || "No file chosen"}</em>
              </label>
              <label className="settings-line-field">
                <span>Or paste image URL</span>
                <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder=" " aria-label="Image URL" />
              </label>
              <UnderlineButton disabled={savingKey === "photo" || (!selectedFile && !imageUrl.trim())} loading={savingKey === "photo"} onClick={savePhoto}>{selectedFile ? "Crop and save profile photo" : "Save profile photo"}</UnderlineButton>
            </div>
          </div>
        </section>

        <section className="settings-section page-reveal" style={{ "--reveal-order": 2 } as CSSProperties}>
          <div className="settings-section-heading">
            <div><p>02 / Public identity</p><h2>Unique username</h2></div>
            <span className="settings-status">Permanent</span>
          </div>
          <p className="settings-copy">Your username cannot be changed. Name and email updates require a one-time code sent to the current registered email.</p>

          <div className="identity-details-card">
            <div className="identity-fields-grid">
              <div className="identity-static-field">
                <span>Permanent DevArena Username</span>
                <strong>{settings.username}</strong>
              </div>
              <label className="settings-line-field identity-line-field">
                <span>Account name</span>
                <input placeholder=" " value={newName} onChange={(event) => setNewName(event.target.value)} />
              </label>
              <label className="settings-line-field identity-line-field">
                <span>Registered email</span>
                <input type="email" placeholder=" " value={newEmail} onChange={(event) => setNewEmail(event.target.value)} />
              </label>
            </div>
            <p className="identity-permanent-note">The DevArena username is permanent. Name and email changes require verification through the current registered email.</p>
            {!otpRequested ? (
              <UnderlineButton disabled={!identityChanged} loading={savingKey === "identity-request"} onClick={() => void requestVerification()}>Verify identity change</UnderlineButton>
            ) : (
              <div className="identity-otp-row">
                <label className="settings-line-field"><span>One-time code</span><input inputMode="numeric" maxLength={6} placeholder=" " value={identityOtp} onChange={(event) => setIdentityOtp(event.target.value.replace(/\D/g, ""))} /></label>
                <UnderlineButton disabled={identityOtp.length !== 6} loading={savingKey === "identity-confirm"} onClick={() => void verifyIdentity()}>Confirm change</UnderlineButton>
              </div>
            )}
          </div>
        </section>

        <section className="settings-section github-settings-section page-reveal" style={{ "--reveal-order": 3 } as CSSProperties}>
          <div className="settings-section-heading">
            <div><p>03 / GitHub integration</p><h2>Repository languages</h2></div>
            <span className={`settings-status${githubStatus?.connected ? " connected" : ""}`}>{githubStatus?.connected ? "Connected" : "Optional"}</span>
          </div>
          <p className="settings-copy">DevArena reads only GitHub&apos;s repository language endpoint. Public repositories work from their URL without connecting an account. Connect and install the GitHub App only when a private repository must be read.</p>

          <div className="github-settings-grid">
            <article>
              <p>Connected account</p>
              <h3>{githubStatus?.githubLogin ? `@${githubStatus.githubLogin}` : "Not connected"}</h3>
              <span>{githubStatus?.connectedAt ? <>Connected <LiveDateTime value={githubStatus.connectedAt} /></> : "Only required for private repository language data."}</span>
            </article>
            <article>
              <p>Stored GitHub data</p>
              <h3>Languages only</h3>
              <span>DevArena saves the repository URL, calculated language percentages, and refresh time.</span>
            </article>
          </div>

          {!githubStatus?.configReady && githubStatus?.missingConfiguration?.length ? (
            <div className="github-settings-alert">Private repository support is incomplete: {githubStatus.missingConfiguration.join(", ")}</div>
          ) : null}

          <div className="github-settings-actions">
            <UnderlineButton loading={savingKey === "github-connect"} onClick={() => void connectGitHub()}>{githubStatus?.connected ? "Reconnect GitHub" : "Connect GitHub for private repos"}</UnderlineButton>
            {githubStatus?.connected && <UnderlineButton loading={savingKey === "github-install"} onClick={() => void installGitHubApp()}>Install or manage private repo access</UnderlineButton>}
            {githubStatus?.connected && <UnderlineButton loading={savingKey === "github-refresh"} onClick={() => void refreshGitHubStatus()}>Check connection</UnderlineButton>}
            {githubStatus?.connected && <UnderlineButton danger loading={savingKey === "github-disconnect"} onClick={() => void disconnectGitHub()}>Disconnect GitHub</UnderlineButton>}
          </div>
        </section>

        {preferenceGroups.map((group, groupIndex) => (
          <section className="settings-section page-reveal" style={{ "--reveal-order": groupIndex + 4 } as CSSProperties} key={group.eyebrow}>
            <div className="settings-section-heading"><div><p>{String(groupIndex + 4).padStart(2, "0")} / {group.eyebrow}</p><h2>{group.title}</h2></div></div>
            <div className="preference-list">
              {group.items.map((item) => (
                <div className="preference-row" key={item.key}>
                  <div><h3>{item.title}</h3><p>{item.copy}</p></div>
                  <Toggle checked={settings[item.key]} busy={savingKey === item.key} onChange={(value) => void updateToggle(item.key, value)} label={item.title} />
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="settings-section settings-support-section page-reveal" style={{ "--reveal-order": 6 } as CSSProperties}>
          <div className="settings-section-heading">
            <div><p>06 / Support &amp; feedback</p><h2>Help and product feedback</h2></div>
          </div>
          <p className="settings-copy">Open the support knowledge base or send a structured report about any DevArena feature.</p>
          <div className="github-settings-grid settings-support-grid">
            <article><p>Support</p><h3>Need help?</h3><span>Open troubleshooting guidance and common DevArena questions.</span><UnderlineButton onClick={() => navigate("/support")}>Open support</UnderlineButton></article>
            <article><p>Feedback</p><h3>Report a feature</h3><span>Choose the affected feature and describe what went wrong.</span><UnderlineButton onClick={() => navigate("/feedback")}>Send feedback</UnderlineButton></article>
          </div>
        </section>

        <section className="settings-section danger-section page-reveal" style={{ "--reveal-order": 7 } as CSSProperties}>
          <div className="settings-section-heading"><div><p>07 / Danger zone</p><h2>Account control</h2></div></div>
          <p className="settings-copy">Download a readable DevArena data report with clear sections for your profile, projects, DSA activity, scores, network, notifications, and account preferences. Security credentials and unreadable encrypted payloads are never included.</p>
          <div className="danger-actions">
            <UnderlineButton loading={savingKey === "export"} onClick={() => void exportData()}>Download my data</UnderlineButton>
            <UnderlineButton onClick={clearLocalSettings}>Clear local app settings</UnderlineButton>
            <div className="delete-account-control">
              <label className="settings-line-field"><span>Type DELETE to confirm</span><input placeholder=" " value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} /></label>
              <UnderlineButton danger disabled={deleteConfirmation.trim().toUpperCase() !== "DELETE"} loading={savingKey === "delete"} onClick={() => void permanentlyDeleteAccount()}>Delete account</UnderlineButton>
            </div>
          </div>
        </section>

        <section className="settings-section settings-friends-section page-reveal" style={{ "--reveal-order": 8 } as CSSProperties}>
          <div className="settings-section-heading">
            <div><p>08 / Player control</p><h2>Delete a player</h2></div>
            <UnderlineButton onClick={() => navigate("/players")}>Open Players page</UnderlineButton>
          </div>
          <label className="settings-line-field friend-search-field"><span>Search by name, username, or email</span><input placeholder=" " value={friendQuery} onChange={(event) => setFriendQuery(event.target.value)} /></label>
          <div className="settings-friend-list">
            {visibleFriends.map(({ friend, friendsSince }) => (
              <article className="settings-friend-row" key={friend.id}>
                <div className="mini-avatar">{friend.avatarUrl && !friend.useInitials ? <img src={friend.avatarUrl} alt="" /> : <span>{initials(friend.name)}</span>}</div>
                <div><h3>{friend.name}</h3><p>{friend.email || "Email hidden"}</p><span>Connected <LiveDateTime value={friendsSince} mode="relative" /></span></div>
                <UnderlineButton danger loading={savingKey === `friend-${friend.id}`} onClick={() => void confirmRemoveFriend(friend.id)}>{removingFriendId === friend.id ? "Confirm remove" : "Remove"}</UnderlineButton>
              </article>
            ))}
            {visibleFriends.length === 0 && <div className="settings-empty">No matching players found.</div>}
          </div>
        </section>
      </div>
      {cropOpen && selectedPreviewUrl && (
        <ProfilePhotoCropper
          source={selectedPreviewUrl}
          busy={savingKey === "photo"}
          error={photoError}
          onCancel={() => { if (savingKey !== "photo") { setPhotoError(""); setCropOpen(false); } }}
          onConfirm={(imageData) => void uploadProfilePhoto({ imageData })}
        />
      )}
    </main>
  );
}

function Toggle({ checked, busy, onChange, label }: { checked: boolean; busy?: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button type="button" className={`settings-toggle${checked ? " active" : ""}${busy ? " busy" : ""}`} role="switch" aria-checked={checked} aria-label={label} disabled={busy} onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

function UnderlineButton({ children, onClick, disabled, loading, danger }: { children: ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; danger?: boolean }) {
  return (
    <button type="button" className={`settings-underline-action${danger ? " danger" : ""}`} onClick={onClick} disabled={disabled || loading}>
      {loading ? <span className="settings-button-loader" aria-label="Working" /> : children}
    </button>
  );
}
