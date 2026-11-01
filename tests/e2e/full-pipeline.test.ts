import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/backend/app';
import { createDatabase, runMigrations, DatabaseInstance } from '../../src/backend/db/database';
import { SeriesRepository } from '../../src/backend/repositories/series-repository';
import { ChapterRepository } from '../../src/backend/repositories/chapter-repository';
import { ingestChapter } from '../../src/backend/services/chapter-ingestion-service';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

describe('Full End-to-End Pipeline Integration', () => {
  sharp.cache(false);
  const tmpRoot = path.resolve(__dirname, 'pipeline-test-storage');
  const rawChapterDir = path.join(tmpRoot, 'raw-chapter');
  let app: any;
  let db: DatabaseInstance;

  beforeAll(async () => {
    await fs.mkdir(rawChapterDir, { recursive: true });
    // Generate 3 sample manga pages
    for (let i = 1; i <= 3; i++) {
      await sharp({
        create: { width: 1200, height: 1800, channels: 3, background: { r: 50 * i, g: 30 * i, b: 20 * i } }
      }).png().toFile(path.join(rawChapterDir, `page_${i}.png`));
    }

    db = createDatabase(':memory:');
    runMigrations(db);
    app = buildApp({ db, storageRoot: tmpRoot });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    db.close();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it('successfully executes ingestion, multilingual query, chapter manifest, static delivery, and progress sync', async () => {
    const seriesRepo = new SeriesRepository(db);
    const chapRepo = new ChapterRepository(db);

    // 1. Create series with multilingual aliases
    seriesRepo.createSeries({
      id: 'kny',
      slug: 'kimetsu-no-yaiba',
      titlePrimary: 'Demon Slayer: Kimetsu no Yaiba',
      type: 'manga',
      status: 'completed'
    });
    seriesRepo.addSeriesTitles('kny', [
      { languageCode: 'ja', title: '鬼滅の刃' },
      { languageCode: 'es', title: 'Guardianes de la Noche' },
      { languageCode: 'en', title: 'Demon Slayer', isPrimary: true }
    ]);

    // 2. Ingest raw chapter images into 4TB storage directory
    const ingestResult = await ingestChapter({
      storageRoot: tmpRoot,
      seriesSlug: 'kimetsu-no-yaiba',
      volumeNumber: 1,
      chapterNumber: 1,
      sourcePath: rawChapterDir,
      isArchive: false
    });

    expect(ingestResult.pageCount).toBe(3);

    // 3. Register chapter in database
    chapRepo.createChapter({
      id: 'chap-1',
      seriesId: 'kny',
      chapterNumber: 1,
      title: 'Cruelty',
      storagePath: ingestResult.relativeStorageDir
    });
    chapRepo.addPages('chap-1', ingestResult.pages);

    // 4. Verify multilingual search: searching by Spanish returns series
    const spanishSearchRes = await app.inject({ method: 'GET', url: '/api/v1/series?q=Guardianes' });
    expect(spanishSearchRes.statusCode).toBe(200);
    expect(spanishSearchRes.json().items.length).toBe(1);
    expect(spanishSearchRes.json().items[0].slug).toBe('kimetsu-no-yaiba');

    // 5. Verify multilingual search: searching by Japanese Kanji returns series
    const kanjiSearchRes = await app.inject({ method: 'GET', url: '/api/v1/series?q=鬼滅' });
    expect(kanjiSearchRes.statusCode).toBe(200);
    expect(kanjiSearchRes.json().items.length).toBe(1);
    expect(kanjiSearchRes.json().items[0].slug).toBe('kimetsu-no-yaiba');

    // 6. Verify chapter manifest with zero-CLS page metadata
    const chapRes = await app.inject({ method: 'GET', url: '/api/v1/chapters/chap-1' });
    expect(chapRes.statusCode).toBe(200);
    const chapData = chapRes.json();
    expect(chapData.pages.length).toBe(3);
    expect(chapData.pages[0].fileName).toBe('001.webp');
    expect(chapData.pages[0].aspectRatio).toBeCloseTo(1200 / 1800, 2);

    // 7. Verify static image streaming from storage
    const staticRes = await app.inject({ method: 'GET', url: `/storage/${ingestResult.relativeStorageDir}/001.webp` });
    expect(staticRes.statusCode).toBe(200);
    expect(staticRes.headers['content-type']).toContain('webp');

    // 8. Verify reading progress sync
    const progRes = await app.inject({
      method: 'POST',
      url: '/api/v1/progress',
      payload: {
        userId: 'carlos',
        seriesId: 'kny',
        chapterId: 'chap-1',
        pageNumber: 3,
        scrollOffsetY: 0,
        isCompleted: true
      }
    });
    expect(progRes.statusCode).toBe(200);

    const getProgRes = await app.inject({ method: 'GET', url: '/api/v1/progress/kny?userId=carlos' });
    expect(getProgRes.statusCode).toBe(200);
    expect(getProgRes.json().pageNumber).toBe(3);
    expect(getProgRes.json().isCompleted).toBe(1);
  });
});
