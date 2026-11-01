import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { extractArchive, isPathSafe } from '../../../src/backend/services/archive-extractor';
import { optimizeImageToWebP } from '../../../src/backend/services/image-processor';
import { ingestChapter } from '../../../src/backend/services/chapter-ingestion-service';
import { naturalSort } from '../../../src/backend/utils/natural-sort';
import { buildApp } from '../../../src/backend/app';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { SeriesRepository } from '../../../src/backend/repositories/series-repository';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository';

describe('Senior QA & Resilience Suite: KuraScroll Edge Cases', () => {
  sharp.cache(false);

  const testSandbox = path.resolve(__dirname, 'sandbox-resilience');
  const storageRoot = path.join(testSandbox, 'storage');
  let db: DatabaseInstance;
  let app: any;

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
    app = buildApp({ db, storageRoot });
    await app.ready();

    // Seed test series
    const seriesRepo = new SeriesRepository(db);
    seriesRepo.createSeries({
      id: 'test-series',
      slug: 'test-series',
      titlePrimary: 'Test Resilience Series',
      type: 'manhwa',
      status: 'ongoing',
    });
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  // =========================================================================
  // 1. Corrupted CBZ archive (truncated byte stream or non-zip binary)
  // =========================================================================
  describe('1. Corrupted CBZ Archive Resilience', () => {
    it('1.1: rejects non-zip random binary file disguised as .cbz with meaningful error', async () => {
      const corruptFile = path.join(testSandbox, 'random-garbage.cbz');
      const garbageBytes = Buffer.from('DEADBEEF-THIS-IS-NOT-A-ZIP-FILE-DATA-CORRUPTION-TEST-STREAM-1234567890');
      await fs.writeFile(corruptFile, garbageBytes);

      const destDir = path.join(testSandbox, 'extract-corrupt-1');
      await expect(extractArchive(corruptFile, destDir)).rejects.toThrow(/Failed to (open|read).*archive/i);

      // Verify ingestion fails gracefully and rejects
      await expect(
        ingestChapter({
          storageRoot,
          seriesSlug: 'test-series',
          volumeNumber: 1,
          chapterNumber: 901,
          sourcePath: corruptFile,
        })
      ).rejects.toThrow(/Failed to (open|read).*archive/i);

      // Verify no temporary extraction folders leak in storage/.tmp
      const tmpDir = path.join(storageRoot, '.tmp');
      if (fsSync.existsSync(tmpDir)) {
        const remaining = await fs.readdir(tmpDir);
        expect(remaining.length).toBe(0);
      }
    });

    it('1.2: rejects truncated zip byte stream cut off mid-stream without crashing', async () => {
      const truncatedFile = path.join(testSandbox, 'truncated-stream.cbz');
      // Standard PK 03 04 header truncated at 12 bytes
      const truncatedZip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00, 0x88, 0x77]);
      await fs.writeFile(truncatedFile, truncatedZip);

      const destDir = path.join(testSandbox, 'extract-truncated');
      await expect(extractArchive(truncatedFile, destDir)).rejects.toThrow(/Failed to (open|read).*archive/i);

      await expect(
        ingestChapter({
          storageRoot,
          seriesSlug: 'test-series',
          volumeNumber: 1,
          chapterNumber: 902,
          sourcePath: truncatedFile,
        })
      ).rejects.toThrow();
    });

    it('1.3: handles CBZ with corrupted image payload cleanly and cleans temp files', async () => {
      const damagedArchive = path.join(testSandbox, 'damaged-payload.cbz');
      const zip = new AdmZip();
      // Valid image name with invalid, non-decodable binary payload
      zip.addFile('001.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00])); // truncated PNG signature
      zip.writeZip(damagedArchive);

      await expect(
        ingestChapter({
          storageRoot,
          seriesSlug: 'test-series',
          volumeNumber: 1,
          chapterNumber: 903,
          sourcePath: damagedArchive,
        })
      ).rejects.toThrow();

      // Ensure temp extraction directory is cleaned up after failure
      const tmpDir = path.join(storageRoot, '.tmp');
      if (fsSync.existsSync(tmpDir)) {
        const remaining = await fs.readdir(tmpDir);
        expect(remaining.length).toBe(0);
      }
    });

    it('1.4: Fastify API returns HTTP 400 when ingesting corrupted CBZ and does not crash process', async () => {
      const corruptFile = path.join(testSandbox, 'api-corrupt.cbz');
      await fs.writeFile(corruptFile, Buffer.from('FAKE-BINARY-PAYLOAD-FOR-API-TEST'));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chapters/ingest',
        payload: {
          seriesSlug: 'test-series',
          chapterNumber: 904,
          sourcePath: corruptFile,
        },
      });

      expect(res.statusCode).toBe(400);
      const json = res.json();
      expect(json.error).toBe('Bad Request');
      expect(json.message).toMatch(/Failed to (open|read).*archive/i);

      // Verify server remains responsive after failure
      const health = await app.inject({ method: 'GET', url: '/health' });
      expect(health.statusCode).toBe(200);
      expect(health.json().status).toBe('ok');
    });
  });

  // =========================================================================
  // 2. Empty chapter directory with 0 valid images
  // =========================================================================
  describe('2. Empty Chapter Directory (0 Valid Images) Handling', () => {
    it('2.1: rejects completely empty folder with descriptive error', async () => {
      const emptyDir = path.join(testSandbox, 'empty-chapter-folder');
      await fs.mkdir(emptyDir, { recursive: true });

      await expect(
        ingestChapter({
          storageRoot,
          seriesSlug: 'test-series',
          volumeNumber: 1,
          chapterNumber: 801,
          sourcePath: emptyDir,
          isArchive: false,
        })
      ).rejects.toThrow(/No valid images found in chapter source/i);
    });

    it('2.2: rejects folder containing non-image files only (.txt, .nfo, .DS_Store, .pdf)', async () => {
      const nonImageDir = path.join(testSandbox, 'non-image-folder');
      await fs.mkdir(nonImageDir, { recursive: true });
      await fs.writeFile(path.join(nonImageDir, 'readme.txt'), 'Chapter notes');
      await fs.writeFile(path.join(nonImageDir, 'cover.nfo'), 'Release info');
      await fs.writeFile(path.join(nonImageDir, '.DS_Store'), 'Apple desktop services');
      await fs.writeFile(path.join(nonImageDir, 'document.pdf'), '%PDF-1.4 fake pdf');

      await expect(
        ingestChapter({
          storageRoot,
          seriesSlug: 'test-series',
          volumeNumber: 1,
          chapterNumber: 802,
          sourcePath: nonImageDir,
          isArchive: false,
        })
      ).rejects.toThrow(/No valid images found in chapter source/i);
    });

    it('2.3: rejects CBZ archive that contains 0 valid images', async () => {
      const emptyCbz = path.join(testSandbox, 'no-images.cbz');
      const zip = new AdmZip();
      zip.addFile('info.txt', Buffer.from('No scans here'));
      zip.addFile('metadata.xml', Buffer.from('<comicinfo></comicinfo>'));
      zip.writeZip(emptyCbz);

      const dest = path.join(testSandbox, 'extract-no-images');
      const extracted = await extractArchive(emptyCbz, dest);
      expect(extracted.length).toBe(0);

      await expect(
        ingestChapter({
          storageRoot,
          seriesSlug: 'test-series',
          volumeNumber: 1,
          chapterNumber: 803,
          sourcePath: emptyCbz,
        })
      ).rejects.toThrow(/No valid images found in chapter source/i);

      // Verify temp cleanup
      const tmpDir = path.join(storageRoot, '.tmp');
      if (fsSync.existsSync(tmpDir)) {
        const remaining = await fs.readdir(tmpDir);
        expect(remaining.length).toBe(0);
      }
    });

    it('2.4: Fastify API responds with HTTP 400 for empty chapter source', async () => {
      const emptyDir = path.join(testSandbox, 'api-empty-folder');
      await fs.mkdir(emptyDir, { recursive: true });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chapters/ingest',
        payload: {
          seriesSlug: 'test-series',
          chapterNumber: 804,
          sourcePath: emptyDir,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toMatch(/No valid images found in chapter source/i);
    });
  });

  // =========================================================================
  // 3. Malicious entry names attempting directory traversal (Zip Slip)
  // =========================================================================
  describe('3. Malicious Directory Traversal Guards (Zip Slip)', () => {
    it('3.1: isPathSafe blocks POSIX path traversal attempts', () => {
      const baseDir = path.resolve('/app/storage/series');
      expect(isPathSafe(baseDir, '../../etc/passwd')).toBe(false);
      expect(isPathSafe(baseDir, '../../../root/.ssh/id_rsa')).toBe(false);
      expect(isPathSafe(baseDir, 'sub/../../../../escaped.png')).toBe(false);
      expect(isPathSafe(baseDir, 'valid/subfolder/page.png')).toBe(true);
      expect(isPathSafe(baseDir, 'page.png')).toBe(true);
    });

    it('3.2: isPathSafe blocks Windows path traversal attempts', () => {
      const baseDir = path.resolve('C:\\kura-scroll\\storage');
      expect(isPathSafe(baseDir, '..\\..\\Windows\\System32\\cmd.exe')).toBe(false);
      expect(isPathSafe(baseDir, '..\\..\\Windows\\win.ini')).toBe(false);
      expect(isPathSafe(baseDir, 'sub\\..\\..\\..\\escape.png')).toBe(false);
    });

    it('3.3: extractArchive blocks POSIX and Windows traversal entries from writing outside destDir', async () => {
      const maliciousZipPath = path.join(testSandbox, 'malicious-zipslip.cbz');
      const outsideMarker = path.join(testSandbox, 'pwned.txt');

      // Ensure outside marker does not exist
      if (fsSync.existsSync(outsideMarker)) {
        await fs.unlink(outsideMarker);
      }

      const zip = new AdmZip();
      // Add files and explicitly set entryName to crafted traversal paths
      zip.addFile('pwned_posix.png', Buffer.from('malicious-payload-1'));
      zip.getEntries()[0].entryName = '../../pwned.png';

      zip.addFile('pwned_win.png', Buffer.from('malicious-payload-2'));
      zip.getEntries()[1].entryName = '..\\..\\pwned_win.png';

      zip.addFile('pwned_nested.png', Buffer.from('malicious-payload-3'));
      zip.getEntries()[2].entryName = 'nested/../../../pwned_nested.png';

      // Valid legitimate entry
      zip.addFile('legit_page.png', Buffer.from('valid-image-bytes'));
      zip.writeZip(maliciousZipPath);

      const destDir = path.join(testSandbox, 'safe-extract-target');
      const extracted = await extractArchive(maliciousZipPath, destDir);

      // Only the legitimate entry should have been extracted
      expect(extracted.length).toBe(1);
      expect(path.basename(extracted[0])).toBe('legit_page.png');

      // Verify no files were created outside destDir in testSandbox root
      expect(fsSync.existsSync(outsideMarker)).toBe(false);
      expect(fsSync.existsSync(path.join(testSandbox, 'pwned.png'))).toBe(false);
      expect(fsSync.existsSync(path.join(testSandbox, 'pwned_win.png'))).toBe(false);
      expect(fsSync.existsSync(path.join(testSandbox, 'pwned_nested.png'))).toBe(false);
    });

    it('3.4: rejects archives consisting entirely of directory traversal attempts', async () => {
      const purelyMaliciousZip = path.join(testSandbox, 'pure-exploit.cbz');
      const zip = new AdmZip();
      zip.addFile('shadow.png', Buffer.from('exploit'));
      zip.getEntries()[0].entryName = '../../etc/shadow.png';

      zip.addFile('bashrc.png', Buffer.from('exploit'));
      zip.getEntries()[1].entryName = '../../../root/.bashrc.png';

      zip.writeZip(purelyMaliciousZip);

      const destDir = path.join(testSandbox, 'exploit-extract');
      const extracted = await extractArchive(purelyMaliciousZip, destDir);
      expect(extracted.length).toBe(0);

      // Ingestion must reject with 0 valid images found
      await expect(
        ingestChapter({
          storageRoot,
          seriesSlug: 'test-series',
          volumeNumber: 1,
          chapterNumber: 701,
          sourcePath: purelyMaliciousZip,
        })
      ).rejects.toThrow(/No valid images found in chapter source/i);
    });
  });

  // =========================================================================
  // 4. Non-ASCII/Unicode file names (Japanese Kanji, Korean Hangul, Arabic, emojis)
  // =========================================================================
  describe('4. Non-ASCII and Multilingual Unicode Support', () => {
    it('4.1: naturally sorts Japanese Kanji and mixed scripts preserving numerical order', () => {
      const files = ['第10話_鬼滅.png', '第01話_鬼滅.png', '第02話_進撃.png', '第20話_呪術.png'];
      const sorted = naturalSort(files);
      expect(sorted).toEqual(['第01話_鬼滅.png', '第02話_進撃.png', '第10話_鬼滅.png', '第20話_呪術.png']);
    });

    it('4.2: naturally sorts Korean Hangul manhwa chapter pages', () => {
      const files = [
        '나_혼자만_레벨업_10.png',
        '나_혼자만_레벨업_01.png',
        '나_혼자만_레벨업_02.png',
        '나_혼자만_레벨업_100.png',
      ];
      const sorted = naturalSort(files);
      expect(sorted).toEqual([
        '나_혼자만_레벨업_01.png',
        '나_혼자만_레벨업_02.png',
        '나_혼자만_레벨업_10.png',
        '나_혼자만_레벨업_100.png',
      ]);
    });

    it('4.3: naturally sorts Arabic and RTL scripts correctly', () => {
      const files = ['صفحة_10.jpg', 'صفحة_01.jpg', 'صفحة_02.jpg', 'صفحة_100.jpg'];
      const sorted = naturalSort(files);
      expect(sorted).toEqual(['صفحة_01.jpg', 'صفحة_02.jpg', 'صفحة_10.jpg', 'صفحة_100.jpg']);
    });

    it('4.4: naturally sorts Emoji and symbol filenames correctly', () => {
      const files = ['⚡_page_10.png', '⚡_page_01.png', '🔥_page_02.png'];
      const sorted = naturalSort(files);
      expect(sorted[0]).toMatch(/01\.png$/);
    });

    it('4.5: extracts and ingests chapter with Kanji, Hangul, Arabic, and Emoji files', async () => {
      const unicodeDir = path.join(testSandbox, 'unicode-chapter-src');
      await fs.mkdir(unicodeDir, { recursive: true });

      const testImages = [
        { name: '第01話_鬼滅.png', color: { r: 255, g: 0, b: 0 } },
        { name: '나_혼자만_02.png', color: { r: 0, g: 255, b: 0 } },
        { name: 'صفحة_03.jpg', color: { r: 0, g: 0, b: 255 } },
        { name: '🔥_04_특급.png', color: { r: 255, g: 255, b: 0 } },
      ];

      for (const item of testImages) {
        await sharp({
          create: {
            width: 800,
            height: 1200,
            channels: 3,
            background: item.color,
          },
        })
          .png()
          .toFile(path.join(unicodeDir, item.name));
      }

      // Ingest loose folder
      const result = await ingestChapter({
        storageRoot,
        seriesSlug: 'test-series',
        volumeNumber: 1,
        chapterNumber: 601,
        sourcePath: unicodeDir,
        isArchive: false,
      });

      expect(result.pageCount).toBe(4);
      expect(result.pages[0].fileName).toBe('001.webp');
      expect(result.pages[1].fileName).toBe('002.webp');
      expect(result.pages[2].fileName).toBe('003.webp');
      expect(result.pages[3].fileName).toBe('004.webp');

      // Verify WebP files exist on disk and have valid headers
      for (const p of result.pages) {
        const fullPath = path.join(result.absoluteStorageDir, p.fileName);
        const meta = await sharp(fullPath).metadata();
        expect(meta.format).toBe('webp');
        expect(meta.width).toBe(800);
        expect(meta.height).toBe(1200);
      }
    });

    it('4.6: extracts and ingests CBZ containing UTF-8 multilingual entries', async () => {
      const cbzPath = path.join(testSandbox, 'multilingual.cbz');
      const zip = new AdmZip();

      // Create test image buffers
      const img1 = await sharp({
        create: { width: 600, height: 900, channels: 3, background: { r: 10, g: 20, b: 30 } },
      })
        .png()
        .toBuffer();

      const img2 = await sharp({
        create: { width: 600, height: 900, channels: 3, background: { r: 40, g: 50, b: 60 } },
      })
        .png()
        .toBuffer();

      zip.addFile('01_呪術廻戦_五条.png', img1);
      zip.addFile('02_나혼렙_성진우.png', img2);
      zip.writeZip(cbzPath);

      const result = await ingestChapter({
        storageRoot,
        seriesSlug: 'test-series',
        volumeNumber: 1,
        chapterNumber: 602,
        sourcePath: cbzPath,
      });

      expect(result.pageCount).toBe(2);
      expect(result.pages[0].fileName).toBe('001.webp');
      expect(result.pages[1].fileName).toBe('002.webp');
    });
  });

  // =========================================================================
  // 5. Extremely tall manhwa strips (aspect ratio < 0.2)
  // =========================================================================
  describe('5. Extremely Tall Manhwa Webtoon Strips (Aspect Ratio < 0.2)', () => {
    it('5.1: accurately processes long manhwa webtoon strip (800x8000, aspect ratio = 0.1)', async () => {
      const tallInput = path.join(testSandbox, 'webtoon-strip-800x8000.png');
      const tallOutput = path.join(testSandbox, 'webtoon-strip-800x8000.webp');

      await sharp({
        create: {
          width: 800,
          height: 8000,
          channels: 3,
          background: { r: 75, g: 120, b: 200 },
        },
      })
        .png()
        .toFile(tallInput);

      const meta = await optimizeImageToWebP(tallInput, tallOutput, {
        pageNumber: 1,
        maxImageWidth: 1440,
        webpQuality: 80,
      });

      expect(meta.width).toBe(800);
      expect(meta.height).toBe(8000);
      expect(meta.aspectRatio).toBe(0.1);
      expect(meta.aspectRatio).toBeLessThan(0.2);
      expect(meta.fileName).toBe('webtoon-strip-800x8000.webp');
      expect(meta.fileSizeBytes).toBeGreaterThan(0);

      // Verify the generated file is a valid WebP image with libvips
      const outputInfo = await sharp(tallOutput).metadata();
      expect(outputInfo.format).toBe('webp');
      expect(outputInfo.width).toBe(800);
      expect(outputInfo.height).toBe(8000);
    });

    it('5.2: resizes ultra-tall wide manhwa strip (1600x10000) to max width 1440 maintaining aspect ratio', async () => {
      const ultraTallInput = path.join(testSandbox, 'ultra-tall-1600x10000.png');
      const ultraTallOutput = path.join(testSandbox, 'ultra-tall-1440x9000.webp');

      await sharp({
        create: {
          width: 1600,
          height: 10000,
          channels: 3,
          background: { r: 120, g: 45, b: 90 },
        },
      })
        .png()
        .toFile(ultraTallInput);

      const meta = await optimizeImageToWebP(ultraTallInput, ultraTallOutput, {
        pageNumber: 2,
        maxImageWidth: 1440,
        webpQuality: 82,
      });

      // 1600 scaled to 1440 => height 10000 * (1440 / 1600) = 9000
      expect(meta.width).toBe(1440);
      expect(meta.height).toBe(9000);
      expect(meta.aspectRatio).toBeCloseTo(1440 / 9000, 4);
      expect(meta.aspectRatio).toBeLessThan(0.2);

      const outputInfo = await sharp(ultraTallOutput).metadata();
      expect(outputInfo.width).toBe(1440);
      expect(outputInfo.height).toBe(9000);
    }, 15000);

    it('5.3: boundary test: ultra-narrow strip (300x6000, aspect ratio = 0.05) has valid positive aspect ratio', async () => {
      const narrowInput = path.join(testSandbox, 'narrow-300x6000.png');
      const narrowOutput = path.join(testSandbox, 'narrow-300x6000.webp');

      await sharp({
        create: {
          width: 300,
          height: 6000,
          channels: 3,
          background: { r: 30, g: 60, b: 90 },
        },
      })
        .png()
        .toFile(narrowInput);

      const meta = await optimizeImageToWebP(narrowInput, narrowOutput);
      expect(meta.width).toBe(300);
      expect(meta.height).toBe(6000);
      expect(meta.aspectRatio).toBe(0.05);
      expect(meta.aspectRatio).toBeLessThan(0.2);
    });

    it('5.4: end-to-end ingestion and API retrieval of chapter with manhwa tall strips preserves zero-CLS metadata', async () => {
      const manhwaDir = path.join(testSandbox, 'manhwa-chapter-strips');
      await fs.mkdir(manhwaDir, { recursive: true });

      // Generate 2 tall manhwa strips
      await sharp({
        create: { width: 720, height: 7200, channels: 3, background: { r: 10, g: 20, b: 30 } },
      })
        .png()
        .toFile(path.join(manhwaDir, 'strip_01.png'));

      await sharp({
        create: { width: 720, height: 9000, channels: 3, background: { r: 30, g: 40, b: 50 } },
      })
        .png()
        .toFile(path.join(manhwaDir, 'strip_02.png'));

      // Ingest via API
      const ingestRes = await app.inject({
        method: 'POST',
        url: '/api/v1/chapters/ingest',
        payload: {
          seriesSlug: 'test-series',
          chapterNumber: 501,
          sourcePath: manhwaDir,
          title: 'The Awakening - Long Strip',
        },
      });

      expect(ingestRes.statusCode).toBe(200);
      const ingestBody = ingestRes.json();
      expect(ingestBody.success).toBe(true);
      expect(ingestBody.pageCount).toBe(2);

      // Retrieve via GET /api/v1/chapters/:chapterId
      const chapterRes = await app.inject({
        method: 'GET',
        url: `/api/v1/chapters/${ingestBody.chapterId}`,
      });

      expect(chapterRes.statusCode).toBe(200);
      const chapterData = chapterRes.json();
      expect(chapterData.pages.length).toBe(2);

      // Verify zero-CLS precomputed aspect ratios are stored and served accurately
      expect(chapterData.pages[0].aspectRatio).toBe(0.1);
      expect(chapterData.pages[0].aspectRatio).toBeLessThan(0.2);
      expect(chapterData.pages[1].aspectRatio).toBe(0.08);
      expect(chapterData.pages[1].aspectRatio).toBeLessThan(0.2);

      // Verify static streaming returns the tall WebP image
      const staticRes = await app.inject({
        method: 'GET',
        url: `/storage/${chapterData.chapter.storagePath}/001.webp`,
      });
      expect(staticRes.statusCode).toBe(200);
      expect(staticRes.headers['content-type']).toContain('webp');
    });
  });

  // =========================================================================
  // 6. Graceful error handling & resilience under server conditions
  // =========================================================================
  describe('6. Server Process Resilience and Unhandled Rejection Guards', () => {
    it('6.1: server does not crash when multiple invalid requests are executed concurrently', async () => {
      const nonExistentPath = path.join(testSandbox, 'does-not-exist');

      const requests = [
        app.inject({
          method: 'POST',
          url: '/api/v1/chapters/ingest',
          payload: { seriesSlug: 'test-series', chapterNumber: 991, sourcePath: nonExistentPath },
        }),
        app.inject({
          method: 'POST',
          url: '/api/v1/chapters/ingest',
          payload: { seriesSlug: 'non-existent-series', chapterNumber: 992, sourcePath: storageRoot },
        }),
        app.inject({
          method: 'POST',
          url: '/api/v1/chapters/ingest',
          payload: { chapterNumber: 'invalid' },
        }),
        app.inject({
          method: 'GET',
          url: '/api/v1/chapters/invalid-chapter-id-xyz',
        }),
        app.inject({
          method: 'GET',
          url: '/storage/../../../../etc/passwd',
        }),
      ];

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect([400, 404]).toContain(res.statusCode);
      }

      // Check server health afterwards
      const health = await app.inject({ method: 'GET', url: '/health' });
      expect(health.statusCode).toBe(200);
      expect(health.json().status).toBe('ok');
    });

    it('6.2: database rollback resilience on failed chapter ingestion', async () => {
      const corruptFile = path.join(testSandbox, 'fail-db.cbz');
      await fs.writeFile(corruptFile, Buffer.from('NOT-A-VALID-ZIP'));

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chapters/ingest',
        payload: {
          seriesSlug: 'test-series',
          chapterNumber: 999,
          sourcePath: corruptFile,
        },
      });

      expect(res.statusCode).toBe(400);

      // Verify that no orphan chapter was committed to the DB
      const chapRepo = new ChapterRepository(db);
      const detail = chapRepo.getChapterWithPages('test-series-c999');
      expect(detail).toBeNull();
    });
  });
});
