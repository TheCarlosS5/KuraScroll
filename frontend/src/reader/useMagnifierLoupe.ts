/**
 * KuraScroll Saccadic Glance & Panel Magnifier Loupe Hook
 * Sprint 78 - Optical Loupe & Sub-Panel Zoom Reticle
 *
 * Coordinates cursor/touch tracking, optical lens geometry,
 * and keyboard shortcut 'Z'.
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, 0 CLS).
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

export type LoupeShape = 'circle' | 'rectangle';

export interface UseMagnifierLoupeOptions {
  defaultEnabled?: boolean;
  defaultShape?: LoupeShape;
  defaultZoomFactor?: number;
  defaultLensRadiusPx?: number;
  defaultSmoothingFactor?: number;
  defaultBorderColor?: string;
  enableKeyboard?: boolean;
}

export function useMagnifierLoupe({
  defaultEnabled = true,
  defaultShape = 'circle',
  defaultZoomFactor = 2.0,
  defaultLensRadiusPx = 120,
  defaultSmoothingFactor = 0.15,
  defaultBorderColor = '#3b82f6',
  enableKeyboard = true,
}: UseMagnifierLoupeOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultEnabled);
  const [shape, setShapeState] = useState<LoupeShape>(defaultShape);
  const [zoomFactor, setZoomFactorState] = useState<number>(defaultZoomFactor);
  const [lensRadiusPx, setLensRadiusPxState] = useState<number>(defaultLensRadiusPx);
  const [smoothingFactor, setSmoothingFactorState] = useState<number>(defaultSmoothingFactor);
  const [borderColor, setBorderColorState] = useState<string>(defaultBorderColor);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const openHUD = useCallback(() => setIsOpen(true), []);
  const closeHUD = useCallback(() => setIsOpen(false), []);
  const toggleHUD = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleEnabled = useCallback(() => setIsEnabled((prev) => !prev), []);

  const setShape = useCallback((s: LoupeShape) => {
    setShapeState(s === 'rectangle' ? 'rectangle' : 'circle');
  }, []);

  const setZoomFactor = useCallback((z: number) => {
    const clamped = Math.max(1.25, Math.min(4.0, z));
    setZoomFactorState(clamped);
  }, []);

  const setLensRadiusPx = useCallback((r: number) => {
    const clamped = Math.max(60, Math.min(250, r));
    setLensRadiusPxState(clamped);
  }, []);

  const setSmoothingFactor = useCallback((sf: number) => {
    const clamped = Math.max(0.0, Math.min(0.5, sf));
    setSmoothingFactorState(clamped);
  }, []);

  const setBorderColor = useCallback((c: string) => {
    setBorderColorState(c);
  }, []);

  const updateCursorPos = useCallback((x: number, y: number) => {
    setCursorPos({ x, y });
  }, []);

  const resetToDefaults = useCallback(() => {
    setIsEnabled(true);
    setShapeState('circle');
    setZoomFactorState(2.0);
    setLensRadiusPxState(120);
    setSmoothingFactorState(0.15);
    setBorderColorState('#3b82f6');
  }, []);

  // Keyboard shortcut listener ('Z' to toggle HUD)
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, toggleHUD]);

  // Derived lens geometry style parameters (GPU compositor quads, zero-blur)
  const lensStyles = useMemo(() => {
    const lensWidth = lensRadiusPx * 2;
    const lensHeight = shape === 'circle' ? lensRadiusPx * 2 : Math.round(lensRadiusPx * 1.5);
    const borderRadius = shape === 'circle' ? '50%' : '8px';

    return {
      width: `${lensWidth}px`,
      height: `${lensHeight}px`,
      borderRadius,
      border: `2px solid ${borderColor}`,
      boxShadow: 'none', // Strict GMA 4500MHD zero-blur fill-rate protection
      pointerEvents: 'none' as const,
      position: 'absolute' as const,
      overflow: 'hidden' as const,
      zIndex: 50,
    };
  }, [lensRadiusPx, shape, borderColor]);

  return {
    isOpen,
    openHUD,
    closeHUD,
    toggleHUD,
    isEnabled,
    toggleEnabled,
    shape,
    setShape,
    zoomFactor,
    setZoomFactor,
    lensRadiusPx,
    setLensRadiusPx,
    smoothingFactor,
    setSmoothingFactor,
    borderColor,
    setBorderColor,
    cursorPos,
    updateCursorPos,
    resetToDefaults,
    lensStyles,
  };
}
