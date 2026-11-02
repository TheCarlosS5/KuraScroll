import { describe, it, expect } from 'vitest';
import { detectSpreadLayout, mapBoxToCrop } from '../../../src/backend/utils/spread-detector.js';

describe('Sprint 51: Spread Detector & Geometry Utility', () => {
  it('detects standard single manga page (< 1.25 AR)', () => {
    // 1000 x 1440 = 0.6944
    const res = detectSpreadLayout({ width: 1000, height: 1440, sourcePageNumber: 5 });
    expect(res.candidate).toBe(false);
    expect(res.decision).toBe('single');
    expect(res.aspectRatio).toBe(0.6944);
    expect(res.segments).toHaveLength(1);
    expect(res.segments[0].key).toBe('5');
    expect(res.segments[0].side).toBe('full');
  });

  it('detects two-page Tankōbon spread (1.25 - 2.10 AR) in RTL mode', () => {
    // 2400 x 1800 = 1.3333
    const res = detectSpreadLayout({
      width: 2400,
      height: 1800,
      sourcePageNumber: 42,
      readingDirection: 'rtl',
    });

    expect(res.candidate).toBe(true);
    expect(res.decision).toBe('split_spread');
    expect(res.aspectRatio).toBe(1.3333);
    expect(res.segments).toHaveLength(2);

    // RTL: Right half is read first (42-a), Left half second (42-b)
    const seg1 = res.segments[0];
    const seg2 = res.segments[1];

    expect(seg1.key).toBe('42-a');
    expect(seg1.side).toBe('right');
    expect(seg1.crop).toEqual({ x: 0.5, y: 0.0, w: 0.5, h: 1.0 });
    expect(seg1.readingOrder).toBe(1);

    expect(seg2.key).toBe('42-b');
    expect(seg2.side).toBe('left');
    expect(seg2.crop).toEqual({ x: 0.0, y: 0.0, w: 0.5, h: 1.0 });
    expect(seg2.readingOrder).toBe(2);
  });

  it('detects two-page spread in LTR mode (Manhwa / Western)', () => {
    const res = detectSpreadLayout({
      width: 2400,
      height: 1800,
      sourcePageNumber: 15,
      readingDirection: 'ltr',
    });

    expect(res.candidate).toBe(true);
    expect(res.segments).toHaveLength(2);

    // LTR: Left half is read first (15-a), Right half second (15-b)
    expect(res.segments[0].key).toBe('15-a');
    expect(res.segments[0].side).toBe('left');
    expect(res.segments[1].key).toBe('15-b');
    expect(res.segments[1].side).toBe('right');
  });

  it('identifies ultra-wide panoramas (> 2.10 AR)', () => {
    // 3000 x 1000 = 3.0
    const res = detectSpreadLayout({ width: 3000, height: 1000, sourcePageNumber: 99 });
    expect(res.candidate).toBe(false);
    expect(res.decision).toBe('panorama');
    expect(res.segments).toHaveLength(1);
    expect(res.segments[0].side).toBe('full');
  });

  it('preserves cover page as single even if wide', () => {
    const res = detectSpreadLayout({
      width: 2400,
      height: 1800,
      sourcePageNumber: 1,
      isCover: true,
    });
    expect(res.candidate).toBe(false);
    expect(res.decision).toBe('single');
  });

  it('respects user overrides: force_single and force_split', () => {
    const forcedSingle = detectSpreadLayout({
      width: 2400,
      height: 1800,
      explicitOverride: 'force_single',
    });
    expect(forcedSingle.decision).toBe('single');

    const forcedSplit = detectSpreadLayout({
      width: 1000,
      height: 1440,
      explicitOverride: 'force_split',
    });
    expect(forcedSplit.decision).toBe('split_spread');
  });

  it('throws RangeError on invalid dimensions', () => {
    expect(() => detectSpreadLayout({ width: 0, height: 1000 })).toThrow(RangeError);
    expect(() => detectSpreadLayout({ width: 1000, height: -50 })).toThrow(RangeError);
    expect(() => detectSpreadLayout({ width: NaN, height: 1000 })).toThrow(RangeError);
  });

  it('maps speech bubble boxes to slice crops accurately (mapBoxToCrop)', () => {
    const rightCrop = { x: 0.5, y: 0.0, w: 0.5, h: 1.0 };
    const leftCrop = { x: 0.0, y: 0.0, w: 0.5, h: 1.0 };

    // Bubble located on the right side: x=0.6, y=0.2, w=0.2, h=0.2
    const rightBubble = { x: 0.6, y: 0.2, w: 0.2, h: 0.2 };
    const mappedRight = mapBoxToCrop(rightBubble, rightCrop);
    expect(mappedRight).not.toBeNull();
    expect(mappedRight!.x).toBe(0.2); // (0.6 - 0.5) / 0.5 = 0.2
    expect(mappedRight!.w).toBe(0.4); // 0.2 / 0.5 = 0.4

    // Bubble on right side mapped to left slice should return null (no intersection)
    const mappedLeft = mapBoxToCrop(rightBubble, leftCrop);
    expect(mappedLeft).toBeNull();
  });
});
