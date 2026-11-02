import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSfxOverlay, SfxPageAnnotation } from '../reader/useSfxOverlay';

describe('Sprint 67 - useSfxOverlay Hook Tests', () => {
  const mockAnnotations: SfxPageAnnotation[] = [
    {
      id: 1,
      chapterId: 'ch_jojo_1',
      pageNumber: 3,
      sfxId: 101,
      normX: 0.15,
      normY: 0.25,
      normW: 0.20,
      normH: 0.30,
      rotationDeg: -12,
      isVertical: false,
      sfx: {
        id: 101,
        surface: 'ゴゴゴ',
        normalizedSurface: 'ゴゴゴ',
        languageCode: 'ja',
        category: 'GITAGO',
        romanization: 'Gogogo',
        meaningEs: 'Presencia amenazante',
        meaningEn: 'Menacing presence',
        translationEs: '¡RUMBLE!',
        translationEn: '¡MENACING!',
        stylePreset: 'ROUGH_DISPLAY',
        intensity: 0.9,
      },
      displayTranslation: '¡RUMBLE!',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default settings and provided annotations', () => {
    const { result } = renderHook(() =>
      useSfxOverlay({ initialAnnotations: mockAnnotations, enableKeyboard: false })
    );

    expect(result.current.isVisible).toBe(true);
    expect(result.current.mode).toBe('TRANSLATED_OVERLAY');
    expect(result.current.targetLanguage).toBe('es');
    expect(result.current.annotations.length).toBe(1);
    expect(result.current.selectedAnnotation).toBeNull();
  });

  it('toggles visibility when toggleVisibility is invoked', () => {
    const { result } = renderHook(() =>
      useSfxOverlay({ enableKeyboard: false })
    );

    act(() => {
      result.current.toggleVisibility();
    });
    expect(result.current.isVisible).toBe(false);

    act(() => {
      result.current.toggleVisibility();
    });
    expect(result.current.isVisible).toBe(true);
  });

  it('updates display mode and target language', () => {
    const { result } = renderHook(() =>
      useSfxOverlay({ enableKeyboard: false })
    );

    act(() => {
      result.current.setMode('INTERACTIVE_TOOLTIP');
      result.current.setTargetLanguage('en');
    });

    expect(result.current.mode).toBe('INTERACTIVE_TOOLTIP');
    expect(result.current.targetLanguage).toBe('en');
  });

  it('detects point tap inside annotation bounding box', () => {
    const { result } = renderHook(() =>
      useSfxOverlay({ initialAnnotations: mockAnnotations, enableKeyboard: false })
    );

    let hit: SfxPageAnnotation | null = null;
    act(() => {
      hit = result.current.handlePagePointTap(0.20, 0.35);
    });

    expect(hit).not.toBeNull();
    expect(result.current.selectedAnnotation).toEqual(mockAnnotations[0]);

    // Tap outside
    let miss: SfxPageAnnotation | null = null;
    act(() => {
      miss = result.current.handlePagePointTap(0.85, 0.85);
    });

    expect(miss).toBeNull();
    expect(result.current.selectedAnnotation).toBeNull();
  });
});
