import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  ChapterTransitionService,
  DEFAULT_TRANSITION_PROFILE,
  CANONICAL_TRANSITION_PRESETS,
} from '../../../../src/backend/services/chapter-transition-service.js';

describe('ChapterTransitionService Unit Tests (Sprint 79)', () => {
  let db: DatabaseInstance;
  let service: ChapterTransitionService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new ChapterTransitionService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Profile Persistence & Hierarchy', () => {
    it('returns default fallback profile when no record exists', () => {
      const profile = service.getProfile('series-default', 'chap-1');
      expect(profile.seriesId).toBe('series-default');
      expect(profile.transitionStyle).toBe('curtain');
      expect(profile.prebakeTriggerPageOffset).toBe(3);
      expect(profile.autoAdvanceDelayMs).toBe(1500);
      expect(profile.showReadingSummary).toBe(true);
      expect(profile.isEnabled).toBe(true);
    });

    it('upserts and retrieves series-level and chapter-level transition profiles', () => {
      // 1. Series-level profile
      service.upsertProfile({
        seriesId: 'chainsaw-man',
        transitionStyle: 'infinite_scroll',
        prebakeTriggerPageOffset: 4,
        autoAdvanceDelayMs: 0,
        showReadingSummary: false,
        isEnabled: true,
      });

      const seriesProfile = service.getProfile('chainsaw-man');
      expect(seriesProfile.transitionStyle).toBe('infinite_scroll');
      expect(seriesProfile.prebakeTriggerPageOffset).toBe(4);

      // Chapter lookup should inherit series profile
      const chapInherit = service.getProfile('chainsaw-man', 'chap-5');
      expect(chapInherit.transitionStyle).toBe('infinite_scroll');

      // 2. Override at Chapter-level
      service.upsertProfile({
        seriesId: 'chainsaw-man',
        fromChapterId: 'chap-5',
        toChapterId: 'chap-6',
        transitionStyle: 'curtain',
        prebakeTriggerPageOffset: 2,
        autoAdvanceDelayMs: 2000,
        showReadingSummary: true,
        isEnabled: true,
      });

      const chapOverride = service.getProfile('chainsaw-man', 'chap-5');
      expect(chapOverride.transitionStyle).toBe('curtain');
      expect(chapOverride.toChapterId).toBe('chap-6');
      expect(chapOverride.autoAdvanceDelayMs).toBe(2000);

      // Other chapter still gets series default
      const otherChap = service.getProfile('chainsaw-man', 'chap-6');
      expect(otherChap.transitionStyle).toBe('infinite_scroll');
    });

    it('clamps out-of-range profile values properly', () => {
      const saved = service.upsertProfile({
        seriesId: 'clamped-series',
        prebakeTriggerPageOffset: 20, // max 5
        autoAdvanceDelayMs: 20000, // max 5000
        transitionStyle: 'invalid_style' as any, // falls back to curtain
        isEnabled: true,
      });

      expect(saved.prebakeTriggerPageOffset).toBe(5);
      expect(saved.autoAdvanceDelayMs).toBe(5000);
      expect(saved.transitionStyle).toBe('curtain');
    });
  });

  describe('resolveTransitionState Parameter Resolution', () => {
    it('triggers shouldPrebake true when within prebake page offset window', () => {
      const result = ChapterTransitionService.resolveTransitionState({
        currentPage: 18,
        totalPages: 20,
        nextChapterId: 'chap-next',
        nextChapterTitle: 'El Regreso del Héroe',
        nextChapterNumber: 2,
        profile: {
          prebakeTriggerPageOffset: 3,
        },
      });

      expect(result.shouldPrebake).toBe(true);
      expect(result.showCurtain).toBe(false);
      expect(result.nextChapterId).toBe('chap-next');
      expect(result.isLastChapter).toBe(false);
    });

    it('does not trigger shouldPrebake when early in the chapter', () => {
      const result = ChapterTransitionService.resolveTransitionState({
        currentPage: 5,
        totalPages: 20,
        nextChapterId: 'chap-next',
        profile: {
          prebakeTriggerPageOffset: 3,
        },
      });

      expect(result.shouldPrebake).toBe(false);
      expect(result.showCurtain).toBe(false);
    });

    it('activates showCurtain on the final page or beyond', () => {
      const result = ChapterTransitionService.resolveTransitionState({
        currentPage: 20,
        totalPages: 20,
        nextChapterId: 'chap-next',
        nextChapterTitle: 'Capítulo 2',
      });

      expect(result.showCurtain).toBe(true);
      expect(result.shouldPrebake).toBe(true);
    });

    it('detects last chapter correctly when nextChapterId is null', () => {
      const result = ChapterTransitionService.resolveTransitionState({
        currentPage: 20,
        totalPages: 20,
        nextChapterId: null,
      });

      expect(result.isLastChapter).toBe(true);
      expect(result.shouldPrebake).toBe(false);
      expect(result.showCurtain).toBe(true);
    });

    it('executes resolveTransitionState within SLA 43 bounds (< 20µs)', () => {
      const start = performance.now();
      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        ChapterTransitionService.resolveTransitionState({
          currentPage: 19,
          totalPages: 20,
          nextChapterId: 'chap-10',
          nextChapterTitle: 'Climax Battle',
          nextChapterNumber: 10,
        });
      }
      const elapsedMs = performance.now() - start;
      const avgUs = (elapsedMs / iterations) * 1000;

      expect(avgUs).toBeLessThan(20.0);
    });
  });
});
