import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  SfxOverlayService,
  CANONICAL_SFX_SEEDS,
} from '../../../../src/backend/services/sfx-overlay-service.js';

describe('SfxOverlayService Unit Tests (Sprint 67)', () => {
  let db: DatabaseInstance;
  let service: SfxOverlayService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new SfxOverlayService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Catalog Seeding & Dictionary Lookup', () => {
    it('seeds canonical onomatopoeia catalog with Japanese and Korean entries', () => {
      const gogogo = service.lookupCatalog('ゴゴゴ');
      expect(gogogo.length).toBeGreaterThan(0);
      expect(gogogo[0].surface).toBe('ゴゴゴ');
      expect(gogogo[0].category).toBe('GITAGO');
      expect(gogogo[0].meaningEs).toContain('amenazante');
      expect(gogogo[0].translationEs).toBe('¡RUMBLE!');

      const kwaaa = service.lookupCatalog('콰아아');
      expect(kwaaa.length).toBeGreaterThan(0);
      expect(kwaaa[0].languageCode).toBe('ko');
      expect(kwaaa[0].category).toBe('UISEONGEO');
      expect(kwaaa[0].meaningEs).toContain('maná');
    });

    it('finds catalog entries by romanization substring', () => {
      const results = service.lookupCatalog('Doki');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].surface).toBe('ドキドキ');
      expect(results[0].romanization).toBe('Doki Doki');
    });

    it('returns empty array for unknown onomatopoeia without throwing', () => {
      const results = service.lookupCatalog('nonexistent_sfx_xyz');
      expect(results).toEqual([]);
    });
  });

  describe('Page Annotations & Spatial Hit-Testing', () => {
    it('adds an SFX annotation and retrieves annotations for chapter page', () => {
      const sfxEntry = service.lookupCatalog('ドン')[0];
      expect(sfxEntry).toBeDefined();

      const annotation = service.addAnnotation({
        chapterId: 'ch_op_1000',
        pageNumber: 15,
        sfxId: sfxEntry.id,
        normX: 0.35,
        normY: 0.45,
        normW: 0.20,
        normH: 0.15,
        rotationDeg: -10,
        isVertical: false,
      });

      expect(annotation.id).toBeGreaterThan(0);
      expect(annotation.chapterId).toBe('ch_op_1000');
      expect(annotation.pageNumber).toBe(15);
      expect(annotation.normX).toBe(0.35);

      const pageList = service.getPageAnnotations('ch_op_1000', 15, 'es');
      expect(pageList.length).toBe(1);
      expect(pageList[0].displayTranslation).toBe('¡DON!!');
      expect(pageList[0].sfx?.surface).toBe('ドン!!');
    });

    it('performs ultra-fast zero-allocation spatial AABB hit-test at point', () => {
      const sfxEntry = service.lookupCatalog('ゴゴゴ')[0];

      service.addAnnotation({
        chapterId: 'ch_jojo_45',
        pageNumber: 3,
        sfxId: sfxEntry.id,
        normX: 0.10,
        normY: 0.20,
        normW: 0.25,
        normH: 0.30,
      });

      // Point inside box [0.10..0.35, 0.20..0.50]
      const hit = service.findSfxAtPoint('ch_jojo_45', 3, 0.20, 0.30, 'es');
      expect(hit).not.toBeNull();
      expect(hit?.sfx?.romanization).toBe('Gogogo');

      // Point outside box
      const miss = service.findSfxAtPoint('ch_jojo_45', 3, 0.80, 0.80, 'es');
      expect(miss).toBeNull();
    });

    it('resolves English translation when targetLanguage is en', () => {
      const sfxEntry = service.lookupCatalog('ガキン')[0]; // Gakin / Clang

      service.addAnnotation({
        chapterId: 'ch_berserk_1',
        pageNumber: 1,
        sfxId: sfxEntry.id,
        normX: 0.5,
        normY: 0.5,
        normW: 0.3,
        normH: 0.3,
      });

      const annotations = service.getPageAnnotations('ch_berserk_1', 1, 'en');
      expect(annotations[0].displayTranslation).toBe('¡CLANG!');
    });
  });
});
