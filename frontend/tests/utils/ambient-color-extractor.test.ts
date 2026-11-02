import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateDeltaE,
  rgbToHex,
  shouldBypassAmbilight,
  extractAmbientColor,
  DEFAULT_AMBIENT_RGB,
  RGBColor,
  _setSamplingContextForTest,
} from '../../src/utils/ambient-color-extractor';

describe('ambient-color-extractor (Sprint 39)', () => {
  describe('Unit: Math & Helpers', () => {
    it('calculates Delta-E distance between RGB colors accurately', () => {
      const c1: RGBColor = { r: 100, g: 100, b: 100 };
      const c2: RGBColor = { r: 100, g: 100, b: 100 };
      expect(calculateDeltaE(c1, c2)).toBe(0);

      const c3: RGBColor = { r: 110, g: 100, b: 100 };
      expect(calculateDeltaE(c1, c3)).toBe(10);
    });

    it('formats RGB to hex strings properly', () => {
      expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
      expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00');
      expect(rgbToHex({ r: 8, g: 12, b: 20 })).toBe('#080c14');
    });

    it('bypasses ambilight calculation under thermal saver or low power flags', () => {
      expect(shouldBypassAmbilight(false, false, false)).toBe(false);
      expect(shouldBypassAmbilight(true, false, false)).toBe(true);
      expect(shouldBypassAmbilight(false, true, false)).toBe(true);
      expect(shouldBypassAmbilight(false, false, true)).toBe(true);
    });
  });

  describe('Integration: extractAmbientColor with Mock Canvas', () => {
    let mockCanvas: HTMLCanvasElement;
    let mockCtx: any;

    beforeEach(() => {
      mockCanvas = {
        width: 100,
        height: 100,
      } as any;

      mockCtx = {
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn(),
        imageSmoothingEnabled: false,
      };

      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return {
            width: 16,
            height: 16,
            getContext: () => mockCtx,
          } as any;
        }
        return {} as any;
      });

      _setSamplingContextForTest(mockCtx);
    });

    afterEach(() => {
      _setSamplingContextForTest(null);
      vi.restoreAllMocks();
    });

    it('returns default ambient background for 0-dimension images or errors', () => {
      const emptyImg = { naturalWidth: 0, naturalHeight: 0 } as any;
      const result = extractAmbientColor(emptyImg);
      expect(result.rgb).toEqual(DEFAULT_AMBIENT_RGB);
      expect(result.isMonochrome).toBe(true);
    });

    it('extracts colorful ambient perimeter from downsampled canvas data', () => {
      // Simulate vibrant blue perimeter (r: 40, g: 80, b: 220)
      const data = new Uint8ClampedArray(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 40;     // R
        data[i + 1] = 80;  // G
        data[i + 2] = 220; // B
        data[i + 3] = 255; // A
      }

      mockCtx.getImageData.mockReturnValue({ data });

      const img = { naturalWidth: 1440, naturalHeight: 2048 } as any;
      const result = extractAmbientColor(img);

      expect(result.isMonochrome).toBe(false);
      expect(result.rgb.b).toBeGreaterThan(result.rgb.r);
      expect(result.rgbaString(0.5)).toContain('rgba(');
    });

    it('filters out pure white manga gutters and falls back to soft default tone', () => {
      // Simulate pure white page (r: 255, g: 255, b: 255)
      const data = new Uint8ClampedArray(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }

      mockCtx.getImageData.mockReturnValue({ data });

      const img = { naturalWidth: 1440, naturalHeight: 2048 } as any;
      const result = extractAmbientColor(img);

      expect(result.isMonochrome).toBe(true);
      expect(result.rgb).toEqual(DEFAULT_AMBIENT_RGB);
    });

    it('applies chromatic hysteresis retaining previous color when Delta-E < 18', () => {
      const data = new Uint8ClampedArray(16 * 16 * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 100;
        data[i + 1] = 100;
        data[i + 2] = 100;
        data[i + 3] = 255;
      }

      mockCtx.getImageData.mockReturnValue({ data });

      const previousColor: RGBColor = { r: 102, g: 101, b: 99 }; // Delta-E ~ 2.4
      const img = { naturalWidth: 1440, naturalHeight: 2048 } as any;
      const result = extractAmbientColor(img, previousColor);

      expect(result.rgb).toEqual(previousColor);
      expect(result.deltaE).toBeLessThan(18);
    });
  });
});
