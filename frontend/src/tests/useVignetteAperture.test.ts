import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useVignetteAperture,
  localCalculateVignetteAperture,
} from '../reader/useVignetteAperture';

describe('useVignetteAperture Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default subtle_vignette preset and closed HUD', () => {
    const { result } = renderHook(() => useVignetteAperture('test-series-vignette'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('subtle_vignette');
    expect(result.current.innerRadius).toBe(0.45);
    expect(result.current.outerRadius).toBe(1.10);
    expect(result.current.vignetteStrength).toBe(0.40);
    expect(result.current.dofBlurFactor).toBe(0.35);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.cssGradient).toContain('radial-gradient');
  });

  it('toggles HUD on keyboard key V / v', () => {
    const { result } = renderHook(() => useVignetteAperture('test-series-vignette'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'V' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates optical parameters', () => {
    const { result } = renderHook(() => useVignetteAperture('test-series-vignette'));

    act(() => {
      result.current.selectPreset('cinematic_macro');
    });
    expect(result.current.presetName).toBe('cinematic_macro');
    expect(result.current.innerRadius).toBe(0.25);
    expect(result.current.vignetteStrength).toBe(0.70);

    act(() => {
      result.current.selectPreset('action_tunnel');
    });
    expect(result.current.presetName).toBe('action_tunnel');
    expect(result.current.innerRadius).toBe(0.15);
    expect(result.current.vignetteStrength).toBe(0.85);
  });

  it('calculates vignette falloff and DoF edge contrast accurately', () => {
    const res = localCalculateVignetteAperture(
      700,
      500,
      800,
      600,
      50,
      50,
      0.25,
      0.85,
      0.70,
      0.60,
      1.0,
      true
    );
    expect(res.normalizedDistance).toBeGreaterThan(0.25);
    expect(res.vignetteAlpha).toBeGreaterThan(0);
    expect(res.edgeContrast).toBeLessThan(1.0);
    expect(res.cssGradient).toContain('radial-gradient');
  });
});
