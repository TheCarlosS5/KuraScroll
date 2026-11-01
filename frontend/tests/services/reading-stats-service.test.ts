import { describe, it, expect, beforeEach } from 'vitest';
import { ReadingStatsTracker } from '../../src/services/reading-stats-service';

describe('ReadingStatsTracker Suite', () => {
  let tracker: ReadingStatsTracker;

  beforeEach(() => {
    tracker = new ReadingStatsTracker(20);
  });

  it('initializes with configured default seconds per page', () => {
    expect(tracker.getAverageSecondsPerPage()).toBe(20);
  });

  it('estimates chapter remaining time based on default pace before user data', () => {
    // 10 pages remaining at 20s/page = 200s = ~4 minutes
    const estimate = tracker.estimateRemainingChapterTime(10, 20);
    expect(estimate.pagesRemaining).toBe(10);
    expect(estimate.avgSecondsPerPage).toBe(20);
    expect(estimate.estimatedMinutesRemaining).toBe(4);
    expect(estimate.formattedRemaining).toContain('min restantes');
  });

  it('updates pace dynamically as pages are recorded', () => {
    tracker.recordPageAdvance();
    expect(tracker.getAverageSecondsPerPage()).toBeGreaterThan(0);

    const summary = tracker.getSessionSummary();
    expect(summary.pagesReadCount).toBe(1);
    expect(summary.avgSpeed).toContain('s / pág');
  });

  it('reports "Completado" when current page equals or exceeds total pages', () => {
    const estimate = tracker.estimateRemainingChapterTime(30, 30);
    expect(estimate.pagesRemaining).toBe(0);
    expect(estimate.estimatedMinutesRemaining).toBe(0);
    expect(estimate.formattedRemaining).toBe('Completado');
  });

  it('formats under 60 seconds remaining as seconds text', () => {
    const fastTracker = new ReadingStatsTracker(5);
    // 5 pages remaining * 5s = 25s
    const estimate = fastTracker.estimateRemainingChapterTime(15, 20);
    expect(estimate.formattedRemaining).toContain('seg restantes');
  });
});
