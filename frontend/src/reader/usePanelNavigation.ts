/**
 * KuraScroll Sprint 55: Panel-to-Panel Guided Navigation Hook
 * Zero-CLS, keyboard shortcuts (Z, N, P, Esc), and hardware-accelerated transform matrix
 */

import { useState, useCallback, useEffect } from 'react';

export interface PanelBox {
  id: string;
  chapterId: string;
  pageNumber: number;
  panelIndex: number;
  x: number; // 0.0 .. 100.0%
  y: number; // 0.0 .. 100.0%
  w: number; // 0.0 .. 100.0%
  h: number; // 0.0 .. 100.0%
  aspectRatio: number;
  readingOrder: number;
}

export interface UsePanelNavigationOptions {
  panels: PanelBox[];
  onPanelChange?: (panel: PanelBox | null) => void;
  enabled?: boolean;
}

export function usePanelNavigation({
  panels = [],
  onPanelChange,
  enabled = true
}: UsePanelNavigationOptions) {
  const [isZoomed, setIsZoomed] = useState(false);
  const [activePanelIndex, setActivePanelIndex] = useState(0);

  const activePanel = isZoomed && panels.length > 0 && activePanelIndex < panels.length
    ? panels[activePanelIndex]
    : null;

  const toggleZoom = useCallback(() => {
    if (!enabled || panels.length === 0) return;
    setIsZoomed(prev => {
      const next = !prev;
      if (!next) {
        onPanelChange?.(null);
      } else {
        onPanelChange?.(panels[activePanelIndex] || panels[0]);
      }
      return next;
    });
  }, [enabled, panels, activePanelIndex, onPanelChange]);

  const nextPanel = useCallback(() => {
    if (!enabled || panels.length === 0) return;
    setIsZoomed(true);
    setActivePanelIndex(prev => {
      const nextIdx = Math.min(prev + 1, panels.length - 1);
      onPanelChange?.(panels[nextIdx]);
      return nextIdx;
    });
  }, [enabled, panels, onPanelChange]);

  const prevPanel = useCallback(() => {
    if (!enabled || panels.length === 0) return;
    setIsZoomed(true);
    setActivePanelIndex(prev => {
      const prevIdx = Math.max(prev - 1, 0);
      onPanelChange?.(panels[prevIdx]);
      return prevIdx;
    });
  }, [enabled, panels, onPanelChange]);

  const resetZoom = useCallback(() => {
    setIsZoomed(false);
    onPanelChange?.(null);
  }, [onPanelChange]);

  // Global keyboard shortcuts
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        toggleZoom();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        nextPanel();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        prevPanel();
      } else if (e.key === 'Escape') {
        if (isZoomed) {
          e.preventDefault();
          resetZoom();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, toggleZoom, nextPanel, prevPanel, resetZoom, isZoomed]);

  return {
    isZoomed,
    activePanelIndex,
    activePanel,
    totalPanels: panels.length,
    toggleZoom,
    nextPanel,
    prevPanel,
    resetZoom
  };
}
