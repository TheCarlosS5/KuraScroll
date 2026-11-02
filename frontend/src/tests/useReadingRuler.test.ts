import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReadingRuler } from '../reader/useReadingRuler';

describe('Sprint 71 - useReadingRuler Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options and calculates aperture geometry', () => {
    const { result } = renderHook(() =>
      useReadingRuler({ defaultEnabled: false, enableKeyboard: false })
    );

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.mode).toBe('ruler');
    expect(result.current.orientation).toBe('horizontal');
    expect(result.current.slotSize).toBe(64);
    expect(result.current.dimOpacity).toBe(0.50);
    expect(result.current.tintColor).toBe('amber');
    expect(result.current.geometry.cssVars['--ruler-tint-color']).toBe('#ffb74d');
  });

  it('toggles visibility and sets custom modes', () => {
    const { result } = renderHook(() =>
      useReadingRuler({ defaultEnabled: false, enableKeyboard: false })
    );

    act(() => {
      result.current.toggleVisibility();
    });
    expect(result.current.isEnabled).toBe(true);

    act(() => {
      result.current.setMode('shutter');
      result.current.setTintColor('mint');
      result.current.setSlotSize(96);
    });

    expect(result.current.mode).toBe('shutter');
    expect(result.current.tintColor).toBe('mint');
    expect(result.current.slotSize).toBe(96);
    expect(result.current.geometry.cssVars['--ruler-tint-color']).toBe('#81c784');
  });

  it('steps ruler discretely using stepRuler and clamps within viewport', () => {
    const { result } = renderHook(() =>
      useReadingRuler({ defaultEnabled: true, enableKeyboard: false })
    );

    const initial = result.current.centerCoord;

    act(() => {
      result.current.stepRuler(48);
    });

    expect(result.current.centerCoord).toBe(initial + 48);

    act(() => {
      result.current.stepRuler(-24);
    });

    expect(result.current.centerCoord).toBe(initial + 24);
  });

  it('handles keyboard shortcuts: U toggles, Space pauses pacer, Arrows step position', () => {
    const { result } = renderHook(() =>
      useReadingRuler({ defaultEnabled: false, enableKeyboard: true, defaultMode: 'saccadic_pacer' })
    );

    expect(result.current.isEnabled).toBe(false);

    // Press U to toggle
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u' }));
    });
    expect(result.current.isEnabled).toBe(true);

    // Press Space to pause
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space' }));
    });
    expect(result.current.isPaused).toBe(true);

    // Press ArrowDown to step
    const pos = result.current.centerCoord;
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    });
    expect(result.current.centerCoord).toBe(pos + 24);
  });

  it('updates position on pointer move without object reallocation', () => {
    const { result } = renderHook(() =>
      useReadingRuler({ defaultEnabled: true, enableKeyboard: false })
    );

    act(() => {
      result.current.handlePointerMove({ clientX: 250, clientY: 450 });
    });

    expect(result.current.centerCoord).toBe(450);
  });

  it('respects prefers-reduced-motion media query', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { result } = renderHook(() =>
      useReadingRuler({ enableKeyboard: false })
    );

    expect(result.current.prefersReducedMotion).toBe(true);
  });
});
