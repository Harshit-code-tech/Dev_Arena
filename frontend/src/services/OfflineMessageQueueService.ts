export type QueuedEncryptedMessage = {
  clientId: string;
  conversationId: string;
  senderId: string;
  ciphertext: string;
  iv: string;
  algorithm: string;
  senderKeyVersion: number;
  createdAt: string;
  state: "encrypting" | "queued" | "sending" | "sent" | "delivered" | "read" | "failed";
  attempts: number;
  lastError?: string;
};

const DB_NAME = "devarena-direct-messages";
const DB_VERSION = 2;
const STORE_NAME = "outbox";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Offline message storage is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "clientId" });
        store.createIndex("conversationId", "conversationId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Offline message storage could not open."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, mode);
      const request = operation(tx.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Offline message storage failed."));
      tx.onabort = () => reject(tx.error || new Error("Offline message storage was interrupted."));
    });
  } finally {
    database.close();
  }
}

export const OfflineMessageQueue = {
  async list(): Promise<QueuedEncryptedMessage[]> {
    const rows = await transaction<QueuedEncryptedMessage[]>("readonly", (store) => store.getAll());
    return rows.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  },

  async listForConversation(conversationId: string): Promise<QueuedEncryptedMessage[]> {
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).index("conversationId").getAll(conversationId);
        request.onsuccess = () => resolve((request.result as QueuedEncryptedMessage[]).sort((left, right) => left.createdAt.localeCompare(right.createdAt)));
        request.onerror = () => reject(request.error || new Error("Queued messages could not be loaded."));
      });
    } finally {
      database.close();
    }
  },

  put(message: QueuedEncryptedMessage) {
    return transaction<IDBValidKey>("readwrite", (store) => store.put(message));
  },

  async update(clientId: string, patch: Partial<QueuedEncryptedMessage>) {
    const existing = await transaction<QueuedEncryptedMessage | undefined>("readonly", (store) => store.get(clientId));
    if (!existing) return;
    await this.put({ ...existing, ...patch, clientId: existing.clientId });
  },

  async remove(clientId: string) {
    await transaction<undefined>("readwrite", (store) => store.delete(clientId) as IDBRequest<undefined>);
  },
};
