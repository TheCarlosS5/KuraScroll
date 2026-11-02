import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import type { FastifyInstance } from 'fastify';

describe('Offline Sync & Batch Replay Fastify Routes (Sprint 35)', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s-solo', 'solo-leveling', 'Solo Leveling', 'manhwa', 'completed')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, storage_path, page_count)
      VALUES ('ch-1', 's-solo', 1, '/ch1', 20),
             ('ch-2', 's-solo', 2, '/ch2', 25)
    `).run();

    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('POST /api/v1/sync/replay replays batch of offline mutations in a single transaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/replay',
      payload: {
        userId: 'carlos-laptop',
        mutations: [
          {
            clientMutationId: 'carlos-prog-1',
            type: 'UPDATE_PROGRESS',
            payload: {
              seriesId: 's-solo',
              chapterId: 'ch-1',
              pageNumber: 15,
            },
            timestamp: '2026-11-02T10:00:00Z',
          },
          {
            clientMutationId: 'carlos-bm-1',
            type: 'CREATE_BOOKMARK',
            payload: {
              seriesId: 's-solo',
              chapterId: 'ch-1',
              pageIndex: 14,
              note: 'Shadow Monarch Awakening',
            },
            timestamp: '2026-11-02T10:02:00Z',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.processedCount).toBe(2);
    expect(body.errorsCount).toBe(0);

    // Verify progress in SQLite
    const prog = db
      .prepare(`SELECT page_number FROM user_progress WHERE user_id = ? AND series_id = ?`)
      .get('carlos-laptop', 's-solo') as any;
    expect(prog.page_number).toBe(15);

    // Verify bookmark in SQLite
    const bm = db
      .prepare(`SELECT note FROM user_bookmarks WHERE user_id = ? AND chapter_id = ? AND page_index = 14`)
      .get('carlos-laptop', 'ch-1') as any;
    expect(bm.note).toBe('Shadow Monarch Awakening');
  });

  it('POST /api/v1/sync/replay rejects batches exceeding 50 items with 413 Payload Too Large', async () => {
    const largeBatch = Array.from({ length: 51 }, (_, i) => ({
      clientMutationId: `overflow-${i}`,
      type: 'UPDATE_PROGRESS',
      payload: { seriesId: 's-solo', chapterId: 'ch-1', pageNumber: 1 },
      timestamp: '2026-11-02T10:00:00Z',
    }));

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/replay',
      payload: {
        userId: 'carlos-laptop',
        mutations: largeBatch,
      },
    });

    expect(res.statusCode).toBe(413);
  });

  it('POST /api/v1/sync/replay rejects malformed requests missing mutations array with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sync/replay',
      payload: {
        userId: 'carlos-laptop',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('GET /api/v1/sync/status reports telemetry of applied mutations', async () => {
    // Seed 1 applied mutation
    db.prepare(`
      INSERT INTO applied_mutations (user_id, client_mutation_id, status, applied_at)
      VALUES ('carlos-laptop', 'mut-123', 'SUCCESS', '2026-11-02 12:00:00')
    `).run();

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/sync/status?userId=carlos-laptop',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.userId).toBe('carlos-laptop');
    expect(body.totalApplied).toBe(1);
    expect(body.lastAppliedAt).toBe('2026-11-02 12:00:00');
  });
});
