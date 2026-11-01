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

  it('GET /api/v1/metrics/cache returns live ByteLRU statistics', async () => {
    // Call manifest to trigger a cache populate
    await app.inject({ method: 'GET', url: '/api/v1/chapters/c1' });
    // Call again to hit the cache
    await app.inject({ method: 'GET', url: '/api/v1/chapters/c1' });

    const res = await app.inject({ method: 'GET', url: '/api/v1/metrics/cache' });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.manifestCache).toBeDefined();
    expect(body.imageCache).toBeDefined();
    expect(body.manifestCache.hits).toBeGreaterThanOrEqual(1);
    expect(body.manifestCache.maxBytes).toBe(32 * 1024 * 1024);
  });

  it('blocks path traversal attempts on page retrieval', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/c1/pages/..%2F..%2Fsensitive.txt',
    });
    expect(res.statusCode).toBe(400);
  });

  it('reflects Save-Data header on image page request', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const targetDir = path.resolve('./tmp/series/one-piece/v1/c1');
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, '001.webp'), 'fake-webp');

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/c1/pages/001.webp',
      headers: { 'save-data': 'on' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-save-data']).toBe('active');
    expect(res.headers['vary']).toContain('Save-Data');
  });

  it('serves graceful fallback WebP and logs corruption when disk file is corrupted (bad sector)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const targetDir = path.resolve('./tmp/series/one-piece/v1/c1');
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(path.join(targetDir, '002.webp'), Buffer.alloc(50));

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/c1/pages/002.webp',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    const bodyBuf = res.rawPayload;
    expect(bodyBuf.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(bodyBuf.subarray(8, 12).toString('ascii')).toBe('WEBP');

    const row: any = db.prepare('SELECT * FROM corrupt_files_log WHERE chapter_id = ?').get('c1');
    expect(row).toBeTruthy();
  });
});
