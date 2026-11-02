# Sprint 35 Blueprint: Offline IndexedDB Mutation Outbox & Smart Batch Replay Engine

## 1. Executive Summary & Senior Architectural Guidance
When Carlos reads manga, toggles bookmarks, or completes chapters on an offline or intermittently connected laptop, user interactions must never be dropped or blocked. 

Following senior consultation with ChatGPT, Sprint 35 delivers a resilient, zero-data-loss offline sync engine tailored to the Pentium T4500 and mechanical 4TB SATA II HDD:

1. **Deterministic Sequential Replay via IndexedDB Outbox:**
   - Client stores pending actions (`UPDATE_PROGRESS`, `CREATE_BOOKMARK`, `DELETE_BOOKMARK`, `UPDATE_GOALS`) in IndexedDB `offline_mutations`.
   - Ordering is strictly preserved using auto-increment integer keys (`id`) to prevent temporal inversions (e.g. deleting a bookmark before creating it).
   - Compound index `['status', 'id']` allows fast sequential batch retrieval (`SELECT * WHERE status = 'pending' ORDER BY id LIMIT 50`).

2. **SATA II Mechanical HDD Single-Transaction Batch Replay (`POST /api/v1/sync/replay`):**
   - Individual HTTP requests per mutation cause severe mechanical disk head thrashing (50 fsyncs = ~750ms seek latency on 5400 RPM drives).
   - All mutations are batched up to 50 items and processed in a **single SQLite transaction** via `IOCoordinator.run({ priority: IOPriority.NORMAL, label: 'offline-sync-batch-replay' })`.
   - Mechanical seek latency drops from >750ms to **under 15ms total (< 1 physical fsync)**.

3. **Idempotency & Poison Pill Isolation:**
   - Server-side table `applied_mutations (user_id, client_mutation_id, status, applied_at)` prevents duplicate replays.
   - Malformed mutations are isolated and recorded without aborting valid operations in the batch.
   - Out-of-order progress updates: If server `user_progress.updated_at` is newer than incoming mutation timestamp, the update is safely ignored as `SKIPPED_OLDER`.

4. **Crash Resilience & Interrupted Tab Recovery:**
   - If the browser tab or laptop closes during transmission, records left in `syncing` are reset to `pending` on startup via `recoverInterruptedMutations()`.
   - Network retries implement Full Jitter Exponential Backoff ($d_n = \min(30000, 1000 \cdot 2^n)$).

5. **Client UI Synchronization & HUD:**
   - Floating badge in `OfflineSyncHUD` displays pending queue count (`⚡ 3 pendientes`).
   - Manual "Sincronizar Ahora" trigger alongside automatic reconnection replay.
