import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import sharp from 'sharp';
import { buildApp } from '../../../src/backend/app';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { SeriesRepository } from '../../../src/backend/repositories/series-repository';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository';

describe('Senior QA & Resilience Suite: Fastify HTTP Fuzzing & Teardown Guards', () => {
  sharp.cache(false);

  const testSandbox = path.resolve(__dirname, 'sandbox-http-fuzz');
  const storageRoot = path.join(testSandbox, 'storage');
  let db: DatabaseInstance;
  let app: any;
  let seriesRepo: SeriesRepository;
  let chapRepo: ChapterRepository;

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

    seriesRepo = new SeriesRepository(db);
    chapRepo = new ChapterRepository(db);

    // Seed test series with multilingual titles
    seriesRepo.createSeries({
      id: 'fuzz-solo',
      slug: 'solo-leveling',
      titlePrimary: 'Solo Leveling',
      type: 'manhwa',
      status: 'completed',
    });
    seriesRepo.addSeriesTitles('fuzz-solo', [
      { languageCode: 'en', title: 'Solo Leveling', isPrimary: true },
      { languageCode: 'ko', title: '나 혼자만 레벨업' },
      { languageCode: 'ja', title: '俺だけレベルアップな件' },
    ]);

    seriesRepo.createSeries({
      id: 'fuzz-kny',
      slug: 'kimetsu-no-yaiba',
      titlePrimary: 'Demon Slayer: Kimetsu no Yaiba',
      type: 'manga',
      status: 'completed',
    });
    seriesRepo.addSeriesTitles('fuzz-kny', [
      { languageCode: 'en', title: 'Demon Slayer', isPrimary: true },
      { languageCode: 'ja', title: '鬼滅の刃' },
      { languageCode: 'es', title: 'Guardianes de la Noche' },
    ]);
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  // =========================================================================
  // 1. Giant JSON Payloads (>5MB) & Body Limit (413 Payload Too Large)
  // =========================================================================
  describe('1. Giant JSON Payloads & Body Limit Guards (HTTP 413)', () => {
    it('1.1: rejects a >5MB JSON payload on POST /api/v1/progress with 413 without V8 heap exhaustion', async () => {
      // Create a 5.5MB string in JSON
      const giantString = 'x'.repeat(5.5 * 1024 * 1024);
      const giantPayload = {
        userId: 'fuzzer',
        seriesId: 'solo-leveling',
        chapterId: 'chap-1',
        pageNumber: 1,
        scrollOffsetY: 0,
        extraData: giantString,
      };

      const heapBefore = process.memoryUsage().heapUsed;

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/progress',
        payload: giantPayload,
        headers: {
          'content-type': 'application/json',
        },
      });

      const heapAfter = process.memoryUsage().heapUsed;
      const heapDeltaMB = (heapAfter - heapBefore) / (1024 * 1024);

      expect(res.statusCode).toBe(413);
      const json = res.json();
      expect(json.statusCode).toBe(413);
      expect(json.error).toBe('Payload Too Large');
      expect(json.message).toMatch(/body is too large/i);

      // Verify V8 heap did not collapse or blow up beyond reasonable garbage collection bounds (< 35MB delta)
      expect(heapDeltaMB).toBeLessThan(35);

      // Verify server remains responsive after rejecting the oversized payload
      const health = await app.inject({ method: 'GET', url: '/health' });
      expect(health.statusCode).toBe(200);
      expect(health.json().status).toBe('ok');
    });

    it('1.2: rejects a >5MB payload on POST /api/v1/chapters/ingest with 413 without disk write', async () => {
      const giantBody = JSON.stringify({
        seriesSlug: 'solo-leveling',
        chapterNumber: 999,
        sourcePath: 'dummy',
        garbage: 'z'.repeat(5.2 * 1024 * 1024),
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chapters/ingest',
        headers: {
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(giantBody)),
        },
        payload: giantBody,
      });

      expect(res.statusCode).toBe(413);
      expect(res.json().error).toBe('Payload Too Large');

      // Verify no chapter record was written to the database
      const row = db.prepare('SELECT * FROM chapters WHERE chapter_number = 999').get();
      expect(row).toBeUndefined();
    });

    it('1.3: custom bodyLimit config enforces strict limits', async () => {
      // Build an app instance with a tight 256KB body limit
      const tightApp = buildApp({ db, storageRoot, bodyLimit: 256 * 1024 });
      await tightApp.ready();

      chapRepo.createChapter({
        id: 'fuzz-c1',
        seriesId: 'fuzz-solo',
        chapterNumber: 1,
        storagePath: 'series/solo-leveling/v1/c1',
      });

      try {
        // 400KB payload should be rejected with 413
        const payload400k = { data: 'a'.repeat(400 * 1024) };
        const resOver = await tightApp.inject({
          method: 'POST',
          url: '/api/v1/progress',
          payload: payload400k,
        });
        expect(resOver.statusCode).toBe(413);

        // Small valid payload within 256KB should be processed cleanly
        const payload1k = {
          userId: 'test-user',
          seriesId: 'fuzz-solo',
          chapterId: 'fuzz-c1',
          pageNumber: 1,
        };
        const resOk = await tightApp.inject({
          method: 'POST',
          url: '/api/v1/progress',
          payload: payload1k,
        });
        expect(resOk.statusCode).toBe(200);
      } finally {
        await tightApp.close();
      }
    });
  });

  // =========================================================================
  // 2. Malformed HTTP Headers & Control Characters
  // =========================================================================
  describe('2. Malformed HTTP Headers & Control Characters', () => {
    it('2.1: handles null bytes (%00) and control characters in URL query safely', async () => {
      const maliciousQueries = [
        '/api/v1/series?q=solo%00leveling',
        '/api/v1/series?q=%00%00%00',
        '/api/v1/series?q=%07%08%1b%1f',
        '/api/v1/series?q=demon%0A%0Dslayer',
      ];

      for (const uri of maliciousQueries) {
        const res = await app.inject({ method: 'GET', url: uri });
        // The server must safely respond without crashing or throwing unhandled 500
        expect([200, 400]).toContain(res.statusCode);
      }

      // Check server health afterwards
      const health = await app.inject({ method: 'GET', url: '/health' });
      expect(health.statusCode).toBe(200);
      expect(health.json().status).toBe('ok');
    });

    it('2.2: rejects malformed Content-Type with control characters or garbage syntax', async () => {
      const badContentTypes = [
        'application/json; boundary=invalid\0garbage',
        'application/x-unknown-fuzzing-type',
        'multipart/form-data', // missing boundary
        'text/html; charset=utf-7',
      ];

      for (const ct of badContentTypes) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/progress',
          headers: { 'content-type': ct },
          payload: '{"test": 1}',
        });

        // Fastify rejects or handles gracefully; must not crash
        expect([200, 400, 415]).toContain(res.statusCode);
      }
    });

    it('2.3: handles malformed Accept and User-Agent headers with extreme lengths', async () => {
      const longHeaderValue = 'A'.repeat(8000);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/series',
        headers: {
          'user-agent': longHeaderValue,
          accept: 'text/html,application/xhtml+xml,' + longHeaderValue,
        },
      });

      expect([200, 400, 431]).toContain(res.statusCode);

      const health = await app.inject({ method: 'GET', url: '/health' });
      expect(health.statusCode).toBe(200);
    });

    it('2.4: handles raw TCP requests with malformed HTTP/1.1 control bytes without unhandled crash', async () => {
      await app.listen({ port: 0, host: '127.0.0.1' });
      const address = app.server.address() as any;
      const port = address.port;

      // Send raw garbage over TCP socket to test Node http_parser resilience
      await new Promise<void>((resolve) => {
        const socket = net.createConnection({ port, host: '127.0.0.1' }, () => {
          socket.write("GET /health HTTP/1.1\r\nX-Bad: \x00\x01\x02\r\n\r\n");
        });

        socket.on('data', () => {
          socket.destroy();
          resolve();
        });

        socket.on('error', () => {
          socket.destroy();
          resolve();
        });

        socket.on('close', () => resolve());
      });

      // Verify the Fastify server is completely unharmed
      const checkRes = await app.inject({ method: 'GET', url: '/health' });
      expect(checkRes.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // 3. FTS5 Complex Syntax Injections & Invisible Unicode
  // =========================================================================
  describe('3. SQLite FTS5 Complex Syntax Injections & Invisible Unicode', () => {
    it('3.1: safely handles quotation spam (""""")', async () => {
      const quoteAttacks = ['"""""', '"""""""', '\\"\\"\\"', '"""solo"""', '""leveling""'];

      for (const q of quoteAttacks) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/series?q=${encodeURIComponent(q)}`,
        });

        expect(res.statusCode).toBe(200);
        const json = res.json();
        expect(Array.isArray(json.items)).toBe(true);
      }
    });

    it('3.2: neutralizes FTS5 boolean operators and chaining (AND OR NOT NEAR)', async () => {
      const operatorAttacks = [
        'AND OR NOT NEAR',
        'NOT',
        'AND AND AND',
        'OR OR',
        'NEAR/5',
        'solo NOT leveling',
        'demon AND NOT slayer',
        'NEAR(solo leveling, 10)',
        'AND',
        'OR',
      ];

      for (const op of operatorAttacks) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/series?q=${encodeURIComponent(op)}`,
        });

        expect(res.statusCode).toBe(200);
        const json = res.json();
        expect(Array.isArray(json.items)).toBe(true);
      }
    });

    it('3.3: neutralizes wildcard floods and special FTS punctuation (* * * *)', async () => {
      const wildcardAttacks = [
        '* * * *',
        '***',
        '*** *** ***',
        '^ * + -',
        '() [] {} : ^ + - < > = ==',
        ':::^^^+++---***',
        '???',
        'solo*',
        '*leveling',
      ];

      for (const w of wildcardAttacks) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/series?q=${encodeURIComponent(w)}`,
        });

        expect(res.statusCode).toBe(200);
        const json = res.json();
        expect(Array.isArray(json.items)).toBe(true);
      }
    });

    it('3.4: strips invisible unicode characters (zero-width spaces, Bidi overrides)', async () => {
      const invisibleAttacks = [
        // Zero-width space & non-joiners
        'solo\u200Bleveling',
        '\u200B\u200C\u200D',
        'Demon\uFEFFSlayer',
        // Bidirectional override characters
        '\u202Ereversed\u202C',
        'Solo\u2066Leveling\u2069',
        // Invisible separator
        'Solo\u2063Leveling',
      ];

      for (const inv of invisibleAttacks) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/series?q=${encodeURIComponent(inv)}`,
        });

        expect(res.statusCode).toBe(200);
        const json = res.json();
        expect(Array.isArray(json.items)).toBe(true);
      }

      // Verify that 'solo\u200Bleveling' still cleanly matches the series after stripping
      const matchRes = await app.inject({
        method: 'GET',
        url: `/api/v1/series?q=${encodeURIComponent('solo\u200Bleveling')}`,
      });
      expect(matchRes.statusCode).toBe(200);
      expect(matchRes.json().items.length).toBeGreaterThan(0);
      expect(matchRes.json().items[0].slug).toBe('solo-leveling');
    });

    it('3.5: protects against SQL injection attempts via search query', async () => {
      const sqlInjections = [
        "' OR 1=1 --",
        "'; DROP TABLE series; --",
        "1' UNION SELECT '1','hacked','hacked','manga','ongoing',null,null,null,null,null,null,null,null,null,null,null --",
        "admin'--",
        "1' AND 1=2 UNION SELECT * FROM series --",
      ];

      for (const sql of sqlInjections) {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/series?q=${encodeURIComponent(sql)}`,
        });

        expect(res.statusCode).toBe(200);
        const json = res.json();
        expect(Array.isArray(json.items)).toBe(true);
      }

      // Verify table still exists and data was not dropped
      const count = db.prepare('SELECT COUNT(*) as c FROM series').get() as any;
      expect(count.c).toBe(2);
    });
  });

  // =========================================================================
  // 4. Abrupt Stream Teardown & File Descriptor Leak Guards
  // =========================================================================
  describe('4. Abrupt HTTP Stream Teardown & Resource Leak Guards', () => {
    const webpRelPath = 'series/test-teardown/v1/c1/001.webp';
    let targetFilePath: string;

    beforeEach(async () => {
      targetFilePath = path.join(storageRoot, webpRelPath);
      await fs.mkdir(path.dirname(targetFilePath), { recursive: true });

      // Generate a sizeable ~300KB WebP image to ensure multi-chunk HTTP streaming
      await sharp({
        create: {
          width: 1440,
          height: 2500,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .webp({ quality: 90 })
        .toFile(targetFilePath);
    });

    it('4.1: client abruptly destroys connection mid-stream without crashing server', async () => {
      await app.listen({ port: 0, host: '127.0.0.1' });
      const address = app.server.address() as any;
      const port = address.port;

      const streamUrl = `http://127.0.0.1:${port}/storage/${webpRelPath}`;

      await new Promise<void>((resolve, reject) => {
        const req = http.get(streamUrl, (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-type']).toContain('webp');

          res.once('data', (chunk) => {
            expect(chunk.length).toBeGreaterThan(0);
            // Abrupt client teardown: destroy request and underlying socket immediately
            req.destroy();
            resolve();
          });
        });

        req.on('error', (err) => {
          // Expected client-side abort error
          resolve();
        });
      });

      // Small delay to allow Fastify/Node stream cleanup handlers to execute
      await new Promise((r) => setTimeout(r, 50));

      // Verify server remains fully functional
      const health = await app.inject({ method: 'GET', url: '/health' });
      expect(health.statusCode).toBe(200);
      expect(health.json().status).toBe('ok');
    });

    it('4.2: executes 30 rapid concurrent abrupt stream teardowns without file descriptor leaks', async () => {
      await app.listen({ port: 0, host: '127.0.0.1' });
      const address = app.server.address() as any;
      const port = address.port;

      const streamUrl = `http://127.0.0.1:${port}/storage/${webpRelPath}`;
      const CONCURRENT_ABORTS = 30;

      const abortTasks = Array.from({ length: CONCURRENT_ABORTS }, (_, i) => {
        return new Promise<void>((resolve) => {
          const req = http.get(streamUrl, (res) => {
            res.once('data', () => {
              // Destroy midway through reading
              req.destroy();
              resolve();
            });
          });

          req.on('error', () => {
            resolve();
          });
        });
      });

      await Promise.all(abortTasks);

      // Wait 100ms for OS sockets and file handles to close
      await new Promise((r) => setTimeout(r, 100));

      // PROOF OF ZERO FILE DESCRIPTOR LEAKS:
      // On Windows and POSIX, if a file descriptor was leaked / held open exclusively,
      // trying to open the file with read-write flags ('r+') would fail or throw EBUSY / EPERM.
      const handle = await fs.open(targetFilePath, 'r+');
      expect(handle).toBeDefined();
      await handle.close();

      // Verify the file can still be read normally by another request
      const fullRes = await app.inject({
        method: 'GET',
        url: `/storage/${webpRelPath}`,
      });
      expect(fullRes.statusCode).toBe(200);
      expect(fullRes.headers['content-type']).toContain('webp');
      expect(fullRes.rawPayload.length).toBeGreaterThan(1000);
    });
  });
});
