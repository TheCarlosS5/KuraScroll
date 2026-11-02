/**
 * KuraScroll Sprint 98: useReadingDwell Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReadingDwell } from '../reader/useReadingDwell';

describe('useReadingDwell Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default cadence_adaptive preset and proper parameters', () => {
    const { result } = renderHook(() => useReadingDwell());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.mode).toBe('cadence_adaptive');
    expect(result.current.baseDwellMs).toBe(4500);
    expect(result.current.complexityWeight).toBe(1.25);
    expect(result.current.urgencyThresholdMs).toBe(800);
    expect(result.current.isPrefetchTriggerEnabled).toBe(true);
    expect(result.current.elapsedMs).toBe(0);
    expect(result.current.predictedTotalDwellMs).toBe(5625);
    expect(result.current.remainingDwellMs).toBe(5625);
    expect(result.current.progressPct).toBe(0);
    expect(result.current.isUrgentPrefetchTriggered).toBe(false);
    expect(result.current.dwellProgressBarColor).toBe('#38bdf8');
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useReadingDwell());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      result.current.toggleHUD();
    });
    expect(result.current.isHUDVisible).toBe(true);
    act(() => {
      result.current.setIsHUDVisible(false);
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('switches presets correctly', () => {
    const { result } = renderHook(() => useReadingDwell());

    act(() => {
      result.current.resetToPreset('action_heavy');
    });

    expect(result.current.mode).toBe('action_heavy');
    expect(result.current.baseDwellMs).toBe(2500);
    expect(result.current.complexityWeight).toBe(0.85);
    expect(result.current.urgencyThresholdMs).toBe(600);
    expect(result.current.predictedTotalDwellMs).toBe(2125);
  });

  it('triggers urgent prefetch when elapsed time crosses urgency window', () => {
    const { result } = renderHook(() => useReadingDwell());

    act(() => {
      result.current.setElapsedMs(5000); // 5625 - 5000 = 625ms <= 800ms
    });

    expect(result.current.remainingDwellMs).toBe(625);
    expect(result.current.isUrgentPrefetchTriggered).toBe(true);
    expect(result.current.dwellProgressBarColor).toBe('#10b981'); // Emerald
  });

  it('toggles HUD on "d" and "D" keydown events', () => {
    const { result } = renderHook(() => useReadingDwell());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'D' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('resets elapsed time', () => {
    const { result } = renderHook(() => useReadingDwell());

    act(() => {
      result.current.setElapsedMs(3500);
    });
    expect(result.current.elapsedMs).toBe(3500);

    act(() => {
      result.current.resetElapsedMs();
    });
    expect(result.current.elapsedMs).toBe(0);
  });
});
