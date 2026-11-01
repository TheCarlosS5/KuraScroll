import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { copyFileWithBackpressure, calculateFileHashStream, CHUNK_SIZE_64KB } from '../../../src/backend/utils/stream-copy.js';

describe('Stream Copy & Checksum Utilities (64KB Buffer SATA II Optimization)', () => {
  const testDir = path.resolve(__dirname, '../../../test-scratch/stream-copy');

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('copies a small file with backpressure accurately', async () => {
    const src = path.join(testDir, 'small-src.txt');
    const dest = path.join(testDir, 'small-dest.txt');
    const content = 'KuraScroll Stream Copy Test Content';
    await fs.writeFile(src, content, 'utf-8');

    await copyFileWithBackpressure(src, dest);

    const destContent = await fs.readFile(dest, 'utf-8');
    expect(destContent).toBe(content);
  });

  it('copies a multi-chunk file (>150KB, spanning multiple 64KB blocks) with full integrity', async () => {
    const src = path.join(testDir, 'large-src.bin');
    const dest = path.join(testDir, 'large-dest.bin');
    const data = crypto.randomBytes(192 * 1024); // 192KB = 3 full 64KB chunks
    await fs.writeFile(src, data);

    await copyFileWithBackpressure(src, dest);

    const destData = await fs.readFile(dest);
    expect(destData.length).toBe(data.length);
    expect(crypto.createHash('sha256').update(destData).digest('hex')).toBe(
      crypto.createHash('sha256').update(data).digest('hex')
    );
  });

  it('computes accurate SHA256 checksum through streaming without loading whole file into memory', async () => {
    const file = path.join(testDir, 'hash-test.bin');
    const buffer = crypto.randomBytes(256 * 1024); // 256KB
    await fs.writeFile(file, buffer);

    const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const actualHash = await calculateFileHashStream(file);

    expect(actualHash).toBe(expectedHash);
  });

  it('handles empty files gracefully', async () => {
    const emptyFile = path.join(testDir, 'empty.bin');
    await fs.writeFile(emptyFile, Buffer.alloc(0));

    const hash = await calculateFileHashStream(emptyFile);
    const expectedEmptySha = crypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex');

    expect(hash).toBe(expectedEmptySha);
  });

  it('exposes 64KB chunk constant aligned with SATA II radial seek latency', () => {
    expect(CHUNK_SIZE_64KB).toBe(65536);
  });
});
