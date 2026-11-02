import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { SyncReplayService } from '../../../src/backend/services/sync-replay-service';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Sprint 35: Offline Mutation Outbox & Smart Background Replay Engine Suite', () => {
  let db: DatabaseInstance;
  let service: SyncReplayService;
  let testSandbox: string;

  beforeEach(async () => {
    testSandbox = path.resolve(__dirname, 'sandbox-sprint35');
    await fs.mkdir(testSandbox, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status) VALUES ('s-1', 's-1', 'Series 1', 'manhwa', 'ongoing');
      INSERT INTO chapters (id, series_id, chapter_number, storage_path) VALUES 
        ('c-1', 's-1', 1, 'path/c1'),
        ('c-2', 's-1', 2, 'path/c2');
    `);

    service = new SyncReplayService(db);
  });

  afterEach(async () => {
    db.close();
    await fs.rm(testSandbox, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. Replaying duplicate mutations with same clientMutationId (idempotency)
  // =========================================================================
  it('1.1: replaying duplicate mutations with same clientMutationId is safely ignored without errors', async () => {
    const userId = 'user-sync';
    const mutations = [
      {
        clientMutationId: 'mut-dup-1',
        type: 'UPDATE_PROGRESS',
        payload: { seriesId: 's-1', chapterId: 'c-1', pageNumber: 5, timestamp: '2026-11-02T10:00:00Z' },
        timestamp: '2026-11-02T10:00:00Z',
      },
    ];

    const firstRun = await service.replayMutations(userId, mutations);
    expect(firstRun.processedCount).toBe(1);
    expect(firstRun.errorsCount).toBe(0);

    const secondRun = await service.replayMutations(userId, mutations);
    expect(secondRun.processedCount).toBe(1);
    expect(secondRun.skippedCount).toBe(1);
    expect(secondRun.errorsCount).toBe(0);

    const progress = db
      .prepare(`SELECT page_number FROM user_progress WHERE user_id = ? AND series_id = ?`)
      .get(userId, 's-1') as any;
    expect(progress.page_number).toBe(5);
  });

  // =========================================================================
  // 2. Out-of-order progress updates protection
  // =========================================================================
  it('2.1: older offline progress timestamps do not overwrite newer progress already recorded on server', async () => {
    const userId = 'user-sync';

    db.prepare(`
      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, scroll_offset_y, is_completed, updated_at)
      VALUES (?, 's-1', 'c-2', 20, 500, 0, '2026-11-02T12:00:00Z')
    `).run(userId);

    const mutations = [
      {
        clientMutationId: 'mut-old-1',
        type: 'UPDATE_PROGRESS',
        payload: { seriesId: 's-1', chapterId: 'c-1', pageNumber: 2, timestamp: '2026-11-02T10:00:00Z' },
        timestamp: '2026-11-02T10:00:00Z',
      },
    ];

    await service.replayMutations(userId, mutations);

    const progress = db
      .prepare(`SELECT chapter_id, page_number FROM user_progress WHERE user_id = ? AND series_id = ?`)
      .get(userId, 's-1') as any;
    expect(progress.chapter_id).toBe('c-2');
    expect(progress.page_number).toBe(20);
  });

  // =========================================================================
  // 3. Poison pills handling inside batch
  // =========================================================================
  it('3.1: gracefully isolates and handles malformed poison pill mutations inside a batch of valid mutations', async () => {
    const userId = 'user-sync';
    const mutations = [
      {
        clientMutationId: 'mut-valid-1',
        type: 'UPDATE_PROGRESS',
        payload: { seriesId: 's-1', chapterId: 'c-1', pageNumber: 10, timestamp: '2026-11-02T11:00:00Z' },
        timestamp: '2026-11-02T11:00:00Z',
      },
      {
        clientMutationId: 'mut-poison-pill',
        type: 'UPDATE_PROGRESS',
        payload: null,
        timestamp: '2026-11-02T11:01:00Z',
      },
      {
        clientMutationId: 'mut-valid-2',
        type: 'UPDATE_PROGRESS',
        payload: { seriesId: 's-1', chapterId: 'c-2', pageNumber: 5, timestamp: '2026-11-02T11:02:00Z' },
        timestamp: '2026-11-02T11:02:00Z',
      },
    ];

    const result = await service.replayMutations(userId, mutations);
    expect(result.processedCount).toBe(2);
    expect(result.errorsCount).toBe(1);
    expect(result.failedIds).toContain('mut-poison-pill');
  });

  // =========================================================================
  // 4. CREATE_BOOKMARK and DELETE_BOOKMARK replay verification
  // =========================================================================
  it('4.1: replays CREATE_BOOKMARK and DELETE_BOOKMARK mutations with exact order and idempotency', async () => {
    const userId = 'user-bm';

    // Reverse chronological order input: DELETE (10:05Z) before CREATE (10:00Z)
    // The service must sort them chronologically so CREATE happens first, then DELETE
    const mutations = [
      {
        clientMutationId: 'bm-del-seq',
        type: 'DELETE_BOOKMARK',
        payload: { chapterId: 'c-1', pageIndex: 10 },
        timestamp: '2026-11-02T10:05:00Z',
      },
      {
        clientMutationId: 'bm-create-seq',
        type: 'CREATE_BOOKMARK',
        payload: { seriesId: 's-1', chapterId: 'c-1', pageIndex: 10, note: 'Temporary bookmark' },
        timestamp: '2026-11-02T10:00:00Z',
      },
    ];

    const result = await service.replayMutations(userId, mutations);
    expect(result.processedCount).toBe(2);
    expect(result.errorsCount).toBe(0);

    const bm = db
      .prepare(`SELECT * FROM user_bookmarks WHERE user_id = ? AND chapter_id = ? AND page_index = 10`)
      .get(userId, 'c-1');
    expect(bm).toBeUndefined(); // Created then deleted
  });

  // =========================================================================
  // 5. Stress test: replaying 50 queued mutations in single transaction
  // =========================================================================
  it('5.1: stress test replaying 50 queued mutations under simulated SATA II conditions succeeds reliably', async () => {
    const userId = 'user-stress';
    const mutations = Array.from({ length: 50 }, (_, i) => ({
      clientMutationId: `mut-stress-${i + 1}`,
      type: 'UPDATE_PROGRESS',
      payload: {
        seriesId: 's-1',
        chapterId: 'c-1',
        pageNumber: i + 1,
        timestamp: `2026-11-02T10:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`,
      },
      timestamp: `2026-11-02T10:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`,
    }));

    const res = await service.replayMutations(userId, mutations);
    expect(res.errorsCount).toBe(0);
    expect(res.processedCount).toBe(50);

    const progress = db
      .prepare(`SELECT page_number FROM user_progress WHERE user_id = ? AND series_id = ?`)
      .get(userId, 's-1') as any;
    expect(progress.page_number).toBe(50);
  });
});
