import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChromaBleed, localCalculateChromaBleed } from '../reader/useChromaBleed';

describe('useChromaBleed Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default monochrome_bw preset and hidden HUD', () => {
    const { result } = renderHook(() => useChromaBleed('test-series'));

    expect(result.current.isVisible).toBe(false);
    expect(result.current.profile.colorMode).toBe('monochrome_bw');
    expect(result.current.profile.colorTemperatureK).toBe(6500);
    expect(result.current.profile.bleedSpreadPx).toBe(24);
    expect(result.current.profile.ambientIntensityPct).toBe(35);
    expect(result.current.profile.isEnabled).toBe(true);
    expect(result.current.result.hexColor).toBeDefined();
    expect(result.current.result.topGradient).toContain('linear-gradient');
  });

  it('toggles visibility on key Z', () => {
    const { result } = renderHook(() => useChromaBleed('test-series'));

    expect(result.current.isVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    });
    expect(result.current.isVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z' }));
    });
    expect(result.current.isVisible).toBe(false);
  });

  it('switches ambient presets correctly', () => {
    const { result } = renderHook(() => useChromaBleed('test-series'));

    act(() => {
      result.current.setPreset('night_crimson');
    });
    expect(result.current.profile.colorMode).toBe('night_crimson');
    expect(result.current.profile.colorTemperatureK).toBe(2200);
    expect(result.current.profile.bleedSpreadPx).toBe(40);

    act(() => {
      result.current.setPreset('cyberpunk_neon');
    });
    expect(result.current.profile.colorMode).toBe('cyberpunk_neon');
    expect(result.current.profile.colorTemperatureK).toBe(8000);
    expect(result.current.profile.bleedSpreadPx).toBe(48);
  });

  it('updates profile parameters dynamically', () => {
    const { result } = renderHook(() => useChromaBleed('test-series'));

    act(() => {
      result.current.updateProfile({ isEnabled: false });
    });
    expect(result.current.profile.isEnabled).toBe(false);
    expect(result.current.result.topGradient).toBe('none');
    expect(result.current.result.perimeterShadow).toBe('none');
  });

  it('localCalculateChromaBleed computes Planckian temperatures accurately', () => {
    const warm = localCalculateChromaBleed(2200, 40, 30, 1.8, 'night_crimson', true);
    expect(warm.rgbColor.r).toBe(255);
    expect(warm.rgbColor.b).toBeLessThan(warm.rgbColor.r);

    const cold = localCalculateChromaBleed(8000, 48, 60, 1.5, 'cyberpunk_neon', true);
    expect(cold.rgbColor.b).toBe(255);
    expect(cold.rgbColor.r).toBeLessThan(cold.rgbColor.b);
  });
});
