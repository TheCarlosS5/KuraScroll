import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextureAtlas, localCalculateTextureAtlasPlacement } from '../reader/useTextureAtlas';

describe('useTextureAtlas Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default conservative GMA 4500MHD preset and hidden HUD', () => {
    const { result } = renderHook(() => useTextureAtlas('test-series'));

    expect(result.current.isVisible).toBe(false);
    expect(result.current.profile.packingStrategy).toBe('guillotine_bssf');
    expect(result.current.profile.atlasMaxDimension).toBe(2048);
    expect(result.current.profile.tilePaddingPx).toBe(4);
    expect(result.current.profile.vramBudgetMb).toBe(32);
    expect(result.current.profile.isEnabled).toBe(true);
    expect(result.current.sampleResult.atlasIndex).toBe(0);
    expect(result.current.sampleResult.u).toBe(4 / 2048);
  });

  it('toggles visibility on key A', () => {
    const { result } = renderHook(() => useTextureAtlas('test-series'));

    expect(result.current.isVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'A' }));
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('switches hardware atlas presets correctly', () => {
    const { result } = renderHook(() => useTextureAtlas('test-series'));

    act(() => {
      result.current.setPreset('hd_canvas_4096');
    });
    expect(result.current.profile.atlasMaxDimension).toBe(4096);
    expect(result.current.profile.vramBudgetMb).toBe(64);

    act(() => {
      result.current.setPreset('low_memory_1024');
    });
    expect(result.current.profile.atlasMaxDimension).toBe(1024);
    expect(result.current.profile.vramBudgetMb).toBe(16);
    expect(result.current.profile.tilePaddingPx).toBe(2);
  });

  it('updates profile parameters dynamically', () => {
    const { result } = renderHook(() => useTextureAtlas('test-series'));

    act(() => {
      result.current.updateProfile({ isEnabled: false });
    });
    expect(result.current.profile.isEnabled).toBe(false);
    expect(result.current.sampleResult.u).toBe(0);
  });

  it('localCalculateTextureAtlasPlacement calculates UV coordinates accurately', () => {
    const r = localCalculateTextureAtlasPlacement('t-test', 256, 256, 0, 2048, 4, 2, 32, 'guillotine_bssf', true);
    expect(r.w).toBe(256);
    expect(r.paddedW).toBe(264);
    expect(r.u).toBe(4 / 2048);
    expect(r.v).toBe(4 / 2048);
    expect(r.vramUsageMb).toBeLessThanOrEqual(32);
  });
});
