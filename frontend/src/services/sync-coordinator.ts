/**
 * Sprint 35: Frontend Sync Coordinator
 * Orchestrates offline-first mutation replay with Full Jitter exponential backoff,
 * tab visibility recovery, online/offline event listeners, and live HUD state notification.
 */

import { mutationOutbox, OutboxMutation, MutationType } from './mutation-outbox';
import type { SyncStatus } from '../components/sync/OfflineSyncHUD';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  isOnline: boolean;
}

export type SyncListener = (state: SyncState) => void;

export class SyncCoordinator {
  private isReplaying = false;
  private retryAttempt = 0;
  private listeners: Set<SyncListener> = new Set();
  private state: SyncState = {
    status: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'synced',
    pendingCount: 0,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.triggerSync();
        }
      });
      // Initialize recovery and pending count
      this.init();
    }
  }

  private async init() {
    try {
      await mutationOutbox.recoverInterruptedMutations();
      await this.refreshState();
      if (this.state.isOnline && this.state.pendingCount > 0) {
        this.triggerSync();
      }
    } catch {
      // IndexedDB might not be available in SSR or restricted iframe
    }
  }

  private handleOnline() {
    this.state.isOnline = true;
    this.refreshState();
    this.triggerSync();
  }

  private handleOffline() {
    this.state.isOnline = false;
    this.state.status = 'offline';
    this.notify();
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener({ ...this.state });
      } catch (err) {
        console.error('[SyncCoordinator] Listener error:', err);
      }
    }
  }

  public async refreshState(): Promise<void> {
    try {
      const count = await mutationOutbox.getPendingCount();
      this.state.pendingCount = count;
      if (!this.state.isOnline) {
        this.state.status = 'offline';
      } else if (this.isReplaying) {
        this.state.status = 'syncing';
      } else if (count > 0) {
        this.state.status = 'pending';
      } else {
        this.state.status = 'synced';
      }
      this.notify();
    } catch {
      // Fallback
    }
  }

  /**
   * Enqueues an offline mutation and triggers an immediate sync attempt if online.
   */
  public async enqueue(type: MutationType, payload: any): Promise<string> {
    const clientMutationId = await mutationOutbox.enqueueMutation(type, payload);
    await this.refreshState();
    if (this.state.isOnline) {
      this.triggerSync();
    }
    return clientMutationId;
  }

  /**
   * Replays pending outbox batches to the server in chunks of 50 items.
   */
  public async triggerSync(): Promise<void> {
    if (this.isReplaying || !this.state.isOnline) {
      return;
    }

    this.isReplaying = true;
    this.state.status = 'syncing';
    this.notify();

    try {
      let hasMore = true;

      while (hasMore) {
        const batch: OutboxMutation[] = await mutationOutbox.getPendingBatch(50);
        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        const batchIds = batch.map((b) => b.id!).filter((id): id is number => id !== undefined);
        await mutationOutbox.markMutationsSyncing(batchIds);

        const mutationsPayload = batch.map((b) => ({
          clientMutationId: b.clientMutationId,
          type: b.type,
          payload: b.payload,
          timestamp: b.timestamp,
        }));

        const isGuest = typeof localStorage !== 'undefined' && localStorage.getItem('kura_guest_mode') === 'true';
        if (isGuest) {
          // Do not replay outbox mutations to backend in guest mode
          hasMore = false;
          break;
        }

        const res = await fetch('/api/v1/sync/replay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            mutations: mutationsPayload,
          }),
        });

        if (!res.ok) {
          throw new Error(`Sync HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        const appliedIds = batch
          .filter((b) => !data.failedIds?.includes(b.clientMutationId))
          .map((b) => b.clientMutationId);

        await mutationOutbox.markMutationsApplied(appliedIds);

        if (data.failedIds && data.failedIds.length > 0) {
          await mutationOutbox.markMutationsFailed(data.failedIds, 60000, 'Poison pill or rejected');
        }

        this.retryAttempt = 0; // Reset exponential backoff on success
        await this.refreshState();

        if (batch.length < 50) {
          hasMore = false;
        }
      }
    } catch (err: any) {
      // Calculate Full Jitter exponential backoff: d_n = min(30000, 1000 * 2^n) * rand(0, 1)
      const cap = Math.min(30000, 1000 * Math.pow(2, this.retryAttempt));
      const jitterDelay = Math.floor(Math.random() * cap);
      this.retryAttempt++;

      const pendingBatch = await mutationOutbox.getPendingBatch(50);
      const failedIds = pendingBatch.map((b) => b.clientMutationId);
      await mutationOutbox.markMutationsFailed(failedIds, jitterDelay, err?.message);
    } finally {
      this.isReplaying = false;
      await this.refreshState();
    }
  }
}

export const syncCoordinator = new SyncCoordinator();
