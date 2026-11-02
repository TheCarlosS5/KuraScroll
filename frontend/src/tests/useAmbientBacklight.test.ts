import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAmbientBacklight, calculateCircadianKelvin } from '../reader/useAmbientBacklight';

describe('Sprint 80 - useAmbientBacklight Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options', () => {
    const { result } = renderHook(() =>
      useAmbientBacklight({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.kelvin).toBe(6500);
    expect(result.current.luminance).toBe(1.0);
    expect(result.current.blueLightReduction).toBe(0.0);
    expect(result.current.paperTintMode).toBe('neutral');
    expect(result.current.circadianAuto).toBe(false);
    expect(result.current.renderMode).toBe('css-solid-glow');
  });

  it('controls HUD visibility correctly', () => {
    const { result } = renderHook(() =>
      useAmbientBacklight({ enableKeyboard: false })
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

  it('updates Kelvin, luminance, and blue light reduction with clamping', () => {
    const { result } = renderHook(() =>
      useAmbientBacklight({ enableKeyboard: false })
    );

    act(() => {
      result.current.setKelvin(1200); // Clamped to 1800
    });
    expect(result.current.kelvin).toBe(1800);
    expect(result.current.paperTintMode).toBe('custom');

    act(() => {
      result.current.setKelvin(9000); // Clamped to 6500
    });
    expect(result.current.kelvin).toBe(6500);

    act(() => {
      result.current.setLuminance(2.5); // Clamped to 1.5
    });
    expect(result.current.luminance).toBe(1.5);

    act(() => {
      result.current.setBlueLightReduction(1.2); // Clamped to 0.8
    });
    expect(result.current.blueLightReduction).toBe(0.8);
  });

  it('applies presets correctly', () => {
    const { result } = renderHook(() =>
      useAmbientBacklight({ enableKeyboard: false })
    );

    act(() => {
      result.current.applyPreset('sunset');
    });

    expect(result.current.paperTintMode).toBe('sunset');
    expect(result.current.kelvin).toBe(3200);
    expect(result.current.luminance).toBe(0.9);
    expect(result.current.blueLightReduction).toBe(0.45);
    expect(result.current.circadianAuto).toBe(false);

    act(() => {
      result.current.applyPreset('candlelight');
    });
    expect(result.current.kelvin).toBe(2200);
    expect(result.current.paperTintMode).toBe('candlelight');
  });

  it('calculates circadian temperatures and switches to auto mode', () => {
    const { result } = renderHook(() =>
      useAmbientBacklight({ enableKeyboard: false })
    );

    act(() => {
      result.current.setCircadianAuto(true);
    });

    expect(result.current.circadianAuto).toBe(true);
    expect(result.current.kelvin).toBeGreaterThanOrEqual(1800);
    expect(result.current.kelvin).toBeLessThanOrEqual(6500);
  });

  it('toggles filter enabled and calculates CSS filters', () => {
    const { result } = renderHook(() =>
      useAmbientBacklight({ enableKeyboard: false })
    );

    expect(result.current.cssFilter).toContain('brightness(');

    act(() => {
      result.current.toggleEnabled();
    });

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.cssFilter).toBe('none');
  });
});
