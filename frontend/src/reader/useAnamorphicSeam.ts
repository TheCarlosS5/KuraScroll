/**
 * KuraScroll - Sprint 111: Adaptive Panel Aspect-Ratio Anamorphic Un-Squeeze & Webtoon Seam Stitcher Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Synthesizes zero-allocation subpixel seam stitching and aspect-ratio un-squeezing.
 * Bound to key 'U' / 'u' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type AspectRatioMode =
  | 'native'
  | 'anamorphic_4_3_to_16_9'
  | 'anamorphic_4_3_to_16_10'
  | 'custom_unsqueeze';

export type SubpixelSnappingMode =
  | 'cumulative_origin'
  | 'round'
  | 'floor'
  | 'ceil';

export interface AnamorphicSeamProfile {
  seriesId: string;
  aspectRatioMode: AspectRatioMode;
  unsqueezeFactor: number;
  seamOverlapPx: number;
  subpixelSnappingMode: SubpixelSnappingMode;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AnamorphicSeamResult {
  aspectRatioMode: AspectRatioMode;
  unsqueezeFactor: number;
  seamOverlapPx: number;
  subpixelSnappingMode: SubpixelSnappingMode;
  sliceIndex: number;
  rawStartY: number;
  rawEndY: number;
  rawHeight: number;
  renderedStartY: number;
  renderedEndY: number;
  renderedHeight: number;
  transformCss: string;
  marginBottomCss: string;
  latencyUs: number;
}

export interface AnamorphicSeamPreset {
  name: AspectRatioMode;
  aspectRatioMode: AspectRatioMode;
  label: string;
  unsqueezeFactor: number;
  seamOverlapPx: number;
  subpixelSnappingMode: SubpixelSnappingMode;
  description: string;
}

export const ANAMORPHIC_SEAM_PRESETS: Record<AspectRatioMode, AnamorphicSeamPreset> = {
  native: {
    name: 'native',
    aspectRatioMode: 'native',
    label: 'Native 1:1 Pixel Ratio (0.75px Anti-Tear Seam)',
    unsqueezeFactor: 1.0,
    seamOverlapPx: 0.75,
    subpixelSnappingMode: 'cumulative_origin',
    description: 'Direct 1:1 mapping with micro-overlap boundary snapping to prevent fractional pixel tearing',
  },
  anamorphic_4_3_to_16_9: {
    name: 'anamorphic_4_3_to_16_9',
    aspectRatioMode: 'anamorphic_4_3_to_16_9',
    label: 'Anamorphic 4:3 Squeeze to 16:9 Cinema Wide (1.3333x)',
    unsqueezeFactor: 1.3333,
    seamOverlapPx: 0.75,
    subpixelSnappingMode: 'cumulative_origin',
    description: 'Un-squeezes vertically compressed 4:3 legacy digital scans to standard 16:9 widescreen proportions',
  },
  anamorphic_4_3_to_16_10: {
    name: 'anamorphic_4_3_to_16_10',
    aspectRatioMode: 'anamorphic_4_3_to_16_10',
    label: 'Anamorphic 4:3 Squeeze to 16:10 Laptop Display (1.2000x)',
    unsqueezeFactor: 1.2000,
    seamOverlapPx: 0.75,
    subpixelSnappingMode: 'cumulative_origin',
    description: 'Optimized vertical un-squeeze factor for 16:10 laptop panels and older LCD monitors',
  },
  custom_unsqueeze: {
    name: 'custom_unsqueeze',
    aspectRatioMode: 'custom_unsqueeze',
    label: 'Custom User-Tuned Un-Squeeze Matrix',
    unsqueezeFactor: 1.0,
    seamOverlapPx: 0.75,
    subpixelSnappingMode: 'cumulative_origin',
    description: 'Fully manual calibration of vertical scale factor and seam overlap margin',
  },
};

export function localCalculateAnamorphicSeam(
  sliceIndex: number,
  rawStartY: number,
  rawHeight: number,
  aspectRatioMode: AspectRatioMode = 'native',
  unsqueezeFactor: number = 1.0,
  seamOverlapPx: number = 0.75,
  snappingMode: SubpixelSnappingMode = 'cumulative_origin',
  isEnabled: boolean = true
): AnamorphicSeamResult {
  const t0 = performance.now();

  const safeIndex = Math.max(0, Math.floor(sliceIndex));
  const safeRawStartY = Math.max(0, rawStartY);
  const safeRawHeight = Math.max(1, rawHeight);
  const rawEndY = safeRawStartY + safeRawHeight;

  if (!isEnabled) {
    const latencyUs = (performance.now() - t0) * 1000;
    return {
      aspectRatioMode: 'native',
      unsqueezeFactor: 1.0,
      seamOverlapPx: 0,
      subpixelSnappingMode: 'cumulative_origin',
      sliceIndex: safeIndex,
      rawStartY: safeRawStartY,
      rawEndY,
      rawHeight: safeRawHeight,
      renderedStartY: safeRawStartY,
      renderedEndY: rawEndY,
      renderedHeight: safeRawHeight,
      transformCss: 'none',
      marginBottomCss: '0px',
      latencyUs,
    };
  }

  let effectiveFactor = 1.0;
  if (aspectRatioMode === 'anamorphic_4_3_to_16_9') {
    effectiveFactor = 1.3333;
  } else if (aspectRatioMode === 'anamorphic_4_3_to_16_10') {
    effectiveFactor = 1.2000;
  } else if (aspectRatioMode === 'custom_unsqueeze') {
    effectiveFactor = Math.min(1.50, Math.max(0.70, unsqueezeFactor));
  } else {
    effectiveFactor = 1.0;
  }

  const safeOverlap = Math.min(2.0, Math.max(0.0, seamOverlapPx));

  const unscaledStartY = safeRawStartY * effectiveFactor;
  const unscaledEndY = rawEndY * effectiveFactor;

  let renderedStartY: number;
  let renderedEndY: number;

  switch (snappingMode) {
    case 'floor':
      renderedStartY = Math.floor(unscaledStartY);
      renderedEndY = Math.floor(unscaledEndY);
      break;
    case 'ceil':
      renderedStartY = Math.ceil(unscaledStartY);
      renderedEndY = Math.ceil(unscaledEndY);
      break;
    case 'round':
    case 'cumulative_origin':
    default:
      renderedStartY = Math.round(unscaledStartY);
      renderedEndY = Math.round(unscaledEndY);
      break;
  }

  const renderedHeight = Math.max(1, renderedEndY - renderedStartY);
  const transformCss = effectiveFactor === 1.0 ? 'none' : `scaleY(${effectiveFactor.toFixed(4)})`;
  const marginBottomCss = `-${safeOverlap.toFixed(2)}px`;

  const latencyUs = (performance.now() - t0) * 1000;

  return {
    aspectRatioMode,
    unsqueezeFactor: effectiveFactor,
    seamOverlapPx: safeOverlap,
    subpixelSnappingMode: snappingMode,
    sliceIndex: safeIndex,
    rawStartY: safeRawStartY,
    rawEndY,
    rawHeight: safeRawHeight,
    renderedStartY,
    renderedEndY,
    renderedHeight,
    transformCss,
    marginBottomCss,
    latencyUs,
  };
}

export function useAnamorphicSeam(seriesId: string = 'default-series') {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [profile, setProfile] = useState<AnamorphicSeamProfile>({
    seriesId,
    ...ANAMORPHIC_SEAM_PRESETS.native,
    isEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Keyboard shortcut 'U' / 'u' (Un-Squeeze & Seam HUD)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === 'u' || e.key === 'U') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          setIsVisible((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const calculateSlice = useCallback(
    (sliceIndex: number, rawStartY: number, rawHeight: number): AnamorphicSeamResult => {
      return localCalculateAnamorphicSeam(
        sliceIndex,
        rawStartY,
        rawHeight,
        profile.aspectRatioMode,
        profile.unsqueezeFactor,
        profile.seamOverlapPx,
        profile.subpixelSnappingMode,
        profile.isEnabled
      );
    },
    [profile]
  );

  const sampleResult = useMemo(() => {
    return calculateSlice(0, 0, 1200);
  }, [calculateSlice]);

  const setPreset = useCallback((presetName: AspectRatioMode) => {
    const preset = ANAMORPHIC_SEAM_PRESETS[presetName];
    if (preset) {
      setProfile((prev) => ({
        ...prev,
        aspectRatioMode: preset.aspectRatioMode,
        unsqueezeFactor: preset.unsqueezeFactor,
        seamOverlapPx: preset.seamOverlapPx,
        subpixelSnappingMode: preset.subpixelSnappingMode,
        updatedAt: Date.now(),
      }));
    }
  }, []);

  const updateProfile = useCallback((params: Partial<AnamorphicSeamProfile>) => {
    setProfile((prev) => ({
      ...prev,
      ...params,
      updatedAt: Date.now(),
    }));
  }, []);

  const toggleVisibility = useCallback(() => {
    setIsVisible((prev) => !prev);
  }, []);

  return {
    isVisible,
    setIsVisible,
    toggleVisibility,
    profile,
    updateProfile,
    sampleResult,
    calculateSlice,
    setPreset,
  };
}
