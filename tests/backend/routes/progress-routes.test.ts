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

  it('GET /api/v1/progress/recent returns recent items ordered by updated_at with thumbnail links', async () => {
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status, cover_image) 
      VALUES ('s2', 'solo-leveling', 'Solo Leveling', 'manhwa', 'completed', 'covers/s2.webp');
      
      INSERT INTO chapters (id, series_id, chapter_number, title, page_count, storage_path) 
      VALUES ('c2', 's2', 179, 'Final Chapter', 45, 'path/s2/c179');

      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, scroll_offset_y, is_completed, updated_at)
      VALUES ('carlos_local', 's1', 'c1', 10, 100, 0, datetime('now', '-10 minutes'));

      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, scroll_offset_y, is_completed, updated_at)
      VALUES ('carlos_local', 's2', 'c2', 45, 0, 1, datetime('now'));
    `);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/recent?userId=carlos_local&limit=10',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(2);
    expect(body.items.length).toBe(2);

    // Most recent first (s2 was inserted with datetime('now'))
    const item1 = body.items[0];
    expect(item1.seriesId).toBe('s2');
    expect(item1.seriesTitle).toBe('Solo Leveling');
    expect(item1.titleCanonical).toBe('Solo Leveling');
    expect(item1.titlePreferred).toBe('Solo Leveling');
    expect(item1.chapterNumber).toBe(179);
    expect(item1.pageNumber).toBe(45);
    expect(item1.totalPages).toBe(45);
    expect(item1.progressPercent).toBe(100);
    expect(item1.isCompleted).toBe(true);
    expect(item1.thumbnails.cover).toBe('/api/v1/covers/s2');
    expect(item1.thumbnails.lastRead).toBe('/api/v1/chapters/c2/pages/45');

    const item2 = body.items[1];
    expect(item2.seriesId).toBe('s1');
    expect(item2.seriesTitle).toBe('Chainsaw Man');
    expect(item2.titleCanonical).toBe('Chainsaw Man');
  });

  it('GET /api/v1/progress/recent handles CJK titles (Kanji, Kana, Hangul) without encoding loss', async () => {
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status) 
      VALUES ('s_jp', 'kimetsu-no-yaiba', '鬼滅の刃', 'manga', 'completed');
      
      INSERT INTO series_titles (series_id, language_code, title, is_primary) VALUES
        ('s_jp', 'native', '鬼滅の刃', 1),
        ('s_jp', 'ja-ro', 'Kimetsu no Yaiba', 0),
        ('s_jp', 'en', 'Demon Slayer: Kimetsu no Yaiba', 0);

      INSERT INTO chapters (id, series_id, chapter_number, title, page_count, storage_path)
      VALUES ('c_jp_1', 's_jp', 1, '第1話 残酷', 50, 'path/jp/c1');

      INSERT INTO series (id, slug, title_primary, type, status) 
      VALUES ('s_kr', 'solo-leveling', '나 혼자만 레벨업', 'manhwa', 'completed');

      INSERT INTO series_titles (series_id, language_code, title, is_primary) VALUES
        ('s_kr', 'native', '나 혼자만 레벨업', 1),
        ('s_kr', 'ko-ro', 'Na Honjaman Level Up', 0),
        ('s_kr', 'en', 'Solo Leveling', 0);

      INSERT INTO chapters (id, series_id, chapter_number, title, page_count, storage_path)
      VALUES ('c_kr_1', 's_kr', 1, '1화', 40, 'path/kr/c1');

      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, scroll_offset_y, is_completed, updated_at)
      VALUES 
        ('cjk_reader', 's_jp', 'c_jp_1', 25, 300, 0, datetime('now', '-5 minutes')),
        ('cjk_reader', 's_kr', 'c_kr_1', 10, 150, 0, datetime('now'));
    `);

    // 1. Default request (resolves romaji if available, preserves CJK native and canonical)
    const resDefault = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/recent?userId=cjk_reader',
    });
    expect(resDefault.statusCode).toBe(200);
    const bodyDefault = resDefault.json();
    expect(bodyDefault.count).toBe(2);

    const krItem = bodyDefault.items[0];
    expect(krItem.seriesId).toBe('s_kr');
    expect(krItem.titleCanonical).toBe('나 혼자만 레벨업');
    expect(krItem.titlePreferred).toBe('Na Honjaman Level Up');
    expect(krItem.titles.native).toBe('나 혼자만 레벨업');
    expect(krItem.titles.romaji).toBe('Na Honjaman Level Up');
    expect(krItem.titles.english).toBe('Solo Leveling');
    expect(krItem.chapterTitle).toBe('1화');

    const jpItem = bodyDefault.items[1];
    expect(jpItem.seriesId).toBe('s_jp');
    expect(jpItem.titleCanonical).toBe('鬼滅の刃');
    expect(jpItem.titlePreferred).toBe('Kimetsu no Yaiba');
    expect(jpItem.titles.native).toBe('鬼滅の刃');
    expect(jpItem.titles.romaji).toBe('Kimetsu no Yaiba');
    expect(jpItem.titles.english).toBe('Demon Slayer: Kimetsu no Yaiba');
    expect(jpItem.chapterTitle).toBe('第1話 残酷');

    // 2. Request with explicit ?titlePref=native
    const resNative = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/recent?userId=cjk_reader&titlePref=native',
    });
    expect(resNative.statusCode).toBe(200);
    const bodyNative = resNative.json();
    expect(bodyNative.items[0].titlePreferred).toBe('나 혼자만 레벨업');
    expect(bodyNative.items[1].titlePreferred).toBe('鬼滅の刃');

    // 3. Request with explicit ?titlePref=english
    const resEn = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/recent?userId=cjk_reader&titlePref=english',
    });
    expect(resEn.statusCode).toBe(200);
    const bodyEn = resEn.json();
    expect(bodyEn.items[0].titlePreferred).toBe('Solo Leveling');
    expect(bodyEn.items[1].titlePreferred).toBe('Demon Slayer: Kimetsu no Yaiba');

    // 4. Single series progress endpoint GET /api/v1/progress/:seriesId also provides titles
    const resSingle = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/s_jp?userId=cjk_reader&titlePref=native',
    });
    expect(resSingle.statusCode).toBe(200);
    const singleBody = resSingle.json();
    expect(singleBody.titleCanonical).toBe('鬼滅の刃');
    expect(singleBody.titlePreferred).toBe('鬼滅の刃');
    expect(singleBody.titles.native).toBe('鬼滅の刃');
    expect(singleBody.titles.romaji).toBe('Kimetsu no Yaiba');
  });

  it('GET /api/v1/progress/recent returns empty items when user has no reading history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/recent?userId=ghost_user',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.count).toBe(0);
    expect(body.items).toEqual([]);
  });
});
