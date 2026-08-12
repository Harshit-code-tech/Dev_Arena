import {
  createCipheriv,
  createDecipheriv,
  createECDH,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma";

const DEFAULT_ITERATIONS = 310_000;
const DEVICE_CHALLENGE_TTL_MS = 5 * 60_000;

function error(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function cleanString(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "string") throw error(`${label} is required.`);
  const clean = value.trim();
  if (clean.length < min || clean.length > max) throw error(`${label} is invalid.`);
  return clean;
}

function publicKey(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw error("Public key is invalid.");
  const key = value as Record<string, unknown>;
  if (key.kty !== "EC" || key.crv !== "P-256" || typeof key.x !== "string" || typeof key.y !== "string") {
    throw error("Public key must be a P-256 ECDH key.");
  }
  return key as Prisma.InputJsonValue;
}

function samePublicKeyValue(left: Prisma.JsonValue | null, right: Prisma.JsonValue | Prisma.InputJsonValue) {
  if (!left || typeof left !== "object" || Array.isArray(left) || !right || typeof right !== "object" || Array.isArray(right)) return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  return a.kty === b.kty && a.crv === b.crv && a.x === b.x && a.y === b.y;
}

function deviceSecret() {
  const value = process.env.CHAT_DEVICE_SECRET?.trim();
  if (!value || value.length < 32) throw error("CHAT_DEVICE_SECRET must be configured with at least 32 characters.", 503);
  return value;
}

function base64UrlToBuffer(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function challengeEncryptionKey() {
  return createHash("sha256").update(deviceSecret()).digest();
}

function sealChallenge(payload: Record<string, unknown>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", challengeEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

function openChallenge(token: string) {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) throw new Error("short challenge");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", challengeEncryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return JSON.parse(plaintext) as { userId: string; nonce: string; expiresAt: number; ephemeralPrivateKey: string };
  } catch {
    throw error("Secure-chat device challenge is invalid or expired.", 401);
  }
}

function publicKeyBytes(value: Prisma.JsonValue) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw error("Account chat public key is unavailable.", 409);
  const key = value as Record<string, unknown>;
  if (key.kty !== "EC" || key.crv !== "P-256" || typeof key.x !== "string" || typeof key.y !== "string") {
    throw error("Account chat public key is invalid.", 409);
  }
  const x = base64UrlToBuffer(key.x);
  const y = base64UrlToBuffer(key.y);
  if (x.length !== 32 || y.length !== 32) throw error("Account chat public key is invalid.", 409);
  return Buffer.concat([Buffer.from([4]), x, y]);
}

function verifyDeviceProof(userId: string, input: Record<string, unknown>, accountPublicKey: Prisma.JsonValue) {
  const challengeToken = cleanString(input.challengeToken, "Device challenge", 40, 4000);
  const proof = cleanString(input.proof, "Device proof", 20, 512);
  const deviceToken = cleanString(input.deviceToken, "Device token", 32, 256);
  const challenge = openChallenge(challengeToken);
  if (challenge.userId !== userId || challenge.expiresAt < Date.now()) {
    throw error("Secure-chat device challenge is invalid or expired.", 401);
  }
  try {
    const ecdh = createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(challenge.ephemeralPrivateKey, "base64url"));
    const sharedSecret = ecdh.computeSecret(publicKeyBytes(accountPublicKey));
    const expected = createHmac("sha256", sharedSecret)
      .update(`devarena-chat-device-v1:${challenge.nonce}:${deviceToken}`)
      .digest();
    const received = Buffer.from(proof, "base64");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new Error("proof mismatch");
    }
  } catch {
    throw error("This browser could not prove possession of the secure-chat private key.", 401);
  }
}

function hashDeviceToken(token: string) {
  return createHmac("sha256", deviceSecret()).update(token).digest("hex");
}

function parseDevice(input: Record<string, unknown>) {
  return {
    token: cleanString(input.deviceToken, "Device token", 32, 256),
    name: cleanString(input.deviceName, "Device name", 2, 80),
  };
}

function parseBackup(input: Record<string, unknown>) {
  const iterations = Number(input.kdfIterations ?? DEFAULT_ITERATIONS);
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) {
    throw error("Recovery key derivation settings are invalid.");
  }
  const kdf = input.kdf === undefined ? "PBKDF2-SHA256" : cleanString(input.kdf, "KDF", 3, 40);
  if (kdf !== "PBKDF2-SHA256") throw error("Unsupported recovery key derivation method.");
  return {
    publicKey: publicKey(input.publicKey),
    encryptedPrivateKey: cleanString(input.encryptedPrivateKey, "Encrypted private key", 32, 30_000),
    iv: cleanString(input.iv, "Backup IV", 8, 256),
    salt: cleanString(input.salt, "Backup salt", 8, 256),
    kdf,
    kdfIterations: iterations,
  };
}

async function upsertDevice(userId: string, input: Record<string, unknown>) {
  const device = parseDevice(input);
  const tokenHash = hashDeviceToken(device.token);
  const existing = await prisma.chatDevice.findUnique({ where: { tokenHash }, select: { id: true, userId: true, revokedAt: true } });
  if (existing && existing.userId !== userId) throw error("Secure-chat device token is already registered to another account.", 409);
  if (existing?.revokedAt) throw error("This secure-chat browser was revoked. Use a trusted browser or reset this browser before restoring again.", 403);
  return existing
    ? prisma.chatDevice.update({
        where: { id: existing.id },
        data: { name: device.name, lastSeenAt: new Date() },
        select: { id: true, name: true, createdAt: true, lastSeenAt: true, revokedAt: true },
      })
    : prisma.chatDevice.create({
        data: { userId, tokenHash, name: device.name },
        select: { id: true, name: true, createdAt: true, lastSeenAt: true, revokedAt: true },
      });
}

function parsePasskeyBackup(input: Record<string, unknown>) {
  return {
    credentialId: cleanString(input.credentialId, "Passkey credential", 20, 2048),
    name: cleanString(input.name, "Passkey name", 2, 80),
    encryptedPrivateKey: cleanString(input.encryptedPrivateKey, "Encrypted private key", 32, 30_000),
    iv: cleanString(input.iv, "Passkey backup IV", 8, 256),
    prfSalt: cleanString(input.prfSalt, "Passkey PRF salt", 8, 256),
    keyVersion: Math.max(1, Number(input.keyVersion) || 1),
  };
}

function transferCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes.values(), (value: number) => alphabet[value % alphabet.length]).join("");
}

export const chatSecurityService = {
  async deviceStatus(userId: string, deviceToken?: string) {
    const activeDeviceCount = await prisma.chatDevice.count({ where: { userId, revokedAt: null } });
    let currentDeviceRegistered = false;
    if (deviceToken) {
      const tokenHash = hashDeviceToken(deviceToken);
      currentDeviceRegistered = Boolean(await prisma.chatDevice.findFirst({
        where: { userId, tokenHash, revokedAt: null },
        select: { id: true },
      }));
    }
    return { activeDeviceCount, currentDeviceRegistered };
  },

  async recoveryStatus(userId: string, deviceToken?: string) {
    const [backup, deviceCount] = await Promise.all([
      prisma.chatIdentityBackup.findUnique({
        where: { userId },
        select: { keyVersion: true, backupVersion: true, updatedAt: true },
      }),
      prisma.chatDevice.count({ where: { userId, revokedAt: null } }),
    ]);
    let currentDeviceRegistered = false;
    if (deviceToken) {
      const tokenHash = hashDeviceToken(deviceToken);
      currentDeviceRegistered = Boolean(await prisma.chatDevice.findFirst({
        where: { userId, tokenHash, revokedAt: null },
        select: { id: true },
      }));
    }
    return {
      hasBackup: Boolean(backup),
      keyVersion: backup?.keyVersion ?? null,
      backupVersion: backup?.backupVersion ?? null,
      backupUpdatedAt: backup?.updatedAt ?? null,
      activeDeviceCount: deviceCount,
      currentDeviceRegistered,
    };
  },

  async setupRecovery(userId: string, input: Record<string, unknown>) {
    const backup = parseBackup(input);
    const device = parseDevice(input);
    const tokenHash = hashDeviceToken(device.token);
    return prisma.$transaction(async (tx) => {
      const [existingBackup, user] = await Promise.all([
        tx.chatIdentityBackup.findUnique({ where: { userId }, select: { id: true } }),
        tx.user.findUnique({ where: { id: userId }, select: { chatPublicKey: true, chatKeyVersion: true } }),
      ]);
      if (!user) throw error("User not found.", 404);
      if (existingBackup) throw error("Secure-chat recovery is already configured.", 409);
      if (user.chatPublicKey && !samePublicKeyValue(user.chatPublicKey, backup.publicKey)) {
        throw error("The backup key does not match the existing secure-chat identity.", 409);
      }
      const keyVersion = user.chatKeyVersion || 1;
      await tx.user.update({
        where: { id: userId },
        data: { chatPublicKey: backup.publicKey, chatKeyVersion: keyVersion },
      });
      const created = await tx.chatIdentityBackup.create({
        data: { userId, ...backup, keyVersion },
        select: { keyVersion: true, backupVersion: true, updatedAt: true },
      });
      const existingDevice = await tx.chatDevice.findUnique({ where: { tokenHash }, select: { id: true, userId: true, revokedAt: true } });
      if (existingDevice && existingDevice.userId !== userId) throw error("Secure-chat device token is already registered to another account.", 409);
      if (existingDevice?.revokedAt) throw error("This secure-chat browser was revoked.", 403);
      const registered = existingDevice
        ? await tx.chatDevice.update({
            where: { id: existingDevice.id },
            data: { name: device.name, lastSeenAt: new Date() },
            select: { id: true, name: true, createdAt: true, lastSeenAt: true },
          })
        : await tx.chatDevice.create({
            data: { userId, tokenHash, name: device.name },
            select: { id: true, name: true, createdAt: true, lastSeenAt: true },
          });
      return { ...created, device: registered };
    });
  },

  async getRecoveryBackup(userId: string) {
    const backup = await prisma.chatIdentityBackup.findUnique({
      where: { userId },
      select: {
        publicKey: true,
        encryptedPrivateKey: true,
        iv: true,
        salt: true,
        kdf: true,
        kdfIterations: true,
        keyVersion: true,
        backupVersion: true,
        updatedAt: true,
      },
    });
    if (!backup) throw error("No secure-chat recovery backup is available.", 404);
    return backup;
  },

  async replaceRecoveryBackup(userId: string, input: Record<string, unknown>) {
    const backup = parseBackup(input);
    const existing = await prisma.chatIdentityBackup.findUnique({ where: { userId }, select: { publicKey: true } });
    if (!existing) throw error("No secure-chat recovery backup is available.", 404);
    if (!samePublicKeyValue(existing.publicKey, backup.publicKey)) {
      throw error("Recovery rotation cannot replace the secure-chat identity.", 409);
    }
    return prisma.chatIdentityBackup.update({
      where: { userId },
      data: {
        encryptedPrivateKey: backup.encryptedPrivateKey,
        iv: backup.iv,
        salt: backup.salt,
        kdf: backup.kdf,
        kdfIterations: backup.kdfIterations,
        backupVersion: { increment: 1 },
      },
      select: { keyVersion: true, backupVersion: true, updatedAt: true },
    });
  },

  async createDeviceChallenge(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { chatPublicKey: true } });
    if (!user?.chatPublicKey) throw error("Configure secure messaging before authorising this browser.", 409);
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const nonce = randomBytes(24).toString("base64url");
    const expiresAt = Date.now() + DEVICE_CHALLENGE_TTL_MS;
    return {
      challengeToken: sealChallenge({
        userId,
        nonce,
        expiresAt,
        ephemeralPrivateKey: ecdh.getPrivateKey().toString("base64url"),
      }),
      nonce,
      serverPublicKey: ecdh.getPublicKey().toString("base64"),
      expiresAt: new Date(expiresAt),
    };
  },

  async registerDevice(userId: string, input: Record<string, unknown>) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { chatPublicKey: true } });
    if (!user?.chatPublicKey) throw error("Configure secure messaging before registering another browser.", 409);
    verifyDeviceProof(userId, input, user.chatPublicKey);
    return upsertDevice(userId, input);
  },

  async registerAuthenticatorVerifiedDevice(userId: string, input: Record<string, unknown>) {
    const device = parseDevice(input);
    const tokenHash = hashDeviceToken(device.token);
    const existing = await prisma.chatDevice.findUnique({ where: { tokenHash }, select: { id: true, userId: true } });
    if (existing && existing.userId !== userId) {
      throw error("Secure-chat browser token is already registered to another account.", 409);
    }
    return existing
      ? prisma.chatDevice.update({
          where: { id: existing.id },
          data: { name: device.name, lastSeenAt: new Date(), revokedAt: null },
          select: { id: true, name: true, createdAt: true, lastSeenAt: true, revokedAt: true },
        })
      : prisma.chatDevice.create({
          data: { userId, tokenHash, name: device.name },
          select: { id: true, name: true, createdAt: true, lastSeenAt: true, revokedAt: true },
        });
  },

  async verifyDevice(userId: string, token: string) {
    const clean = cleanString(token, "Chat device token", 32, 256);
    const tokenHash = hashDeviceToken(clean);
    const device = await prisma.chatDevice.findFirst({
      where: { userId, tokenHash, revokedAt: null },
      select: { id: true, lastSeenAt: true },
    });
    if (!device) throw error("This browser is not an authorised secure-chat device. Restore your encrypted chat key first.", 428);
    if (Date.now() - device.lastSeenAt.getTime() > 5 * 60_000) {
      await prisma.chatDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    }
    return device;
  },

  async listDevices(userId: string, currentToken?: string) {
    const currentHash = currentToken ? hashDeviceToken(currentToken) : null;
    const devices = await prisma.chatDevice.findMany({
      where: { userId },
      orderBy: [{ revokedAt: "asc" }, { lastSeenAt: "desc" }],
      select: { id: true, tokenHash: true, name: true, createdAt: true, lastSeenAt: true, revokedAt: true },
    });
    return devices.map(({ tokenHash, ...device }) => ({ ...device, current: currentHash === tokenHash }));
  },

  async revokeDevice(userId: string, deviceId: string) {
    const device = await prisma.chatDevice.findFirst({ where: { id: deviceId, userId }, select: { id: true, revokedAt: true } });
    if (!device) throw error("Secure-chat device not found.", 404);
    if (device.revokedAt) return { id: device.id, revokedAt: device.revokedAt };
    return prisma.chatDevice.update({
      where: { id: device.id },
      data: { revokedAt: new Date() },
      select: { id: true, revokedAt: true },
    });
  },

  async listPasskeys(userId: string) {
    return prisma.chatPasskeyRecovery.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, credentialId: true, name: true, prfSalt: true, keyVersion: true, createdAt: true, lastUsedAt: true },
    });
  },

  async savePasskey(userId: string, input: Record<string, unknown>) {
    const backup = parsePasskeyBackup(input);
    const existing = await prisma.chatIdentityBackup.findUnique({ where: { userId }, select: { keyVersion: true } });
    if (!existing) throw error("Configure secure-chat recovery before adding a passkey.", 409);
    if (backup.keyVersion !== existing.keyVersion) throw error("The passkey backup uses an outdated chat identity.", 409);
    const credential = await prisma.chatPasskeyRecovery.findUnique({ where: { credentialId: backup.credentialId }, select: { id: true, userId: true } });
    if (credential && credential.userId !== userId) throw error("This passkey is already registered to another DevArena account.", 409);
    return credential
      ? prisma.chatPasskeyRecovery.update({
          where: { id: credential.id },
          data: { name: backup.name, encryptedPrivateKey: backup.encryptedPrivateKey, iv: backup.iv, prfSalt: backup.prfSalt, keyVersion: backup.keyVersion },
          select: { id: true, credentialId: true, name: true, prfSalt: true, keyVersion: true, createdAt: true, lastUsedAt: true },
        })
      : prisma.chatPasskeyRecovery.create({
          data: { userId, ...backup },
          select: { id: true, credentialId: true, name: true, prfSalt: true, keyVersion: true, createdAt: true, lastUsedAt: true },
        });
  },

  async getPasskeyBackup(userId: string, credentialId: string) {
    const backup = await prisma.chatPasskeyRecovery.findFirst({
      where: { userId, credentialId },
      select: { credentialId: true, encryptedPrivateKey: true, iv: true, prfSalt: true, keyVersion: true },
    });
    if (!backup) throw error("Passkey recovery is not available for this account.", 404);
    await prisma.chatPasskeyRecovery.update({ where: { credentialId }, data: { lastUsedAt: new Date() } });
    return backup;
  },

  async deletePasskey(userId: string, passkeyId: string) {
    const backup = await prisma.chatPasskeyRecovery.findFirst({ where: { id: passkeyId, userId }, select: { id: true } });
    if (!backup) throw error("Passkey recovery record not found.", 404);
    await prisma.chatPasskeyRecovery.delete({ where: { id: backup.id } });
    return { deleted: true };
  },

  async createTransferRequest(userId: string, input: Record<string, unknown>) {
    const requestPublicKey = publicKey(input.requestPublicKey);
    await prisma.chatDeviceTransfer.deleteMany({ where: { userId, OR: [{ expiresAt: { lt: new Date() } }, { consumedAt: { not: null } }] } });
    let code = transferCode();
    while (await prisma.chatDeviceTransfer.findUnique({ where: { requestCode: code }, select: { id: true } })) code = transferCode();
    return prisma.chatDeviceTransfer.create({
      data: { userId, requestCode: code, requestPublicKey, expiresAt: new Date(Date.now() + 10 * 60_000) },
      select: { id: true, requestCode: true, requestPublicKey: true, expiresAt: true, approvedAt: true },
    });
  },

  async pendingTransfers(userId: string) {
    return prisma.chatDeviceTransfer.findMany({
      where: { userId, expiresAt: { gt: new Date() }, approvedAt: null, consumedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, requestCode: true, requestPublicKey: true, expiresAt: true, createdAt: true },
    });
  },

  async approveTransfer(userId: string, transferId: string, input: Record<string, unknown>) {
    const transfer = await prisma.chatDeviceTransfer.findFirst({ where: { id: transferId, userId }, select: { id: true, expiresAt: true, consumedAt: true } });
    if (!transfer || transfer.expiresAt < new Date() || transfer.consumedAt) throw error("This trusted-browser request expired.", 410);
    return prisma.chatDeviceTransfer.update({
      where: { id: transfer.id },
      data: {
        encryptedPrivateKey: cleanString(input.encryptedPrivateKey, "Encrypted private key", 32, 30_000),
        iv: cleanString(input.iv, "Transfer IV", 8, 256),
        approvedAt: new Date(),
      },
      select: { id: true, requestCode: true, approvedAt: true, expiresAt: true },
    });
  },

  async transferStatus(userId: string, requestCode: string) {
    const transfer = await prisma.chatDeviceTransfer.findFirst({
      where: { userId, requestCode: requestCode.trim().toUpperCase() },
      select: { id: true, requestCode: true, expiresAt: true, approvedAt: true, consumedAt: true },
    });
    if (!transfer) throw error("Trusted-browser request not found.", 404);
    return { ...transfer, expired: transfer.expiresAt < new Date() };
  },

  async consumeTransfer(userId: string, requestCode: string) {
    const transfer = await prisma.chatDeviceTransfer.findFirst({
      where: { userId, requestCode: requestCode.trim().toUpperCase() },
      select: { id: true, encryptedPrivateKey: true, iv: true, expiresAt: true, approvedAt: true, consumedAt: true },
    });
    if (!transfer || transfer.expiresAt < new Date()) throw error("Trusted-browser request expired.", 410);
    if (!transfer.approvedAt || !transfer.encryptedPrivateKey || !transfer.iv) throw error("This browser has not been approved yet.", 409);
    if (transfer.consumedAt) throw error("This trusted-browser request was already used.", 409);
    return { encryptedPrivateKey: transfer.encryptedPrivateKey, iv: transfer.iv };
  },

  async completeTransfer(userId: string, requestCode: string) {
    const transfer = await prisma.chatDeviceTransfer.findFirst({
      where: { userId, requestCode: requestCode.trim().toUpperCase() },
      select: { id: true, expiresAt: true, approvedAt: true, consumedAt: true },
    });
    if (!transfer || transfer.expiresAt < new Date()) throw error("Trusted-browser request expired.", 410);
    if (!transfer.approvedAt) throw error("This browser has not been approved yet.", 409);
    if (transfer.consumedAt) return { completed: true, consumedAt: transfer.consumedAt };
    const completed = await prisma.chatDeviceTransfer.update({
      where: { id: transfer.id },
      data: { consumedAt: new Date() },
      select: { consumedAt: true },
    });
    return { completed: true, consumedAt: completed.consumedAt };
  },
};
