/**
 * KuraScroll Adaptive Panel Dynamic Cropping & Smart Margin Trimming Hook
 * Sprint 84 - SmartCrop Engine
 *
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, solid #18181b, 0 CLS).
 * Features client-side zero-allocation bounding box resolution,
 * aspect-ratio locking, margin savings telemetry, and keyboard shortcut 'K'.
 */

import { useState, useCallback, useEffect } from 'react';

export type SmartCropMode = 'conservative' | 'aggressive' | 'dialogue_safe';

export interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseSmartCropOptions {
  defaultEnabled?: boolean;
  defaultMode?: SmartCropMode;
  defaultMarginThreshold?: number;
  defaultAspectRatioLock?: boolean;
  defaultTargetAspectRatio?: number;
  defaultPaddingPx?: number;
  enableKeyboard?: boolean;
}

export const CROP_MODE_LABELS: Record<SmartCropMode, { name: string; description: string }> = {
  dialogue_safe: {
    name: 'Seguro para Diálogos',
    description: 'Protege bocadillos de texto y onomatopeyas periféricas con padding extra.',
  },
  conservative: {
    name: 'Conservador (24px)',
    description: 'Conserva márgenes amplios para no cortar notas ni numeración exterior.',
  },
  aggressive: {
    name: 'Agresivo (Borde Estricto)',
    description: 'Elimina todo el blanco sobrante para maximizar la lectura en pantallas pequeñas.',
  },
};

export function useSmartCrop({
  defaultEnabled = true,
  defaultMode = 'dialogue_safe',
  defaultMarginThreshold = 0.96,
  defaultAspectRatioLock = false,
  defaultTargetAspectRatio = 0.70,
  defaultPaddingPx = 12,
  enableKeyboard = true,
}: UseSmartCropOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultEnabled);
  const [mode, setModeState] = useState<SmartCropMode>(defaultMode);
  const [marginThreshold, setMarginThresholdState] = useState<number>(defaultMarginThreshold);
  const [aspectRatioLock, setAspectRatioLockState] = useState<boolean>(defaultAspectRatioLock);
  const [targetAspectRatio, setTargetAspectRatioState] = useState<number>(defaultTargetAspectRatio);
  const [paddingPx, setPaddingPxState] = useState<number>(defaultPaddingPx);

  const [cropBox, setCropBox] = useState<CropBox | null>(null);
  const [marginSavedPct, setMarginSavedPct] = useState<number>(0);
  const [isCropped, setIsCropped] = useState<boolean>(false);

  const openHUD = useCallback(() => setIsOpen(true), []);
  const closeHUD = useCallback(() => setIsOpen(false), []);
  const toggleHUD = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleEnabled = useCallback(() => setIsEnabled((prev) => !prev), []);
  const toggleAspectRatioLock = useCallback(() => setAspectRatioLockState((prev) => !prev), []);

  const setMode = useCallback((m: SmartCropMode) => {
    if (m === 'conservative' || m === 'aggressive' || m === 'dialogue_safe') {
      setModeState(m);
    }
  }, []);

  const setMarginThreshold = useCallback((val: number) => {
    const clamped = Math.min(0.99, Math.max(0.80, Math.round(val * 100) / 100));
    setMarginThresholdState(clamped);
  }, []);

  const setTargetAspectRatio = useCallback((val: number) => {
    const clamped = Math.min(2.0, Math.max(0.40, Math.round(val * 100) / 100));
    setTargetAspectRatioState(clamped);
  }, []);

  const setPaddingPx = useCallback((val: number) => {
    const clamped = Math.min(64, Math.max(0, Math.round(val)));
    setPaddingPxState(clamped);
  }, []);

  const resetCrop = useCallback(() => {
    setCropBox(null);
    setMarginSavedPct(0);
    setIsCropped(false);
  }, []);

  /**
   * Applies client-side dynamic crop calculation (Zero server I/O, zero network delay).
   */
  const applyCrop = useCallback(
    (pageWidth: number, pageHeight: number, contentBounds: ContentBounds) => {
      if (!isEnabled) {
        resetCrop();
        return;
      }

      const pWidth = Math.max(1, pageWidth);
      const pHeight = Math.max(1, pageHeight);

      const minXNorm = Math.min(contentBounds.minX, contentBounds.maxX);
      const maxXNorm = Math.max(contentBounds.minX, contentBounds.maxX);
      const minYNorm = Math.min(contentBounds.minY, contentBounds.maxY);
      const maxYNorm = Math.max(contentBounds.minY, contentBounds.maxY);

      if (maxXNorm - minXNorm <= 0.02 || maxYNorm - minYNorm <= 0.02) {
        setCropBox({ x: 0, y: 0, width: pWidth, height: pHeight });
        setMarginSavedPct(0);
        setIsCropped(false);
        return;
      }

      let extraPadding = paddingPx;
      if (mode === 'conservative') extraPadding += 24;
      else if (mode === 'aggressive') extraPadding += 4;
      else extraPadding += 14;

      const absMinX = minXNorm * pWidth;
      const absMinY = minYNorm * pHeight;
      const absMaxX = maxXNorm * pWidth;
      const absMaxY = maxYNorm * pHeight;

      let x = Math.max(0, absMinX - extraPadding);
      let y = Math.max(0, absMinY - extraPadding);
      let w = Math.min(pWidth - x, (absMaxX + extraPadding) - x);
      let h = Math.min(pHeight - y, (absMaxY + extraPadding) - y);

      if (aspectRatioLock && targetAspectRatio > 0) {
        const currentRatio = w / h;
        if (currentRatio > targetAspectRatio) {
          const desiredH = w / targetAspectRatio;
          if (desiredH <= pHeight) {
            const heightDelta = desiredH - h;
            y = Math.max(0, Math.min(pHeight - desiredH, y - heightDelta * 0.5));
            h = desiredH;
          } else {
            h = pHeight;
            y = 0;
            w = h * targetAspectRatio;
            x = Math.max(0, Math.min(pWidth - w, (absMinX + absMaxX - w) * 0.5));
          }
        } else {
          const desiredW = h * targetAspectRatio;
          if (desiredW <= pWidth) {
            const widthDelta = desiredW - w;
            x = Math.max(0, Math.min(pWidth - desiredW, x - widthDelta * 0.5));
            w = desiredW;
          } else {
            w = pWidth;
            x = 0;
            h = w / targetAspectRatio;
            y = Math.max(0, Math.min(pHeight - h, (absMinY + absMaxY - h) * 0.5));
          }
        }
      }

      const originalArea = pWidth * pHeight;
      const cropArea = w * h;
      const savedPct = originalArea > 0 ? Math.max(0, Math.round((1.0 - (cropArea / originalArea)) * 1000) / 10) : 0;
      const cropped = w < pWidth * 0.98 || h < pHeight * 0.98;

      setCropBox({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(w),
        height: Math.round(h),
      });
      setMarginSavedPct(savedPct);
      setIsCropped(cropped);
    },
    [isEnabled, paddingPx, mode, aspectRatioLock, targetAspectRatio, resetCrop]
  );

  // Keyboard shortcut 'K' toggle (avoids collision with 'C' Chapter Drawer)
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'k' || e.key === 'K') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          toggleHUD();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, toggleHUD]);

  return {
    isOpen,
    isEnabled,
    mode,
    marginThreshold,
    aspectRatioLock,
    targetAspectRatio,
    paddingPx,
    cropBox,
    marginSavedPct,
    isCropped,
    openHUD,
    closeHUD,
    toggleHUD,
    toggleEnabled,
    toggleAspectRatioLock,
    setMode,
    setMarginThreshold,
    setTargetAspectRatio,
    setPaddingPx,
    applyCrop,
    resetCrop,
  };
}
