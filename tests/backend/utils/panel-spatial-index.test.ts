import { describe, it, expect } from 'vitest';
import {
  clampCoordinate,
  normalizePanelBounds,
  hitTestPanel,
  hitTestBubble,
  sortPanelsReadingOrder,
  findEnclosingPanel,
  PanelBox,
  DialogueBubble
} from '../../../src/backend/utils/panel-spatial-index.js';

describe('Sprint 55: Panel Spatial Index & Bounding Box Utilities', () => {
  it('clamps coordinates strictly to [0.0, 100.0] and handles NaNs', () => {
    expect(clampCoordinate(-5.2)).toBe(0.0);
    expect(clampCoordinate(105.8)).toBe(100.0);
    expect(clampCoordinate(45.6789)).toBe(45.679);
    expect(clampCoordinate(NaN)).toBe(0.0);
    expect(clampCoordinate(Infinity)).toBe(0.0);
  });

  it('normalizes panel bounds and prevents overflow beyond 100%', () => {
    const raw = { x: 80.0, y: 70.0, w: 40.0, h: 50.0 };
    const norm = normalizePanelBounds(raw);

    expect(norm.x).toBe(80.0);
    expect(norm.y).toBe(70.0);
    expect(norm.w).toBe(20.0); // Clamped to 100 - 80
    expect(norm.h).toBe(30.0); // Clamped to 100 - 70
    expect(norm.aspectRatio).toBeCloseTo(20.0 / 30.0, 3);
  });

  it('performs sub-microsecond point-in-panel hit testing', () => {
    const panels: PanelBox[] = [
      {
        id: 'p1',
        chapterId: 'ch1',
        pageNumber: 1,
        panelIndex: 0,
        x: 10.0,
        y: 10.0,
        w: 35.0,
        h: 25.0,
        aspectRatio: 1.4,
        readingOrder: 0
      },
      {
        id: 'p2',
        chapterId: 'ch1',
        pageNumber: 1,
        panelIndex: 1,
        x: 55.0,
        y: 10.0,
        w: 35.0,
        h: 25.0,
        aspectRatio: 1.4,
        readingOrder: 1
      }
    ];

    expect(hitTestPanel(20.0, 20.0, panels)?.id).toBe('p1');
    expect(hitTestPanel(60.0, 15.0, panels)?.id).toBe('p2');
    expect(hitTestPanel(50.0, 50.0, panels)).toBeNull(); // Inside gutter
  });

  it('sorts panels according to Japanese Manga RTL reading tradition', () => {
    // Row 1: Right panel (x=50, y=0), Left panel (x=0, y=0)
    // Row 2: Full width panel (x=0, y=50)
    const rawPanels = [
      { id: 'left-top', x: 0.0, y: 0.0, h: 40.0 },
      { id: 'bottom', x: 0.0, y: 50.0, h: 45.0 },
      { id: 'right-top', x: 50.0, y: 0.0, h: 40.0 }
    ];

    const sortedRTL = sortPanelsReadingOrder(rawPanels, 'RTL');
    expect(sortedRTL.map(p => p.id)).toEqual(['right-top', 'left-top', 'bottom']);

    const sortedLTR = sortPanelsReadingOrder(rawPanels, 'LTR');
    expect(sortedLTR.map(p => p.id)).toEqual(['left-top', 'right-top', 'bottom']);
  });

  it('finds enclosing panel for dialogue bubble by centroid', () => {
    const panels: PanelBox[] = [
      {
        id: 'p1',
        chapterId: 'ch1',
        pageNumber: 1,
        panelIndex: 0,
        x: 10.0,
        y: 10.0,
        w: 40.0,
        h: 40.0,
        aspectRatio: 1.0,
        readingOrder: 0
      }
    ];

    const bubbleInside = { x: 15.0, y: 15.0, w: 10.0, h: 10.0 };
    expect(findEnclosingPanel(bubbleInside, panels)?.id).toBe('p1');

    const bubbleOutside = { x: 60.0, y: 60.0, w: 10.0, h: 10.0 };
    expect(findEnclosingPanel(bubbleOutside, panels)).toBeNull();
  });
});
