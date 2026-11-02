import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  GuidedPanelService,
  GuidedPanelBox,
} from '../../../../src/backend/services/guided-panel-service.js';

describe('GuidedPanelService Unit Tests (Sprint 68)', () => {
  let db: DatabaseInstance;
  let service: GuidedPanelService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new GuidedPanelService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Boustrophedon Tier-Clustering & Directional Sorting', () => {
    it('sorts Japanese manga panels strictly in RTL boustrophedon order', () => {
      // 4-panel 2-tier layout:
      // Tier 1 (top): Panel A (left, x=0.05, y=0.05, w=0.42), Panel B (right, x=0.53, y=0.05, w=0.42)
      // Tier 2 (bottom): Panel C (left, x=0.05, y=0.52, w=0.42), Panel D (right, x=0.53, y=0.52, w=0.42)
      const inputPanels: Array<Omit<GuidedPanelBox, 'panelIndex' | 'readingOrderScore'>> = [
        { chapterId: 'ch1', pageNumber: 1, normX: 0.05, normY: 0.05, normW: 0.42, normH: 0.40, aspectRatio: 1.05, isSplash: false },
        { chapterId: 'ch1', pageNumber: 1, normX: 0.53, normY: 0.05, normW: 0.42, normH: 0.40, aspectRatio: 1.05, isSplash: false },
        { chapterId: 'ch1', pageNumber: 1, normX: 0.05, normY: 0.52, normW: 0.42, normH: 0.40, aspectRatio: 1.05, isSplash: false },
        { chapterId: 'ch1', pageNumber: 1, normX: 0.53, normY: 0.52, normW: 0.42, normH: 0.40, aspectRatio: 1.05, isSplash: false },
      ];

      const sorted = service.boustrophedonSort(inputPanels, 'manga');
      expect(sorted).toHaveLength(4);

      // In Manga RTL: Top-Right (B) -> Top-Left (A) -> Bottom-Right (D) -> Bottom-Left (C)
      expect(sorted[0].normX).toBe(0.53);
      expect(sorted[0].normY).toBe(0.05);
      expect(sorted[0].panelIndex).toBe(0);

      expect(sorted[1].normX).toBe(0.05);
      expect(sorted[1].normY).toBe(0.05);
      expect(sorted[1].panelIndex).toBe(1);

      expect(sorted[2].normX).toBe(0.53);
      expect(sorted[2].normY).toBe(0.52);
      expect(sorted[2].panelIndex).toBe(2);

      expect(sorted[3].normX).toBe(0.05);
      expect(sorted[3].normY).toBe(0.52);
      expect(sorted[3].panelIndex).toBe(3);
    });

    it('sorts Western comic panels strictly in LTR boustrophedon order', () => {
      const inputPanels: Array<Omit<GuidedPanelBox, 'panelIndex' | 'readingOrderScore'>> = [
        { chapterId: 'ch1', pageNumber: 1, normX: 0.53, normY: 0.05, normW: 0.42, normH: 0.40, aspectRatio: 1.05, isSplash: false },
        { chapterId: 'ch1', pageNumber: 1, normX: 0.05, normY: 0.05, normW: 0.42, normH: 0.40, aspectRatio: 1.05, isSplash: false },
      ];

      const sorted = service.boustrophedonSort(inputPanels, 'comic');
      expect(sorted[0].normX).toBe(0.05); // Left first
      expect(sorted[1].normX).toBe(0.53); // Right second
    });

    it('sorts Webtoon panels strictly in Top-to-Bottom vertical cascade', () => {
      const inputPanels: Array<Omit<GuidedPanelBox, 'panelIndex' | 'readingOrderScore'>> = [
        { chapterId: 'ch1', pageNumber: 1, normX: 0.1, normY: 0.70, normW: 0.8, normH: 0.25, aspectRatio: 3.2, isSplash: false },
        { chapterId: 'ch1', pageNumber: 1, normX: 0.1, normY: 0.10, normW: 0.8, normH: 0.25, aspectRatio: 3.2, isSplash: false },
        { chapterId: 'ch1', pageNumber: 1, normX: 0.1, normY: 0.40, normW: 0.8, normH: 0.25, aspectRatio: 3.2, isSplash: false },
      ];

      const sorted = service.boustrophedonSort(inputPanels, 'webtoon');
      expect(sorted[0].normY).toBe(0.10);
      expect(sorted[1].normY).toBe(0.40);
      expect(sorted[2].normY).toBe(0.70);
    });

    it('absorbs staggered panel tops within epsilon row threshold', () => {
      // Artistic stagger: Panel 1 top at 0.04, Panel 2 top at 0.06 (diff 0.02 <= 0.05)
      const inputPanels: Array<Omit<GuidedPanelBox, 'panelIndex' | 'readingOrderScore'>> = [
        { chapterId: 'ch1', pageNumber: 1, normX: 0.05, normY: 0.04, normW: 0.40, normH: 0.35, aspectRatio: 1.14, isSplash: false },
        { chapterId: 'ch1', pageNumber: 1, normX: 0.55, normY: 0.06, normW: 0.40, normH: 0.35, aspectRatio: 1.14, isSplash: false },
      ];

      const sorted = service.boustrophedonSort(inputPanels, 'manga', 0.05);
      expect(sorted).toHaveLength(2);
      expect(sorted[0].normX).toBe(0.55); // Right panel first despite 0.02 higher Y
      expect(sorted[1].normX).toBe(0.05);
    });

    it('detects and marks full-page splash panels', () => {
      const splashInput: Array<Omit<GuidedPanelBox, 'panelIndex' | 'readingOrderScore'>> = [
        { chapterId: 'ch1', pageNumber: 1, normX: 0.02, normY: 0.02, normW: 0.96, normH: 0.96, aspectRatio: 1.0, isSplash: false },
      ];

      const sorted = service.boustrophedonSort(splashInput, 'manga');
      expect(sorted[0].isSplash).toBe(true);
    });

    it('returns empty array when given empty input', () => {
      expect(service.boustrophedonSort([])).toEqual([]);
    });
  });

  describe('Camera Framing Coordinates Calculation', () => {
    it('calculates centered translate and scale for a panel', () => {
      const panel: GuidedPanelBox = {
        chapterId: 'ch1',
        pageNumber: 1,
        panelIndex: 0,
        normX: 0.1,
        normY: 0.1,
        normW: 0.4,
        normH: 0.4,
        aspectRatio: 1.0,
        readingOrderScore: 0,
        isSplash: false,
      };

      const framing = service.calculatePanelFraming(panel, {
        viewportW: 1920,
        viewportH: 1080,
        padding: 0.04,
      });

      expect(framing.scale).toBeGreaterThan(1.0);
      expect(framing.isSplash).toBe(false);
      expect(framing.panXPercent).toBeGreaterThan(0); // Offset to center (0.3 < 0.5)
      expect(framing.panYPercent).toBeGreaterThan(0);
      expect(framing.normCenter.x).toBeCloseTo(0.3, 4);
      expect(framing.normCenter.y).toBeCloseTo(0.3, 4);
    });

    it('returns zero pan and 1.0 scale for full-page splash panel', () => {
      const splashPanel: GuidedPanelBox = {
        chapterId: 'ch1',
        pageNumber: 1,
        panelIndex: 0,
        normX: 0.0,
        normY: 0.0,
        normW: 1.0,
        normH: 1.0,
        aspectRatio: 1.0,
        readingOrderScore: 0,
        isSplash: true,
      };

      const framing = service.calculatePanelFraming(splashPanel);
      expect(framing.scale).toBe(1.0);
      expect(framing.panXPercent).toBe(0);
      expect(framing.panYPercent).toBe(0);
      expect(framing.isSplash).toBe(true);
    });

    it('clamps maximum zoom scale to prevent blur', () => {
      const tinyPanel: GuidedPanelBox = {
        chapterId: 'ch1',
        pageNumber: 1,
        panelIndex: 0,
        normX: 0.4,
        normY: 0.4,
        normW: 0.05,
        normH: 0.05,
        aspectRatio: 1.0,
        readingOrderScore: 0,
        isSplash: false,
      };

      const framing = service.calculatePanelFraming(tinyPanel, { maxScale: 3.5 });
      expect(framing.scale).toBe(3.5);
      expect(framing.clamped).toBe(true);
    });
  });

  describe('SQLite Persistence & LRU Memory Caching', () => {
    it('persists panel sequences into SQLite and retrieves them', () => {
      const inputPanels: Array<Omit<GuidedPanelBox, 'panelIndex' | 'readingOrderScore'>> = [
        { chapterId: 'ch-sprint-68', pageNumber: 5, normX: 0.5, normY: 0.1, normW: 0.4, normH: 0.4, aspectRatio: 1.0, isSplash: false },
        { chapterId: 'ch-sprint-68', pageNumber: 5, normX: 0.1, normY: 0.1, normW: 0.4, normH: 0.4, aspectRatio: 1.0, isSplash: false },
      ];

      const saved = service.savePanelSequence('ch-sprint-68', 5, inputPanels, 'manga');
      expect(saved).toHaveLength(2);
      expect(saved[0].panelIndex).toBe(0);
      expect(saved[0].normX).toBe(0.5); // Right panel first in manga

      // Clear in-memory cache to force DB read
      service.clearCache();

      const retrieved = service.getPanelSequence('ch-sprint-68', 5);
      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].panelIndex).toBe(0);
      expect(retrieved[0].normX).toBe(0.5);
      expect(retrieved[1].normX).toBe(0.1);
    });

    it('returns empty array for page with no saved sequences', () => {
      const retrieved = service.getPanelSequence('nonexistent-ch', 99);
      expect(retrieved).toEqual([]);
    });
  });
});
