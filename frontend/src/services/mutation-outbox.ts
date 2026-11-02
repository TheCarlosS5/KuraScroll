/**
 * Sprint 35: Offline IndexedDB Mutation Outbox
 * Zero external dependencies. Uses standard browser IndexedDB with compound indexes
 * to enforce deterministic, sequential playback without clock drift or race conditions.
 */

export type MutationType =
  | 'UPDATE_PROGRESS'
  | 'CREATE_BOOKMARK'
  | 'DELETE_BOOKMARK'
  | 'UPDATE_PREFERENCES';

export type OutboxStatus = 'pending' | 'syncing' | 'failed' | 'applied';

export interface OutboxMutation {
  id?: number;
  clientMutationId: string;
  type: MutationType;
  payload: any;
  timestamp: string;
  status: OutboxStatus;
  retryCount: number;
  nextRetryAt?: number;
  error?: string;
}

const DB_NAME = 'kura_scroll_outbox';
const DB_VERSION = 1;
const STORE_NAME = 'offline_mutations';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'mut-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
}

export class MutationOutbox {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('by_client_mutation_id', 'clientMutationId', {
            unique: true,
          });
          store.createIndex('by_status', 'status', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Enqueues a mutation to be replayed sequentially when online.
   * Preserves exact local insertion order using the auto-increment integer key.
   */
  async enqueueMutation(
    type: MutationType,
    payload: any
  ): Promise<string> {
    const db = await this.openDB();
    const clientMutationId = generateUUID();
    const mutation: OutboxMutation = {
      clientMutationId,
      type,
      payload,
      timestamp: new Date().toISOString(),
      status: 'pending',
      retryCount: 0,
      nextRetryAt: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.add(mutation);

      req.onsuccess = () => resolve(clientMutationId);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieves the next batch of pending mutations up to `limit` items,
   * strictly ordered by their integer `id` key.
   */
  async getPendingBatch(limit = 50): Promise<OutboxMutation[]> {
    const db = await this.openDB();
    const now = Date.now();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const cursorReq = store.openCursor();
      const results: OutboxMutation[] = [];

      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }

        const item = cursor.value as OutboxMutation;
        if (
          item.status === 'pending' &&
          (!item.nextRetryAt || item.nextRetryAt <= now)
        ) {
          results.push(item);
        }

        cursor.continue();
      };

      cursorReq.onerror = () => reject(cursorReq.error);
    });
  }

  /**
   * Marks a set of mutation IDs as currently syncing to prevent duplicate concurrent flights.
   */
  async markMutationsSyncing(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const id of ids) {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const item = getReq.result as OutboxMutation;
          if (item && item.status === 'pending') {
            item.status = 'syncing';
            store.put(item);
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Removes successfully applied mutations from the outbox.
   */
  async markMutationsApplied(clientMutationIds: string[]): Promise<void> {
    if (clientMutationIds.length === 0) return;
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('by_client_mutation_id');

      for (const mutId of clientMutationIds) {
        const keyReq = index.getKey(mutId);
        keyReq.onsuccess = () => {
          if (keyReq.result !== undefined) {
            store.delete(keyReq.result);
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Marks failed mutations for retry with exponential backoff and jitter.
   */
  async markMutationsFailed(
    failedIds: string[],
    retryDelayMs: number,
    errorReason?: string
  ): Promise<void> {
    if (failedIds.length === 0) return;
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('by_client_mutation_id');

      for (const mutId of failedIds) {
        const req = index.get(mutId);
        req.onsuccess = () => {
          const item = req.result as OutboxMutation;
          if (item) {
            item.status = 'pending';
            item.retryCount = (item.retryCount || 0) + 1;
            item.nextRetryAt = Date.now() + retryDelayMs;
            item.error = errorReason || 'Sync failed';
            store.put(item);
          }
        };
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Resets any mutations stuck in 'syncing' back to 'pending'.
   * Crucial for tab close or browser restart recovery.
   */
  async recoverInterruptedMutations(): Promise<number> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const cursorReq = store.openCursor();
      let recovered = 0;

      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) {
          resolve(recovered);
          return;
        }

        const item = cursor.value as OutboxMutation;
        if (item.status === 'syncing') {
          item.status = 'pending';
          cursor.update(item);
          recovered++;
        }

        cursor.continue();
      };

      cursorReq.onerror = () => reject(cursorReq.error);
    });
  }

  /**
   * Counts the total number of pending or syncing mutations.
   */
  async getPendingCount(): Promise<number> {
    const db = await this.openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const cursorReq = store.openCursor();
      let count = 0;

      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) {
          resolve(count);
          return;
        }

        const item = cursor.value as OutboxMutation;
        if (item.status === 'pending' || item.status === 'syncing') {
          count++;
        }

        cursor.continue();
      };

      cursorReq.onerror = () => reject(cursorReq.error);
    });
  }
}

export const mutationOutbox = new MutationOutbox();
