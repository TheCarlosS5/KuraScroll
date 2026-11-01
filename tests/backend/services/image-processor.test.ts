import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { optimizeImageToWebP } from '../../../src/backend/services/image-processor';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('optimizeImageToWebP', () => {
  sharp.cache(false);
  const tmpDir = path.resolve(__dirname, 'tmp-img-test');
  const dummyInput = path.join(tmpDir, 'raw.png');
  const dummyOutput = path.join(tmpDir, '001.webp');

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    // Create a 2000x3000 test image
    await sharp({
      create: {
        width: 2000,
        height: 3000,
        channels: 3,
        background: { r: 255, g: 0, b: 0 }
      }
    }).png().toFile(dummyInput);
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('resizes wide images to max 1440px width and converts to WebP with aspect ratio metadata', async () => {
    const meta = await optimizeImageToWebP(dummyInput, dummyOutput, {
      pageNumber: 1,
      maxImageWidth: 1440,
      webpQuality: 82
    });

    expect(meta.width).toBe(1440);
    expect(meta.height).toBe(2160);
    expect(meta.aspectRatio).toBeCloseTo(1440 / 2160, 2);
    expect(meta.fileName).toBe('001.webp');
    expect(meta.fileSizeBytes).toBeGreaterThan(0);

    const outInfo = await sharp(dummyOutput).metadata();
    expect(outInfo.format).toBe('webp');
    expect(outInfo.width).toBe(1440);
  });

  it('keeps original width if image is already smaller than maxImageWidth', async () => {
    const smallInput = path.join(tmpDir, 'small.jpg');
    const smallOutput = path.join(tmpDir, '002.webp');

    await sharp({
      create: {
        width: 800,
        height: 1200,
        channels: 3,
        background: { r: 0, g: 255, b: 0 }
      }
    }).jpeg().toFile(smallInput);

    const meta = await optimizeImageToWebP(smallInput, smallOutput, {
      pageNumber: 2,
      maxImageWidth: 1440,
      webpQuality: 82
    });

    expect(meta.width).toBe(800);
    expect(meta.height).toBe(1200);
  });
});
