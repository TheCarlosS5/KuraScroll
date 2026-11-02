import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import {
  parseZipOffsets,
  buildSequentialClusters,
  getMimeTypeFromFileName,
  ParsedZipEntry,
} from '../../../../src/backend/utils/cbz-offset-indexer.js';

function createSyntheticZip(files: Array<{ name: string; content: Buffer; method: 0 | 8 }>): Buffer {
  const localHeaders: Buffer[] = [];
  const cdEntries: Buffer[] = [];
  let currentOffset = 0;

  for (const file of files) {
    const fnBuf = Buffer.from(file.name, 'utf8');
    const localHeaderOffset = currentOffset;

    let payload: Buffer;
    let compSize: number;
    let uncompSize = file.content.length;

    if (file.method === 8) {
      payload = zlib.deflateRawSync(file.content);
      compSize = payload.length;
    } else {
      payload = file.content;
      compSize = payload.length;
    }

    // Local Header (30 bytes + fn)
    const lh = Buffer.alloc(30 + fnBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(file.method, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0, 12);
    lh.writeUInt32LE(0x12345678, 14); // fake CRC
    lh.writeUInt32LE(compSize, 18);
    lh.writeUInt32LE(uncompSize, 22);
    lh.writeUInt16LE(fnBuf.length, 26);
    lh.writeUInt16LE(0, 28); // extra length
    fnBuf.copy(lh, 30);

    localHeaders.push(lh, payload);
    currentOffset += lh.length + payload.length;

    // Central Directory Entry (46 bytes + fn)
    const cd = Buffer.alloc(46 + fnBuf.length);
    cd.writeUInt32LE(0x02014b50, 0); // PK\x01\x02
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

  // EOCD (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // PK\x05\x06
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, cdFull, eocd]);
}

describe('Sprint 57 - CBZ Binary Offset Indexer Unit Tests', () => {
  let tmpDir: string;
  let testZipPath: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `kura_test_zip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tmpDir, { recursive: true });
    testZipPath = path.join(tmpDir, 'chapter_test.cbz');

    const zipBuf = createSyntheticZip([
      { name: '002.webp', content: Buffer.from('RIFF_WEBP_PAGE_2'), method: 0 },
      { name: '001.webp', content: Buffer.from('RIFF_WEBP_PAGE_1'), method: 0 },
      { name: '003.png', content: Buffer.from('PNG_CONTENT_PAGE_3_COMPRESSED_DEFLATE'), method: 8 },
    ]);

    await fs.writeFile(testZipPath, zipBuf);
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('correctly parses ZIP byte offsets with natural order numbering', async () => {
    const entries = await parseZipOffsets(testZipPath);
    expect(entries.length).toBe(3);

    // Natural sort: 001.webp should be page 1, 002.webp should be page 2, 003.png should be page 3
    expect(entries[0].pageNumber).toBe(1);
    expect(entries[0].fileName).toBe('001.webp');
    expect(entries[0].compressionMethod).toBe(0); // STORED
    expect(entries[0].mimeType).toBe('image/webp');
    expect(entries[0].dataOffset).toBeGreaterThan(0);

    expect(entries[1].pageNumber).toBe(2);
    expect(entries[1].fileName).toBe('002.webp');
    expect(entries[1].compressionMethod).toBe(0);

    expect(entries[2].pageNumber).toBe(3);
    expect(entries[2].fileName).toBe('003.png');
    expect(entries[2].compressionMethod).toBe(8); // DEFLATE
    expect(entries[2].mimeType).toBe('image/png');
  });

  it('correctly maps MIME types from image file names', () => {
    expect(getMimeTypeFromFileName('page.webp')).toBe('image/webp');
    expect(getMimeTypeFromFileName('page.png')).toBe('image/png');
    expect(getMimeTypeFromFileName('page.jpg')).toBe('image/jpeg');
    expect(getMimeTypeFromFileName('page.jpeg')).toBe('image/jpeg');
    expect(getMimeTypeFromFileName('page.avif')).toBe('image/avif');
  });

  it('builds sequential read clusters respecting maxGap and maxWindow', () => {
    const mockEntries: ParsedZipEntry[] = [
      { pageNumber: 1, fileName: 'p1', compressionMethod: 0, dataOffset: 1000, compressedSize: 50000, uncompressedSize: 50000, crc32: 1, localHeaderOffset: 900, mimeType: 'image/webp' },
      { pageNumber: 2, fileName: 'p2', compressionMethod: 0, dataOffset: 52000, compressedSize: 40000, uncompressedSize: 40000, crc32: 2, localHeaderOffset: 51900, mimeType: 'image/webp' },
      // Gap of 300,000 bytes (> 128 KiB maxGap) -> Should form a new cluster
      { pageNumber: 3, fileName: 'p3', compressionMethod: 0, dataOffset: 392000, compressedSize: 60000, uncompressedSize: 60000, crc32: 3, localHeaderOffset: 391900, mimeType: 'image/webp' },
    ];

    const clusters = buildSequentialClusters(mockEntries, 128 * 1024, 1024 * 1024);
    expect(clusters.length).toBe(2);
    expect(clusters[0].entries.length).toBe(2);
    expect(clusters[1].entries.length).toBe(1);
    expect(clusters[1].entries[0].pageNumber).toBe(3);
  });
});
