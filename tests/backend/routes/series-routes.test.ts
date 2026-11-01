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
      synopsis: 'Sung Jinwoo ascends as the Shadow Monarch.',
    });

    repo.addSeriesTitles('solo-leveling', [
      { languageCode: 'ko', title: '나 혼자만 레벨업' },
      { languageCode: 'en', title: 'Solo Leveling', isPrimary: true },
    ]);

    repo.addSeriesGenres('solo-leveling', ['Action', 'Fantasy']);

    repo.createSeries({
      id: 'one-piece',
      slug: 'one-piece',
      titlePrimary: 'One Piece',
      type: 'manga',
      status: 'ongoing',
      synopsis: 'Monkey D. Luffy sets out to find the One Piece.',
    });

    repo.addSeriesTitles('one-piece', [
      { languageCode: 'ja', title: 'ワンピース' },
      { languageCode: 'en', title: 'One Piece', isPrimary: true },
    ]);

    repo.addSeriesGenres('one-piece', ['Action', 'Adventure', 'Comedy']);

    repo.createSeries({
      id: 'martial-peak',
      slug: 'martial-peak',
      titlePrimary: 'Martial Peak',
      type: 'manhua',
      status: 'ongoing',
      synopsis: 'The journey to the martial peak is a lonely one.',
    });

    repo.addSeriesTitles('martial-peak', [
      { languageCode: 'zh', title: '武炼巅峰' },
      { languageCode: 'en', title: 'Martial Peak', isPrimary: true },
    ]);

    repo.addSeriesGenres('martial-peak', ['Martial Arts', 'Fantasy']);

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
    expect(listRes.json().items.length).toBe(3);

    const searchRes = await app.inject({ method: 'GET', url: '/api/v1/series?q=레벨업' });
    expect(searchRes.statusCode).toBe(200);
    expect(searchRes.json().items.length).toBe(1);
    expect(searchRes.json().items[0].slug).toBe('solo-leveling');
  });

  it('GET /api/v1/series filters by type (manga, manhwa, manhua)', async () => {
    const manhwaRes = await app.inject({ method: 'GET', url: '/api/v1/series?type=manhwa' });
    expect(manhwaRes.statusCode).toBe(200);
    expect(manhwaRes.json().total).toBe(1);
    expect(manhwaRes.json().items[0].slug).toBe('solo-leveling');

    const mangaRes = await app.inject({ method: 'GET', url: '/api/v1/series?type=manga' });
    expect(mangaRes.statusCode).toBe(200);
    expect(mangaRes.json().total).toBe(1);
    expect(mangaRes.json().items[0].slug).toBe('one-piece');
  });

  it('GET /api/v1/series filters by status (completed, ongoing)', async () => {
    const completedRes = await app.inject({ method: 'GET', url: '/api/v1/series?status=completed' });
    expect(completedRes.statusCode).toBe(200);
    expect(completedRes.json().total).toBe(1);
    expect(completedRes.json().items[0].slug).toBe('solo-leveling');

    const ongoingRes = await app.inject({ method: 'GET', url: '/api/v1/series?status=ongoing' });
    expect(ongoingRes.statusCode).toBe(200);
    expect(ongoingRes.json().total).toBe(2);
  });

  it('GET /api/v1/series filters by partial genre match', async () => {
    const adventureRes = await app.inject({ method: 'GET', url: '/api/v1/series?genre=advent' });
    expect(adventureRes.statusCode).toBe(200);
    expect(adventureRes.json().total).toBe(1);
    expect(adventureRes.json().items[0].slug).toBe('one-piece');

    const martialRes = await app.inject({ method: 'GET', url: '/api/v1/series?genre=martial' });
    expect(martialRes.statusCode).toBe(200);
    expect(martialRes.json().total).toBe(1);
    expect(martialRes.json().items[0].slug).toBe('martial-peak');
  });

  it('GET /api/v1/series combines type, status, genre, and text search simultaneously', async () => {
    // One Piece and Solo Leveling are Action, but only One Piece is manga + ongoing
    const combinedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/series?type=manga&status=ongoing&genre=action&q=piece',
    });

    expect(combinedRes.statusCode).toBe(200);
    expect(combinedRes.json().total).toBe(1);
    expect(combinedRes.json().items[0].slug).toBe('one-piece');

    // Searching 'piece' with type 'manhwa' should return 0 results
    const mismatchRes = await app.inject({
      method: 'GET',
      url: '/api/v1/series?type=manhwa&q=piece',
    });

    expect(mismatchRes.statusCode).toBe(200);
    expect(mismatchRes.json().total).toBe(0);
    expect(mismatchRes.json().items.length).toBe(0);
  });

  it('GET /api/v1/series/:slug returns series details with genres and 404 on missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/series/solo-leveling' });
    expect(res.statusCode).toBe(200);
    expect(res.json().titlePrimary).toBe('Solo Leveling');
    expect(res.json().titles.length).toBe(2);
    expect(res.json().genres).toContain('Action');
    expect(res.json().genres).toContain('Fantasy');

    const missingRes = await app.inject({ method: 'GET', url: '/api/v1/series/not-found' });
    expect(missingRes.statusCode).toBe(404);
  });
});
