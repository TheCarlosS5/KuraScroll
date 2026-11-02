/**
 * KuraScroll Sprint 55: High-Precision Panel Spatial Index & Bounding Box Utilities
 * Optimized for Intel Pentium T4500 (Zero-allocation, Sub-microsecond hit tests)
 */

export interface PanelBox {
  id: string;
  chapterId: string;
  pageNumber: number;
  panelIndex: number;
  x: number;          // 0.0 .. 100.0%
  y: number;          // 0.0 .. 100.0%
  w: number;          // 0.0 .. 100.0%
  h: number;          // 0.0 .. 100.0%
  aspectRatio: number;
  readingOrder: number; // 0-based sequential reading index
}

export interface DialogueBubble {
  id: string;
  chapterId: string;
  pageNumber: number;
  panelId?: string | null;
  bubbleIndex: number;
  x: number;          // 0.0 .. 100.0%
  y: number;          // 0.0 .. 100.0%
  w: number;          // 0.0 .. 100.0%
  h: number;          // 0.0 .. 100.0%
  text: string;
  language: string;
  confidence: number; // 0.0 .. 1.0
  bubbleType: 'SPEECH' | 'THOUGHT' | 'SCREAM' | 'WHISPER' | 'SFX';
}

export type ReadingDirection = 'RTL' | 'LTR' | 'VERTICAL_SCROLL';

/**
 * Clamps coordinates strictly into [0.0, 100.0%] bounds.
 */
export function clampCoordinate(val: number): number {
  if (Number.isNaN(val) || !Number.isFinite(val)) return 0.0;
  if (val < 0.0) return 0.0;
  if (val > 100.0) return 100.0;
  return Math.round(val * 1000) / 1000;
}

/**
 * Validates and normalizes raw panel bounds.
 */
export function normalizePanelBounds(
  raw: { x: number; y: number; w: number; h: number }
): { x: number; y: number; w: number; h: number; aspectRatio: number } {
  const x = clampCoordinate(raw.x);
  const y = clampCoordinate(raw.y);
  const w = clampCoordinate(Math.min(raw.w, 100.0 - x));
  const h = clampCoordinate(Math.min(raw.h, 100.0 - y));
  const safeW = Math.max(w, 0.1);
  const safeH = Math.max(h, 0.1);
  const aspectRatio = Math.round((safeW / safeH) * 1000) / 1000;

  return { x, y, w: safeW, h: safeH, aspectRatio };
}

/**
 * High-performance, zero-allocation point-in-panel hit test.
 * Target SLA 19: < 0.005 ms (< 5 µs).
 */
export function hitTestPanel(
  px: number,
  py: number,
  panels: readonly PanelBox[]
): PanelBox | null {
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i];
    if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h) {
      return p;
    }
  }
  return null;
}

/**
 * High-performance, zero-allocation point-in-bubble hit test.
 */
export function hitTestBubble(
  px: number,
  py: number,
  bubbles: readonly DialogueBubble[]
): DialogueBubble | null {
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
      return b;
    }
  }
  return null;
}

/**
 * Computes panel reading order based on comic tradition:
 * - Japanese Manga (RTL): Sort tiers by Y asc; within tier, sort by X desc.
 * - Western Comic (LTR): Sort tiers by Y asc; within tier, sort by X asc.
 * - Webtoon (VERTICAL_SCROLL): Sort strictly by Y asc.
 */
export function sortPanelsReadingOrder<T extends { x: number; y: number; h: number }>(
  panels: T[],
  direction: ReadingDirection = 'RTL'
): T[] {
  if (panels.length <= 1) return [...panels];

  const sorted = [...panels];

  if (direction === 'VERTICAL_SCROLL') {
    return sorted.sort((a, b) => a.y - b.y);
  }

  // Group into horizontal tiers using a vertical overlap tolerance (gutter height threshold)
  return sorted.sort((a, b) => {
    // If panels overlap significantly in Y (same horizontal tier)
    const yDiff = Math.abs(a.y - b.y);
    const tierThreshold = Math.min(a.h, b.h) * 0.4;

    if (yDiff <= tierThreshold) {
      // In same tier: RTL reads right-to-left (descending X), LTR reads left-to-right (ascending X)
      return direction === 'RTL' ? b.x - a.x : a.x - b.x;
    }

    // Different tiers: Top-to-bottom
    return a.y - b.y;
  });
}

/**
 * Finds the enclosing or intersecting panel for a dialogue bubble using centroid intersection.
 */
export function findEnclosingPanel(
  bubble: { x: number; y: number; w: number; h: number },
  panels: readonly PanelBox[]
): PanelBox | null {
  const cx = bubble.x + bubble.w / 2;
  const cy = bubble.y + bubble.h / 2;
  return hitTestPanel(cx, cy, panels);
}
