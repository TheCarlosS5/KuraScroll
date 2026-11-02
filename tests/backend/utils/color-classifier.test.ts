import { describe, it, expect } from 'vitest';
import { classifyPageChroma, isMonochrome8x8 } from '../../../src/backend/utils/color-classifier.js';

describe('Sprint 50: Color Classifier (Zero-Allocation 8x8)', () => {
  it('classifies pure grayscale 8x8 buffer as monochrome', () => {
    // 64 pixels, 4 bytes each = 256 bytes
    const buf = new Uint8Array(256);
    for (let i = 0; i < 256; i += 4) {
      const val = (i * 3) % 256;
      buf[i] = val;     // R
      buf[i + 1] = val; // G
      buf[i + 2] = val; // B
      buf[i + 3] = 255; // A
    }

    const res = classifyPageChroma(buf);
    expect(res.isMonochrome).toBe(true);
    expect(res.neutralPixelCount).toBe(64);
    expect(res.totalPixelCount).toBe(64);
    expect(res.chromaScore).toBe(0.0);
    expect(isMonochrome8x8(buf)).toBe(true);
  });

  it('classifies saturated color page as non-monochrome', () => {
    // Red / Green colorful pixels
    const buf = new Uint8Array(256);
    for (let i = 0; i < 256; i += 4) {
      buf[i] = 240;     // R
      buf[i + 1] = 50;  // G (large delta)
      buf[i + 2] = 30;  // B
      buf[i + 3] = 255;
    }

    const res = classifyPageChroma(buf);
    expect(res.isMonochrome).toBe(false);
    expect(res.neutralPixelCount).toBe(0);
    expect(res.chromaScore).toBeGreaterThan(0.5);
    expect(isMonochrome8x8(buf)).toBe(false);
  });

  it('allows minor paper tinting within delta threshold (14)', () => {
    const buf = new Uint8Array(256);
    for (let i = 0; i < 256; i += 4) {
      buf[i] = 245;     // slight warm tint
      buf[i + 1] = 240;
      buf[i + 2] = 235;
      buf[i + 3] = 255;
    }

    const res = classifyPageChroma(buf, 14);
    expect(res.isMonochrome).toBe(true);
    expect(res.neutralPixelCount).toBe(64);
  });

  it('handles empty buffer gracefully', () => {
    const empty = new Uint8Array(0);
    const res = classifyPageChroma(empty);
    expect(res.isMonochrome).toBe(true);
    expect(res.totalPixelCount).toBe(0);
  });
});
