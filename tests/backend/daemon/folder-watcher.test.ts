import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import sharp from 'sharp';
import AdmZip from 'adm-zip';
import {
  FolderWatcher,
  parseArchiveFilename,
  waitForFileReady,
  moveFileSafe,
} from '../../../src/backend/daemon/folder-watcher';
import { createDatabase, runMigrations } from '../../../src/backend/db/database';
import { SeriesRepository } from '../../../src/backend/repositories/series-repository';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository';

// Disable sharp cache during tests
sharp.cache(false);

const TEST_BASE = path.resolve(__dirname, 'tmp-watcher-test');
const TEST_INCOMING = path.join(TEST_BASE, 'incoming');
const TEST_STORAGE = path.join(TEST_BASE, 'storage');

async function createSampleCbz(destPath: string, pageCount = 2): Promise<void> {
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  const zip = new AdmZip();

  for (let i = 1; i <= pageCount; i++) {
    const imgBuffer = await sharp({
      create: {
        width: 120,
        height: 180,
        channels: 3,
        background: { r: 40 * i, g: 60 * i, b: 80 * i },
      },
    })
      .jpeg()
      .toBuffer();

    zip.addFile(`page_${String(i).padStart(2, '0')}.jpg`, imgBuffer);
  }

  zip.writeZip(destPath);
}

describe('parseArchiveFilename', () => {
  it('parses standard chapter prefixes (c01, ch12, chapter-15)', () => {
    expect(parseArchiveFilename('c01.cbz')).toEqual({
      chapterNumber: 1,
      volumeNumber: 1,
      title: 'Chapter 1',
    });

    expect(parseArchiveFilename('c105.zip')).toEqual({
      chapterNumber: 105,
      volumeNumber: 1,
      title: 'Chapter 105',
    });

    expect(parseArchiveFilename('ch_12.cbz')).toEqual({
      chapterNumber: 12,
      volumeNumber: 1,
      title: 'Chapter 12',
    });

    expect(parseArchiveFilename('chapter-45.cbz')).toEqual({
      chapterNumber: 45,
      volumeNumber: 1,
      title: 'Chapter 45',
    });
  });

  it('parses decimal chapters', () => {
    const res = parseArchiveFilename('c12.5.cbz');
    expect(res).not.toBeNull();
    expect(res!.chapterNumber).toBe(12.5);
    expect(res!.title).toBe('Chapter 12.5');

    const res2 = parseArchiveFilename('chapter-105.5.zip');
    expect(res2!.chapterNumber).toBe(105.5);
  });

  it('parses volume and chapter together', () => {
    const res1 = parseArchiveFilename('v2_c15.cbz');
    expect(res1).toEqual({
      chapterNumber: 15,
      volumeNumber: 2,
      title: 'Chapter 15',
    });

    const res2 = parseArchiveFilename('Vol. 3 Ch. 4.zip');
    expect(res2).toEqual({
      chapterNumber: 4,
      volumeNumber: 3,
      title: 'Chapter 4',
    });
  });

  it('parses filenames with series name and chapter number at the end', () => {
    const res = parseArchiveFilename('Solo Leveling - 015.cbz');
    expect(res).toEqual({
      chapterNumber: 15,
      volumeNumber: 1,
      title: 'Chapter 15',
    });

    const res2 = parseArchiveFilename('05.cbz');
    expect(res2).toEqual({
      chapterNumber: 5,
      volumeNumber: 1,
      title: 'Chapter 5',
    });
  });

  it('returns null for non-numbered filenames', () => {
    expect(parseArchiveFilename('cover_art.cbz')).toBeNull();
    expect(parseArchiveFilename('readme.zip')).toBeNull();
  });
});

describe('FolderWatcher Ingestion Pipeline', () => {
  let db: ReturnType<typeof createDatabase>;
  let seriesRepo: SeriesRepository;
  let chapterRepo: ChapterRepository;

  beforeEach(async () => {
    await fs.rm(TEST_BASE, { recursive: true, force: true });
    await fs.mkdir(TEST_INCOMING, { recursive: true });
    await fs.mkdir(TEST_STORAGE, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);
    seriesRepo = new SeriesRepository(db);
    chapterRepo = new ChapterRepository(db);
  });

  afterEach(async () => {
    await fs.rm(TEST_BASE, { recursive: true, force: true });
  });

  it('ingests a single .cbz archive, registers it in DB, and moves to .processed/', async () => {
    const watcher = new FolderWatcher({
      incomingDir: TEST_INCOMING,
      storageRoot: TEST_STORAGE,
      db,
      deleteAfterIngest: false,
    });

    const cbzPath = path.join(TEST_INCOMING, 'tower-of-god', 'c01.cbz');
    await createSampleCbz(cbzPath, 2);

    const summary = await watcher.processFile(cbzPath);

    expect(summary).not.toBeNull();
    expect(summary!.seriesSlug).toBe('tower-of-god');
    expect(summary!.chapterNumber).toBe(1);
    expect(summary!.pageCount).toBe(2);
    expect(summary!.chapterId).toBe('tower-of-god-c1');

    // 1. Check Series was auto-created in database
    const series = seriesRepo.getSeriesBySlug('tower-of-god');
    expect(series).not.toBeNull();
    expect(series!.titlePrimary).toBe('Tower Of God');

    // 2. Check Chapter was registered in database with pages
    const chapterDetail = chapterRepo.getChapterWithPages('tower-of-god-c1');
    expect(chapterDetail).not.toBeNull();
    expect(chapterDetail!.chapter.chapterNumber).toBe(1);
    expect(chapterDetail!.chapter.pageCount).toBe(2);
    expect(chapterDetail!.pages.length).toBe(2);
    expect(chapterDetail!.pages[0].fileName).toBe('001.webp');
    expect(chapterDetail!.pages[1].fileName).toBe('002.webp');

    // 3. Check WebP files and manifest were written to storage
    const storageDir = path.join(TEST_STORAGE, 'series', 'tower-of-god', 'v1', 'c1');
    expect(fsSync.existsSync(path.join(storageDir, '001.webp'))).toBe(true);
    expect(fsSync.existsSync(path.join(storageDir, '002.webp'))).toBe(true);
    expect(fsSync.existsSync(path.join(storageDir, 'manifest.json'))).toBe(true);

    // 4. Check original source was moved to .processed/
    expect(fsSync.existsSync(cbzPath)).toBe(false);
    const processedPath = path.join(TEST_INCOMING, '.processed', 'tower-of-god', 'c01.cbz');
    expect(fsSync.existsSync(processedPath)).toBe(true);
  });

  it('deletes source archive safely when deleteAfterIngest is true', async () => {
    const watcher = new FolderWatcher({
      incomingDir: TEST_INCOMING,
      storageRoot: TEST_STORAGE,
      db,
      deleteAfterIngest: true,
    });

    const zipPath = path.join(TEST_INCOMING, 'nano-machine', 'c05.zip');
    await createSampleCbz(zipPath, 1);

    const summary = await watcher.processFile(zipPath);

    expect(summary).not.toBeNull();
    expect(summary!.deleted).toBe(true);
    expect(summary!.destinationFile).toBeNull();

    // Source file should be unlinked
    expect(fsSync.existsSync(zipPath)).toBe(false);

    // .processed should NOT have the file
    const processedPath = path.join(TEST_INCOMING, '.processed', 'nano-machine', 'c05.zip');
    expect(fsSync.existsSync(processedPath)).toBe(false);

    // Chapter exists in DB
    const chap = chapterRepo.getChapterWithPages('nano-machine-c5');
    expect(chap).not.toBeNull();
    expect(chap!.pages.length).toBe(1);
  });

  it('scans multiple existing archives in incoming directory recursively', async () => {
    const watcher = new FolderWatcher({
      incomingDir: TEST_INCOMING,
      storageRoot: TEST_STORAGE,
      db,
    });

    // Create 3 chapters across 2 series
    await createSampleCbz(path.join(TEST_INCOMING, 'omniscient-reader', 'c01.cbz'), 1);
    await createSampleCbz(path.join(TEST_INCOMING, 'omniscient-reader', 'c02.cbz'), 1);
    await createSampleCbz(path.join(TEST_INCOMING, 'return-of-the-mount-hua-sect', 'c10.cbz'), 1);

    const results = await watcher.scanIncoming();

    expect(results.length).toBe(3);
    const ids = results.map((r) => r.chapterId).sort();
    expect(ids).toEqual([
      'omniscient-reader-c1',
      'omniscient-reader-c2',
      'return-of-the-mount-hua-sect-c10',
    ]);

    expect(chapterRepo.getChapterWithPages('omniscient-reader-c1')).not.toBeNull();
    expect(chapterRepo.getChapterWithPages('omniscient-reader-c2')).not.toBeNull();
    expect(chapterRepo.getChapterWithPages('return-of-the-mount-hua-sect-c10')).not.toBeNull();
  });

  it('ignores files in root incoming, non-archive files, and .processed directory', async () => {
    const watcher = new FolderWatcher({
      incomingDir: TEST_INCOMING,
      storageRoot: TEST_STORAGE,
      db,
    });

    // 1. Archive placed directly in incoming/ (not incoming/<series-slug>/<filename>)
    const rootArchive = path.join(TEST_INCOMING, 'c01.cbz');
    await createSampleCbz(rootArchive, 1);
    const res1 = await watcher.processFile(rootArchive);
    expect(res1).toBeNull();

    // 2. Non-archive file inside series directory
    const txtFile = path.join(TEST_INCOMING, 'sample-series', 'notes.txt');
    await fs.mkdir(path.dirname(txtFile), { recursive: true });
    await fs.writeFile(txtFile, 'random notes');
    const res2 = await watcher.processFile(txtFile);
    expect(res2).toBeNull();

    // 3. File inside .processed directory
    const processedFile = path.join(TEST_INCOMING, '.processed', 'sample-series', 'c01.cbz');
    await createSampleCbz(processedFile, 1);
    const res3 = await watcher.processFile(processedFile);
    expect(res3).toBeNull();
  });

  it('re-ingests cleanly without UNIQUE constraint crash when chapter is re-dropped', async () => {
    const watcher = new FolderWatcher({
      incomingDir: TEST_INCOMING,
      storageRoot: TEST_STORAGE,
      db,
      deleteAfterIngest: true,
    });

    const cbzPath = path.join(TEST_INCOMING, 'solo-leveling', 'c01.cbz');
    await createSampleCbz(cbzPath, 1);
    await watcher.processFile(cbzPath);

    // Re-create same chapter with 2 pages
    await createSampleCbz(cbzPath, 2);
    const reIngest = await watcher.processFile(cbzPath);

    expect(reIngest).not.toBeNull();
    expect(reIngest!.pageCount).toBe(2);

    const chap = chapterRepo.getChapterWithPages('solo-leveling-c1');
    expect(chap).not.toBeNull();
    expect(chap!.pages.length).toBe(2);
  });

  it('triggers live ingestion via fs.watch when file is placed into incoming', async () => {
    const watcher = new FolderWatcher({
      incomingDir: TEST_INCOMING,
      storageRoot: TEST_STORAGE,
      db,
      debounceMs: 50,
      deleteAfterIngest: false,
    });

    await watcher.start();
    expect(watcher.active).toBe(true);

    const ingestedPromise = new Promise<any>((resolve) => {
      watcher.once('ingested', (data) => resolve(data));
    });

    const newChapter = path.join(TEST_INCOMING, 'live-test-series', 'c01.cbz');
    await createSampleCbz(newChapter, 1);

    const result = await Promise.race([
      ingestedPromise,
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout waiting for live watch ingestion')), 5000)
      ),
    ]);

    expect(result).not.toBeNull();
    expect(result.seriesSlug).toBe('live-test-series');
    expect(result.chapterNumber).toBe(1);

    await watcher.stop();
    expect(watcher.active).toBe(false);
  });
});
