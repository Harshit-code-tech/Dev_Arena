import { ensureChatDeviceToken, getChatDeviceName } from "./ChatDeviceStorageService";
import { deleteStoredChatIdentity, getExportablePrivateJwk, getStoredChatIdentity, saveStoredChatIdentity } from "./ChatIdentityStorageService";
import { PlayerHubApi, PlayerHubRequestError } from "./PlayerHubService";

const PRIVATE_PREFIX = "devarena_chat_private_key_v1:";
const PUBLIC_PREFIX = "devarena_chat_public_key_v1:";

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return window.btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function samePublicKey(a: JsonWebKey | null | undefined, b: JsonWebKey | null | undefined) {
  return Boolean(a && b && a.kty === b.kty && a.crv === b.crv && a.x === b.x && a.y === b.y);
}

function legacyStoredKeys(userId: string) {
  const privateRaw = localStorage.getItem(`${PRIVATE_PREFIX}${userId}`);
  const publicRaw = localStorage.getItem(`${PUBLIC_PREFIX}${userId}`);
  if (!privateRaw || !publicRaw) return null;
  try {
    return {
      privateJwk: JSON.parse(privateRaw) as JsonWebKey,
      publicJwk: JSON.parse(publicRaw) as JsonWebKey,
    };
  } catch {
    localStorage.removeItem(`${PRIVATE_PREFIX}${userId}`);
    localStorage.removeItem(`${PUBLIC_PREFIX}${userId}`);
    return null;
  }
}

function clearLegacyKeys(userId: string) {
  localStorage.removeItem(`${PRIVATE_PREFIX}${userId}`);
  localStorage.removeItem(`${PUBLIC_PREFIX}${userId}`);
}

async function importPrivate(value: JsonWebKey) {
  return window.crypto.subtle.importKey(
    "jwk",
    value,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
}

function identityFromStored(privateKey: CryptoKey, publicJwk: JsonWebKey, keyVersion: number, status: ChatIdentity["status"]) {
  return {
    privateKey,
    publicKey: publicJwk,
    keyVersion,
    status,
    recoveryProtected: true,
  } satisfies ChatIdentity;
}

async function identityFromKeys(privateJwk: JsonWebKey, publicJwk: JsonWebKey, keyVersion: number, status: ChatIdentity["status"]) {
  return identityFromStored(await importPrivate(privateJwk), publicJwk, keyVersion, status);
}

async function authoriseChatDevice(privateKey: CryptoKey) {
  const deviceToken = ensureChatDeviceToken();
  const challenge = await PlayerHubApi.chatDeviceChallenge();
  const serverPublicKey = await window.crypto.subtle.importKey(
    "raw",
    base64ToBytes(challenge.serverPublicKey),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const sharedBits = await window.crypto.subtle.deriveBits(
    { name: "ECDH", public: serverPublicKey },
    privateKey,
    256,
  );
  const hmacKey = await window.crypto.subtle.importKey(
    "raw",
    sharedBits,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const proof = await window.crypto.subtle.sign(
    "HMAC",
    hmacKey,
    new TextEncoder().encode(`devarena-chat-device-v1:${challenge.nonce}:${deviceToken}`),
  );
  await PlayerHubApi.registerChatDevice({
    deviceToken,
    deviceName: getChatDeviceName(),
    challengeToken: challenge.challengeToken,
    proof: bytesToBase64(new Uint8Array(proof)),
  });
}

export type ChatIdentityAction = "SETUP_REQUIRED" | "BACKUP_REQUIRED" | "RECOVERY_REQUIRED" | "LEGACY_KEY_MISSING";

export class ChatIdentityActionError extends Error {
  action: ChatIdentityAction;

  constructor(action: ChatIdentityAction, message: string) {
    super(message);
    this.name = "ChatIdentityActionError";
    this.action = action;
  }
}

export type ChatIdentity = {
  privateKey: CryptoKey;
  publicKey: JsonWebKey;
  keyVersion: number;
  status: "ready" | "created" | "restored";
  recoveryProtected: boolean;
};

export async function ensureChatIdentity(userId: string): Promise<ChatIdentity> {
  if (!window.crypto?.subtle) throw new Error("This browser does not support secure direct messaging.");
  const [server, authenticator, stored] = await Promise.all([
    PlayerHubApi.getChatKey(),
    PlayerHubApi.chatAuthenticatorStatus(),
    getStoredChatIdentity(userId).catch(() => undefined),
  ]);
  const legacy = stored ? null : legacyStoredKeys(userId);
  const local = stored
    ? { privateKey: stored.privateKey, publicJwk: stored.publicJwk }
    : legacy
      ? { privateKey: await importPrivate(legacy.privateJwk), publicJwk: legacy.publicJwk }
      : null;

  if (local) {
    if (server.chatPublicKey && !samePublicKey(server.chatPublicKey, local.publicJwk)) {
      throw new Error("The local secure-chat key does not match this account. Restore the account key instead of replacing it.");
    }
    if (!server.chatPublicKey) await PlayerHubApi.saveChatKey(local.publicJwk);
    if (!authenticator.configured) {
      throw new ChatIdentityActionError("BACKUP_REQUIRED", "Enable Google Authenticator recovery before continuing secure chat.");
    }
    const identity = identityFromStored(local.privateKey, local.publicJwk, server.chatKeyVersion || authenticator.keyVersion || 1, "ready");
    if (!authenticator.currentDeviceRegistered) {
      try {
        await authoriseChatDevice(identity.privateKey);
      } catch (reason) {
        if (reason instanceof PlayerHubRequestError && reason.status === 403) {
          await deleteStoredChatIdentity(userId).catch(() => undefined);
          throw new ChatIdentityActionError("RECOVERY_REQUIRED", "This browser was revoked. Verify with Google Authenticator to authorise it again.");
        }
        throw reason;
      }
    }
    if (!stored) {
      await saveStoredChatIdentity(userId, identity.privateKey, identity.publicKey, legacy?.privateJwk);
      clearLegacyKeys(userId);
    }
    return identity;
  }

  if (authenticator.configured) {
    throw new ChatIdentityActionError("RECOVERY_REQUIRED", "Verify with Google Authenticator to restore secure messages on this browser.");
  }
  if (server.chatPublicKey) {
    throw new ChatIdentityActionError("LEGACY_KEY_MISSING", "Google Authenticator recovery is not enabled yet. Open a browser that already decrypts your messages and enable it there.");
  }
  throw new ChatIdentityActionError("SETUP_REQUIRED", "Set up secure messaging and protect it with Google Authenticator.");
}

export type ChatAuthenticatorSetupState = {
  setupToken: string;
  setupKey: string;
  otpauthUri: string;
  accountLabel: string;
  expiresAt: string;
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
  status: ChatIdentity["status"];
};

export async function prepareChatAuthenticatorSetup(userId: string): Promise<ChatAuthenticatorSetupState> {
  if (!window.crypto?.subtle) throw new Error("This browser does not support secure direct messaging.");
  const [server, setup, stored] = await Promise.all([
    PlayerHubApi.getChatKey(),
    PlayerHubApi.beginChatAuthenticatorSetup(),
    getStoredChatIdentity(userId).catch(() => undefined),
  ]);
  const legacy = stored ? null : legacyStoredKeys(userId);

  let privateJwk: JsonWebKey;
  let publicJwk: JsonWebKey;
  let status: ChatIdentity["status"] = "ready";

  if (legacy) {
    privateJwk = legacy.privateJwk;
    publicJwk = legacy.publicJwk;
  } else if (stored) {
    try {
      privateJwk = await getExportablePrivateJwk(userId);
      publicJwk = stored.publicJwk;
    } catch {
      throw new Error("This browser has an older non-exportable chat key. Use the browser where secure-chat recovery was originally configured, or reset secure messaging if that key is no longer available.");
    }
  } else {
    if (server.chatPublicKey) {
      throw new Error("Open a browser that already decrypts your secure messages to enable Google Authenticator recovery.");
    }
    const pair = await window.crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    privateJwk = await window.crypto.subtle.exportKey("jwk", pair.privateKey);
    publicJwk = await window.crypto.subtle.exportKey("jwk", pair.publicKey);
    status = "created";
  }

  if (server.chatPublicKey && !samePublicKey(server.chatPublicKey, publicJwk)) {
    throw new Error("This browser does not hold the secure-chat identity registered to your account.");
  }

  return { ...setup, privateJwk, publicJwk, status };
}

export async function confirmChatAuthenticatorSetup(userId: string, setup: ChatAuthenticatorSetupState, code: string) {
  const result = await PlayerHubApi.confirmChatAuthenticatorSetup({
    setupToken: setup.setupToken,
    code,
    publicKey: setup.publicJwk,
    privateKey: setup.privateJwk,
    deviceToken: ensureChatDeviceToken(),
    deviceName: getChatDeviceName(),
  });
  const identity = await identityFromKeys(setup.privateJwk, setup.publicJwk, result.keyVersion || 1, setup.status);
  await saveStoredChatIdentity(userId, identity.privateKey, setup.publicJwk, setup.privateJwk);
  clearLegacyKeys(userId);
  return identity;
}

export async function restoreChatIdentityWithAuthenticator(userId: string, code: string) {
  const restored = await PlayerHubApi.restoreChatWithAuthenticator({
    code,
    deviceToken: ensureChatDeviceToken(),
    deviceName: getChatDeviceName(),
  });
  if (!samePublicKey(restored.privateKey, restored.publicKey)) {
    throw new Error("The recovered secure-chat identity does not match this account.");
  }
  const identity = await identityFromKeys(restored.privateKey, restored.publicKey, restored.keyVersion || 1, "restored");
  await saveStoredChatIdentity(userId, identity.privateKey, restored.publicKey, restored.privateKey);
  clearLegacyKeys(userId);
  return identity;
}

export async function forgetLocalChatIdentity(userId: string) {
  clearLegacyKeys(userId);
  await deleteStoredChatIdentity(userId).catch(() => undefined);
}

const conversationKeyCache = new Map<string, Promise<CryptoKey>>();

async function deriveConversationKey(identity: ChatIdentity, peerPublicKey: JsonWebKey, conversationId: string) {
  const cacheKey = `${conversationId}:${identity.keyVersion}:${peerPublicKey.x || ""}:${peerPublicKey.y || ""}`;
  const cached = conversationKeyCache.get(cacheKey);
  if (cached) return cached;
  const pending = (async () => {
    const peerKey = await window.crypto.subtle.importKey(
      "jwk",
      peerPublicKey,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    const sharedBits = await window.crypto.subtle.deriveBits(
      { name: "ECDH", public: peerKey },
      identity.privateKey,
      256,
    );
    const hkdfMaterial = await window.crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey"]);
    return window.crypto.subtle.deriveKey(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: new TextEncoder().encode(conversationId),
        info: new TextEncoder().encode("devarena-direct-chat-v1"),
      },
      hkdfMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  })();
  conversationKeyCache.set(cacheKey, pending);
  try { return await pending; } catch (reason) { conversationKeyCache.delete(cacheKey); throw reason; }
}

export async function encryptDirectMessage(
  content: string,
  identity: ChatIdentity,
  peerPublicKey: JsonWebKey,
  conversationId: string,
) {
  const key = await deriveConversationKey(identity, peerPublicKey, conversationId);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(content),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
    algorithm: "AES-GCM",
    senderKeyVersion: identity.keyVersion,
  };
}

export async function decryptDirectMessage(
  ciphertext: string,
  iv: string,
  identity: ChatIdentity,
  peerPublicKey: JsonWebKey,
  conversationId: string,
) {
  const key = await deriveConversationKey(identity, peerPublicKey, conversationId);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}
