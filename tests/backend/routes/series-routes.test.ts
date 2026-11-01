import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { SeriesRepository } from '../../../src/backend/repositories/series-repository';

describe('Series Routes', () => {
  let app: any;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    const repo = new SeriesRepository(db);

    repo.createSeries({
      id: 'solo-leveling',
      slug: 'solo-leveling',
      titlePrimary: 'Solo Leveling',
      type: 'manhwa',
      status: 'completed',
      synopsis: 'Sung Jinwoo ascends as the Shadow Monarch.'
    });

    repo.addSeriesTitles('solo-leveling', [
      { languageCode: 'ko', title: '나 혼자만 레벨업' },
      { languageCode: 'en', title: 'Solo Leveling', isPrimary: true }
    ]);

    app = buildApp({ db, storageRoot: './tmp' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/series returns catalog list and responds to search queries in Korean', async () => {
    const listRes = await app.inject({ method: 'GET', url: '/api/v1/series' });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().items.length).toBe(1);

    const searchRes = await app.inject({ method: 'GET', url: '/api/v1/series?q=레벨업' });
    expect(searchRes.statusCode).toBe(200);
    expect(searchRes.json().items.length).toBe(1);
    expect(searchRes.json().items[0].slug).toBe('solo-leveling');
  });

  it('GET /api/v1/series/:slug returns series details and 404 on missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/series/solo-leveling' });
    expect(res.statusCode).toBe(200);
    expect(res.json().titlePrimary).toBe('Solo Leveling');
    expect(res.json().titles.length).toBe(2);

    const missingRes = await app.inject({ method: 'GET', url: '/api/v1/series/not-found' });
    expect(missingRes.statusCode).toBe(404);
  });
});
