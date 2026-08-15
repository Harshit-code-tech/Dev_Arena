import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import {
  confirmChatAuthenticatorSetup,
  prepareChatAuthenticatorSetup,
  restoreChatIdentityWithAuthenticator,
  type ChatAuthenticatorSetupState,
  type ChatIdentity,
  type ChatIdentityAction,
} from "../../../services/PlayerHubCryptoService";
import {
  PlayerHubApi,
  type ChatAuthenticatorStatus,
  type ChatDevice,
} from "../../../services/PlayerHubService";
import LiveDateTime from "../../../shared/components/LiveDateTime";
import TotpQrCode from "./TotpQrCode";

type RecoveryPanelMode = ChatIdentityAction | "MANAGE";
type Props = {
  userId: string;
  mode: RecoveryPanelMode;
  message?: string;
  onReady: (identity: ChatIdentity) => void;
  onClose?: () => void;
};

function cleanCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export default function SecureChatRecoveryPanel({ userId, mode, message, onReady, onClose }: Props) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState<ChatAuthenticatorSetupState | null>(null);
  const [devices, setDevices] = useState<ChatDevice[]>([]);
  const [authenticator, setAuthenticator] = useState<ChatAuthenticatorStatus | null>(null);
  const [showSetupKey, setShowSetupKey] = useState(false);

  const title = useMemo(() => {
    if (mode === "RECOVERY_REQUIRED") return "Restore secure messages";
    if (mode === "BACKUP_REQUIRED") return "Protect your existing chat key";
    if (mode === "LEGACY_KEY_MISSING") return "Authenticator setup required";
    if (mode === "MANAGE") return "Secure messaging protection";
    return "Set up secure messaging";
  }, [mode]);

  useEffect(() => {
    setCode("");
    setSetup(null);
    setShowSetupKey(false);
    if (mode !== "MANAGE") return;
    void Promise.all([
      PlayerHubApi.chatAuthenticatorStatus(),
      PlayerHubApi.chatDevices().catch(() => []),
    ]).then(([status, nextDevices]) => {
      setAuthenticator(status);
      setDevices(nextDevices);
    }).catch(() => undefined);
  }, [mode]);

  async function startSetup() {
    setBusy(true);
    try {
      const next = await prepareChatAuthenticatorSetup(userId);
      setSetup(next);
      setCode("");
      setShowSetupKey(false);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Google Authenticator setup could not start.");
    } finally {
      setBusy(false);
    }
  }

  async function enableAuthenticator() {
    if (!setup || code.length !== 6) return;
    setBusy(true);
    try {
      const identity = await confirmChatAuthenticatorSetup(userId, setup, code);
      toast.success("Google Authenticator is now protecting secure-message recovery.");
      onReady(identity);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Google Authenticator setup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (code.length !== 6) return;
    setBusy(true);
    try {
      const identity = await restoreChatIdentityWithAuthenticator(userId, code);
      toast.success("Secure messages restored on this browser.");
      onReady(identity);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Secure-message recovery failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copySetupKey() {
    if (!setup) return;
    await navigator.clipboard.writeText(setup.setupKey.replace(/\s/g, ""));
    toast.success("Authenticator setup key copied.");
  }

  async function revoke(device: ChatDevice) {
    if (device.current || device.revokedAt) return;
    setBusy(true);
    try {
      await PlayerHubApi.revokeChatDevice(device.id);
      setDevices(await PlayerHubApi.chatDevices());
      toast.success("Secure-chat browser revoked.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Browser could not be revoked.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="secure-chat-recovery secure-chat-authenticator" aria-label={title}>
      <header>
        <div>
          <p>Secure messaging</p>
          <h3>{title}</h3>
        </div>
        {onClose && <button type="button" className="secure-chat-text-button" onClick={onClose}>Close</button>}
      </header>

      {mode === "LEGACY_KEY_MISSING" ? (
        <div className="secure-chat-recovery-copy">
          <p>{message}</p>
          <strong>Open DevArena in a browser that already decrypts your existing messages.</strong>
          <span>Then open Direct Messaging → Manage security and enable Google Authenticator. A private key that no browser still holds cannot be reconstructed.</span>
        </div>
      ) : mode === "RECOVERY_REQUIRED" ? (
        <div className="secure-chat-auth-card">
          <div className="secure-chat-auth-icon" aria-hidden="true"><i className="bx bx-mobile-alt" /></div>
          <div className="secure-chat-auth-copy">
            <p>Google Authenticator</p>
            <h4>Verify this browser</h4>
            <span>Open Google Authenticator on your phone and enter the current 6-digit code for DevArena.</span>
          </div>
          <label className="secure-chat-otp-field">
            <span>6-digit code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(cleanCode(event.target.value))}
              placeholder="000000"
              aria-label="Google Authenticator code"
            />
          </label>
          <button type="button" className="secure-chat-action" disabled={busy || code.length !== 6} onClick={() => void restore()}>
            {busy ? "Verifying…" : "Restore secure messages"}
          </button>
          <small className="secure-chat-auth-note">Codes refresh every 30 seconds. If a code has just changed, use the newest one.</small>
        </div>
      ) : mode === "MANAGE" ? (
        <div className="secure-chat-device-manager">
          <div className="secure-chat-auth-status">
            <div>
              <p>Recovery method</p>
              <h4>Google Authenticator</h4>
              <span>{authenticator?.configured ? "Enabled" : "Not configured"}</span>
            </div>
            <i className={`bx ${authenticator?.configured ? "bx-check-shield" : "bx-error"}`} aria-hidden="true" />
          </div>

          {authenticator?.enabledAt && (
            <div className="secure-chat-auth-meta">
              <span>Enabled</span>
              <strong><LiveDateTime value={authenticator.enabledAt} mode="full" /></strong>
              <span>Last recovery verification</span>
              <strong>{authenticator.lastVerifiedAt ? <LiveDateTime value={authenticator.lastVerifiedAt} mode="full" /> : "Not used yet"}</strong>
            </div>
          )}

          <div className="secure-chat-security-block">
            <div>
              <p>Browsers</p>
              <h4>Authorised secure-message sessions</h4>
            </div>
            <span>These browsers currently hold your local secure-message key. Revoke any browser you no longer trust.</span>
          </div>
          <div className="secure-chat-device-list">
            {devices.map((device) => (
              <article key={device.id} className={device.revokedAt ? "revoked" : ""}>
                <div>
                  <strong>{device.name}{device.current ? " · This browser" : ""}</strong>
                  <span>Last used <LiveDateTime value={device.lastSeenAt} mode="full" /></span>
                </div>
                <button
                  type="button"
                  className="secure-chat-text-button"
                  disabled={busy || device.current || Boolean(device.revokedAt)}
                  onClick={() => void revoke(device)}
                >
                  {device.revokedAt ? "Revoked" : device.current ? "Current" : "Revoke"}
                </button>
              </article>
            ))}
          </div>
          <p className="secure-chat-footnote">On a new browser, DevArena asks only for your current Google Authenticator code. Recovery is server-assisted: the secure-message private key is encrypted at rest and released to your authenticated session only after a valid one-time code.</p>
        </div>
      ) : (
        <div className="secure-chat-auth-setup">
          {!setup ? (
            <>
              <div className="secure-chat-auth-card compact">
                <div className="secure-chat-auth-icon" aria-hidden="true"><i className="bx bx-mobile-alt" /></div>
                <div className="secure-chat-auth-copy">
                  <p>Recovery protection</p>
                  <h4>Use Google Authenticator</h4>
                  <span>{message || "Protect secure messages so the same encrypted conversation history can be restored in another browser."}</span>
                </div>
                <button type="button" className="secure-chat-action" disabled={busy} onClick={() => void startSetup()}>
                  {busy ? "Preparing…" : "Set up Google Authenticator"}
                </button>
              </div>
            </>
          ) : (
            <div className="secure-chat-auth-card setup">
              <div className="secure-chat-auth-copy">
                <p>Step 1</p>
                <h4>Scan with Google Authenticator</h4>
                <span>Open Google Authenticator on your phone, tap +, choose Scan a QR code, then scan this code.</span>
              </div>

              <div className="secure-chat-qr-panel">
                <div className="secure-chat-qr-frame">
                  <TotpQrCode value={setup.otpauthUri} />
                </div>
                <div className="secure-chat-qr-copy">
                  <strong>{setup.accountLabel}</strong>
                  <span>The QR code is generated inside your browser from DevArena's Authenticator setup URI. It is not sent to a third-party QR service.</span>
                </div>
              </div>

              <button
                type="button"
                className="secure-chat-text-button secure-chat-setup-fallback"
                onClick={() => setShowSetupKey((current) => !current)}
                aria-expanded={showSetupKey}
              >
                {showSetupKey ? "Hide setup key" : "Can't scan? Show setup key"}
              </button>

              {showSetupKey && (
                <div className="secure-chat-setup-details secure-chat-setup-key-fallback">
                  <div><span>Account</span><strong>{setup.accountLabel}</strong></div>
                  <div><span>Key type</span><strong>Time based</strong></div>
                  <div className="key"><span>Setup key</span><strong>{setup.setupKey}</strong></div>
                  <button type="button" className="secure-chat-text-button" onClick={() => void copySetupKey()}>Copy setup key</button>
                </div>
              )}

              <div className="secure-chat-auth-copy verify">
                <p>Step 2</p>
                <h4>Verify the first code</h4>
                <span>After scanning, enter the current 6-digit code shown for DevArena in Google Authenticator.</span>
              </div>
              <label className="secure-chat-otp-field">
                <span>6-digit code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(cleanCode(event.target.value))}
                  placeholder="000000"
                  aria-label="Google Authenticator code"
                />
              </label>
              <button type="button" className="secure-chat-action" disabled={busy || code.length !== 6} onClick={() => void enableAuthenticator()}>
                {busy ? "Verifying…" : "Enable Google Authenticator"}
              </button>
              <small className="secure-chat-auth-note">The setup session expires in about 10 minutes. DevArena never stores your six-digit codes.</small>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
