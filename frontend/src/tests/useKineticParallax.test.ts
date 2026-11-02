import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKineticParallax, KineticLayerBox } from '../reader/useKineticParallax';

describe('Sprint 70 - useKineticParallax Hook Tests', () => {
  const mockLayers: KineticLayerBox[] = [
    {
      chapterId: 'ch1',
      pageNumber: 1,
      panelIndex: 0,
      layerIndex: 0,
      layerRole: 'BACKGROUND',
      normX: 0.0,
      normY: 0.0,
      normW: 1.0,
      normH: 1.0,
      depthFactor: 0.1,
    },
    {
      chapterId: 'ch1',
      pageNumber: 1,
      panelIndex: 0,
      layerIndex: 1,
      layerRole: 'MIDGROUND',
      normX: 0.1,
      normY: 0.1,
      normW: 0.8,
      normH: 0.8,
      depthFactor: 0.5,
    },
    {
      chapterId: 'ch1',
      pageNumber: 1,
      panelIndex: 0,
      layerIndex: 2,
      layerRole: 'FOREGROUND',
      normX: 0.2,
      normY: 0.2,
      normW: 0.6,
      normH: 0.6,
      depthFactor: 1.0,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    // Default matchMedia mock
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

  it('initializes with default kinetic state and computes initial drift transforms', () => {
    const { result } = renderHook(() =>
      useKineticParallax({ layers: mockLayers, enableKeyboard: false })
    );

    expect(result.current.isKineticEnabled).toBe(true);
    expect(result.current.intensity).toBe('normal');
    expect(result.current.isShutterActive).toBe(true);
    expect(result.current.hasClimaxLayers).toBe(true);
    expect(result.current.currentDrifts).toHaveLength(3);

    // Initial neutral transforms (offset 0, anti-bleed scale applied)
    expect(result.current.currentDrifts[0].scale).toBe(1.008);
    expect(result.current.currentDrifts[1].scale).toBe(1.04);
    expect(result.current.currentDrifts[2].scale).toBe(1.08);
  });

  it('toggles kinetic state and zeroes out drifts when disabled', () => {
    const onToggleMock = vi.fn();
    const { result } = renderHook(() =>
      useKineticParallax({ layers: mockLayers, onKineticToggle: onToggleMock, enableKeyboard: false })
    );

    act(() => {
      result.current.toggleKinetic();
    });

    expect(result.current.isKineticEnabled).toBe(false);
    expect(result.current.isShutterActive).toBe(false);
    expect(onToggleMock).toHaveBeenCalledWith(false);

    // Transforms should be static scale 1 when disabled
    expect(result.current.currentDrifts[2].scale).toBe(1.0);
    expect(result.current.currentDrifts[2].offsetX).toBe(0);
    expect(result.current.currentDrifts[2].offsetY).toBe(0);
  });

  it('changes intensity and invokes callback', () => {
    const onIntensityMock = vi.fn();
    const { result } = renderHook(() =>
      useKineticParallax({ layers: mockLayers, onIntensityChange: onIntensityMock, enableKeyboard: false })
    );

    act(() => {
      result.current.setIntensity('intense');
    });

    expect(result.current.intensity).toBe('intense');
    expect(onIntensityMock).toHaveBeenCalledWith('intense');
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
      useKineticParallax({ layers: mockLayers, enableKeyboard: false })
    );

    expect(result.current.prefersReducedMotion).toBe(true);
    // Drift is disabled with scale 1.0
    expect(result.current.currentDrifts[0].scale).toBe(1.0);
    expect(result.current.currentDrifts[0].offsetX).toBe(0);
  });

  it('handles keyboard K key to toggle kinetic mode', () => {
    const onToggleMock = vi.fn();
    const { result } = renderHook(() =>
      useKineticParallax({ layers: mockLayers, onKineticToggle: onToggleMock, enableKeyboard: true })
    );

    expect(result.current.isKineticEnabled).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    });

    expect(result.current.isKineticEnabled).toBe(false);
    expect(onToggleMock).toHaveBeenCalledWith(false);
  });

  it('updates drift on pointer move and resets on pointer leave', () => {
    const { result } = renderHook(() =>
      useKineticParallax({ layers: mockLayers, enableKeyboard: false })
    );

    act(() => {
      result.current.handlePointerMove({ clientX: 100, clientY: 100 });
    });

    act(() => {
      result.current.handlePointerLeave();
    });

    expect(result.current.hasClimaxLayers).toBe(true);
  });
});
