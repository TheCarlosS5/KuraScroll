/**
 * KuraScroll Dynamic Two-Page Spread Detector & Normalized Cropping Utility
 * Sprint 51 - High-Performance Virtual Geometry Splitting
 *
 * Designed for Intel Pentium T4500:
 * - Pure arithmetic geometry calculation in < 0.01 ms
 * - Zero buffer copying, zero file system writes
 * - Respects RTL (Right-to-Left) manga Tankōbon vs LTR manhwa reading orders
 */

export type LayoutDecision = 'single' | 'split_spread' | 'panorama' | 'stitch_webtoon';
export type ReadingDirection = 'rtl' | 'ltr';

export interface NormalizedCrop {
  x: number; // 0.0 to 1.0
  y: number; // 0.0 to 1.0
  w: number; // 0.0 to 1.0
  h: number; // 0.0 to 1.0
}

export interface VirtualSlice {
  key: string; // e.g. "42-a", "42-b", "42"
  label: string; // Display label e.g. "Pág 42 (Der)", "Pág 42 (Izq)"
  side: 'left' | 'right' | 'full';
  crop: NormalizedCrop;
  readingOrder: number; // 1, 2...
  virtualAspectRatio: number;
}

export interface SpreadDetectionInput {
  width: number;
  height: number;
  sourcePageNumber?: number;
  readingDirection?: ReadingDirection;
  isCover?: boolean;
  explicitOverride?: 'automatic' | 'force_single' | 'force_split';
  splitPositionPct?: number; // default 50.0
}

export interface SpreadDetectionResult {
  candidate: boolean;
  decision: LayoutDecision;
  aspectRatio: number;
  splitPositionPct: number;
  segments: VirtualSlice[];
  reasons: string[];
}

/**
 * Evaluates image dimensions and reading direction to produce a virtual spread layout.
 */
export function detectSpreadLayout(input: SpreadDetectionInput): SpreadDetectionResult {
  const {
    width,
    height,
    sourcePageNumber = 1,
    readingDirection = 'rtl',
    isCover = false,
    explicitOverride = 'automatic',
    splitPositionPct = 50.0,
  } = input;

  if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) {
    throw new RangeError(`Invalid image dimensions: width=${width}, height=${height}`);
  }

  const aspectRatio = Math.round((width / height) * 10000) / 10000;
  const clampedSplit = Math.max(10.0, Math.min(90.0, splitPositionPct));
  const splitRatio = clampedSplit / 100.0;
  const reasons: string[] = [];

  let decision: LayoutDecision = 'single';
  let candidate = false;

  if (explicitOverride === 'force_single') {
    decision = 'single';
    candidate = false;
    reasons.push('Forced single page layout by user override');
  } else if (explicitOverride === 'force_split') {
    decision = 'split_spread';
    candidate = true;
    reasons.push('Forced split layout by user override');
  } else if (isCover) {
    decision = 'single';
    candidate = false;
    reasons.push('Cover page preserved as single full image');
  } else if (aspectRatio >= 1.25 && aspectRatio <= 2.10) {
    decision = 'split_spread';
    candidate = true;
    reasons.push(`Aspect ratio ${aspectRatio} matches two-page Tankōbon spread (1.25 - 2.10)`);
  } else if (aspectRatio > 2.10) {
    decision = 'panorama';
    candidate = false;
    reasons.push(`Aspect ratio ${aspectRatio} is an ultra-wide panoramic splash or banner (> 2.10)`);
  } else {
    decision = 'single';
    candidate = false;
    reasons.push(`Aspect ratio ${aspectRatio} is standard vertical single page (< 1.25)`);
  }

  const segments: VirtualSlice[] = [];

  if (decision === 'split_spread') {
    const leftW = splitRatio;
    const rightW = 1.0 - splitRatio;

    const leftCrop: NormalizedCrop = { x: 0.0, y: 0.0, w: leftW, h: 1.0 };
    const rightCrop: NormalizedCrop = { x: leftW, y: 0.0, w: rightW, h: 1.0 };

    const leftVirtualAR = Math.round(((width * leftW) / height) * 10000) / 10000;
    const rightVirtualAR = Math.round(((width * rightW) / height) * 10000) / 10000;

    if (readingDirection === 'rtl') {
      // Right half is read first in manga Tankōbon
      segments.push({
        key: `${sourcePageNumber}-a`,
        label: `Pág ${sourcePageNumber} (Der)`,
        side: 'right',
        crop: rightCrop,
        readingOrder: 1,
        virtualAspectRatio: rightVirtualAR,
      });
      segments.push({
        key: `${sourcePageNumber}-b`,
        label: `Pág ${sourcePageNumber} (Izq)`,
        side: 'left',
        crop: leftCrop,
        readingOrder: 2,
        virtualAspectRatio: leftVirtualAR,
      });
    } else {
      // Left half is read first in LTR (manhwa / comics)
      segments.push({
        key: `${sourcePageNumber}-a`,
        label: `Pág ${sourcePageNumber} (Izq)`,
        side: 'left',
        crop: leftCrop,
        readingOrder: 1,
        virtualAspectRatio: leftVirtualAR,
      });
      segments.push({
        key: `${sourcePageNumber}-b`,
        label: `Pág ${sourcePageNumber} (Der)`,
        side: 'right',
        crop: rightCrop,
        readingOrder: 2,
        virtualAspectRatio: rightVirtualAR,
      });
    }
  } else {
    // Single or Panorama layout
    segments.push({
      key: `${sourcePageNumber}`,
      label: `Pág ${sourcePageNumber}`,
      side: 'full',
      crop: { x: 0.0, y: 0.0, w: 1.0, h: 1.0 },
      readingOrder: 1,
      virtualAspectRatio: aspectRatio,
    });
  }

  return {
    candidate,
    decision,
    aspectRatio,
    splitPositionPct: clampedSplit,
    segments,
    reasons,
  };
}

/**
 * Projects a speech bubble or heatmap box from original full-image coordinates
 * into normalized sub-slice coordinates.
 * Returns null if the bounding box does not intersect the slice.
 */
export function mapBoxToCrop(box: NormalizedCrop, crop: NormalizedCrop): NormalizedCrop | null {
  const left = Math.max(box.x, crop.x);
  const top = Math.max(box.y, crop.y);
  const right = Math.min(box.x + box.w, crop.x + crop.w);
  const bottom = Math.min(box.y + box.h, crop.y + crop.h);

  if (right <= left || bottom <= top) {
    return null;
  }

  const mappedX = (left - crop.x) / crop.w;
  const mappedY = (top - crop.y) / crop.h;
  const mappedW = (right - left) / crop.w;
  const mappedH = (bottom - top) / crop.h;

  return {
    x: Math.round(mappedX * 10000) / 10000,
    y: Math.round(mappedY * 10000) / 10000,
    w: Math.round(mappedW * 10000) / 10000,
    h: Math.round(mappedH * 10000) / 10000,
  };
}
