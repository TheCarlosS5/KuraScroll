/**
 * KuraScroll Sprint 100: Vector Quantizer Service Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  VectorQuantizerService,
  VECTOR_INDEX_PRESETS,
  VectorIndexProfile,
} from '../../../../src/backend/services/vector-quantizer-service.js';

describe('VectorQuantizerService', () => {
  let db: DatabaseInstance;
  let service: VectorQuantizerService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS vector_index_profiles (
        series_id TEXT PRIMARY KEY,
        index_mode TEXT NOT NULL DEFAULT 'int8_quantized' CHECK (index_mode IN (
            'int8_quantized',
            'compact_scalar',
            'exact_cosine',
            'custom'
        )),
        embedding_dimension INTEGER NOT NULL DEFAULT 64 CHECK (embedding_dimension >= 16 AND embedding_dimension <= 256),
        similarity_threshold REAL NOT NULL DEFAULT 0.75 CHECK (similarity_threshold >= 0.10 AND similarity_threshold <= 0.99),
        max_top_k INTEGER NOT NULL DEFAULT 5 CHECK (max_top_k >= 1 AND max_top_k <= 50),
        is_spoiler_shield_active INTEGER NOT NULL DEFAULT 1 CHECK (is_spoiler_shield_active IN (0, 1)),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_vector_index_lookup ON vector_index_profiles(series_id);
    `);
    service = new VectorQuantizerService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('calculateQuantizedCosineSimilarity', () => {
    it('returns perfect similarity 1.0 for identical vectors', () => {
      const q = [10, 20, 30, 40];
      const c = [10, 20, 30, 40];
      const res = service.calculateQuantizedCosineSimilarity(q, c, 64, 0.75, true, 5, 10);

      expect(res.cosineSimilarity).toBe(1.0);
      expect(res.isMatch).toBe(true);
      expect(res.isSpoilerShielded).toBe(false);
      expect(res.effectiveDimension).toBe(4);
    });

    it('returns 0.0 for orthogonal vectors', () => {
      const q = [1, 0, 0, 0];
      const c = [0, 1, 0, 0];
      const res = service.calculateQuantizedCosineSimilarity(q, c, 64, 0.75);

      expect(res.cosineSimilarity).toBe(0.0);
      expect(res.isMatch).toBe(false);
    });

    it('returns -1.0 for opposite vectors', () => {
      const q = [10, 20, 30, 40];
      const c = [-10, -20, -30, -40];
      const res = service.calculateQuantizedCosineSimilarity(q, c, 64, 0.75);

      expect(res.cosineSimilarity).toBe(-1.0);
      expect(res.isMatch).toBe(false);
    });

    it('handles zero norm vectors safely without returning NaN', () => {
      const q = [0, 0, 0, 0];
      const c = [0, 0, 0, 0];
      const res = service.calculateQuantizedCosineSimilarity(q, c, 64, 0.75);

      expect(res.cosineSimilarity).toBe(0.0);
      expect(isNaN(res.cosineSimilarity)).toBe(false);
      expect(res.isMatch).toBe(false);
    });

    it('shields spoilers when candidate reveal chapter exceeds user current chapter', () => {
      const q = [10, 20, 30, 40];
      const c = [10, 20, 30, 40]; // 1.0 match
      const res = service.calculateQuantizedCosineSimilarity(
        q,
        c,
        64,
        0.75,
        true, // isSpoilerShieldActive
        25,   // candidateRevealChapter = 25
        10    // userCurrentChapter = 10
      );

      expect(res.isMatch).toBe(true);
      expect(res.isSpoilerShielded).toBe(true);
    });

    it('does not shield when candidate chapter has already been read by user', () => {
      const q = [10, 20, 30, 40];
      const c = [10, 20, 30, 40];
      const res = service.calculateQuantizedCosineSimilarity(
        q,
        c,
        64,
        0.75,
        true,
        8,  // candidateRevealChapter = 8
        10  // userCurrentChapter = 10
      );

      expect(res.isMatch).toBe(true);
      expect(res.isSpoilerShielded).toBe(false);
    });

    it('clamps out-of-range parameters safely', () => {
      const res = service.calculateQuantizedCosineSimilarity(
        [1, 2, 3],
        [1, 2, 3],
        10,  // dim < 16 -> clamped to 16
        0.05 // threshold < 0.10 -> clamped to 0.10
      );

      expect(res.effectiveDimension).toBe(3);
      expect(res.isMatch).toBe(true);
    });
  });

  describe('getProfile & setProfile', () => {
    it('returns default int8 quantized profile when not stored in database', () => {
      const profile = service.getProfile('series-vector-none');
      expect(profile.seriesId).toBe('series-vector-none');
      expect(profile.indexMode).toBe('int8_quantized');
      expect(profile.embeddingDimension).toBe(VECTOR_INDEX_PRESETS.int8_quantized.embeddingDimension);
      expect(profile.similarityThreshold).toBe(VECTOR_INDEX_PRESETS.int8_quantized.similarityThreshold);
      expect(profile.maxTopK).toBe(VECTOR_INDEX_PRESETS.int8_quantized.maxTopK);
      expect(profile.isSpoilerShieldActive).toBe(true);
      expect(profile.isEnabled).toBe(true);
      expect(profile.updatedAt).toBe(0);
    });

    it('persists and retrieves custom vector index profile', () => {
      const newProfile: VectorIndexProfile = {
        seriesId: 'hunter-x-hunter-vol-1',
        indexMode: 'exact_cosine',
        embeddingDimension: 128,
        similarityThreshold: 0.85,
        maxTopK: 10,
        isSpoilerShieldActive: false,
        isEnabled: true,
        updatedAt: 0,
      };

      const saved = service.setProfile(newProfile);
      expect(saved.seriesId).toBe('hunter-x-hunter-vol-1');
      expect(saved.indexMode).toBe('exact_cosine');
      expect(saved.embeddingDimension).toBe(128);
      expect(saved.similarityThreshold).toBe(0.85);
      expect(saved.maxTopK).toBe(10);
      expect(saved.isSpoilerShieldActive).toBe(false);
      expect(saved.updatedAt).toBeGreaterThan(0);

      const retrieved = service.getProfile('hunter-x-hunter-vol-1');
      expect(retrieved.indexMode).toBe('exact_cosine');
      expect(retrieved.embeddingDimension).toBe(128);
    });

    it('updates existing profile via upsert ON CONFLICT', () => {
      service.setProfile({
        seriesId: 'series-vec-x',
        indexMode: 'int8_quantized',
        embeddingDimension: 64,
        similarityThreshold: 0.75,
        maxTopK: 5,
        isSpoilerShieldActive: true,
        isEnabled: true,
        updatedAt: 0,
      });

      const updated = service.setProfile({
        seriesId: 'series-vec-x',
        indexMode: 'compact_scalar',
        embeddingDimension: 32,
        similarityThreshold: 0.70,
        maxTopK: 3,
        isSpoilerShieldActive: false,
        isEnabled: false,
        updatedAt: 0,
      });

      expect(updated.indexMode).toBe('compact_scalar');
      expect(updated.embeddingDimension).toBe(32);
      expect(updated.similarityThreshold).toBe(0.70);
      expect(updated.isSpoilerShieldActive).toBe(false);
      expect(updated.isEnabled).toBe(false);

      const retrieved = service.getProfile('series-vec-x');
      expect(retrieved.indexMode).toBe('compact_scalar');
      expect(retrieved.embeddingDimension).toBe(32);
      expect(retrieved.isEnabled).toBe(false);
    });
  });
});
