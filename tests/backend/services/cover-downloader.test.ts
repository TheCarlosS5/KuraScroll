import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  downloadCover,
  CoverDownloader,
  generateMonogramSvg,
  saveMonogramSvg,
} from '../../../src/backend/services/cover-downloader';

describe('Cover Downloader & Offline Cache Service', () => {
  sharp.cache(false);
  const tmpDir = path.resolve(__dirname, 'tmp-cover-test');

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Clean up covers directory before each test
    const coversDir = path.join(tmpDir, 'covers');
    await fs.rm(coversDir, { recursive: true, force: true }).catch(() => {});
  });

  it('downloads external cover, resizes to max 480px, and saves as optimized WebP', async () => {
    // Generate a 1200x1800 mock cover image buffer
    const mockImageBuffer = await sharp({
      create: {
        width: 1200,
        height: 1800,
        channels: 3,
        background: { r: 50, g: 100, b: 200 },
      },
    })
      .jpeg()
      .toBuffer();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => mockImageBuffer.buffer,
    } as any);

    const result = await downloadCover(
      'solo-leveling',
      'https://uploads.mangadex.org/covers/solo/cover.jpg',
      {
        storageRoot: tmpDir,
        maxWidth: 480,
        quality: 80,
        fetcher: mockFetch,
      }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.source).toBe('downloaded');
    expect(result.coverUrl).toBe('/storage/covers/solo-leveling.webp');
    expect(result.localPath).toBe(path.join(tmpDir, 'covers', 'solo-leveling.webp'));

    // Check file on disk
    const fileStat = await fs.stat(result.localPath!);
    expect(fileStat.size).toBeGreaterThan(0);

    // Verify Sharp output metadata
    const metadata = await sharp(result.localPath!).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(480);
    expect(metadata.height).toBe(720); // 1200x1800 scaled to 480 is 480x720
  });

  it('keeps original width if image is already smaller than 480px without upscaling', async () => {
    const smallBuffer = await sharp({
      create: {
        width: 320,
        height: 480,
        channels: 3,
        background: { r: 255, g: 200, b: 50 },
      },
    })
      .png()
      .toBuffer();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => smallBuffer.buffer,
    } as any);

    const result = await downloadCover('small-cover', 'https://example.com/small.png', {
      storageRoot: tmpDir,
      maxWidth: 480,
      quality: 80,
      fetcher: mockFetch,
    });

    expect(result.success).toBe(true);
    const metadata = await sharp(result.localPath!).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(480);
  });

  it('maintains external URL when download fails and fallbackMode is keep_external', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const result = await downloadCover(
      'offline-series',
      'https://uploads.mangadex.org/covers/fail.jpg',
      {
        storageRoot: tmpDir,
        fetcher: mockFetch,
        fallbackMode: 'keep_external',
      }
    );

    expect(result.success).toBe(false);
    expect(result.source).toBe('external');
    expect(result.coverUrl).toBe('https://uploads.mangadex.org/covers/fail.jpg');
    expect(result.localPath).toBeNull();
  });

  it('generates dynamic SVG with KS monogram when download fails and fallbackMode is svg', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as any);

    const result = await downloadCover(
      'berserk',
      'https://uploads.mangadex.org/covers/not-found.jpg',
      {
        storageRoot: tmpDir,
        fetcher: mockFetch,
        fallbackMode: 'svg',
        seriesTitle: 'Berserk',
      }
    );

    expect(result.success).toBe(false);
    expect(result.source).toBe('svg_fallback');
    expect(result.coverUrl).toBe('/storage/covers/berserk.svg');
    expect(result.localPath).toBe(path.join(tmpDir, 'covers', 'berserk.svg'));

    // Check SVG file content
    const svgContent = await fs.readFile(result.localPath!, 'utf-8');
    expect(svgContent).toContain('KS');
    expect(svgContent).toContain('KURASCROLL');
    expect(svgContent).toContain('Berserk');
    expect(svgContent).toContain('<svg');
  });

  it('generates dynamic SVG monogram fallback when coverUrl is null or empty', async () => {
    const result = await downloadCover('mystery-manga', null, {
      storageRoot: tmpDir,
      seriesTitle: 'Mystery Manga',
    });

    expect(result.success).toBe(false);
    expect(result.source).toBe('svg_fallback');
    expect(result.coverUrl).toBe('/storage/covers/mystery-manga.svg');

    const svgContent = await fs.readFile(result.localPath!, 'utf-8');
    expect(svgContent).toContain('Mystery Manga');
    expect(svgContent).toContain('KS');
  });

  it('properly escapes XML special characters in dynamic SVG titles', () => {
    const svg = generateMonogramSvg('<Hunter x "Hunter" & Greed>');
    expect(svg).toContain('&lt;Hunter x &quot;Hunter&quot; &amp; Greed&gt;');
    expect(svg).toContain('KS');
    expect(svg).toContain('KURASCROLL');
  });

  it('works with CoverDownloader class instance and custom options', async () => {
    const mockImageBuffer = await sharp({
      create: {
        width: 800,
        height: 1200,
        channels: 3,
        background: { r: 10, g: 200, b: 50 },
      },
    })
      .jpeg()
      .toBuffer();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => mockImageBuffer.buffer,
    } as any);

    const downloader = new CoverDownloader({
      storageRoot: tmpDir,
      maxWidth: 320,
      quality: 75,
      fetcher: mockFetch,
    });

    const result = await downloader.download('class-test', 'https://example.com/test.jpg');
    expect(result.success).toBe(true);

    const metadata = await sharp(result.localPath!).metadata();
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(480);
  });

  it('saves standalone monogram SVG directly via saveMonogramSvg', async () => {
    const saved = await saveMonogramSvg('direct-series', tmpDir, 'Direct Series Title');
    expect(saved.coverUrl).toBe('/storage/covers/direct-series.svg');

    const content = await fs.readFile(saved.localPath, 'utf-8');
    expect(content).toContain('Direct Series Title');
    expect(content).toContain('KS');
  });
});
