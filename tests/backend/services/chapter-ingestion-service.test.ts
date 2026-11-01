import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ingestChapter } from '../../../src/backend/services/chapter-ingestion-service';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

describe('Chapter Ingestion Coordinator', () => {
  sharp.cache(false);
  const testRoot = path.resolve(__dirname, 'test-storage-root');
  const sourceFolder = path.resolve(__dirname, 'test-src-folder');

  beforeAll(async () => {
    await fs.mkdir(testRoot, { recursive: true });
    await fs.mkdir(sourceFolder, { recursive: true });

    // Generate 3 sample manga images
    for (let i = 1; i <= 3; i++) {
      await sharp({
        create: {
          width: 800,
          height: 1200,
          channels: 3,
          background: { r: 10 * i, g: 20 * i, b: 30 * i }
        }
      }).jpeg().toFile(path.join(sourceFolder, `page_${i}.jpg`));
    }
  });

  afterAll(async () => {
    await fs.rm(testRoot, { recursive: true, force: true });
    await fs.rm(sourceFolder, { recursive: true, force: true });
  });

  it('ingests loose images into structured storage directory with manifest.json', async () => {
    const result = await ingestChapter({
      storageRoot: testRoot,
      seriesSlug: 'solo-leveling',
      volumeNumber: 1,
      chapterNumber: 15,
      sourcePath: sourceFolder,
      isArchive: false
    });

    expect(result.pageCount).toBe(3);
    const expectedRelPath = path.join('series', 'solo-leveling', 'v1', 'c15');
    expect(result.relativeStorageDir).toBe(expectedRelPath);

    const manifestPath = path.join(testRoot, expectedRelPath, 'manifest.json');
    const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestRaw);

    expect(manifest.pageCount).toBe(3);
    expect(manifest.pages.length).toBe(3);
    expect(manifest.pages[0].fileName).toBe('001.webp');
    expect(manifest.pages[0].aspectRatio).toBeCloseTo(800 / 1200, 2);
  });
});
