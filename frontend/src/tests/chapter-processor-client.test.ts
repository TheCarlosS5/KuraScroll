import { describe, it, expect, vi } from 'vitest';
import {
  isWebpSupported,
  naturalSortCompare,
  convertBitmapToWebpBlobs,
  inspectZipArchive,
} from '../services/chapter-processor-client.js';

describe('chapter-processor-client', () => {
  it('naturalSortCompare sorts chapter pages in natural numeric order', () => {
    const pages = ['page-10.jpg', 'page-1.jpg', 'page-2.jpg', 'page-20.jpg'];
    pages.sort(naturalSortCompare);
    expect(pages).toEqual(['page-1.jpg', 'page-2.jpg', 'page-10.jpg', 'page-20.jpg']);
  });

  it('isWebpSupported returns boolean safely without throwing', async () => {
    const supported = await isWebpSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('convertBitmapToWebpBlobs handles standard dimension images and scales to max width 1440', async () => {
    // Mock image source
    const mockSource = {
      width: 2880,
      height: 1800,
    } as any;

    // In jsdom environment, mock OffscreenCanvas or canvas
    const originalOffscreen = globalThis.OffscreenCanvas;
    (globalThis as any).OffscreenCanvas = class MockOffscreenCanvas {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
      }
      getContext() {
        return {
          drawImage: vi.fn(),
        };
      }
      async convertToBlob(options: { type: string; quality: number }) {
        return new Blob(['fake-webp-data'], { type: options.type });
      }
    };

    try {
      const results = await convertBitmapToWebpBlobs(mockSource, 'test-page.jpg', 1, {
        maxWidth: 1440,
        quality: 0.82,
      });

      expect(results.length).toBe(1);
      expect(results[0].width).toBe(1440);
      expect(results[0].height).toBe(900);
      expect(results[0].mimeType).toBe('image/webp');
      expect(results[0].pageNumber).toBe(1);
    } finally {
      (globalThis as any).OffscreenCanvas = originalOffscreen;
    }
  });

  it('convertBitmapToWebpBlobs splits vertical strips exceeding max dimension limit', async () => {
    // A tall webtoon strip: 1000px wide, 35000px high
    const mockStrip = {
      width: 1000,
      height: 35000,
    } as any;

    const originalOffscreen = globalThis.OffscreenCanvas;
    (globalThis as any).OffscreenCanvas = class MockOffscreenCanvas {
      width: number;
      height: number;
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
      }
      getContext() {
        return {
          drawImage: vi.fn(),
        };
      }
      async convertToBlob(options: { type: string; quality: number }) {
        return new Blob(['fake-webp-data'], { type: options.type });
      }
    };

    try {
      // Set maxDimension threshold to 15000 to trigger splitting into multiple contiguous pages
      const results = await convertBitmapToWebpBlobs(mockStrip, 'webtoon-strip.png', 1, {
        maxWidth: 1440,
        quality: 0.82,
        maxDimension: 15000,
      });

      // 35,000 / 15,000 = 3 segments
      expect(results.length).toBe(3);
      expect(results[0].pageNumber).toBe(1);
      expect(results[1].pageNumber).toBe(2);
      expect(results[2].pageNumber).toBe(3);
      expect(results[0].originalName).toContain('segment-1');
      expect(results[1].originalName).toContain('segment-2');
      expect(results[2].originalName).toContain('segment-3');
    } finally {
      (globalThis as any).OffscreenCanvas = originalOffscreen;
    }
  });

  it('inspectZipArchive rejects files exceeding 250MB limit', async () => {
    const fakeLargeFile = {
      size: 300 * 1024 * 1024,
      name: 'huge.cbz',
    } as File;

    await expect(inspectZipArchive(fakeLargeFile)).rejects.toThrow(
      'supera el límite de 250 MB'
    );
  });
});
