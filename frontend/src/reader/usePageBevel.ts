/**
 * KuraScroll - Sprint 109: Bi-Directional Multi-Channel Tactile Page Edge Bevel & Stack Thickness Hologram Synthesizer Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Synthesizes zero-allocation tactile page edge stack thickness, center sag dip, and edge bevels.
 * Bound to key 'W' / 'w' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type PaperCaliperMode =
  | 'newsprint_65um'
  | 'pulp_85um'
  | 'tankobon_silk_110um'
  | 'omnibus_coated_130um'
  | 'custom';

export type BevelReadingDirection = 'rtl' | 'ltr' | 'vertical';

export interface PageBevelProfile {
  seriesId: string;
  paperCaliperMode: PaperCaliperMode;
  maxStackThicknessPx: number;
  pageCaliperUm: number;
  curvatureSagPct: number;
  edgeBevelShadingPct: number;
  readingDirection: BevelReadingDirection;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PageBevelResult {
  leftThicknessPx: number;
  rightThicknessPx: number;
  leftPagesCount: number;
  rightPagesCount: number;
  progressRatio: number;
  readingDirection: BevelReadingDirection;
  leftBevelGradient: string;
  rightBevelGradient: string;
  sagOffsetPx: number;
  latencyUs: number;
}

export interface PageBevelPreset {
  name: PaperCaliperMode;
  paperCaliperMode: PaperCaliperMode;
  label: string;
  pageCaliperUm: number;
  maxStackThicknessPx: number;
  curvatureSagPct: number;
  edgeBevelShadingPct: number;
  description: string;
}

export const PAGE_BEVEL_PRESETS: Record<PaperCaliperMode, PageBevelPreset> = {
  tankobon_silk_110um: {
    name: 'tankobon_silk_110um',
    paperCaliperMode: 'tankobon_silk_110um',
    label: 'Tankōbon Standard Silk (110 µm)',
    pageCaliperUm: 110.0,
    maxStackThicknessPx: 24,
    curvatureSagPct: 35,
    edgeBevelShadingPct: 40,
    description: 'Traditional Japanese tankōbon volume with smooth high-opacity cream paper',
  },
  newsprint_65um: {
    name: 'newsprint_65um',
    paperCaliperMode: 'newsprint_65um',
    label: 'Weekly Anthology Newsprint (65 µm)',
    pageCaliperUm: 65.0,
    maxStackThicknessPx: 18,
    curvatureSagPct: 25,
    edgeBevelShadingPct: 30,
    description: 'Thin recycled newsprint phonebook style with subtle edge layering',
  },
  pulp_85um: {
    name: 'pulp_85um',
    paperCaliperMode: 'pulp_85um',
    label: 'Classic Pulp Shōnen (85 µm)',
    pageCaliperUm: 85.0,
    maxStackThicknessPx: 20,
    curvatureSagPct: 30,
    edgeBevelShadingPct: 35,
    description: 'Vintage pulp paper with visible grain edge absorption and textured bevel',
  },
  omnibus_coated_130um: {
    name: 'omnibus_coated_130um',
    paperCaliperMode: 'omnibus_coated_130um',
    label: 'Omnibus Hardcover Coated (130 µm)',
    pageCaliperUm: 130.0,
    maxStackThicknessPx: 36,
    curvatureSagPct: 50,
    edgeBevelShadingPct: 55,
    description: 'Heavy multi-chapter collector omnibus with prominent physical stack heft and spine sag',
  },
  custom: {
    name: 'custom',
    paperCaliperMode: 'custom',
    label: 'Custom Reader Profile',
    pageCaliperUm: 110.0,
    maxStackThicknessPx: 24,
    curvatureSagPct: 35,
    edgeBevelShadingPct: 40,
    description: 'User-customized physical stack thickness and edge bevel attributes',
  },
};

export function localCalculatePageBevel(
  currentPage: number = 1,
  totalPages: number = 200,
  readingDirection: BevelReadingDirection = 'rtl',
  maxStackThicknessPx: number = 24,
  curvatureSagPct: number = 35,
  edgeBevelShadingPct: number = 40,
  isEnabled: boolean = true
): PageBevelResult {
  const start = performance.now();

  const totalN = Math.max(1, totalPages);
  const currentP = Math.max(1, Math.min(totalN, currentPage));
  const maxThick = Math.max(4, Math.min(48, maxStackThicknessPx));
  const sagPct = Math.max(0, Math.min(100, curvatureSagPct));
  const shadePct = Math.max(0, Math.min(100, edgeBevelShadingPct));

  if (!isEnabled || totalN <= 1) {
    const end = performance.now();
    return {
      leftThicknessPx: 0,
      rightThicknessPx: 0,
      leftPagesCount: 0,
      rightPagesCount: 0,
      progressRatio: 0.0,
      readingDirection,
      leftBevelGradient: 'none',
      rightBevelGradient: 'none',
      sagOffsetPx: 0,
      latencyUs: (end - start) * 1000.0,
    };
  }

  const progressRatio = totalN > 1 ? (currentP - 1) / (totalN - 1) : 0.0;

  let leftPages = 0;
  let rightPages = 0;
  let leftProgress = 0.0;
  let rightProgress = 0.0;

  if (readingDirection === 'vertical') {
    leftPages = 0;
    rightPages = 0;
    leftProgress = 0.15;
    rightProgress = 0.15;
  } else if (readingDirection === 'rtl') {
    leftPages = currentP - 1;
    rightPages = totalN - currentP;
    leftProgress = progressRatio;
    rightProgress = 1.0 - progressRatio;
  } else {
    leftPages = totalN - currentP;
    rightPages = currentP - 1;
    leftProgress = 1.0 - progressRatio;
    rightProgress = progressRatio;
  }

  const leftThicknessPx = Math.max(0, Math.min(maxThick, Math.round(leftProgress * maxThick)));
  const rightThicknessPx = Math.max(0, Math.min(maxThick, Math.round(rightProgress * maxThick)));

  const sagOffsetPx = Math.round((sagPct / 100.0) * Math.sin(progressRatio * Math.PI) * (maxThick * 0.35));

  const shadeAlpha = (shadePct / 100.0).toFixed(2);
  const leftBevelGradient = leftThicknessPx > 0
    ? `linear-gradient(to right, rgba(0, 0, 0, ${shadeAlpha}) 0%, rgba(255, 255, 255, 0.06) 60%, rgba(0, 0, 0, 0.2) 100%)`
    : 'none';
  const rightBevelGradient = rightThicknessPx > 0
    ? `linear-gradient(to left, rgba(0, 0, 0, ${shadeAlpha}) 0%, rgba(255, 255, 255, 0.06) 60%, rgba(0, 0, 0, 0.2) 100%)`
    : 'none';

  const end = performance.now();
  const latencyUs = (end - start) * 1000.0;

  return {
    leftThicknessPx,
    rightThicknessPx,
    leftPagesCount: leftPages,
    rightPagesCount: rightPages,
    progressRatio: Number(progressRatio.toFixed(4)),
    readingDirection,
    leftBevelGradient,
    rightBevelGradient,
    sagOffsetPx,
    latencyUs,
  };
}

export function usePageBevel(
  seriesId: string = 'default-series',
  initialCurrentPage: number = 1,
  initialTotalPages: number = 200
) {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(initialCurrentPage);
  const [totalPages, setTotalPages] = useState<number>(initialTotalPages);

  const [profile, setProfile] = useState<PageBevelProfile>({
    seriesId,
    ...PAGE_BEVEL_PRESETS.tankobon_silk_110um,
    readingDirection: 'rtl',
    isEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Keyboard shortcut 'W' / 'w' (Wedge / Stack Width / Bevel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || (document.activeElement as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === 'w' || e.key === 'W') {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          setIsVisible((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const result = useMemo(() => {
    return localCalculatePageBevel(
      currentPage,
      totalPages,
      profile.readingDirection,
      profile.maxStackThicknessPx,
      profile.curvatureSagPct,
      profile.edgeBevelShadingPct,
      profile.isEnabled
    );
  }, [
    currentPage,
    totalPages,
    profile.readingDirection,
    profile.maxStackThicknessPx,
    profile.curvatureSagPct,
    profile.edgeBevelShadingPct,
    profile.isEnabled,
  ]);

  const setPreset = useCallback((presetName: PaperCaliperMode) => {
    const preset = PAGE_BEVEL_PRESETS[presetName];
    if (preset) {
      setProfile((prev) => ({
        ...prev,
        paperCaliperMode: preset.paperCaliperMode,
        maxStackThicknessPx: preset.maxStackThicknessPx,
        pageCaliperUm: preset.pageCaliperUm,
        curvatureSagPct: preset.curvatureSagPct,
        edgeBevelShadingPct: preset.edgeBevelShadingPct,
        updatedAt: Date.now(),
      }));
    }
  }, []);

  const updateProfile = useCallback((params: Partial<PageBevelProfile>) => {
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
    result,
    currentPage,
    setCurrentPage,
    totalPages,
    setTotalPages,
    setPreset,
  };
}
