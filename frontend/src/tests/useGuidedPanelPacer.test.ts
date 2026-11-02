import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useGuidedPanelPacer,
  calculateCameraFraming,
  GuidedPanelBox,
} from '../reader/useGuidedPanelPacer';

describe('Sprint 68 - useGuidedPanelPacer Hook Tests', () => {
  const mockPanels: GuidedPanelBox[] = [
    {
      chapterId: 'ch1',
      pageNumber: 1,
      panelIndex: 0,
      normX: 0.5,
      normY: 0.05,
      normW: 0.45,
      normH: 0.4,
      aspectRatio: 1.125,
      readingOrderScore: 0,
      isSplash: false,
    },
    {
      chapterId: 'ch1',
      pageNumber: 1,
      panelIndex: 1,
      normX: 0.05,
      normY: 0.05,
      normW: 0.45,
      normH: 0.4,
      aspectRatio: 1.125,
      readingOrderScore: 1,
      isSplash: false,
    },
    {
      chapterId: 'ch1',
      pageNumber: 1,
      panelIndex: 2,
      normX: 0.05,
      normY: 0.5,
      normW: 0.9,
      normH: 0.45,
      aspectRatio: 2.0,
      readingOrderScore: 2,
      isSplash: false,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() =>
      useGuidedPanelPacer({ panels: mockPanels, enableKeyboard: false })
    );

    expect(result.current.isPacingActive).toBe(false);
    expect(result.current.activePanelIndex).toBe(0);
    expect(result.current.totalPanels).toBe(3);
    expect(result.current.isAutoPlay).toBe(false);
    expect(result.current.cameraTransformStyle.transform).toBe('translate3d(0, 0, 0) scale(1)');
  });

  it('toggles pacing active mode', () => {
    const onPanelChange = vi.fn();
    const { result } = renderHook(() =>
      useGuidedPanelPacer({
        panels: mockPanels,
        enableKeyboard: false,
        onPanelChange,
      })
    );

    act(() => {
      result.current.togglePacing();
    });

    expect(result.current.isPacingActive).toBe(true);
    expect(onPanelChange).toHaveBeenCalledWith(mockPanels[0], 0);

    act(() => {
      result.current.togglePacing();
    });

    expect(result.current.isPacingActive).toBe(false);
  });

  it('navigates next and previous panels with bounds clamping', () => {
    const onPanelChange = vi.fn();
    const { result } = renderHook(() =>
      useGuidedPanelPacer({
        panels: mockPanels,
        enableKeyboard: false,
        onPanelChange,
      })
    );

    act(() => {
      result.current.setPacingActive(true);
    });

    act(() => {
      result.current.nextPanel();
    });
    expect(result.current.activePanelIndex).toBe(1);

    act(() => {
      result.current.nextPanel();
    });
    expect(result.current.activePanelIndex).toBe(2);

    // Attempting to step past last panel triggers onPageComplete
    const onPageComplete = vi.fn();
    const { result: edgeResult } = renderHook(() =>
      useGuidedPanelPacer({
        panels: mockPanels,
        enableKeyboard: false,
        onPageComplete,
      })
    );
    act(() => {
      edgeResult.current.goToPanel(2);
    });
    act(() => {
      edgeResult.current.nextPanel();
    });
    expect(onPageComplete).toHaveBeenCalledTimes(1);
    expect(edgeResult.current.activePanelIndex).toBe(2);

    // Prev panel steps back
    act(() => {
      result.current.prevPanel();
    });
    expect(result.current.activePanelIndex).toBe(1);
  });

  it('calculates camera framing transform coordinates', () => {
    const framing = calculateCameraFraming(mockPanels[0], 1920, 1080, 0.04);

    expect(framing.scale).toBeGreaterThan(1.0);
    expect(framing.isSplash).toBe(false);
    expect(typeof framing.panXPercent).toBe('number');
    expect(typeof framing.panYPercent).toBe('number');
  });

  it('handles full-page splash panels with scale 1.0 and 0 pan', () => {
    const splashPanel: GuidedPanelBox = {
      chapterId: 'ch1',
      pageNumber: 2,
      panelIndex: 0,
      normX: 0,
      normY: 0,
      normW: 1.0,
      normH: 1.0,
      aspectRatio: 1.0,
      readingOrderScore: 0,
      isSplash: true,
    };

    const framing = calculateCameraFraming(splashPanel);
    expect(framing.scale).toBe(1.0);
    expect(framing.panXPercent).toBe(0);
    expect(framing.panYPercent).toBe(0);
    expect(framing.isSplash).toBe(true);
  });

  it('runs auto-play timer and advances panels', () => {
    vi.useFakeTimers();
    const onPanelChange = vi.fn();

    const { result } = renderHook(() =>
      useGuidedPanelPacer({
        panels: mockPanels,
        enableKeyboard: false,
        autoPlayIntervalMs: 1000,
        onPanelChange,
      })
    );

    act(() => {
      result.current.setPacingActive(true);
      result.current.toggleAutoPlay();
    });

    expect(result.current.isAutoPlay).toBe(true);

    // Advance 1000ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.activePanelIndex).toBe(1);

    // Advance another 1000ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.activePanelIndex).toBe(2);

    // At the end, auto-play stops
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.isAutoPlay).toBe(false);

    vi.useRealTimers();
  });

  it('responds to keyboard events', () => {
    const { result } = renderHook(() =>
      useGuidedPanelPacer({ panels: mockPanels, enableKeyboard: true })
    );

    // 'p' key toggles pacing
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    });
    expect(result.current.isPacingActive).toBe(true);

    // Space key advances to next panel
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    });
    expect(result.current.activePanelIndex).toBe(1);

    // 'a' key toggles auto-play
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    expect(result.current.isAutoPlay).toBe(true);

    // Escape exits pacing
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.isPacingActive).toBe(false);
    expect(result.current.isAutoPlay).toBe(false);
  });
});
