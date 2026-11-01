import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository';

describe('Chapter Routes & Navigation Pointers', () => {
  let app: any;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    const chapRepo = new ChapterRepository(db);

    db.exec(`INSERT INTO series (id, slug, title_primary, type, status) VALUES ('s1', 'one-piece', 'One Piece', 'manga', 'ongoing');`);

    chapRepo.createChapter({
      id: 'c1',
      seriesId: 's1',
      chapterNumber: 1,
      title: 'Romance Dawn',
      storagePath: 'series/one-piece/v1/c1'
    });

    chapRepo.createChapter({
      id: 'c2',
      seriesId: 's1',
      chapterNumber: 2,
      title: 'Luffy',
      storagePath: 'series/one-piece/v1/c2'
    });

    chapRepo.addPages('c1', [
      { pageNumber: 1, fileName: '001.webp', width: 1440, height: 2160, aspectRatio: 0.666, fileSizeBytes: 50000 },
      { pageNumber: 2, fileName: '002.webp', width: 1440, height: 2160, aspectRatio: 0.666, fileSizeBytes: 52000 }
    ]);

    app = buildApp({ db, storageRoot: './tmp' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/chapters/:chapterId returns manifest with precomputed aspect ratios and next/prev pointers', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/chapters/c1' });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.chapter.chapterNumber).toBe(1);
    expect(body.pages.length).toBe(2);
    expect(body.pages[0].aspectRatio).toBeCloseTo(0.666, 2);
    expect(body.prevChapterId).toBeNull();
    expect(body.nextChapterId).toBe('c2');
  });

  it('returns 404 on nonexistent chapter ID', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/chapters/nonexistent' });
    expect(res.statusCode).toBe(404);
  });
});
