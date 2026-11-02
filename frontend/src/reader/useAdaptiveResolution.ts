/**
 * Sprint 58 - Client-Side Adaptive Resolution Negotiator
 *
 * Designed for low-power Intel GMA 4500MHD displays and mobile devices:
 * - Dynamically evaluates window.innerWidth and window.devicePixelRatio
 * - Negotiates optimal downscaled WebP tiers (800 / 1200 / 1600)
 * - Zero CLS, non-blocking state updates
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

export type ResolutionTier = 800 | 1200 | 1600;
export type ResolutionOverride = ResolutionTier | 'auto';

export interface UseAdaptiveResolutionReturn {
  targetWidth: ResolutionTier;
  tierName: 'mobile' | 'laptop' | 'desktop';
  dpr: number;
  isAuto: boolean;
  override: ResolutionOverride;
  setOverride: (override: ResolutionOverride) => void;
  buildTranscodeUrl: (chapterId: string, pageNumber: number) => string;
}

export function computeAdaptiveTier(width: number, dpr: number = 1): ResolutionTier {
  const effectiveWidth = width * Math.min(dpr, 2.0);

  if (effectiveWidth <= 900) {
    return 800; // Mobile / saver tier
  }
  if (effectiveWidth <= 1400) {
    return 1200; // Laptop / standard 720p tier (sweet spot for GMA 4500MHD)
  }
  return 1600; // Desktop / high-density 1080p tier
}

export function useAdaptiveResolution(
  initialOverride: ResolutionOverride = 'auto'
): UseAdaptiveResolutionReturn {
  const [override, setOverride] = useState<ResolutionOverride>(initialOverride);
  const [windowWidth, setWindowWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );
  const [dpr, setDpr] = useState<number>(() =>
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setWindowWidth(window.innerWidth);
        setDpr(window.devicePixelRatio || 1);
      }, 150); // Debounce resize events
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const targetWidth = useMemo<ResolutionTier>(() => {
    if (override !== 'auto') {
      return override;
    }
    return computeAdaptiveTier(windowWidth, dpr);
  }, [override, windowWidth, dpr]);

  const tierName = useMemo(() => {
    if (targetWidth === 800) return 'mobile';
    if (targetWidth === 1200) return 'laptop';
    return 'desktop';
  }, [targetWidth]);

  const buildTranscodeUrl = useCallback(
    (chapterId: string, pageNumber: number): string => {
      return `/api/v1/chapters/${encodeURIComponent(chapterId)}/pages/${pageNumber}/transcode?w=${targetWidth}`;
    },
    [targetWidth]
  );

  return {
    targetWidth,
    tierName,
    dpr,
    isAuto: override === 'auto',
    override,
    setOverride,
    buildTranscodeUrl,
  };
}
