import type { DatabaseInstance, Statement } from '../db/database.js';
import { IOCoordinator, sharedIOCoordinator } from '../storage/io/io-coordinator.js';
import { IOPriority } from '../storage/io/io-priority.js';

export interface ReplayMutationItem {
  clientMutationId: string;
  type: string;
  payload: any;
  timestamp: string;
}

export interface ReplayBatchResult {
  success: boolean;
  processedCount: number;
  skippedCount: number;
  errorsCount: number;
  failedIds: string[];
}

function parseUtcTimestamp(ts: string | null | undefined): number {
  if (!ts) return 0;
  // If string doesn't contain timezone or 'Z', treat as UTC
  const normalized =
    ts.includes('Z') || ts.includes('+') || (ts.includes('-') && ts.length > 19)
      ? ts
      : ts.replace(' ', 'T') + 'Z';
  return new Date(normalized).getTime();
}

export class SyncReplayService {
  private stmtGetApplied: Statement;
  private stmtInsertApplied: Statement;
  private stmtGetProgress: Statement;
  private stmtUpsertProgress: Statement;
  private stmtUpsertBookmark: Statement;
  private stmtDeleteBookmark: Statement;
  private stmtDeleteBookmarkById: Statement;
  private stmtGetChapterSeries: Statement;

  constructor(
    private db: DatabaseInstance,
    private ioCoordinator: IOCoordinator = sharedIOCoordinator
  ) {
    this.stmtGetApplied = this.db.prepare(`
      SELECT client_mutation_id, status FROM applied_mutations
      WHERE user_id = ? AND client_mutation_id = ?
    `);

    this.stmtInsertApplied = this.db.prepare(`
      INSERT INTO applied_mutations (user_id, client_mutation_id, status, applied_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, client_mutation_id) DO UPDATE SET
        status = excluded.status,
        applied_at = datetime('now')
    `);

    this.stmtGetProgress = this.db.prepare(`
      SELECT updated_at FROM user_progress
      WHERE user_id = ? AND series_id = ?
    `);

    this.stmtUpsertProgress = this.db.prepare(`
      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, scroll_offset_y, is_completed, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, series_id) DO UPDATE SET
        chapter_id = excluded.chapter_id,
        page_number = excluded.page_number,
        scroll_offset_y = excluded.scroll_offset_y,
        is_completed = excluded.is_completed,
        updated_at = excluded.updated_at
    `);

    this.stmtUpsertBookmark = this.db.prepare(`
      INSERT INTO user_bookmarks (user_id, series_id, chapter_id, page_index, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime(?), datetime(?))
      ON CONFLICT(user_id, chapter_id, page_index) DO UPDATE SET
        note = COALESCE(excluded.note, note),
        updated_at = excluded.updated_at
    `);

    this.stmtDeleteBookmark = this.db.prepare(`
      DELETE FROM user_bookmarks
      WHERE user_id = ? AND chapter_id = ? AND page_index = ?
    `);

    this.stmtDeleteBookmarkById = this.db.prepare(`
      DELETE FROM user_bookmarks
      WHERE id = ? AND user_id = ?
    `);

    this.stmtGetChapterSeries = this.db.prepare(`
      SELECT series_id FROM chapters WHERE id = ?
    `);
  }

  /**
   * Replays an array of offline mutations in a single, high-performance SQLite transaction.
   * Dispatched through IOCoordinator to guarantee zero mechanical disk contention on SATA II HDDs.
   */
  async replayMutations(
    userId: string = 'local_user',
    mutations: ReplayMutationItem[]
  ): Promise<ReplayBatchResult> {
    if (!mutations || mutations.length === 0) {
      return {
        success: true,
        processedCount: 0,
        skippedCount: 0,
        errorsCount: 0,
        failedIds: [],
      };
    }

    // Sort mutations chronologically by client timestamp to enforce strict cause-and-effect replay
    const sorted = [...mutations].sort(
      (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    );

    return this.ioCoordinator.run(
      { priority: IOPriority.NORMAL, label: 'offline-sync-batch-replay' },
      async () => {
        let processedCount = 0;
        let skippedCount = 0;
        let errorsCount = 0;
        const failedIds: string[] = [];

        this.db.exec('BEGIN IMMEDIATE;');

        try {
          for (const mut of sorted) {
            try {
              // 1. Idempotency Check
              const existing = this.stmtGetApplied.get(userId, mut.clientMutationId) as
                | { client_mutation_id: string; status: string }
                | undefined;

              if (existing) {
                skippedCount++;
                processedCount++;
                continue;
              }

              // 2. Validate Mutation Envelope
              if (!mut.clientMutationId || !mut.type || !mut.payload || typeof mut.payload !== 'object') {
                throw new Error('Poison Pill: Malformed mutation envelope or payload');
              }

              const isoTimestamp = mut.timestamp || new Date().toISOString();

              // 3. Process Domain Actions
              if (mut.type === 'UPDATE_PROGRESS') {
                const { seriesId, chapterId, pageNumber, scrollOffsetY, isCompleted, timestamp } = mut.payload;
                const page = typeof pageNumber === 'number' ? pageNumber : mut.payload.pageIndex;
                if (!seriesId || !chapterId || typeof page !== 'number') {
                  throw new Error('Poison Pill: Missing seriesId, chapterId, or pageNumber in UPDATE_PROGRESS');
                }

                // Protect against out-of-order writes: if server has newer progress, skip
                const currentProgress = this.stmtGetProgress.get(userId, seriesId) as { updated_at?: string } | undefined;
                if (currentProgress && currentProgress.updated_at) {
                  const serverTime = parseUtcTimestamp(currentProgress.updated_at);
                  const incomingTime = parseUtcTimestamp(timestamp || isoTimestamp);
                  if (incomingTime < serverTime) {
                    this.stmtInsertApplied.run(userId, mut.clientMutationId, 'SKIPPED_OLDER');
                    skippedCount++;
                    processedCount++;
                    continue;
                  }
                }

                this.stmtUpsertProgress.run(
                  userId,
                  seriesId,
                  chapterId,
                  page,
                  scrollOffsetY ?? 0,
                  isCompleted ? 1 : 0,
                  timestamp || isoTimestamp
                );
              } else if (mut.type === 'CREATE_BOOKMARK') {
                const { chapterId, note, timestamp } = mut.payload;
                const pageIndex = typeof mut.payload.pageIndex === 'number'
                  ? mut.payload.pageIndex
                  : typeof mut.payload.pageNumber === 'number'
                  ? mut.payload.pageNumber
                  : null;

                if (!chapterId || pageIndex === null) {
                  throw new Error('Poison Pill: Missing chapterId or pageIndex in CREATE_BOOKMARK');
                }

                let seriesId = mut.payload.seriesId;
                if (!seriesId) {
                  const chap = this.stmtGetChapterSeries.get(chapterId) as { series_id?: string } | undefined;
                  seriesId = chap?.series_id || 'unknown';
                }

                this.stmtUpsertBookmark.run(
                  userId,
                  seriesId,
                  chapterId,
                  pageIndex,
                  note || null,
                  timestamp || isoTimestamp,
                  timestamp || isoTimestamp
                );
              } else if (mut.type === 'DELETE_BOOKMARK') {
                const { bookmarkId, chapterId } = mut.payload;
                const pageIndex = typeof mut.payload.pageIndex === 'number'
                  ? mut.payload.pageIndex
                  : typeof mut.payload.pageNumber === 'number'
                  ? mut.payload.pageNumber
                  : null;

                if (typeof bookmarkId === 'number') {
                  this.stmtDeleteBookmarkById.run(bookmarkId, userId);
                } else if (chapterId && pageIndex !== null) {
                  this.stmtDeleteBookmark.run(userId, chapterId, pageIndex);
                } else {
                  throw new Error('Poison Pill: Missing bookmark identifiers in DELETE_BOOKMARK');
                }
              } else {
                throw new Error(`Poison Pill: Unsupported mutation type "${mut.type}"`);
              }

              // 4. Mark Mutation Applied
              this.stmtInsertApplied.run(userId, mut.clientMutationId, 'SUCCESS');
              processedCount++;
            } catch (itemErr) {
              errorsCount++;
              failedIds.push(mut.clientMutationId);
              // Safely isolate poison pill without aborting the entire batch
              try {
                this.stmtInsertApplied.run(userId, mut.clientMutationId, 'POISON_PILL');
              } catch {
                // Ignore secondary failure on recording poison pill
              }
            }
          }

          this.db.exec('COMMIT;');
        } catch (fatalErr) {
          this.db.exec('ROLLBACK;');
          throw fatalErr;
        }

        return {
          success: errorsCount === 0,
          processedCount,
          skippedCount,
          errorsCount,
          failedIds,
        };
      }
    );
  }
}
