import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePaperLighting,
  localCalculatePaperLighting,
} from '../reader/usePaperLighting';

describe('usePaperLighting Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default tankobon_deluxe_matte preset and closed HUD', () => {
    const { result } = renderHook(() => usePaperLighting('test-series-lighting'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('tankobon_deluxe_matte');
    expect(result.current.lightX).toBe(0.50);
    expect(result.current.lightY).toBe(0.30);
    expect(result.current.lightZ).toBe(1.20);
    expect(result.current.diffuseKd).toBe(0.85);
    expect(result.current.specularKs).toBe(0.12);
    expect(result.current.roughness).toBe(0.45);
    expect(result.current.inkAbsorption).toBe(0.85);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.outR).toBeDefined();
  });

  it('toggles HUD on keyboard key Shift + L', () => {
    const { result } = renderHook(() => usePaperLighting('test-series-lighting'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'L', shiftKey: true }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'l', shiftKey: true }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates lighting parameters', () => {
    const { result } = renderHook(() => usePaperLighting('test-series-lighting'));

    act(() => {
      result.current.applyPreset('doujinshi_satin');
    });
    expect(result.current.presetName).toBe('doujinshi_satin');
    expect(result.current.specularKs).toBe(0.22);
    expect(result.current.roughness).toBe(0.25);

    act(() => {
      result.current.applyPreset('shonen_pulp_newsprint');
    });
    expect(result.current.presetName).toBe('shonen_pulp_newsprint');
    expect(result.current.specularKs).toBe(0.05);
    expect(result.current.inkAbsorption).toBe(0.92);
  });

  it('computes realistic specular sheen on white paper and suppresses on ink', () => {
    const whiteRes = localCalculatePaperLighting(
      0.50,
      0.30,
      255,
      255,
      255,
      0.50,
      0.30,
      1.20,
      0.85,
      0.12,
      0.45,
      0.85,
      0.20,
      true
    );
    expect(whiteRes.specularIntensity).toBeGreaterThan(0);
    expect(whiteRes.inkGuard).toBeGreaterThan(0.9);

    const inkRes = localCalculatePaperLighting(
      0.50,
      0.30,
      0,
      0,
      0,
      0.50,
      0.30,
      1.20,
      0.85,
      0.12,
      0.45,
      0.85,
      0.20,
      true
    );
    expect(inkRes.inkGuard).toBeLessThanOrEqual(0.20);
    expect(inkRes.outR).toBeLessThanOrEqual(5);
  });
});
