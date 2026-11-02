import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageBevel, localCalculatePageBevel } from '../reader/usePageBevel';

describe('usePageBevel Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default tankobon_silk_110um preset and hidden HUD', () => {
    const { result } = renderHook(() => usePageBevel('test-series', 1, 200));

    expect(result.current.isVisible).toBe(false);
    expect(result.current.profile.paperCaliperMode).toBe('tankobon_silk_110um');
    expect(result.current.profile.maxStackThicknessPx).toBe(24);
    expect(result.current.profile.readingDirection).toBe('rtl');
    expect(result.current.profile.isEnabled).toBe(true);
    expect(result.current.result.leftThicknessPx).toBe(0);
    expect(result.current.result.rightThicknessPx).toBe(24);
  });

  it('toggles visibility on key W', () => {
    const { result } = renderHook(() => usePageBevel('test-series'));

    expect(result.current.isVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'W' }));
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('switches paper caliper presets correctly', () => {
    const { result } = renderHook(() => usePageBevel('test-series'));

    act(() => {
      result.current.setPreset('omnibus_coated_130um');
    });
    expect(result.current.profile.paperCaliperMode).toBe('omnibus_coated_130um');
    expect(result.current.profile.maxStackThicknessPx).toBe(36);
    expect(result.current.profile.pageCaliperUm).toBe(130.0);

    act(() => {
      result.current.setPreset('newsprint_65um');
    });
    expect(result.current.profile.paperCaliperMode).toBe('newsprint_65um');
    expect(result.current.profile.maxStackThicknessPx).toBe(18);
    expect(result.current.profile.pageCaliperUm).toBe(65.0);
  });

  it('updates page numbers and recalculates stack thickness dynamically', () => {
    const { result } = renderHook(() => usePageBevel('test-series', 1, 200));

    act(() => {
      result.current.setCurrentPage(100);
    });
    expect(result.current.result.leftThicknessPx).toBeGreaterThan(0);
    expect(result.current.result.rightThicknessPx).toBeGreaterThan(0);
    expect(result.current.result.progressRatio).toBeCloseTo(0.5, 1);
  });

  it('localCalculatePageBevel simulates RTL kinematics accurately', () => {
    // At page 1 of 200 in RTL: left stack is 0, right stack is max
    const startRes = localCalculatePageBevel(1, 200, 'rtl', 24, 35, 40, true);
    expect(startRes.leftThicknessPx).toBe(0);
    expect(startRes.rightThicknessPx).toBe(24);
    expect(startRes.leftPagesCount).toBe(0);
    expect(startRes.rightPagesCount).toBe(199);

    // At page 200 of 200 in RTL: left stack is max, right stack is 0
    const endRes = localCalculatePageBevel(200, 200, 'rtl', 24, 35, 40, true);
    expect(endRes.leftThicknessPx).toBe(24);
    expect(endRes.rightThicknessPx).toBe(0);
    expect(endRes.leftPagesCount).toBe(199);
    expect(endRes.rightPagesCount).toBe(0);
  });
});
