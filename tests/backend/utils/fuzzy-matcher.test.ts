import { describe, it, expect } from 'vitest';
import {
  normalizeTitle,
  normalizeChapterNumber,
  jaroSimilarity,
  jaroWinklerSimilarity,
  tokenDiceSimilarity,
  compositeSimilarity
} from '../../../src/backend/utils/fuzzy-matcher.js';

describe('KuraScroll Fuzzy Matcher & Normalization Unit Tests', () => {
  describe('normalizeTitle', () => {
    it('strips scanlation tags, resolution flags, and extra spaces', () => {
      const raw = '[Asura Scans] Solo Leveling (Webtoon) [1080p]';
      expect(normalizeTitle(raw)).toBe('solo leveling');
    });

    it('strips macrons and diacritical marks via NFKD decomposition', () => {
      const raw = 'Tōkyō Revengers (Official) [HD]';
      expect(normalizeTitle(raw)).toBe('tokyo revengers');
    });

    it('normalizes multiplication signs and interpuncts', () => {
      const raw = 'SPY×FAMILY [Digital Colored]';
      expect(normalizeTitle(raw)).toBe('spy family');
    });

    it('normalizes colons and dashes without mangling letters', () => {
      const raw = 'Re:Zero - Starting Life in Another World';
      expect(normalizeTitle(raw)).toBe('re zero starting life in another world');
    });

    it('handles empty or null-like string cleanly', () => {
      expect(normalizeTitle('')).toBe('');
    });
  });

  describe('normalizeChapterNumber', () => {
    it('normalizes integers and string integers', () => {
      expect(normalizeChapterNumber(1)).toBe('1');
      expect(normalizeChapterNumber('01')).toBe('1');
      expect(normalizeChapterNumber('Ch. 05')).toBe('5');
      expect(normalizeChapterNumber('Capítulo 12')).toBe('12');
    });

    it('normalizes decimal and fractional chapter numbers', () => {
      expect(normalizeChapterNumber('10.5')).toBe('10.5');
      expect(normalizeChapterNumber('10-5')).toBe('10.5');
      expect(normalizeChapterNumber('Ch. 10.50')).toBe('10.5');
      expect(normalizeChapterNumber('Cap 10_1')).toBe('10.1');
    });

    it('handles fallback for invalid inputs', () => {
      expect(normalizeChapterNumber('')).toBe('0');
      expect(normalizeChapterNumber('extra')).toBe('0');
    });
  });

  describe('jaroSimilarity & jaroWinklerSimilarity', () => {
    it('returns 1.0 for identical strings', () => {
      expect(jaroSimilarity('berserk', 'berserk')).toBe(1.0);
      expect(jaroWinklerSimilarity('berserk', 'berserk')).toBe(1.0);
    });

    it('returns 0.0 for completely disjoint strings', () => {
      expect(jaroSimilarity('abc', 'xyz')).toBe(0.0);
      expect(jaroWinklerSimilarity('abc', 'xyz')).toBe(0.0);
    });

    it('rewards common prefixes in Jaro-Winkler', () => {
      const jaro = jaroSimilarity('mushoku', 'mushoki');
      const jw = jaroWinklerSimilarity('mushoku', 'mushoki');
      expect(jw).toBeGreaterThanOrEqual(jaro);
    });
  });

  describe('tokenDiceSimilarity & compositeSimilarity', () => {
    it('detects high overlap even with word order rearrangement', () => {
      const dice = tokenDiceSimilarity('hunter x hunter', 'hunter hunter x');
      expect(dice).toBe(1.0);
    });

    it('computes composite similarity score for near duplicate titles', () => {
      const result = compositeSimilarity('Solo Leveling [Asura]', 'Solo Leveling (Official)');
      expect(result.score).toBe(1.0);
    });

    it('accurately identifies partial duplicates', () => {
      const result = compositeSimilarity('Tokyo Revengers', 'Toukyou Revengers');
      expect(result.score).toBeGreaterThan(0.85);
    });

    it('distinguishes distinct series sharing common words', () => {
      const result = compositeSimilarity('Fairy Tail', 'Fairy Tail 100 Years Quest');
      expect(result.score).toBeLessThan(0.85);
    });
  });
});
