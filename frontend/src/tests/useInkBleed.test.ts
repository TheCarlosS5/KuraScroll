/**
 * KuraScroll Sprint 103: useInkBleed Hook Tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInkBleed } from '../reader/useInkBleed';

describe('useInkBleed Hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default vintage_newsprint preset and proper parameters', () => {
    const { result } = renderHook(() => useInkBleed());

    expect(result.current.isHUDVisible).toBe(false);
    expect(result.current.profile.compensationMode).toBe('vintage_newsprint');
    expect(result.current.profile.blackPointLift).toBe(0.08);
    expect(result.current.profile.whitePointCompression).toBe(0.95);
    expect(result.current.profile.gammaExponent).toBe(1.15);
    expect(result.current.profile.isEnabled).toBe(true);
    expect(result.current.result.contrastMultiplier).toBe(87);
    expect(result.current.result.cssFilterString).toContain('contrast');
  });

  it('toggles HUD visibility', () => {
    const { result } = renderHook(() => useInkBleed());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      result.current.toggleHUD();
    });
    expect(result.current.isHUDVisible).toBe(true);
    act(() => {
      result.current.setIsHUDVisible(false);
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('responds to keyboard shortcut I to toggle HUD', () => {
    const { result } = renderHook(() => useInkBleed());

    expect(result.current.isHUDVisible).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i' }));
    });
    expect(result.current.isHUDVisible).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'I' }));
    });
    expect(result.current.isHUDVisible).toBe(false);
  });

  it('switches presets correctly', () => {
    const { result } = renderHook(() => useInkBleed());

    act(() => {
      result.current.applyPreset('halftone_clarity');
    });
    expect(result.current.profile.compensationMode).toBe('halftone_clarity');
    expect(result.current.profile.blackPointLift).toBe(0.12);
    expect(result.current.profile.whitePointCompression).toBe(0.92);

    act(() => {
      result.current.applyPreset('deep_black_preservation');
    });
    expect(result.current.profile.compensationMode).toBe('deep_black_preservation');
    expect(result.current.profile.blackPointLift).toBe(0.03);
  });

  it('generates none filter when disabled', () => {
    const { result } = renderHook(() => useInkBleed());

    act(() => {
      result.current.setProfile(prev => ({ ...prev, isEnabled: false }));
    });
    expect(result.current.result.cssFilterString).toBe('none');
  });
});
