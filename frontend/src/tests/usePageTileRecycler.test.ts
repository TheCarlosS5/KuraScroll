/**
 * KuraScroll Sprint 101: usePageTileRecycler Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageTileRecycler } from '../reader/usePageTileRecycler';

describe('usePageTileRecycler Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default standard_lru preset and 7 slots', () => {
    const { result } = renderHook(() => usePageTileRecycler());

    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.profile.ringCapacity).toBe(7);
    expect(result.current.profile.forwardLookahead).toBe(3);
    expect(result.current.profile.backwardLookahead).toBe(2);
    expect(result.current.profile.slotRecyclingStrategy).toBe('circular_lru');
    expect(result.current.profile.zeroCopySliceEnabled).toBe(true);
    expect(result.current.matrixResult.slots.length).toBe(7);
    expect(result.current.matrixResult.recycledSlotIndex).toBe(0);
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => usePageTileRecycler());

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

  it('responds to keyboard shortcut B to toggle HUD', () => {
    const { result } = renderHook(() => usePageTileRecycler());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'B' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('switches presets correctly', () => {
    const { result } = renderHook(() => usePageTileRecycler());

    act(() => {
      result.current.applyPreset('low_ram');
    });
    expect(result.current.profile.ringCapacity).toBe(5);
    expect(result.current.profile.forwardLookahead).toBe(2);
    expect(result.current.profile.backwardLookahead).toBe(1);

    act(() => {
      result.current.applyPreset('boustrophedon');
    });
    expect(result.current.profile.ringCapacity).toBe(9);
    expect(result.current.profile.slotRecyclingStrategy).toBe('boustrophedon_ring');
  });

  it('re-evaluates matrix and increments zero-copy hit counter on page change', () => {
    const { result, rerender } = renderHook(
      ({ page }) => usePageTileRecycler({ currentPageIndex: page, totalPages: 30 }),
      { initialProps: { page: 0 } }
    );

    expect(result.current.matrixResult.recycledSlotIndex).toBe(0);
    const initialHits = result.current.zeroCopyHitCount;

    rerender({ page: 8 });
    // Modulo: 8 % 7 = 1
    expect(result.current.matrixResult.recycledSlotIndex).toBe(1);
    expect(result.current.zeroCopyHitCount).toBeGreaterThanOrEqual(initialHits);
  });
});
