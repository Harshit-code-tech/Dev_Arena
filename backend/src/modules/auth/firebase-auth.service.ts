import jwt, { type JwtPayload } from "jsonwebtoken";

const FIREBASE_CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const DEFAULT_CERT_TTL_MS = 60 * 60 * 1000;

type FirebaseJwtPayload = JwtPayload & {
  email?: string;
  email_verified?: boolean;
  auth_time?: number;
  name?: string;
  picture?: string;
  firebase?: {
    sign_in_provider?: string;
  };
};

export type VerifiedFirebaseIdentity = {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoURL: string | null;
  provider: "password" | "google" | "github";
};

let certificateCache: { certificates: Record<string, string>; expiresAt: number } | null = null;

function firebaseProjectId() {
  return String(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "").trim();
}

function parseMaxAge(value: string | null) {
  const match = String(value || "").match(/(?:^|,)\s*max-age=(\d+)/i);
  const seconds = match ? Number(match[1]) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_CERT_TTL_MS;
}

async function getFirebaseCertificates() {
  if (certificateCache && certificateCache.expiresAt > Date.now() + 30_000) {
    return certificateCache.certificates;
  }

  const response = await fetch(FIREBASE_CERT_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`FIREBASE_CERT_FETCH_FAILED:${response.status}`);
  }

  const certificates = await response.json() as Record<string, string>;
  if (!certificates || typeof certificates !== "object" || Object.keys(certificates).length === 0) {
    throw new Error("FIREBASE_CERT_FETCH_FAILED:EMPTY");
  }

  certificateCache = {
    certificates,
    expiresAt: Date.now() + parseMaxAge(response.headers.get("cache-control")),
  };
  return certificates;
}

function normalizeProvider(providerId: string | undefined): VerifiedFirebaseIdentity["provider"] {
  if (providerId === "password") return "password";
  if (providerId === "google.com") return "google";
  if (providerId === "github.com") return "github";
  throw new Error("FIREBASE_PROVIDER_NOT_SUPPORTED");
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseIdentity> {
  const projectId = firebaseProjectId();
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID_NOT_CONFIGURED");
  }
  if (!idToken) {
    throw new Error("FIREBASE_ID_TOKEN_REQUIRED");
  }

  const decodedHeader = jwt.decode(idToken, { complete: true });
  const kid = decodedHeader?.header?.kid;
  if (!kid || decodedHeader?.header?.alg !== "RS256") {
    throw new Error("FIREBASE_ID_TOKEN_INVALID");
  }

  const certificates = await getFirebaseCertificates();
  const certificate = certificates[kid];
  if (!certificate) {
    certificateCache = null;
    const refreshed = await getFirebaseCertificates();
    if (!refreshed[kid]) throw new Error("FIREBASE_ID_TOKEN_INVALID");
  }

  const payload = jwt.verify(idToken, (certificateCache?.certificates || certificates)[kid], {
    algorithms: ["RS256"],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  }) as FirebaseJwtPayload;

  const uid = String(payload.sub || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (!uid || uid.length > 128 || !email) {
    throw new Error("FIREBASE_ID_TOKEN_INVALID");
  }
  if (typeof payload.iat !== "number" || payload.iat > nowSeconds + 60) {
    throw new Error("FIREBASE_ID_TOKEN_INVALID");
  }
  if (typeof payload.auth_time !== "number" || payload.auth_time > nowSeconds + 60) {
    throw new Error("FIREBASE_ID_TOKEN_INVALID");
  }

  return {
    uid,
    email,
    emailVerified: payload.email_verified === true,
    displayName: String(payload.name || "").trim(),
    photoURL: typeof payload.picture === "string" && payload.picture.trim() ? payload.picture.trim() : null,
    provider: normalizeProvider(payload.firebase?.sign_in_provider),
  };
}
