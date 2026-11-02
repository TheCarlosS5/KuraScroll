import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PassThrough } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  CbzArchiveStreamer,
  computeCrc32,
  CbzPageItem,
} from '../../../src/backend/services/cbz-archive-streamer.js';

describe('CbzArchiveStreamer (Sprint 40: High-Performance ZIP Store Streamer)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-cbz-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('computes accurate CRC-32 checksums', () => {
    const data = Buffer.from('123456789', 'ascii');
    // Standard test vector: CRC-32 of '123456789' is 0xCBF43926 (3421780262)
    expect(computeCrc32(data)).toBe(3421780262);
  });

  it('streams a valid CBZ archive containing ComicInfo.xml and padded pages', async () => {
    // Create dummy page files
    const p1Path = path.join(tempDir, '001.webp');
    const p2Path = path.join(tempDir, '002.webp');
    fs.writeFileSync(p1Path, Buffer.from('fake-webp-data-1', 'utf8'));
    fs.writeFileSync(p2Path, Buffer.from('fake-webp-data-2', 'utf8'));

    const pages: CbzPageItem[] = [
      { pageNumber: 2, fileName: '002.webp', absolutePath: p2Path },
      { pageNumber: 1, fileName: '001.webp', absolutePath: p1Path },
    ];

    const chunks: Buffer[] = [];
    const destination = new PassThrough();
    destination.on('data', (chunk) => chunks.push(chunk));

    const streamer = new CbzArchiveStreamer(destination);
    const result = await streamer.streamChapterCbz({
      chapterId: 'ch-test-1',
      metadata: {
        seriesTitle: 'Frieren',
        chapterTitle: 'The Journey Ends',
        chapterNumber: 1,
        pageCount: 2,
      },
      pages,
    });

    const archiveBuffer = Buffer.concat(chunks);

    expect(result.pageCount).toBe(2);
    expect(result.totalBytes).toBe(archiveBuffer.length);

    // Verify ZIP magic signature at byte 0 (0x04034b50)
    expect(archiveBuffer.readUInt32LE(0)).toBe(0x04034b50);

    // Verify ComicInfo.xml is in archive
    const archiveString = archiveBuffer.toString('binary');
    expect(archiveString).toContain('ComicInfo.xml');
    expect(archiveString).toContain('p0001.webp');
    expect(archiveString).toContain('p0002.webp');
    expect(archiveString).toContain('Frieren');
    expect(archiveString).toContain('The Journey Ends');

    // Verify End of Central Directory signature (0x06054b50) in last 22 bytes
    const eocdSignature = archiveBuffer.readUInt32LE(archiveBuffer.length - 22);
    expect(eocdSignature).toBe(0x06054b50);
  });

  it('skips missing page files gracefully without crashing', async () => {
    const validPath = path.join(tempDir, 'real.webp');
    fs.writeFileSync(validPath, Buffer.from('page-data', 'utf8'));

    const pages: CbzPageItem[] = [
      { pageNumber: 1, fileName: 'real.webp', absolutePath: validPath },
      { pageNumber: 2, fileName: 'missing.webp', absolutePath: path.join(tempDir, 'nonexistent.webp') },
    ];

    const chunks: Buffer[] = [];
    const destination = new PassThrough();
    destination.on('data', (chunk) => chunks.push(chunk));

    const streamer = new CbzArchiveStreamer(destination);
    const result = await streamer.streamChapterCbz({
      chapterId: 'ch-test-missing',
      metadata: {
        seriesTitle: 'Berserk',
        pageCount: 2,
      },
      pages,
    });

    expect(result.pageCount).toBe(1); // Only 1 valid page exported
    const archiveBuffer = Buffer.concat(chunks);
    expect(archiveBuffer.readUInt32LE(0)).toBe(0x04034b50);
  });
});
