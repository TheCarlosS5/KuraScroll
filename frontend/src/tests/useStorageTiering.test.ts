/**
 * KuraScroll Sprint 94: useStorageTiering Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStorageTiering } from '../reader/useStorageTiering';

describe('useStorageTiering Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default balanced_hybrid preset and proper bounds', () => {
    const { result } = renderHook(() => useStorageTiering());

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.mode).toBe('balanced_hybrid');
    expect(result.current.hotRetentionDays).toBe(14);
    expect(result.current.warmRetentionDays).toBe(60);
    expect(result.current.diskQuotaTargetGb).toBe(3500);
    expect(result.current.isAutoEvictionEnabled).toBe(true);
    expect(result.current.isPinned).toBe(false);
    expect(result.current.totalUsedGb).toBe(3150);
    expect(result.current.freeGb).toBe(850);
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useStorageTiering());

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
    const { result } = renderHook(() => useStorageTiering());

    act(() => {
      result.current.resetToPreset('aggressive_evict');
    });

    expect(result.current.mode).toBe('aggressive_evict');
    expect(result.current.hotRetentionDays).toBe(7);
    expect(result.current.warmRetentionDays).toBe(30);
    expect(result.current.diskQuotaTargetGb).toBe(3000);
    expect(result.current.evictionCandidateCount).toBe(42);
    expect(result.current.reclaimableGb).toBe(310);
  });

  it('protects pinned series from eviction candidates', () => {
    const { result } = renderHook(() => useStorageTiering({ initialPinned: true }));

    expect(result.current.isPinned).toBe(true);
    expect(result.current.evictionCandidateCount).toBe(0);
    expect(result.current.reclaimableGb).toBe(0);

    act(() => {
      result.current.togglePin();
    });
    expect(result.current.isPinned).toBe(false);
    expect(result.current.evictionCandidateCount).toBeGreaterThan(0);
  });

  it('toggles HUD on "v" keydown event', () => {
    const { result } = renderHook(() => useStorageTiering());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'V' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });
});
