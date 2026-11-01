import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import {
  ingestVolumeArchive,
  normalizeChapterNumber,
  isSystemJunkOrNoise,
  detectVolumeChapters,
} from '../../../src/backend/services/volume-ingestion-service';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { SeriesRepository } from '../../../src/backend/repositories/series-repository';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository';

describe('Senior QA & Resilience Suite: Multi-Chapter Volume Archive Fuzzing (Sprint 10.2)', () => {
  sharp.cache(false);

  const testSandbox = path.resolve(__dirname, 'sandbox-volume-fuzz');
  const storageRoot = path.join(testSandbox, 'storage');
  let db: DatabaseInstance;
  let seriesRepo: SeriesRepository;
  let chapRepo: ChapterRepository;

  // Helper to create a valid lightweight PNG image buffer
  async function makeValidPng(width = 200, height = 300, color = { r: 50, g: 100, b: 150 }): Promise<Buffer> {
    return await sharp({
      create: { width, height, channels: 3, background: color },
    })
      .png()
      .toBuffer();
  }

  beforeAll(async () => {
    await fs.mkdir(testSandbox, { recursive: true });
    await fs.mkdir(storageRoot, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testSandbox, { recursive: true, force: true });
  });

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    seriesRepo = new SeriesRepository(db);
    chapRepo = new ChapterRepository(db);

    seriesRepo.createSeries({
      id: 'berserk',
      slug: 'berserk',
      titlePrimary: 'Berserk',
      type: 'manga',
      status: 'ongoing',
    });
  });

  afterEach(async () => {
    db.close();
  });

  // =========================================================================
  // 1. Zip Slip Defense in Multi-Chapter Volumes
  // =========================================================================
  describe('1. Zip Slip Defense in Volume Archives', () => {
    it('1.1: neutralizes directory traversal entries (Chapter 1/../../../../evil.jpg) without escaping sandbox', async () => {
      const volumeZipPath = path.join(testSandbox, 'zipslip-volume.cbz');
      const outsideMarker = path.join(testSandbox, 'evil.jpg');

      if (fsSync.existsSync(outsideMarker)) {
        await fs.unlink(outsideMarker);
      }

      const zip = new AdmZip();
      const validImg = await makeValidPng();

      // Legitimate entries
      zip.addFile('Chapter 1/001.png', validImg);
      zip.addFile('Chapter 1/002.png', validImg);

      // Malicious entries attempting traversal
      zip.addFile('pwned_1.png', validImg);
      zip.getEntries()[2].entryName = 'Chapter 1/../../../../evil.jpg';

      zip.addFile('pwned_win.png', validImg);
      zip.getEntries()[3].entryName = 'Chapter 1\\..\\..\\..\\..\\evil_win.jpg';

      zip.writeZip(volumeZipPath);

      // Ingest the volume archive
      const result = await ingestVolumeArchive({
        storageRoot,
        seriesSlug: 'berserk',
        volumeNumber: 1,
        sourcePath: volumeZipPath,
        db,
      });

      expect(result.totalChapters).toBe(1);
      expect(result.totalValidPages).toBe(2);
      expect(result.warnings.some((w) => w.includes('Zip Slip'))).toBe(true);

      // Verify no files escaped to the sandbox root or parent folders
      expect(fsSync.existsSync(outsideMarker)).toBe(false);
      expect(fsSync.existsSync(path.join(testSandbox, 'evil.jpg'))).toBe(false);
      expect(fsSync.existsSync(path.join(testSandbox, 'evil_win.jpg'))).toBe(false);
    });
  });

  // =========================================================================
  // 2. System Artifacts and Noise Filtering
  // =========================================================================
  describe('2. System Artifacts & Noise Filtering (__MACOSX, .DS_Store, Thumbs.db)', () => {
    it('2.1: isSystemJunkOrNoise accurately flags system junk files', () => {
      expect(isSystemJunkOrNoise('__MACOSX/Chapter 1/._001.jpg')).toBe(true);
      expect(isSystemJunkOrNoise('Chapter 1/._001.jpg')).toBe(true);
      expect(isSystemJunkOrNoise('Chapter 1/.DS_Store')).toBe(true);
      expect(isSystemJunkOrNoise('Chapter 1/Thumbs.db')).toBe(true);
      expect(isSystemJunkOrNoise('desktop.ini')).toBe(true);
      expect(isSystemJunkOrNoise('Chapter 1/001.png')).toBe(false);
      expect(isSystemJunkOrNoise('001_page.webp')).toBe(false);
    });

    it('2.2: volume extractor ignores system files and empty directories cleanly', async () => {
      const noisyVolumePath = path.join(testSandbox, 'noisy-volume.cbz');
      const zip = new AdmZip();
      const validImg = await makeValidPng();

      // Valid pages
      zip.addFile('Chapter 1/001.png', validImg);
      zip.addFile('Chapter 1/002.png', validImg);
      // macOS junk
      zip.addFile('__MACOSX/Chapter 1/._001.png', Buffer.from('Mac OS metadata resource fork'));
      zip.addFile('Chapter 1/._002.png', Buffer.from('AppleDouble header'));
      zip.addFile('Chapter 1/.DS_Store', Buffer.from('Mac Finder view state'));
      // Windows junk
      zip.addFile('Chapter 1/Thumbs.db', Buffer.from('Windows Explorer thumbnail cache'));
      zip.addFile('desktop.ini', Buffer.from('[LocalizedFileNames]'));
      // Empty directory entry
      zip.addFile('EmptyFolder/', Buffer.alloc(0));

      zip.writeZip(noisyVolumePath);

      const result = await ingestVolumeArchive({
        storageRoot,
        seriesSlug: 'berserk',
        volumeNumber: 1,
        sourcePath: noisyVolumePath,
        db,
      });

      expect(result.totalChapters).toBe(1);
      expect(result.totalValidPages).toBe(2);
      expect(result.chapters[0].pages.length).toBe(2);
      expect(result.chapters[0].pages[0].fileName).toBe('001.webp');
      expect(result.chapters[0].pages[1].fileName).toBe('002.webp');
    });
  });

  // =========================================================================
  // 3. Partial Image Corruption Handling (Fault Tolerance)
  // =========================================================================
  describe('3. Partial Image Corruption Resilience (1 Corrupted in 10 Pages)', () => {
    it('3.1: processes 9 valid pages and reports warning on 1 corrupted page without failing volume', async () => {
      const corruptVolumePath = path.join(testSandbox, 'partial-corrupt-volume.cbz');
      const zip = new AdmZip();
      const validImg = await makeValidPng(150, 250);

      // Add 9 valid pages
      for (let i = 1; i <= 9; i++) {
        zip.addFile(`Chapter 1/page_${String(i).padStart(3, '0')}.png`, validImg);
      }

      // Add 1 corrupted page with random undecodable garbage bytes
      const randomGarbageBytes = Buffer.from('NOT-AN-IMAGE-CORRUPT-HEADER-0xDEADBEEF-GARBAGE-PAYLOAD-FUZZING');
      zip.addFile('Chapter 1/page_005_corrupt.png', randomGarbageBytes);

      zip.writeZip(corruptVolumePath);

      const result = await ingestVolumeArchive({
        storageRoot,
        seriesSlug: 'berserk',
        volumeNumber: 1,
        sourcePath: corruptVolumePath,
        db,
      });

      expect(result.totalChapters).toBe(1);
      // The 9 valid pages must be processed successfully
      expect(result.totalValidPages).toBe(9);
      expect(result.totalSkippedPages).toBe(1);
      expect(result.chapters[0].pageCount).toBe(9);
      expect(result.chapters[0].skippedPagesCount).toBe(1);

      // Warnings must contain reference to the corrupted entry
      expect(result.warnings.some((w) => w.includes('page_005_corrupt.png'))).toBe(true);

      // Verify that the manifest was saved with 9 pages and recorded skipped count
      const chapterDetail = chapRepo.getChapterWithPages('berserk-c1');
      expect(chapterDetail).not.toBeNull();
      expect(chapterDetail!.pages.length).toBe(9);
      expect(chapterDetail!.chapter.pageCount).toBe(9);
    });
  });

  // =========================================================================
  // 4. Chapter Name Variations and Case Normalization
  // =========================================================================
  describe('4. Chapter Folder Variations & Case Normalization', () => {
    it('4.1: normalizeChapterNumber handles diverse naming patterns', () => {
      expect(normalizeChapterNumber('CHAPTER 1')).toBe(1);
      expect(normalizeChapterNumber('chapter 02')).toBe(2);
      expect(normalizeChapterNumber('Ch.03')).toBe(3);
      expect(normalizeChapterNumber('Capitulo 4')).toBe(4);
      expect(normalizeChapterNumber('c05')).toBe(5);
      expect(normalizeChapterNumber('Vol. 1 - Ch. 6.5')).toBe(6.5);
      expect(normalizeChapterNumber('10')).toBe(10);
    });

    it('4.2: normalizes mixed casing (CHAPTER 1/, chapter 02/, Ch.03/) in natural numerical order', async () => {
      const mixedVolumePath = path.join(testSandbox, 'mixed-casing-volume.cbz');
      const zip = new AdmZip();
      const validImg = await makeValidPng(100, 150);

      // Ch. 10 added first in zip
      zip.addFile('Ch.10/001.png', validImg);
      // CHAPTER 1 in uppercase
      zip.addFile('CHAPTER 1/001.png', validImg);
      zip.addFile('CHAPTER 1/002.png', validImg);
      // chapter 02 in lowercase
      zip.addFile('chapter 02/001.png', validImg);
      // Ch.03 with dot
      zip.addFile('Ch.03/001.png', validImg);

      zip.writeZip(mixedVolumePath);

      const result = await ingestVolumeArchive({
        storageRoot,
        seriesSlug: 'berserk',
        volumeNumber: 1,
        sourcePath: mixedVolumePath,
        db,
      });

      // 4 chapters detected: 1, 2, 3, 10
      expect(result.totalChapters).toBe(4);
      expect(result.chapters[0].chapterNumber).toBe(1);
      expect(result.chapters[1].chapterNumber).toBe(2);
      expect(result.chapters[2].chapterNumber).toBe(3);
      expect(result.chapters[3].chapterNumber).toBe(10);

      // Verify DB records
      expect(chapRepo.getChapter('berserk-c1')).not.toBeNull();
      expect(chapRepo.getChapter('berserk-c2')).not.toBeNull();
      expect(chapRepo.getChapter('berserk-c3')).not.toBeNull();
      expect(chapRepo.getChapter('berserk-c10')).not.toBeNull();
    });
  });

  // =========================================================================
  // 5. Volume Ingestion Idempotency
  // =========================================================================
  describe('5. Volume Ingestion Idempotency (Consecutive Re-Ingestion)', () => {
    it('5.1: re-ingesting the exact same volume archive twice updates cleanly without UNIQUE constraint crash', async () => {
      const idempotentVolumePath = path.join(testSandbox, 'idempotent-volume.cbz');
      const zip = new AdmZip();
      const validImg = await makeValidPng(120, 180);

      zip.addFile('Chapter 1/001.png', validImg);
      zip.addFile('Chapter 2/001.png', validImg);
      zip.writeZip(idempotentVolumePath);

      // Run 1: First Ingestion
      const run1 = await ingestVolumeArchive({
        storageRoot,
        seriesSlug: 'berserk',
        volumeNumber: 1,
        sourcePath: idempotentVolumePath,
        db,
      });
      expect(run1.totalChapters).toBe(2);
      expect(run1.totalValidPages).toBe(2);

      // Run 2: Consecutive Re-Ingestion (must NOT throw UNIQUE constraint error)
      await expect(
        ingestVolumeArchive({
          storageRoot,
          seriesSlug: 'berserk',
          volumeNumber: 1,
          sourcePath: idempotentVolumePath,
          db,
        })
      ).resolves.not.toThrow();

      // Verify database still has exactly 2 chapters for this series (zero duplicate rows)
      const chaptersInDb = db.prepare('SELECT * FROM chapters WHERE series_id = ?').all('berserk') as any[];
      expect(chaptersInDb.length).toBe(2);

      // Verify chapter pages in DB
      const pagesInDb = db.prepare('SELECT * FROM chapter_pages').all() as any[];
      expect(pagesInDb.length).toBe(2);
    });
  });

  // =========================================================================
  // 6. Resource Leaks & File Descriptor Teardown on Windows
  // =========================================================================
  describe('6. Resource Leak & Windows File Descriptor Teardown', () => {
    it('6.1: processes multiple volumes consecutively without leaving locked file descriptors', async () => {
      const volumeCount = 5;
      const createdVolumePaths: string[] = [];

      // Generate 5 separate volume archives
      for (let v = 1; v <= volumeCount; v++) {
        const volPath = path.join(testSandbox, `fd-leak-volume-${v}.cbz`);
        const zip = new AdmZip();
        const img = await makeValidPng(100, 100);
        zip.addFile('Chapter 1/001.png', img);
        zip.writeZip(volPath);
        createdVolumePaths.push(volPath);
      }

      // Process each volume consecutively
      for (let v = 1; v <= volumeCount; v++) {
        await ingestVolumeArchive({
          storageRoot,
          seriesSlug: 'berserk',
          volumeNumber: v,
          sourcePath: createdVolumePaths[v - 1],
          db,
        });
      }

      // PROOF OF ZERO FILE DESCRIPTOR LEAKS:
      // On Windows, if any AdmZip instance or file read stream held an open file descriptor,
      // calling fs.unlink() or fs.open('r+') would throw EBUSY / EPERM.
      for (const volPath of createdVolumePaths) {
        // Must succeed without EBUSY
        const handle = await fs.open(volPath, 'r+');
        expect(handle).toBeDefined();
        await handle.close();

        // Must delete cleanly without file-in-use error
        await expect(fs.unlink(volPath)).resolves.not.toThrow();
        expect(fsSync.existsSync(volPath)).toBe(false);
      }
    });
  });
});
