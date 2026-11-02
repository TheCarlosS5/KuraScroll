import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTileInvalidator, localCalculateTileInvalidation } from '../reader/useTileInvalidator';

describe('useTileInvalidator Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default profile and hidden HUD', () => {
    const { result } = renderHook(() => useTileInvalidator('test-series'));

    expect(result.current.isVisible).toBe(false);
    expect(result.current.profile.maxHeapMb).toBe(128.0);
    expect(result.current.profile.isAutoGcEnabled).toBe(true);
    expect(result.current.evaluationResult.activeCount).toBe(0);
  });

  it('toggles visibility on key T', () => {
    const { result } = renderHook(() => useTileInvalidator('test-series'));

    expect(result.current.isVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }));
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'T' }));
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('switches presets correctly', () => {
    const { result } = renderHook(() => useTileInvalidator('test-series'));

    act(() => {
      result.current.setPreset('ultra_low_ram');
    });
    expect(result.current.profile.maxHeapMb).toBe(64.0);
    expect(result.current.profile.viewportMarginPx).toBe(300.0);

    act(() => {
      result.current.setPreset('aggressive_prefetch');
    });
    expect(result.current.profile.maxHeapMb).toBe(200.0);
  });

  it('updates profile parameters', () => {
    const { result } = renderHook(() => useTileInvalidator('test-series'));

    act(() => {
      result.current.updateProfile({ isAutoGcEnabled: false, maxHeapMb: 96.0 });
    });
    expect(result.current.profile.isAutoGcEnabled).toBe(false);
    expect(result.current.profile.maxHeapMb).toBe(96.0);
  });

  it('executes triggerPurge and removes evictable tiles', () => {
    const initialTiles = [
      {
        id: 'tile-center',
        x: 400,
        y: 300,
        width: 256,
        height: 256,
        sizeBytes: 150000,
        lastAccessedEpochMs: Date.now(),
      },
      {
        id: 'tile-far',
        x: 0,
        y: 9000,
        width: 256,
        height: 256,
        sizeBytes: 150000,
        lastAccessedEpochMs: Date.now() - 50000,
      },
    ];

    const { result } = renderHook(() => useTileInvalidator('test-series', initialTiles));

    expect(result.current.tiles.length).toBe(2);
    act(() => {
      result.current.triggerPurge();
    });
    expect(result.current.tiles.length).toBe(1);
    expect(result.current.tiles[0].id).toBe('tile-center');
  });
});
