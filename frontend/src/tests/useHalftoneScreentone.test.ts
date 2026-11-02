import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHalftoneScreentone } from '../reader/useHalftoneScreentone';

describe('Sprint 77 - useHalftoneScreentone Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options', () => {
    const { result } = renderHook(() =>
      useHalftoneScreentone({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.presetName).toBe('pristine');
    expect(result.current.dotPitchLpi).toBe(60);
    expect(result.current.dotAngleDeg).toBe(45.0);
    expect(result.current.dotIntensity).toBe(0.0);
    expect(result.current.paperAgePct).toBe(0.0);
    expect(result.current.foxingIntensity).toBe(0.0);
  });

  it('controls HUD visibility correctly', () => {
    const { result } = renderHook(() =>
      useHalftoneScreentone({ enableKeyboard: false })
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

  it('switches presets and updates parameter values accurately', () => {
    const { result } = renderHook(() =>
      useHalftoneScreentone({ enableKeyboard: false })
    );

    act(() => {
      result.current.selectPreset('shonen_90s');
    });

    expect(result.current.presetName).toBe('shonen_90s');
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.dotPitchLpi).toBe(60);
    expect(result.current.dotIntensity).toBe(0.35);
    expect(result.current.paperAgePct).toBe(0.20);

    act(() => {
      result.current.selectPreset('pulp_press');
    });

    expect(result.current.presetName).toBe('pulp_press');
    expect(result.current.dotPitchLpi).toBe(45);
    expect(result.current.dotIntensity).toBe(0.55);
    expect(result.current.paperAgePct).toBe(0.50);
  });

  it('switches to custom when individual sliders are adjusted', () => {
    const { result } = renderHook(() =>
      useHalftoneScreentone({ enableKeyboard: false, defaultPreset: 'tankobon_retro' })
    );

    expect(result.current.presetName).toBe('tankobon_retro');

    act(() => {
      result.current.setDotPitchLpi(110);
    });

    expect(result.current.presetName).toBe('custom');
    expect(result.current.dotPitchLpi).toBe(110);

    act(() => {
      result.current.setDotIntensity(0.80);
    });
    expect(result.current.dotIntensity).toBe(0.80);

    act(() => {
      result.current.setPaperAgePct(0.65);
    });
    expect(result.current.paperAgePct).toBe(0.65);
  });

  it('resets to pristine defaults', () => {
    const { result } = renderHook(() =>
      useHalftoneScreentone({ enableKeyboard: false, defaultPreset: 'pulp_press' })
    );

    expect(result.current.presetName).toBe('pulp_press');

    act(() => {
      result.current.resetToDefaults();
    });

    expect(result.current.presetName).toBe('pristine');
    expect(result.current.isEnabled).toBe(false);
  });

  it('responds to keyboard shortcut H to toggle HUD', () => {
    const { result } = renderHook(() =>
      useHalftoneScreentone({ enableKeyboard: true })
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'H' }));
    });
    expect(result.current.isOpen).toBe(false);
  });
});
