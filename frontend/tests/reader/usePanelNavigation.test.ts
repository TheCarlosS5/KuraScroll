import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePanelNavigation, PanelBox } from '../../src/reader/usePanelNavigation';

describe('Sprint 55: usePanelNavigation Hook Suite', () => {
  const mockPanels: PanelBox[] = [
    { id: 'p1', chapterId: 'ch1', pageNumber: 1, panelIndex: 0, x: 50, y: 0, w: 50, h: 40, aspectRatio: 1.25, readingOrder: 0 },
    { id: 'p2', chapterId: 'ch1', pageNumber: 1, panelIndex: 1, x: 0, y: 0, w: 50, h: 40, aspectRatio: 1.25, readingOrder: 1 },
    { id: 'p3', chapterId: 'ch1', pageNumber: 1, panelIndex: 2, x: 0, y: 45, w: 100, h: 55, aspectRatio: 1.81, readingOrder: 2 }
  ];

  it('initializes with unzoomed state and first panel index', () => {
    const { result } = renderHook(() =>
      usePanelNavigation({ panels: mockPanels })
    );

    expect(result.current.isZoomed).toBe(false);
    expect(result.current.activePanelIndex).toBe(0);
    expect(result.current.activePanel).toBeNull();
    expect(result.current.totalPanels).toBe(3);
  });

  it('toggles zoom and focuses on active panel', () => {
    const onPanelChange = vi.fn();
    const { result } = renderHook(() =>
      usePanelNavigation({ panels: mockPanels, onPanelChange })
    );

    act(() => {
      result.current.toggleZoom();
    });

    expect(result.current.isZoomed).toBe(true);
    expect(result.current.activePanel?.id).toBe('p1');
    expect(onPanelChange).toHaveBeenCalledWith(mockPanels[0]);

    act(() => {
      result.current.toggleZoom();
    });

    expect(result.current.isZoomed).toBe(false);
    expect(result.current.activePanel).toBeNull();
    expect(onPanelChange).toHaveBeenCalledWith(null);
  });

  it('navigates next and prev panels clamping at bounds', () => {
    const { result } = renderHook(() =>
      usePanelNavigation({ panels: mockPanels })
    );

    act(() => {
      result.current.nextPanel();
    });

    expect(result.current.isZoomed).toBe(true);
    expect(result.current.activePanelIndex).toBe(1);
    expect(result.current.activePanel?.id).toBe('p2');

    act(() => {
      result.current.nextPanel();
    });
    expect(result.current.activePanelIndex).toBe(2);

    // Clamps at end
    act(() => {
      result.current.nextPanel();
    });
    expect(result.current.activePanelIndex).toBe(2);

    // Moves back
    act(() => {
      result.current.prevPanel();
    });
    expect(result.current.activePanelIndex).toBe(1);
  });

  it('responds to global keyboard shortcuts Z, N, P, and Escape', () => {
    const { result } = renderHook(() =>
      usePanelNavigation({ panels: mockPanels })
    );

    // Press 'Z'
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z' }));
    });
    expect(result.current.isZoomed).toBe(true);

    // Press 'N'
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    });
    expect(result.current.activePanelIndex).toBe(1);

    // Press 'P'
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    });
    expect(result.current.activePanelIndex).toBe(0);

    // Press 'Escape'
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.isZoomed).toBe(false);
  });
});
