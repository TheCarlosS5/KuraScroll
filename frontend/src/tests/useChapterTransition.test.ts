import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChapterTransition } from '../reader/useChapterTransition';

describe('Sprint 79 - useChapterTransition Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default options', () => {
    const { result } = renderHook(() =>
      useChapterTransition({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.transitionStyle).toBe('curtain');
    expect(result.current.prebakeTriggerPageOffset).toBe(3);
    expect(result.current.autoAdvanceDelayMs).toBe(1500);
    expect(result.current.showReadingSummary).toBe(true);
    expect(result.current.isCurtainVisible).toBe(false);
  });

  it('controls HUD visibility correctly', () => {
    const { result } = renderHook(() =>
      useChapterTransition({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.openHUD();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeHUD();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggleHUD();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it('triggers curtain and advances automatically after delay', () => {
    const onAdvance = vi.fn();
    const { result } = renderHook(() =>
      useChapterTransition({
        enableKeyboard: false,
        defaultDelayMs: 1000,
        onAdvance,
      })
    );

    act(() => {
      result.current.triggerCurtain({
        id: 'chap-next',
        title: 'El Despertar',
        chapterNumber: 2,
        estimatedReadMinutes: 4,
      });
    });

    expect(result.current.isCurtainVisible).toBe(true);
    expect(result.current.nextChapter?.title).toBe('El Despertar');

    // Advance timers past delay
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(onAdvance).toHaveBeenCalledWith('chap-next');
    expect(result.current.isCurtainVisible).toBe(false);
  });

  it('advances immediately when advanceImmediately is called', () => {
    const onAdvance = vi.fn();
    const { result } = renderHook(() =>
      useChapterTransition({
        enableKeyboard: false,
        defaultDelayMs: 3000,
        onAdvance,
      })
    );

    act(() => {
      result.current.triggerCurtain({
        id: 'chap-10',
        title: 'Climax',
        chapterNumber: 10,
      });
    });

    expect(result.current.isCurtainVisible).toBe(true);

    act(() => {
      result.current.advanceImmediately();
    });

    expect(onAdvance).toHaveBeenCalledWith('chap-10');
    expect(result.current.isCurtainVisible).toBe(false);
  });

  it('resets to defaults cleanly', () => {
    const { result } = renderHook(() =>
      useChapterTransition({ enableKeyboard: false })
    );

    act(() => {
      result.current.setTransitionStyle('infinite_scroll');
      result.current.setPrebakeTriggerPageOffset(5);
      result.current.setAutoAdvanceDelayMs(3000);
      result.current.toggleEnabled();
    });

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.transitionStyle).toBe('infinite_scroll');

    act(() => {
      result.current.resetToDefaults();
    });

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.transitionStyle).toBe('curtain');
    expect(result.current.prebakeTriggerPageOffset).toBe(3);
  });

  it('responds to keyboard shortcut C to toggle HUD when curtain is closed', () => {
    const { result } = renderHook(() =>
      useChapterTransition({ enableKeyboard: true })
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'C' }));
    });
    expect(result.current.isOpen).toBe(false);
  });
});
