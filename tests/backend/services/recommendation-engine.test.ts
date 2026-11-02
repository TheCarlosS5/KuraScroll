import { describe, it, expect, beforeEach } from 'vitest';
import {
  RecommendationEngine,
  calculateIdfWeights,
  fastWeightedJaccard,
  formatCompatibilityScore,
  creatorSignatureScore,
  calculateAffinityScore,
  PRIMARY_GENRES,
  THEMES,
  SeriesFeatureVector,
} from '../../../src/backend/services/recommendation-engine';

describe('Sprint 32: Content-Based Filtering & Recommendation Engine', () => {
  describe('1. Taxonomy & Bitmask Foundations', () => {
    it('defines 16 canonical primary genres and 32 themes', () => {
      expect(PRIMARY_GENRES.length).toBe(16);
      expect(THEMES.length).toBe(32);
      expect(PRIMARY_GENRES).toContain('Action');
      expect(PRIMARY_GENRES).toContain('Fantasy');
      expect(THEMES).toContain('Isekai');
      expect(THEMES).toContain('Murim');
      expect(THEMES).toContain('Dungeon');
    });

    it('calculates smoothed IDF weights penalizing ubiquitous tags', () => {
      // 1000 total series: tag 0 appears 800 times (Action), tag 1 appears 20 times (Murim)
      const freqs = new Uint32Array([800, 20]);
      const weights = calculateIdfWeights(freqs, 1000);

      expect(weights[0]).toBeCloseTo(Math.log(1 + 1000 / 800), 2); // ~0.81
      expect(weights[1]).toBeCloseTo(Math.log(1 + 1000 / 20), 2);  // ~3.93
      expect(weights[1]).toBeGreaterThan(weights[0] * 3); // Niche tag is >3x more weighted
    });

    it('fastWeightedJaccard computes accurate weighted intersection and union', () => {
      const weights = new Float32Array([1.0, 2.0, 3.0, 4.0]);
      // Mask A has bit 0 and 1 (weights: 1.0 + 2.0 = 3.0)
      const maskA = (1 << 0) | (1 << 1);
      const totalA = 3.0;

      // Mask B has bit 1 and 2 (weights: 2.0 + 3.0 = 5.0)
      const maskB = (1 << 1) | (1 << 2);
      const totalB = 5.0;

      // Common bit: bit 1 (weight: 2.0)
      // Union weight: 3.0 + 5.0 - 2.0 = 6.0
      // Jaccard: 2.0 / 6.0 = 0.333
      const sim = fastWeightedJaccard(maskA, totalA, maskB, totalB, weights);
      expect(sim).toBeCloseTo(2.0 / 6.0, 3);

      // Disjoint
      expect(fastWeightedJaccard(1 << 0, 1.0, 1 << 2, 3.0, weights)).toBe(0);

      // Identical
      expect(fastWeightedJaccard(maskA, totalA, maskA, totalA, weights)).toBe(1.0);
    });
  });

  describe('2. Multi-Tier Similarity Metrics', () => {
    it('applies format compatibility scores correctly', () => {
      expect(formatCompatibilityScore('manga', 'manga')).toBe(1.0);
      expect(formatCompatibilityScore('manhwa', 'manhwa')).toBe(1.0);
      expect(formatCompatibilityScore('manhwa', 'manhua')).toBe(0.5); // Webtoon cousins
      expect(formatCompatibilityScore('manga', 'manhwa')).toBe(0.2); // Cross-format
    });

    it('computes creator signature scores with author and artist weighting', () => {
      const target = { author: 'ONE', artist: 'Yusuke Murata' };
      const sameAuthor = { author: 'ONE', artist: 'Other Artist' };
      const sameArtist = { author: 'Other Author', artist: 'Yusuke Murata' };
      const bothSame = { author: 'ONE', artist: 'Yusuke Murata' };
      const completelyDifferent = { author: 'Oda', artist: 'Oda' };

      expect(creatorSignatureScore(target, sameAuthor)).toBe(0.7);
      expect(creatorSignatureScore(target, sameArtist)).toBe(0.5);
      expect(creatorSignatureScore(target, bothSame)).toBe(1.0);
      expect(creatorSignatureScore(target, completelyDifferent)).toBe(0);
    });

    it('calculates 0-100% Affinity Score with creator boost', () => {
      const weightsG = new Float32Array(16).fill(1.0);
      const weightsT = new Float32Array(32).fill(2.0);

      const target: SeriesFeatureVector = {
        id: 's1',
        type: 'manhwa',
        author: 'Chugong',
        artist: 'DUBU',
        genreMask: (1 << 0) | (1 << 4), // Action, Fantasy
        themeMask: (1 << 5) | (1 << 6), // Dungeon, System
        totalGenreWeight: 2.0,
        totalThemeWeight: 4.0,
      };

      // Candidate 1: Another work by same author with similar tropes
      const candidateSameAuthor: SeriesFeatureVector = {
        id: 's2',
        type: 'manhwa',
        author: 'Chugong',
        artist: 'Other',
        genreMask: (1 << 0) | (1 << 4),
        themeMask: (1 << 5), // Dungeon
        totalGenreWeight: 2.0,
        totalThemeWeight: 2.0,
      };

      const score1 = calculateAffinityScore(target, candidateSameAuthor, weightsG, weightsT);
      expect(score1).toBeGreaterThanOrEqual(75);
      expect(score1).toBeLessThanOrEqual(100);

      // Target compared to itself
      expect(calculateAffinityScore(target, target, weightsG, weightsT)).toBe(100);
    });
  });

  describe('3. RecommendationEngine Indexing & Ranking', () => {
    let engine: RecommendationEngine;

    beforeEach(() => {
      engine = new RecommendationEngine();
      engine.indexCatalog([
        {
          id: 'solo-leveling',
          type: 'manhwa',
          author: 'Chugong',
          artist: 'DUBU',
          genres: ['Action', 'Fantasy', 'Dungeon', 'System', 'Leveling'],
        },
        {
          id: 'omniscient-reader',
          type: 'manhwa',
          author: 'sing N song',
          artist: 'Sleepy-C',
          genres: ['Action', 'Fantasy', 'Dungeon', 'System', 'Survival'],
        },
        {
          id: 'return-of-the-mount-hua-sect',
          type: 'manhwa',
          author: 'Biga',
          artist: 'LICO',
          genres: ['Action', 'Martial Arts', 'Murim', 'Reincarnation'],
        },
        {
          id: 'horimiya',
          type: 'manga',
          author: 'HERO',
          artist: 'Daisuke Hagiwara',
          genres: ['Romance', 'Comedy', 'School Life', 'Slice of Life'],
        },
        {
          id: 'overgeared',
          type: 'manhwa',
          author: 'Park Saenal',
          artist: 'Silverbin',
          genres: ['Action', 'Fantasy', 'Virtual Reality', 'Leveling', 'System'],
        },
      ]);
    });

    it('ranks webtoon dungeon/system series highest for Solo Leveling', () => {
      const recs = engine.getSimilarSeries('solo-leveling', 5);
      expect(recs.length).toBeGreaterThan(0);

      // Top recommendations should be fellow action/dungeon/system manhwa
      const topIds = recs.map((r) => r.id);
      expect(topIds).toContain('omniscient-reader');
      expect(topIds).toContain('overgeared');

      // Romance manga should NOT be in top similar for Solo Leveling
      expect(topIds).not.toContain('horimiya');

      // Check score ordering
      for (let i = 0; i < recs.length - 1; i++) {
        expect(recs[i].score).toBeGreaterThanOrEqual(recs[i + 1].score);
      }
    });

    it('returns empty array for unknown target series', () => {
      const recs = engine.getSimilarSeries('non-existent-id', 5);
      expect(recs).toEqual([]);
    });
  });
});
