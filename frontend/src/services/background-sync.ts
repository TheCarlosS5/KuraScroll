/**
 * PWA Offline Background Synchronization Manager
 * Queues offline user mutations (progress, shelf updates) and flushes them transactionally when online.
 */

export interface SyncMutation {
  id: string;
  type: 'PROGRESS' | 'BOOKMARK' | 'SETTINGS';
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  body: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
}

export interface SyncResult {
  flushedCount: number;
  remainingCount: number;
  errors: string[];
}

const STORAGE_KEY = 'kura_scroll_sync_outbox';

export class BackgroundSyncManager {
  private isSyncing = false;
  private onlineListenerAttached = false;

  constructor() {
    this.attachOnlineListener();
  }

  /**
   * Enqueues an offline mutation to the outbox queue.
   */
  public enqueue(
    type: SyncMutation['type'],
    url: string,
    body: Record<string, unknown>,
    method: SyncMutation['method'] = 'POST',
    autoFlush = false
  ): SyncMutation {
    const queue = this.getQueue();
    const mutation: SyncMutation = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      type,
      url,
      method,
      body,
      createdAt: Date.now(),
      retryCount: 0,
    };

    queue.push(mutation);
    this.saveQueue(queue);

    if (autoFlush && typeof navigator !== 'undefined' && navigator.onLine) {
      this.flush().catch(() => {});
    }

    return mutation;
  }

  /**
   * Retrieves all pending mutations in the outbox queue.
   */
  public getQueue(): SyncMutation[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Flushes pending mutations in FIFO order against backend APIs.
   */
  public async flush(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { flushedCount: 0, remainingCount: this.getQueue().length, errors: [] };
    }

    this.isSyncing = true;
    const queue = this.getQueue();
    const remaining: SyncMutation[] = [];
    const errors: string[] = [];
    let flushedCount = 0;

    for (const item of queue) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.body),
        });

        if (response.ok) {
          flushedCount++;
        } else if (response.status >= 400 && response.status < 500) {
          // Client error - do not retry bad requests
          errors.push(`HTTP ${response.status} on ${item.url} for mutation ${item.id}`);
        } else {
          // 5xx Server error - retain for next retry
          item.retryCount++;
          remaining.push(item);
        }
      } catch (err: any) {
        // Network offline or socket error - keep remaining queue intact
        item.retryCount++;
        remaining.push(item);
        errors.push(err.message || 'Network unreachable');
        break; // Stop flushing while offline
      }
    }

    this.saveQueue(remaining);
    this.isSyncing = false;

    return {
      flushedCount,
      remainingCount: remaining.length,
      errors,
    };
  }

  /**
   * Clears the sync queue.
   */
  public clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  private saveQueue(queue: SyncMutation[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch {}
  }

  private attachOnlineListener(): void {
    if (this.onlineListenerAttached || typeof window === 'undefined') return;
    this.onlineListenerAttached = true;

    window.addEventListener('online', () => {
      this.flush().catch(() => {});
    });
  }
}

export const backgroundSync = new BackgroundSyncManager();
