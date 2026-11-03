import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useMoireSuppressor,
  localCalculateMoireSuppression,
} from '../reader/useMoireSuppressor';

describe('useMoireSuppressor Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default manga_screentone_soften preset and closed HUD', () => {
    const { result } = renderHook(() => useMoireSuppressor('test-series-ms'));

    expect(result.current.isHUDOpen).toBe(false);
    expect(result.current.presetName).toBe('manga_screentone_soften');
    expect(result.current.suppressionStrength).toBe(0.45);
    expect(result.current.deltaClamp).toBe(16.0);
    expect(result.current.edgeThreshold).toBe(32.0);
    expect(result.current.filterRadius).toBe(2);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.currentResult.filteredLuminance).toBeDefined();
  });

  it('toggles HUD on keyboard key M / m', () => {
    const { result } = renderHook(() => useMoireSuppressor('test-series-ms'));

    expect(result.current.isHUDOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    });
    expect(result.current.isHUDOpen).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'M' }));
    });
    expect(result.current.isHUDOpen).toBe(false);
  });

  it('switches preset profiles and updates suppression parameters', () => {
    const { result } = renderHook(() => useMoireSuppressor('test-series-ms'));

    act(() => {
      result.current.selectPreset('dense_crosshatch_calm');
    });
    expect(result.current.presetName).toBe('dense_crosshatch_calm');
    expect(result.current.suppressionStrength).toBe(0.20);
    expect(result.current.deltaClamp).toBe(8.0);
    expect(result.current.edgeThreshold).toBe(40.0);

    act(() => {
      result.current.selectPreset('newsprint_despeckle');
    });
    expect(result.current.presetName).toBe('newsprint_despeckle');
    expect(result.current.suppressionStrength).toBe(0.60);
    expect(result.current.deltaClamp).toBe(24.0);
  });

  it('evaluates moire suppression and enforces edge barrier', () => {
    // Normal screentone
    const resNormal = localCalculateMoireSuppression(110, 150, 0, 0, 0.7, 0.45, 16.0, 32.0, true);
    expect(resNormal.isEdgeProtected).toBe(false);
    expect(resNormal.filteredLuminance).toBeGreaterThan(110);

    // Sharp ink edge (dLdx = 40 >= 32.0)
    const resEdge = localCalculateMoireSuppression(30, 150, 40, 0, 0.7, 0.45, 16.0, 32.0, true);
    expect(resEdge.isEdgeProtected).toBe(true);
    expect(resEdge.filteredLuminance).toBe(30);
    expect(resEdge.appliedDelta).toBe(0);
  });
});
