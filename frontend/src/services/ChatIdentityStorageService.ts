const DATABASE_NAME = "devarena-secure-chat";
const DATABASE_VERSION = 2;
const IDENTITY_STORE = "identities";

export type StoredChatIdentity = {
  userId: string;
  privateKey: CryptoKey;
  publicJwk: JsonWebKey;
  wrappingKey?: CryptoKey;
  wrappedPrivateJwk?: ArrayBuffer;
  wrapIv?: Uint8Array;
  storedAt: string;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("This browser cannot securely store the chat encryption key."));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IDENTITY_STORE)) database.createObjectStore(IDENTITY_STORE, { keyPath: "userId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Secure-chat storage could not open."));
  });
}

function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDatabase().then((database) => new Promise<T>((resolve, reject) => {
    const tx = database.transaction(IDENTITY_STORE, mode);
    const request = run(tx.objectStore(IDENTITY_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Secure-chat storage request failed."));
    tx.oncomplete = () => database.close();
    tx.onerror = () => { database.close(); reject(tx.error || new Error("Secure-chat storage transaction failed.")); };
  }));
}

export function getStoredChatIdentity(userId: string) {
  return transaction<StoredChatIdentity | undefined>("readonly", (store) => store.get(userId));
}

export async function saveStoredChatIdentity(userId: string, privateKey: CryptoKey, publicJwk: JsonWebKey, privateJwk?: JsonWebKey) {
  const row: StoredChatIdentity = { userId, privateKey, publicJwk, storedAt: new Date().toISOString() };
  if (privateJwk) {
    const wrappingKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    const wrapIv = crypto.getRandomValues(new Uint8Array(12));
    const wrappedPrivateJwk = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: wrapIv },
      wrappingKey,
      new TextEncoder().encode(JSON.stringify(privateJwk)),
    );
    Object.assign(row, { wrappingKey, wrapIv, wrappedPrivateJwk });
  }
  return transaction<IDBValidKey>("readwrite", (store) => store.put(row));
}

export async function getExportablePrivateJwk(userId: string) {
  const row = await getStoredChatIdentity(userId);
  if (!row?.wrappingKey || !row.wrappedPrivateJwk || !row.wrapIv) {
    throw new Error("This stored key predates Google Authenticator recovery and cannot be exported from this browser.");
  }
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: row.wrapIv },
    row.wrappingKey,
    row.wrappedPrivateJwk,
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as JsonWebKey;
}

export function deleteStoredChatIdentity(userId: string) {
  return transaction<undefined>("readwrite", (store) => store.delete(userId));
}
