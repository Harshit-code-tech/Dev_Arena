import jwt, { type JwtPayload } from "jsonwebtoken";

const FIREBASE_CERT_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const FIREBASE_ADMIN_SCOPE = "https://www.googleapis.com/auth/identitytoolkit";
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

type FirebaseServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

type FirebaseAdminUser = {
  localId?: string;
  email?: string;
  displayName?: string;
  emailVerified?: boolean;
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
let adminAccessTokenCache: { token: string; expiresAt: number } | null = null;

function firebaseProjectId() {
  return String(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "").trim();
}

function firebaseWebApiKey() {
  return String(
    process.env.FIREBASE_WEB_API_KEY ||
    process.env.FIREBASE_API_KEY ||
    process.env.VITE_FIREBASE_API_KEY ||
    "",
  ).trim();
}

function parseServiceAccount(): Required<Pick<FirebaseServiceAccount, "client_email" | "private_key">> & { project_id: string } {
  let parsed: FirebaseServiceAccount = {};
  const json = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();

  if (json) {
    try {
      parsed = JSON.parse(json) as FirebaseServiceAccount;
    } catch {
      throw new Error("FIREBASE_ADMIN_CREDENTIALS_INVALID");
    }
  }

  const projectId = String(parsed.project_id || firebaseProjectId()).trim();
  const clientEmail = String(parsed.client_email || process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const privateKey = String(parsed.private_key || process.env.FIREBASE_PRIVATE_KEY || "")
    .replace(/\\n/g, "\n")
    .trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("FIREBASE_ADMIN_NOT_CONFIGURED");
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };
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

async function getFirebaseAdminAccessToken() {
  if (adminAccessTokenCache && adminAccessTokenCache.expiresAt > Date.now() + 60_000) {
    return adminAccessTokenCache.token;
  }

  const serviceAccount = parseServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: serviceAccount.client_email,
      scope: FIREBASE_ADMIN_SCOPE,
      aud: GOOGLE_OAUTH_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    serviceAccount.private_key,
    { algorithm: "RS256" },
  );

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const data = await response.json().catch(() => ({})) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    console.error("Firebase admin access-token request failed:", data.error || response.status, data.error_description || "");
    throw new Error("FIREBASE_ADMIN_AUTH_FAILED");
  }

  const expiresInSeconds = Number(data.expires_in) || 3600;
  adminAccessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
  return data.access_token;
}

async function firebaseAdminRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const projectId = parseServiceAccount().project_id;
  const accessToken = await getFirebaseAdminAccessToken();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const data = await response.json().catch(() => ({})) as T & {
    error?: { message?: string; status?: string };
  };

  if (!response.ok) {
    const message = data.error?.message || data.error?.status || `HTTP_${response.status}`;
    console.error(`Firebase admin request failed (${path}):`, message);
    throw new Error(`FIREBASE_ADMIN_REQUEST_FAILED:${message}`);
  }
  return data;
}

export async function findFirebaseUserByEmail(email: string): Promise<FirebaseAdminUser | null> {
  const data = await firebaseAdminRequest<{ users?: FirebaseAdminUser[] }>("accounts:lookup", {
    email: [email.trim().toLowerCase()],
  });
  return data.users?.[0] || null;
}

export async function updateFirebasePassword(uid: string, newPassword: string): Promise<void> {
  await firebaseAdminRequest("accounts:update", {
    localId: uid,
    password: newPassword,
  });
}

export async function createFirebasePasswordUser(input: {
  email: string;
  password: string;
  displayName?: string;
  emailVerified?: boolean;
}): Promise<{ uid: string }> {
  const serviceAccount = parseServiceAccount();
  const apiKey = firebaseWebApiKey();
  if (!apiKey) throw new Error("FIREBASE_WEB_API_KEY_NOT_CONFIGURED");

  const accessToken = await getFirebaseAdminAccessToken();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(serviceAccount.project_id)}/accounts?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
        password: input.password,
        displayName: String(input.displayName || "").trim() || undefined,
        emailVerified: input.emailVerified === true,
      }),
    },
  );
  const data = await response.json().catch(() => ({})) as {
    localId?: string;
    error?: { message?: string; status?: string };
  };

  if (!response.ok || !data.localId) {
    const message = data.error?.message || data.error?.status || `HTTP_${response.status}`;
    console.error("Firebase admin account creation failed:", message);
    throw new Error(`FIREBASE_ADMIN_REQUEST_FAILED:${message}`);
  }

  return { uid: data.localId };
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
