import { KTPApiError, submitChallenge, type KtpSubmitResponse } from './ktpApi';
import { computeKtpChecksum } from './ktpChecksum';

const DB_NAME = 'KTPSync';
const STORE_NAME = 'queue';
const FALLBACK_STORAGE_KEY = 'ktp_offline_queue_v1';

export interface KtpQueuedSubmission {
  id?: number;
  challengeId: string;
  seed: string;
  playerId: string;
  evLossBb: number;
  reactionMs: number;
  clientChecksum: string;
  createdAt: number;
}

function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null;
}

function openSyncDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('challengeId', 'challengeId', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Erreur ouverture IndexedDB KTPSync'));
  });
}

function readFallbackQueue(): KtpQueuedSubmission[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KtpQueuedSubmission[]) : [];
  } catch {
    return [];
  }
}

function writeFallbackQueue(items: KtpQueuedSubmission[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors cleanly
  }
}

async function addToQueue(item: KtpQueuedSubmission): Promise<number> {
  if (hasIndexedDb()) {
    try {
      const db = await openSyncDb();
      return await new Promise<number>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).add(item);
        req.onsuccess = () => resolve(Number(req.result));
        req.onerror = () => reject(req.error ?? new Error('Erreur écriture IndexedDB'));
        tx.oncomplete = () => db.close();
      });
    } catch {
      // Fall through to localStorage fallback
    }
  }
  const existing = readFallbackQueue();
  const nextId = existing.reduce((max, x) => Math.max(max, x.id ?? 0), 0) + 1;
  existing.push({ ...item, id: nextId });
  writeFallbackQueue(existing);
  return nextId;
}

export async function getQueuedSubmissions(): Promise<KtpQueuedSubmission[]> {
  if (hasIndexedDb()) {
    try {
      const db = await openSyncDb();
      return await new Promise<KtpQueuedSubmission[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve((req.result as KtpQueuedSubmission[]) ?? []);
        req.onerror = () => reject(req.error ?? new Error('Erreur lecture IndexedDB'));
        tx.oncomplete = () => db.close();
      });
    } catch {
      // Fallback below
    }
  }
  return readFallbackQueue();
}

async function removeFromQueue(id: number): Promise<void> {
  if (hasIndexedDb()) {
    try {
      const db = await openSyncDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('Erreur suppression IndexedDB'));
        tx.oncomplete = () => db.close();
      });
      return;
    } catch {
      // Fallback below
    }
  }
  const filtered = readFallbackQueue().filter((x) => x.id !== id);
  writeFallbackQueue(filtered);
}

export async function clearKtpQueue(): Promise<void> {
  if (hasIndexedDb()) {
    try {
      const db = await openSyncDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error ?? new Error('Erreur purge IndexedDB'));
        tx.oncomplete = () => db.close();
      });
      return;
    } catch {
      // Fallback below
    }
  }
  writeFallbackQueue([]);
}

export type SyncSubmitResult =
  | { queued: true; pendingCount: number; checksum: string }
  | { queued: false; result: KtpSubmitResponse; checksum: string };

/**
 * Soumet un résultat vers AWS ktp-backend ou le met en file IndexedDB native s'il est hors-ligne.
 */
export async function syncSubmit(
  challengeId: string,
  seed: string,
  payload: { playerId: string; evLossBb: number; reactionMs: number }
): Promise<SyncSubmitResult> {
  const checksum = await computeKtpChecksum(
    challengeId,
    payload.playerId,
    payload.evLossBb,
    payload.reactionMs,
    seed
  );

  const item: KtpQueuedSubmission = {
    challengeId,
    seed,
    playerId: payload.playerId,
    evLossBb: payload.evLossBb,
    reactionMs: payload.reactionMs,
    clientChecksum: checksum,
    createdAt: Date.now(),
  };

  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  if (!online) {
    await addToQueue(item);
    const pending = await getQueuedSubmissions();
    return { queued: true, pendingCount: pending.length, checksum };
  }

  try {
    const result = await submitChallenge(challengeId, {
      playerId: payload.playerId,
      evLossBb: payload.evLossBb,
      reactionMs: payload.reactionMs,
      clientChecksum: checksum,
    });
    return { queued: false, result, checksum };
  } catch (err) {
    const isNetworkOrTransient =
      err instanceof KTPApiError ? err.offline || err.status === 0 || err.status >= 500 || err.status === 429 : true;
    if (isNetworkOrTransient) {
      await addToQueue(item);
      const pending = await getQueuedSubmissions();
      return { queued: true, pendingCount: pending.length, checksum };
    }
    throw err;
  }
}

export interface FlushQueueSummary {
  flushed: number;
  remaining: number;
  errors: string[];
}

export async function flushQueue(): Promise<FlushQueueSummary> {
  const pending = await getQueuedSubmissions();
  if (!pending.length) {
    return { flushed: 0, remaining: 0, errors: [] };
  }

  let flushed = 0;
  const errors: string[] = [];

  for (const item of pending) {
    try {
      await submitChallenge(item.challengeId, {
        playerId: item.playerId,
        evLossBb: item.evLossBb,
        reactionMs: item.reactionMs,
        clientChecksum: item.clientChecksum,
      });
      if (item.id !== undefined) {
        await removeFromQueue(item.id);
      }
      flushed++;
    } catch (err) {
      // Rejet définitif client (400 / 409) : purger pour ne pas bloquer la file indéfiniment
      if (err instanceof KTPApiError && (err.status === 400 || err.status === 409)) {
        if (item.id !== undefined) {
          await removeFromQueue(item.id);
        }
        errors.push(`${item.challengeId}: ${err.message}`);
      } else {
        errors.push(`${item.challengeId}: ${err instanceof Error ? err.message : 'Erreur réseau'}`);
      }
    }
  }

  const left = await getQueuedSubmissions();
  return { flushed, remaining: left.length, errors };
}

export function attachKtpOnlineSync(onFlushed?: (summary: FlushQueueSummary) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    void flushQueue().then((summary) => {
      if (onFlushed) onFlushed(summary);
    });
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
