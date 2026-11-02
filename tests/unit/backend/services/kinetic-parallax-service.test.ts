import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  KineticParallaxService,
  KineticLayerBox,
} from '../../../../src/backend/services/kinetic-parallax-service.js';

describe('KineticParallaxService Unit Tests (Sprint 70)', () => {
  let db: DatabaseInstance;
  let service: KineticParallaxService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new KineticParallaxService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Zero-Allocation 2.5D Layer Drift Calculation', () => {
    const sampleLayers: KineticLayerBox[] = [
      {
        chapterId: 'ch1',
        pageNumber: 5,
        panelIndex: 0,
        layerIndex: 0,
        layerRole: 'BACKGROUND',
        normX: 0.0,
        normY: 0.0,
        normW: 1.0,
        normH: 1.0,
        depthFactor: 0.1,
      },
      {
        chapterId: 'ch1',
        pageNumber: 5,
        panelIndex: 0,
        layerIndex: 1,
        layerRole: 'MIDGROUND',
        normX: 0.1,
        normY: 0.1,
        normW: 0.8,
        normH: 0.8,
        depthFactor: 0.5,
      },
      {
        chapterId: 'ch1',
        pageNumber: 5,
        panelIndex: 0,
        layerIndex: 2,
        layerRole: 'FOREGROUND',
        normX: 0.2,
        normY: 0.2,
        normW: 0.6,
        normH: 0.6,
        depthFactor: 1.0,
      },
    ];

    it('calculates proportional drift offsets and anti-bleed over-scaling', () => {
      const drifts = service.calculateLayerDrifts(sampleLayers, {
        inputX: 1.0,
        inputY: 0.5,
        maxOffsetPx: 10.0,
      });

      expect(drifts).toHaveLength(3);

      // Background: depth 0.1 -> offsetX = 1.0 * 0.1 * 10 = 1.0px, offsetY = 0.5 * 0.1 * 10 = 0.5px
      // scale = 1.0 + 0.1 * 0.08 = 1.008
      expect(drifts[0].layerRole).toBe('BACKGROUND');
      expect(drifts[0].offsetX).toBe(1.0);
      expect(drifts[0].offsetY).toBe(0.5);
      expect(drifts[0].scale).toBe(1.008);
      expect(drifts[0].cssTransform).toBe('translate3d(1px, 0.5px, 0) scale(1.008)');

      // Midground: depth 0.5 -> offsetX = 5.0px, offsetY = 2.5px
      // scale = 1.0 + 0.5 * 0.08 = 1.04
      expect(drifts[1].layerRole).toBe('MIDGROUND');
      expect(drifts[1].offsetX).toBe(5.0);
      expect(drifts[1].offsetY).toBe(2.5);
      expect(drifts[1].scale).toBe(1.04);
      expect(drifts[1].cssTransform).toBe('translate3d(5px, 2.5px, 0) scale(1.04)');

      // Foreground: depth 1.0 -> offsetX = 10.0px, offsetY = 5.0px
      // scale = 1.0 + 1.0 * 0.08 = 1.08
      expect(drifts[2].layerRole).toBe('FOREGROUND');
      expect(drifts[2].offsetX).toBe(10.0);
      expect(drifts[2].offsetY).toBe(5.0);
      expect(drifts[2].scale).toBe(1.08);
      expect(drifts[2].cssTransform).toBe('translate3d(10px, 5px, 0) scale(1.08)');
    });

    it('clamps excessive input coordinates to [-1.0, 1.0] and offset to [2.0, 18.0]', () => {
      const drifts = service.calculateLayerDrifts(sampleLayers, {
        inputX: 5.5, // should clamp to 1.0
        inputY: -10.0, // should clamp to -1.0
        maxOffsetPx: 100.0, // should clamp to 18.0
      });

      expect(drifts[2].offsetX).toBe(18.0);
      expect(drifts[2].offsetY).toBe(-18.0);
    });

    it('returns empty array when layers are empty', () => {
      const drifts = service.calculateLayerDrifts([], { inputX: 0.5, inputY: 0.5 });
      expect(drifts).toEqual([]);
    });

    it('handles NaN gracefully in clamp', () => {
      expect(KineticParallaxService.clamp(NaN, 0, 10)).toBe(0);
      expect(KineticParallaxService.clamp(Infinity, 0, 10)).toBe(0);
    });
  });

  describe('SQLite Persistence & Cache Lifecycle', () => {
    it('persists and retrieves kinetic layers for chapter and page', () => {
      const layersToSave = [
        {
          chapterId: 'ch-climax-70',
          pageNumber: 12,
          panelIndex: 1,
          layerIndex: 0,
          layerRole: 'BACKGROUND' as const,
          normX: 0.0,
          normY: 0.0,
          normW: 1.0,
          normH: 1.0,
          depthFactor: 0.1,
          assetUrl: '/storage/layers/ch70_p12_bg.webp',
        },
        {
          chapterId: 'ch-climax-70',
          pageNumber: 12,
          panelIndex: 1,
          layerIndex: 1,
          layerRole: 'FOREGROUND' as const,
          normX: 0.1,
          normY: 0.1,
          normW: 0.8,
          normH: 0.8,
          depthFactor: 1.2,
          assetUrl: '/storage/layers/ch70_p12_fg.webp',
        },
      ];

      const saved = service.saveLayers('ch-climax-70', 12, 1, layersToSave);
      expect(saved).toHaveLength(2);

      // Verify retrieval
      const retrieved = service.getLayers('ch-climax-70', 12, 1);
      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].layerRole).toBe('BACKGROUND');
      expect(retrieved[0].assetUrl).toBe('/storage/layers/ch70_p12_bg.webp');
      expect(retrieved[1].layerRole).toBe('FOREGROUND');
      expect(retrieved[1].depthFactor).toBe(1.2);

      // Clear memory cache and re-read from SQLite
      service.clearCache();
      const fromDb = service.getLayers('ch-climax-70', 12, 1);
      expect(fromDb).toHaveLength(2);
      expect(fromDb[0].layerRole).toBe('BACKGROUND');
      expect(fromDb[1].layerRole).toBe('FOREGROUND');
    });

    it('deletes layers and clears cache', () => {
      service.saveLayers('ch-del', 1, 0, [
        {
          chapterId: 'ch-del',
          pageNumber: 1,
          panelIndex: 0,
          layerIndex: 0,
          layerRole: 'MIDGROUND',
          normX: 0.0,
          normY: 0.0,
          normW: 1.0,
          normH: 1.0,
          depthFactor: 0.5,
        },
      ]);

      expect(service.getLayers('ch-del', 1)).toHaveLength(1);

      service.deleteLayers('ch-del', 1);
      expect(service.getLayers('ch-del', 1)).toHaveLength(0);
    });
  });
});
