import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository.js';

describe('Fastify CBZ Export Routes (Sprint 40)', () => {
  let app: any;
  let db: DatabaseInstance;
  let tempDir: string;
  let chapterDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-cbz-route-test-'));
    chapterDir = path.join(tempDir, 'series', 'chainsaw-man', 'c1');
    fs.mkdirSync(chapterDir, { recursive: true });

    // Write dummy page webp files
    fs.writeFileSync(path.join(chapterDir, 'p01.webp'), Buffer.from('webp-page-1-bytes'));
    fs.writeFileSync(path.join(chapterDir, 'p02.webp'), Buffer.from('webp-page-2-bytes'));

    db = createDatabase(':memory:');
    runMigrations(db);
    const chapRepo = new ChapterRepository(db);

    db.exec(`INSERT INTO series (id, slug, title_primary, type, status, synopsis, author) 
             VALUES ('s1', 'chainsaw-man', 'Chainsaw Man', 'manga', 'ongoing', 'Denji devil hunter', 'Tatsuki Fujimoto');`);

    chapRepo.createChapter({
      id: 'c1',
      seriesId: 's1',
      chapterNumber: 1,
      volumeNumber: 1,
      title: 'Dog & Chainsaw',
      storagePath: 'series/chainsaw-man/c1',
    });

    chapRepo.addPages('c1', [
      { pageNumber: 1, fileName: 'p01.webp', width: 1000, height: 1500, aspectRatio: 0.666, fileSizeBytes: 17 },
      { pageNumber: 2, fileName: 'p02.webp', width: 1000, height: 1500, aspectRatio: 0.666, fileSizeBytes: 17 },
    ]);

    app = buildApp({ db, storageRoot: tempDir });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('GET /api/v1/chapters/:chapterId/export/cbz streams a valid CBZ archive with ComicInfo.xml', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/c1/export/cbz',
    });

    if (res.statusCode !== 200) {
      console.error('500 Error payload:', res.body);
    }

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/vnd.comicbook+zip');
    expect(res.headers['content-disposition']).toContain('attachment;');
    expect(res.headers['content-disposition']).toContain('.cbz');

    const rawBuffer = res.rawPayload;
    expect(rawBuffer.length).toBeGreaterThan(100);

    // ZIP Local file header signature check
    expect(rawBuffer.readUInt32LE(0)).toBe(0x04034b50);

    // Verify ComicInfo.xml and pages in payload
    const str = rawBuffer.toString('binary');
    expect(str).toContain('ComicInfo.xml');
    expect(str).toContain('Chainsaw Man');
    expect(str).toContain('Dog &amp; Chainsaw');
    expect(str).toContain('Tatsuki Fujimoto');
    expect(str).toContain('p0001.webp');
    expect(str).toContain('p0002.webp');

    // ZIP EOCD signature check
    const eocdSig = rawBuffer.readUInt32LE(rawBuffer.length - 22);
    expect(eocdSig).toBe(0x06054b50);
  });

  it('returns 404 on nonexistent chapter export', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/nonexistent/export/cbz',
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('Not Found');
  });
});
