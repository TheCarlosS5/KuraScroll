import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';

describe('Progress Routes', () => {
  let app: any;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status) VALUES ('s1', 'chainsaw-man', 'Chainsaw Man', 'manga', 'ongoing');
      INSERT INTO chapters (id, series_id, chapter_number, storage_path) VALUES ('c1', 's1', 1, 'path');
    `);

    app = buildApp({ db, storageRoot: './tmp' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('upserts reading progress cleanly without duplicate error', async () => {
    const payload = {
      userId: 'carlos_local',
      seriesId: 's1',
      chapterId: 'c1',
      pageNumber: 18,
      scrollOffsetY: 1250.5,
      isCompleted: false
    };

    const res1 = await app.inject({ method: 'POST', url: '/api/v1/progress', payload });
    expect(res1.statusCode).toBe(200);

    // Update with new offset
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/progress',
      payload: { ...payload, pageNumber: 19, isCompleted: true }
    });
    expect(res2.statusCode).toBe(200);

    const getRes = await app.inject({ method: 'GET', url: '/api/v1/progress/s1?userId=carlos_local' });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().pageNumber).toBe(19);
    expect(getRes.json().isCompleted).toBe(1);
  });
});
