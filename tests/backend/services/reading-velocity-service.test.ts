import { describe, it, expect, beforeEach } from 'vitest';
import { ReadingVelocityService } from '../../../src/backend/services/reading-velocity-service';

describe('Sprint 32: ReadingVelocityService & EMA Smoother', () => {
  let velocityService: ReadingVelocityService;

  beforeEach(() => {
    velocityService = new ReadingVelocityService();
  });

  describe('Outlier Rejection Filter (Zero-Allocation)', () => {
    it('rejects page turns under 1.5 seconds (skimming or flipping)', () => {
      const acceptedZero = velocityService.recordSample('user_1', 'solo-leveling', 0);
      const acceptedRapid = velocityService.recordSample('user_1', 'solo-leveling', 1.2);
      const acceptedNegative = velocityService.recordSample('user_1', 'solo-leveling', -5.0);
      const acceptedNaN = velocityService.recordSample('user_1', 'solo-leveling', Number.NaN);

      expect(acceptedZero).toBe(false);
      expect(acceptedRapid).toBe(false);
      expect(acceptedNegative).toBe(false);
      expect(acceptedNaN).toBe(false);

      const stats = velocityService.getStats('user_1', 'solo-leveling');
      expect(stats.samplesCount).toBe(0);
      expect(stats.secondsPerPage).toBe(35); // Default fallback
    });

    it('rejects page turns over 300 seconds (idle or left tab open)', () => {
      const acceptedIdle = velocityService.recordSample('user_1', 'solo-leveling', 301.0);
      const acceptedExtreme = velocityService.recordSample('user_1', 'solo-leveling', 3600.0);

      expect(acceptedIdle).toBe(false);
      expect(acceptedExtreme).toBe(false);

      const stats = velocityService.getStats('user_1', 'solo-leveling');
      expect(stats.samplesCount).toBe(0);
    });

    it('accepts valid page turns between 1.5s and 300s', () => {
      const accepted = velocityService.recordSample('user_1', 'solo-leveling', 25.0);
      expect(accepted).toBe(true);

      const stats = velocityService.getStats('user_1', 'solo-leveling');
      expect(stats.samplesCount).toBe(1);
      expect(stats.secondsPerPage).toBe(25);
    });
  });

  describe('EMA Smoothing Formula & Confidence Upgrades', () => {
    it('smooths consecutive samples using alpha = 0.25', () => {
      // First sample: 20s -> EMA = 20s
      velocityService.recordSample('user_1', 'solo-leveling', 20.0);
      let stats = velocityService.getStats('user_1', 'solo-leveling');
      expect(stats.secondsPerPage).toBe(20.0);

      // Second sample: 40s -> EMA = 0.25 * 40 + 0.75 * 20 = 10 + 15 = 25s
      velocityService.recordSample('user_1', 'solo-leveling', 40.0);
      stats = velocityService.getStats('user_1', 'solo-leveling');
      expect(stats.secondsPerPage).toBe(25.0);
      expect(stats.pagesPerMinute).toBe(2.4); // 60 / 25 = 2.4 ppm
    });

    it('upgrades confidence from provisional to stable to expert as samples increase', () => {
      // 1 sample -> provisional
      velocityService.recordSample('user_1', 'solo-leveling', 30.0);
      expect(velocityService.getStats('user_1').confidence).toBe('provisional');

      // 5 samples -> stable
      for (let i = 0; i < 4; i++) {
        velocityService.recordSample('user_1', 'solo-leveling', 30.0);
      }
      expect(velocityService.getStats('user_1').confidence).toBe('stable');

      // 25 samples -> expert
      for (let i = 0; i < 20; i++) {
        velocityService.recordSample('user_1', 'solo-leveling', 30.0);
      }
      expect(velocityService.getStats('user_1').confidence).toBe('expert');
    });

    it('calculates remaining reading time based on unread page counts', () => {
      // 30 seconds per page
      velocityService.recordSample('user_1', 'solo-leveling', 30.0);
      // 40 remaining pages * 30s = 1200s = 20 minutes
      const remainingMinutes = velocityService.estimateRemainingTimeMinutes('user_1', 'solo-leveling', 40);
      expect(remainingMinutes).toBe(20);
    });
  });
});
