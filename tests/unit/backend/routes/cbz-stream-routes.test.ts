import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { CbzStreamService } from '../../../../src/backend/services/cbz-stream-service.js';
import { cbzStreamRoutes } from '../../../../src/backend/routes/cbz-stream-routes.js';

function createSyntheticZip(files: Array<{ name: string; content: Buffer; method: 0 | 8 }>): Buffer {
  const localHeaders: Buffer[] = [];
  const cdEntries: Buffer[] = [];
  let currentOffset = 0;

  for (const file of files) {
    const fnBuf = Buffer.from(file.name, 'utf8');
    const localHeaderOffset = currentOffset;

    let payload: Buffer;
    let compSize: number;
    const uncompSize = file.content.length;

    if (file.method === 8) {
      payload = zlib.deflateRawSync(file.content);
      compSize = payload.length;
    } else {
      payload = file.content;
      compSize = payload.length;
    }

    const lh = Buffer.alloc(30 + fnBuf.length);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(file.method, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(0x12345678, 14);
    lh.writeUInt32LE(compSize, 18);
    lh.writeUInt32LE(uncompSize, 22);
    lh.writeUInt16LE(fnBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    fnBuf.copy(lh, 30);

    localHeaders.push(lh, payload);
    currentOffset += lh.length + payload.length;

    const cd = Buffer.alloc(46 + fnBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(file.method, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(0x12345678, 16);
    cd.writeUInt32LE(compSize, 20);
    cd.writeUInt32LE(uncompSize, 24);
    cd.writeUInt16LE(fnBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(localHeaderOffset, 42);
    fnBuf.copy(cd, 46);

    cdEntries.push(cd);
  }

  const cdStart = currentOffset;
  const cdFull = Buffer.concat(cdEntries);
  const cdSize = cdFull.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, cdFull, eocd]);
}

describe('Sprint 57 - CbzStreamRoutes Fastify Integration', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: CbzStreamService;
  let tmpDir: string;
  let testZipPath: string;

  const samplePayload1 = Buffer.from('FASTIFY_STORED_IMAGE_PAGE_1', 'utf8');
  const samplePayload2 = Buffer.from('FASTIFY_DEFLATE_IMAGE_PAGE_2'.repeat(5), 'utf8');

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser_fastify', 'fastify-manga', 'Fastify Manga', 'manga', 'ongoing')
    `).run();

    tmpDir = path.join(os.tmpdir(), `kura_route_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    testZipPath = path.join(tmpDir, 'fastify_chapter.cbz');

    const zipBuffer = createSyntheticZip([
      { name: '001.webp', content: samplePayload1, method: 0 },
      { name: '002.png', content: samplePayload2, method: 8 },
    ]);
    await fs.writeFile(testZipPath, zipBuffer);

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES ('ch_fastify_1', 'ser_fastify', 1, 'Chapter 1', ?, 2)
    `).run(testZipPath);

    service = new CbzStreamService(db);
    await service.indexChapterArchive('ch_fastify_1', testZipPath);

    app = Fastify();
    await app.register(cbzStreamRoutes, { db, cbzStreamService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('validates invalid page numbers with 400 Bad Request', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch_fastify_1/pages/0/stream',
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('INVALID_PAGE_NUMBER');
  });

  it('returns 404 for unknown chapter id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch_nonexistent/pages/1/stream',
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('CHAPTER_NOT_FOUND');
  });

  it('streams page 1 with 200 OK and correct headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch_fastify_1/pages/1/stream',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.rawPayload.equals(samplePayload1)).toBe(true);
  });

  it('streams HTTP 206 Partial Content when Range header is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch_fastify_1/pages/1/stream',
      headers: {
        range: 'bytes=0-9',
      },
    });

    expect(res.statusCode).toBe(206);
    expect(res.headers['content-range']).toBe(`bytes 0-9/${samplePayload1.length}`);
    expect(res.headers['content-length']).toBe('10');
    expect(res.rawPayload.equals(samplePayload1.subarray(0, 10))).toBe(true);
  });

  it('returns 416 for unsatisfiable range requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch_fastify_1/pages/1/stream',
      headers: {
        range: 'bytes=9999-10000',
      },
    });

    expect(res.statusCode).toBe(416);
    expect(res.headers['content-range']).toBe(`bytes */${samplePayload1.length}`);
    const body = res.json();
    expect(body.error).toBe('RANGE_NOT_SATISFIABLE');
  });

  it('returns 404 for page number beyond chapter page count', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch_fastify_1/pages/99/stream',
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('PAGE_NOT_FOUND');
  });

  it('GET /api/v1/chapters/:chapterId/offsets returns all indexed offsets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch_fastify_1/offsets',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].fileName).toBe('001.webp');
    expect(body.data[1].fileName).toBe('002.png');
  });

  it('GET /api/v1/chapters/:chapterId/clusters returns sequential read clusters', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch_fastify_1/clusters?maxGap=65536&maxWindow=524288',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0].entries.length).toBe(2);
  });
});
