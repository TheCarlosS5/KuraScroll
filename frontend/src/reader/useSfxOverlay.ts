/**
 * KuraScroll Dynamic SFX & Onomatopoeia Overlay Hook
 * Sprint 67 - Non-Destructive Manga & Webtoon Translation Layer
 *
 * Provides reactive SFX overlay management, keyboard shortcut ('S'),
 * display modes (TRANSLATED_OVERLAY, INTERACTIVE_TOOLTIP, ORIGINAL_ONLY),
 * and zero-allocation spatial hit testing.
 * Optimized for Intel GMA 4500MHD: 0 CSS blur, 0 backdrop-filter, CLS = 0.
 */

import { useState, useCallback, useEffect } from 'react';

export type SfxMode = 'TRANSLATED_OVERLAY' | 'INTERACTIVE_TOOLTIP' | 'ORIGINAL_ONLY';
export type SfxTargetLanguage = 'es' | 'en';

export interface SfxCatalogEntry {
  id: number;
  surface: string;
  normalizedSurface: string;
  languageCode: 'ja' | 'ko';
  category: string;
  romanization: string;
  meaningEs: string;
  meaningEn: string;
  translationEs: string;
  translationEn: string;
  stylePreset: string;
  intensity: number;
}

export interface SfxPageAnnotation {
  id: number;
  chapterId: string;
  pageNumber: number;
  sfxId: number;
  normX: number;
  normY: number;
  normW: number;
  normH: number;
  rotationDeg: number;
  isVertical: boolean;
  sfx?: SfxCatalogEntry;
  displayTranslation?: string;
}

export interface UseSfxOverlayOptions {
  chapterId?: string;
  pageNumber?: number;
  initialMode?: SfxMode;
  initialLanguage?: SfxTargetLanguage;
  initialAnnotations?: SfxPageAnnotation[];
  enableKeyboard?: boolean;
}

export interface UseSfxOverlayResult {
  isVisible: boolean;
  mode: SfxMode;
  targetLanguage: SfxTargetLanguage;
  annotations: SfxPageAnnotation[];
  selectedAnnotation: SfxPageAnnotation | null;
  toggleVisibility: () => void;
  setMode: (mode: SfxMode) => void;
  setTargetLanguage: (lang: SfxTargetLanguage) => void;
  selectAnnotation: (annotation: SfxPageAnnotation | null) => void;
  handlePagePointTap: (normX: number, normY: number) => SfxPageAnnotation | null;
  setAnnotations: (items: SfxPageAnnotation[]) => void;
}

export function useSfxOverlay(options: UseSfxOverlayOptions = {}): UseSfxOverlayResult {
  const {
    chapterId,
    pageNumber,
    initialMode = 'TRANSLATED_OVERLAY',
    initialLanguage = 'es',
    initialAnnotations = [],
    enableKeyboard = true,
  } = options;

  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [mode, setMode] = useState<SfxMode>(initialMode);
  const [targetLanguage, setTargetLanguage] = useState<SfxTargetLanguage>(initialLanguage);
  const [annotations, setAnnotations] = useState<SfxPageAnnotation[]>(initialAnnotations);
  const [selectedAnnotation, setSelectedAnnotation] = useState<SfxPageAnnotation | null>(null);

  const toggleVisibility = useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  const selectAnnotation = useCallback((annotation: SfxPageAnnotation | null) => {
    setSelectedAnnotation(annotation);
  }, []);

  const handlePagePointTap = useCallback(
    (normX: number, normY: number): SfxPageAnnotation | null => {
      for (let i = 0; i < annotations.length; i++) {
        const a = annotations[i];
        if (
          normX >= a.normX &&
          normX <= a.normX + a.normW &&
          normY >= a.normY &&
          normY <= a.normY + a.normH
        ) {
          setSelectedAnnotation(a);
          return a;
        }
      }
      setSelectedAnnotation(null);
      return null;
    },
    [annotations]
  );

  // Keyboard shortcut listener for 'S' key
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        toggleVisibility();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, toggleVisibility]);

  return {
    isVisible,
    mode,
    targetLanguage,
    annotations,
    selectedAnnotation,
    toggleVisibility,
    setMode,
    setTargetLanguage,
    selectAnnotation,
    handlePagePointTap,
    setAnnotations,
  };
}
