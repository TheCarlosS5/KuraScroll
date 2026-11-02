import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository.js';
import { resolveAssetTier, resolveIOPriority, ASSET_TIER_CONFIG } from '../../../src/backend/config/asset-tier-config.js';
import { IOPriority } from '../../../src/backend/storage/io/io-priority.js';

describe('Sprint 38: Asset Tier & Prefetch Priority Configuration', () => {
  describe('Unit: resolveAssetTier & resolveIOPriority', () => {
    it('defaults to high tier and CRITICAL priority for standard interactive requests', () => {
      const tier = resolveAssetTier({});
      const priority = resolveIOPriority({});
      expect(tier).toBe('high');
      expect(priority).toBe(IOPriority.CRITICAL);
    });

    it('resolves low tier when save-data header is on', () => {
      const tier = resolveAssetTier({ 'save-data': 'on' });
      expect(tier).toBe('low');
    });

    it('resolves low tier when saveData query is 1 or true', () => {
      expect(resolveAssetTier({}, { saveData: '1' })).toBe('low');
      expect(resolveAssetTier({}, { saveData: 'true' })).toBe('low');
    });

    it('resolves explicit query tier parameter', () => {
      expect(resolveAssetTier({}, { tier: 'low' })).toBe('low');
      expect(resolveAssetTier({}, { tier: 'balanced' })).toBe('balanced');
      expect(resolveAssetTier({}, { tier: 'high' })).toBe('high');
    });

    it('resolves viewport hints for balanced and low tiers', () => {
      expect(resolveAssetTier({ 'sec-ch-viewport-width': '600' })).toBe('low');
      expect(resolveAssetTier({ 'sec-ch-viewport-width': '1024' })).toBe('balanced');
      expect(resolveAssetTier({ 'sec-ch-viewport-width': '1920' })).toBe('high');
    });

    it('resolves NORMAL priority when X-Purpose or Purpose is prefetch or preview', () => {
      expect(resolveIOPriority({ 'x-purpose': 'prefetch' })).toBe(IOPriority.NORMAL);
      expect(resolveIOPriority({ 'purpose': 'prefetch' })).toBe(IOPriority.NORMAL);
      expect(resolveIOPriority({ 'x-purpose': 'preview' })).toBe(IOPriority.NORMAL);
      expect(resolveIOPriority({}, { prefetch: '1' })).toBe(IOPriority.NORMAL);
    });

    it('exposes correct asset tier configurations', () => {
      expect(ASSET_TIER_CONFIG.low.quality).toBe(68);
      expect(ASSET_TIER_CONFIG.low.maxWidth).toBe(1080);
      expect(ASSET_TIER_CONFIG.balanced.quality).toBe(75);
      expect(ASSET_TIER_CONFIG.high.quality).toBe(82);
    });
  });

  describe('Integration: Fastify Route Header & Priority Tagging', () => {
    let app: any;
    let db: DatabaseInstance;
    let tempDir: string;
    let chapterDir: string;

    beforeEach(async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-asset-tier-'));
      chapterDir = path.join(tempDir, 'series', 'test-series', 'c1');
      fs.mkdirSync(chapterDir, { recursive: true });

      // Create a valid dummy WebP header
      const dummyWebP = Buffer.alloc(32);
      dummyWebP.write('RIFF', 0, 'ascii');
      dummyWebP.writeUInt32LE(24, 4);
      dummyWebP.write('WEBP', 8, 'ascii');
      fs.writeFileSync(path.join(chapterDir, 'page_001.webp'), dummyWebP);

      db = createDatabase(':memory:');
      runMigrations(db);
      const chapRepo = new ChapterRepository(db);

      db.exec(`INSERT INTO series (id, slug, title_primary, type, status) VALUES ('s1', 'test-series', 'Test Series', 'manga', 'ongoing');`);

      chapRepo.createChapter({
        id: 'c1',
        seriesId: 's1',
        chapterNumber: 1,
        title: 'Chapter 1',
        storagePath: 'series/test-series/c1'
      });

      chapRepo.addPages('c1', [
        { pageNumber: 1, fileName: 'page_001.webp', width: 1440, height: 2160, aspectRatio: 0.666, fileSizeBytes: dummyWebP.length }
      ]);

      app = buildApp({ db, storageRoot: tempDir });
      await app.ready();
    });

    afterEach(async () => {
      await app.close();
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('responds with standard headers and CRITICAL priority for interactive reads', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chapters/c1/pages/page_001.webp'
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-asset-tier']).toBe('high');
      expect(res.headers['x-io-priority']).toBe('CRITICAL');
      expect(res.headers['x-prefetch-handled']).toBeUndefined();
    });

    it('responds with prefetch tagging and NORMAL priority when X-Purpose: prefetch is sent', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chapters/c1/pages/page_001.webp',
        headers: {
          'x-purpose': 'prefetch'
        }
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-asset-tier']).toBe('high');
      expect(res.headers['x-io-priority']).toBe('NORMAL');
      expect(res.headers['x-prefetch-handled']).toBe('true');
    });

    it('adapts tier to low when save-data header is present', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chapters/c1/pages/page_001.webp',
        headers: {
          'save-data': 'on',
          'x-purpose': 'prefetch'
        }
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-asset-tier']).toBe('low');
      expect(res.headers['x-io-priority']).toBe('NORMAL');
      expect(res.headers['x-save-data']).toBe('active');
      expect(res.headers['vary']).toContain('Save-Data');
    });
  });
});
