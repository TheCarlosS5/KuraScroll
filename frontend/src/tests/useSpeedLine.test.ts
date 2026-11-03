import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useSpeedLine,
  localCalculateSpeedLines,
  localEvaluateImpactPulse,
} from '../reader/useSpeedLine';

describe('useSpeedLine Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default shonen_radial_climax preset and closed HUD', () => {
    const { result } = renderHook(() => useSpeedLine('test-series-sl'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('shonen_radial_climax');
    expect(result.current.mode).toBe('radial');
    expect(result.current.lineCount).toBe(72);
    expect(result.current.focusX).toBe(0.50);
    expect(result.current.focusY).toBe(0.50);
    expect(result.current.angleJitter).toBe(0.035);
    expect(result.current.minLengthRatio).toBe(0.25);
    expect(result.current.maxLengthRatio).toBe(0.95);
    expect(result.current.minWidthPx).toBe(0.70);
    expect(result.current.maxWidthPx).toBe(2.00);
    expect(result.current.pulseDurationMs).toBe(320);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.buffer.count).toBe(72);
  });

  it('toggles HUD on keyboard key L / l', () => {
    const { result } = renderHook(() => useSpeedLine('test-series-sl'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'L' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates parameters', () => {
    const { result } = renderHook(() => useSpeedLine('test-series-sl'));

    act(() => {
      result.current.selectPreset('dash_horizontal');
    });
    expect(result.current.presetName).toBe('dash_horizontal');
    expect(result.current.mode).toBe('parallel');
    expect(result.current.lineCount).toBe(36);

    act(() => {
      result.current.selectPreset('explosion_burst');
    });
    expect(result.current.presetName).toBe('explosion_burst');
    expect(result.current.mode).toBe('radial');
    expect(result.current.lineCount).toBe(96);
  });

  it('evaluates impact pulse kinetics and triggers pulse', () => {
    const { result } = renderHook(() => useSpeedLine('test-series-sl'));

    expect(result.current.pulseOutput.isActive).toBe(false);

    act(() => {
      result.current.triggerPulse();
    });

    expect(result.current.pulseOutput.isActive).toBe(true);
  });
});
