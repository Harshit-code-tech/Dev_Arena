import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "../../database/prisma";

const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;
const SETUP_TTL_MS = 10 * 60_000;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function error(message: string, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function masterSecret() {
  const value = process.env.CHAT_DEVICE_SECRET?.trim();
  if (!value || value.length < 32) {
    throw error("CHAT_DEVICE_SECRET must be configured with at least 32 characters.", 503);
  }
  return value;
}

function recoveryKey(purpose: string) {
  return createHash("sha256")
    .update(`devarena-chat-authenticator-v1:${purpose}:`)
    .update(masterSecret())
    .digest();
}

function seal(value: string, purpose: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", recoveryKey(purpose), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([tag, ciphertext]).toString("base64url"),
    iv: iv.toString("base64url"),
  };
}

function open(ciphertext: string, iv: string, purpose: string) {
  try {
    const packed = Buffer.from(ciphertext, "base64url");
    const tag = packed.subarray(0, 16);
    const encrypted = packed.subarray(16);
    const decipher = createDecipheriv("aes-256-gcm", recoveryKey(purpose), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    throw error("Secure messaging recovery data could not be decrypted.", 500);
  }
}

function sealSetupToken(payload: { userId: string; secret: string; expiresAt: number }) {
  const sealed = seal(JSON.stringify(payload), "setup-token");
  return `${sealed.iv}.${sealed.ciphertext}`;
}

function openSetupToken(token: unknown) {
  if (typeof token !== "string" || token.length < 40 || token.length > 4000) {
    throw error("Authenticator setup session is invalid or expired.", 401);
  }
  const [iv, ciphertext] = token.split(".");
  if (!iv || !ciphertext) throw error("Authenticator setup session is invalid or expired.", 401);
  try {
    const parsed = JSON.parse(open(ciphertext, iv, "setup-token")) as { userId?: string; secret?: string; expiresAt?: number };
    if (!parsed.userId || !parsed.secret || !parsed.expiresAt || parsed.expiresAt < Date.now()) {
      throw new Error("expired");
    }
    return parsed as { userId: string; secret: string; expiresAt: number };
  } catch (reason) {
    if ((reason as Error & { statusCode?: number }).statusCode === 500) throw reason;
    throw error("Authenticator setup session is invalid or expired.", 401);
  }
}

function base32Encode(input: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const character of clean) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw error("Authenticator secret is invalid.", 500);
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

function normaliseCode(value: unknown) {
  if (typeof value !== "string") throw error("Enter the 6-digit Google Authenticator code.");
  const clean = value.replace(/\D/g, "");
  if (clean.length !== TOTP_DIGITS) throw error("Enter the complete 6-digit Google Authenticator code.");
  return clean;
}

function verifyTotp(secret: string, value: unknown) {
  const code = normaliseCode(value);
  const current = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  for (const offset of [-1, 0, 1]) {
    const counter = current + offset;
    const expected = Buffer.from(hotp(secret, counter));
    const received = Buffer.from(code);
    if (expected.length === received.length && timingSafeEqual(expected, received)) return counter;
  }
  throw error("The Google Authenticator code is incorrect or expired.", 401);
}

function parsePublicKey(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw error("Secure-chat public key is invalid.");
  const key = value as Record<string, unknown>;
  if (key.kty !== "EC" || key.crv !== "P-256" || typeof key.x !== "string" || typeof key.y !== "string") {
    throw error("Secure-chat public key must be a P-256 key.");
  }
  return key as Prisma.InputJsonValue;
}

function parsePrivateKey(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw error("Secure-chat private key is invalid.");
  const key = value as Record<string, unknown>;
  if (key.kty !== "EC" || key.crv !== "P-256" || typeof key.x !== "string" || typeof key.y !== "string" || typeof key.d !== "string") {
    throw error("Secure-chat private key must be a P-256 private key.");
  }
  return key;
}

function sameKeyCoordinates(left: unknown, right: Record<string, unknown>) {
  if (!left || typeof left !== "object" || Array.isArray(left)) return false;
  const existing = left as Record<string, unknown>;
  return existing.kty === right.kty
    && existing.crv === right.crv
    && existing.x === right.x
    && existing.y === right.y;
}

function formatSetupKey(secret: string) {
  return secret.match(/.{1,4}/g)?.join(" ") || secret;
}

export const chatTotpService = {
  async status(userId: string) {
    const record = await prisma.chatTotpRecovery.findUnique({
      where: { userId },
      select: { enabledAt: true, lastVerifiedAt: true, keyVersion: true },
    });
    return {
      configured: Boolean(record),
      enabledAt: record?.enabledAt ?? null,
      lastVerifiedAt: record?.lastVerifiedAt ?? null,
      keyVersion: record?.keyVersion ?? null,
    };
  },

  async beginSetup(userId: string) {
    const [existing, user] = await Promise.all([
      prisma.chatTotpRecovery.findUnique({ where: { userId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, username: true } }),
    ]);
    if (!user) throw error("User not found.", 404);
    if (existing) throw error("Google Authenticator is already enabled for secure messaging.", 409);

    const secret = base32Encode(randomBytes(20));
    const expiresAt = Date.now() + SETUP_TTL_MS;
    const accountLabel = user.email || user.username;
    const issuer = "DevArena";
    const label = encodeURIComponent(`${issuer}:${accountLabel}`);
    const otpauthUri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
    return {
      setupToken: sealSetupToken({ userId, secret, expiresAt }),
      setupKey: formatSetupKey(secret),
      otpauthUri,
      accountLabel: `DevArena (${accountLabel})`,
      expiresAt: new Date(expiresAt),
    };
  },

  async confirmSetup(userId: string, input: Record<string, unknown>) {
    const setup = openSetupToken(input.setupToken);
    if (setup.userId !== userId) throw error("Authenticator setup session belongs to another account.", 403);
    const acceptedCounter = verifyTotp(setup.secret, input.code);

    const publicKey = parsePublicKey(input.publicKey);
    const privateKey = parsePrivateKey(input.privateKey);
    if (!sameKeyCoordinates(publicKey, privateKey)) {
      throw error("The secure-chat private key does not match its public key.", 409);
    }

    const [existing, user] = await Promise.all([
      prisma.chatTotpRecovery.findUnique({ where: { userId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { chatPublicKey: true, chatKeyVersion: true } }),
    ]);
    if (!user) throw error("User not found.", 404);
    if (existing) throw error("Google Authenticator is already enabled for secure messaging.", 409);
    if (user.chatPublicKey && !sameKeyCoordinates(user.chatPublicKey, privateKey)) {
      throw error("This browser does not hold the secure-chat identity already registered to the account.", 409);
    }

    const secretEnvelope = seal(setup.secret, "totp-secret");
    const privateEnvelope = seal(JSON.stringify(privateKey), "private-key");
    const keyVersion = user.chatKeyVersion || 1;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { chatPublicKey: publicKey, chatKeyVersion: keyVersion },
      }),
      prisma.chatTotpRecovery.create({
        data: {
          userId,
          secretCiphertext: secretEnvelope.ciphertext,
          secretIv: secretEnvelope.iv,
          privateKeyCiphertext: privateEnvelope.ciphertext,
          privateKeyIv: privateEnvelope.iv,
          keyVersion,
          lastCounter: acceptedCounter,
        },
      }),
    ]);

    return { configured: true, keyVersion };
  },

  async restore(userId: string, input: Record<string, unknown>) {
    const record = await prisma.chatTotpRecovery.findUnique({
      where: { userId },
      select: {
        id: true,
        secretCiphertext: true,
        secretIv: true,
        privateKeyCiphertext: true,
        privateKeyIv: true,
        keyVersion: true,
        lastCounter: true,
      },
    });
    if (!record) throw error("Google Authenticator recovery is not configured for secure messaging.", 404);

    const secret = open(record.secretCiphertext, record.secretIv, "totp-secret");
    const acceptedCounter = verifyTotp(secret, input.code);
    if (record.lastCounter !== null && acceptedCounter <= record.lastCounter) {
      throw error("That Authenticator code was already used. Wait for the next code and try again.", 409);
    }

    const updated = await prisma.chatTotpRecovery.updateMany({
      where: {
        id: record.id,
        OR: [{ lastCounter: null }, { lastCounter: { lt: acceptedCounter } }],
      },
      data: { lastCounter: acceptedCounter, lastVerifiedAt: new Date() },
    });
    if (updated.count !== 1) {
      throw error("That Authenticator code was already used. Wait for the next code and try again.", 409);
    }

    const privateKey = JSON.parse(open(record.privateKeyCiphertext, record.privateKeyIv, "private-key")) as Record<string, unknown>;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { chatPublicKey: true, chatKeyVersion: true } });
    if (!user?.chatPublicKey || !sameKeyCoordinates(user.chatPublicKey, privateKey)) {
      throw error("Recovered secure-chat identity does not match the account.", 409);
    }

    return {
      privateKey,
      publicKey: user.chatPublicKey,
      keyVersion: user.chatKeyVersion || record.keyVersion || 1,
    };
  },
};
