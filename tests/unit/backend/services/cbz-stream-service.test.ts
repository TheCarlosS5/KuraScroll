import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { CbzStreamService, parseHttpRange } from '../../../../src/backend/services/cbz-stream-service.js';

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

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe('Sprint 57 - CbzStreamService Unit Tests', () => {
  let db: DatabaseInstance;
  let service: CbzStreamService;
  let tmpDir: string;
  let testZipPath: string;

  const storedPayload = Buffer.from('STORED_MANGA_PAGE_RAW_BYTES_SAMPLE', 'utf8');
  const deflatePayload = Buffer.from('DEFLATE_MANGA_PAGE_HIGH_DENSITY_RAW_PIXELS'.repeat(10), 'utf8');

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Insert dummy series and chapter to satisfy FOREIGN KEY constraint
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser_test_1', 'test-series', 'Test Series', 'manga', 'ongoing')
    `).run();

    tmpDir = path.join(os.tmpdir(), `kura_stream_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    testZipPath = path.join(tmpDir, 'test_chapter.cbz');

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES ('ch_test_1', 'ser_test_1', 1, 'Chapter 1', ?, 2)
    `).run(testZipPath);

    service = new CbzStreamService(db);

    const zipBuffer = createSyntheticZip([
      { name: '001.webp', content: storedPayload, method: 0 },
      { name: '002.png', content: deflatePayload, method: 8 },
    ]);
    await fs.writeFile(testZipPath, zipBuffer);
  });

  afterEach(async () => {
    db.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('correctly parses HTTP Range headers', () => {
    expect(parseHttpRange(undefined, 1000)).toEqual({});
    expect(parseHttpRange('invalid', 1000)).toEqual({});
    expect(parseHttpRange('bytes=0-499', 1000)).toEqual({ range: { start: 0, end: 499 } });
    expect(parseHttpRange('bytes=500-', 1000)).toEqual({ range: { start: 500, end: 999 } });
    expect(parseHttpRange('bytes=-200', 1000)).toEqual({ range: { start: 800, end: 999 } });
    expect(parseHttpRange('bytes=1500-2000', 1000)).toEqual({ isUnsatisfiable: true });
    expect(parseHttpRange('bytes=500-200', 1000)).toEqual({ isUnsatisfiable: true });
  });

  it('indexes a CBZ archive ahead of time and stores offsets in SQLite', async () => {
    const offsets = await service.indexChapterArchive('ch_test_1', testZipPath);
    expect(offsets).toHaveLength(2);

    expect(offsets[0].pageNumber).toBe(1);
    expect(offsets[0].fileName).toBe('001.webp');
    expect(offsets[0].compressionMethod).toBe(0);
    expect(offsets[0].mimeType).toBe('image/webp');
    expect(offsets[0].uncompressedSize).toBe(storedPayload.length);

    expect(offsets[1].pageNumber).toBe(2);
    expect(offsets[1].fileName).toBe('002.png');
    expect(offsets[1].compressionMethod).toBe(8);
    expect(offsets[1].mimeType).toBe('image/png');
    expect(offsets[1].uncompressedSize).toBe(deflatePayload.length);

    // Calling again returns cached/persisted offsets without re-parsing
    const offsets2 = await service.indexChapterArchive('ch_test_1', testZipPath);
    expect(offsets2).toEqual(offsets);
  });

  it('retrieves single page offset via hot memory cache and SQLite fallback', async () => {
    await service.indexChapterArchive('ch_test_1', testZipPath);

    // Hot cache hit
    const p1 = service.getArchiveOffset('ch_test_1', 1);
    expect(p1).toBeDefined();
    expect(p1?.fileName).toBe('001.webp');

    // SQLite fallback with new service instance sharing same DB
    const service2 = new CbzStreamService(db);
    const p2 = service2.getArchiveOffset('ch_test_1', 2);
    expect(p2).toBeDefined();
    expect(p2?.fileName).toBe('002.png');
    expect(p2?.compressionMethod).toBe(8);

    // Non-existent page
    const pNotFound = service.getArchiveOffset('ch_test_1', 999);
    expect(pNotFound).toBeNull();
  });

  it('generates sequential read clusters to avoid radial platter seek latency', async () => {
    await service.indexChapterArchive('ch_test_1', testZipPath);
    const clusters = service.getSequentialClusters('ch_test_1', 128 * 1024, 1024 * 1024);

    expect(clusters.length).toBeGreaterThanOrEqual(1);
    expect(clusters[0].entries.length).toBe(2);
    expect(clusters[0].totalBytes).toBeGreaterThan(0);
  });

  it('streams STORED page with 200 OK full content and 206 Partial Content', async () => {
    await service.indexChapterArchive('ch_test_1', testZipPath);

    // Full 200 OK stream
    const fullRes = service.createPageStream('ch_test_1', testZipPath, 1);
    expect(fullRes.statusCode).toBe(200);
    expect(fullRes.mimeType).toBe('image/webp');
    expect(fullRes.contentLength).toBe(storedPayload.length);
    const fullBuffer = await streamToBuffer(fullRes.stream);
    expect(fullBuffer.equals(storedPayload)).toBe(true);

    // Partial 206 Content stream (first 10 bytes)
    const rangeRes = service.createPageStream('ch_test_1', testZipPath, 1, 'bytes=0-9');
    expect(rangeRes.statusCode).toBe(206);
    expect(rangeRes.contentLength).toBe(10);
    expect(rangeRes.headers['Content-Range']).toBe(`bytes 0-9/${storedPayload.length}`);
    const rangeBuffer = await streamToBuffer(rangeRes.stream);
    expect(rangeBuffer.equals(storedPayload.subarray(0, 10))).toBe(true);
  });

  it('streams DEFLATE page decompressed on the fly via raw stream pipeline', async () => {
    await service.indexChapterArchive('ch_test_1', testZipPath);

    const deflateRes = service.createPageStream('ch_test_1', testZipPath, 2);
    expect(deflateRes.statusCode).toBe(200);
    expect(deflateRes.mimeType).toBe('image/png');
    expect(deflateRes.contentLength).toBe(deflatePayload.length);

    const decompressed = await streamToBuffer(deflateRes.stream);
    expect(decompressed.equals(deflatePayload)).toBe(true);
  });

  it('handles range errors and missing pages gracefully', async () => {
    await service.indexChapterArchive('ch_test_1', testZipPath);

    // Unsatisfiable range
    expect(() => {
      service.createPageStream('ch_test_1', testZipPath, 1, 'bytes=99999-999999');
    }).toThrowError('Requested Range Not Satisfiable');

    // Missing page
    expect(() => {
      service.createPageStream('ch_test_1', testZipPath, 99);
    }).toThrowError('Page 99 not found in chapter ch_test_1');
  });
});
