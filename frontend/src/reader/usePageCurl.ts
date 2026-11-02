/**
 * KuraScroll - Sprint 93: Bi-Temporal Gaze & Velocity Dynamic Page Curl & Turn Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Purely parametric client-side 2.5D affine page curvature and peel deformation:
 * provides fluid physical tactile page turns for traditional Tankōbon manga without 3D vertex mesh overhead.
 * Bound to key 'K' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type CurlPreset = 'tankobon_stiff' | 'doujin_silk' | 'newsprint_pulp' | 'custom';

export interface PageCurlPresetConfig {
  preset: CurlPreset;
  label: string;
  paperStiffness: number;
  maxCurlAngleDeg: number;
  shadowDepth: number;
  description: string;
}

export const PAGE_CURL_PRESETS: Record<CurlPreset, PageCurlPresetConfig> = {
  tankobon_stiff: {
    preset: 'tankobon_stiff',
    label: 'Tankōbon Stiff Paper (Snappy Coated)',
    paperStiffness: 0.85,
    maxCurlAngleDeg: 45.0,
    shadowDepth: 0.40,
    description: 'Crisp, controlled curvature resembling standard Japanese tankōbon volume pages',
  },
  doujin_silk: {
    preset: 'doujin_silk',
    label: 'Doujin Silk (Flexible & Glossy)',
    paperStiffness: 0.60,
    maxCurlAngleDeg: 75.0,
    shadowDepth: 0.55,
    description: 'High-flexibility fluid curvature with soft corner peeling and dynamic deformation',
  },
  newsprint_pulp: {
    preset: 'newsprint_pulp',
    label: 'Newsprint Pulp (Vintage Magazine)',
    paperStiffness: 0.92,
    maxCurlAngleDeg: 35.0,
    shadowDepth: 0.30,
    description: 'High-drag vintage paper drag with tactile resistance and minimal flex',
  },
  custom: {
    preset: 'custom',
    label: 'Custom User Paper Profile',
    paperStiffness: 0.85,
    maxCurlAngleDeg: 45.0,
    shadowDepth: 0.40,
    description: 'Custom tuned page curl stiffness and shadow parameters',
  },
};

export interface UsePageCurlProps {
  seriesId?: string;
  initialPreset?: CurlPreset;
  isRtl?: boolean;
}

export interface UsePageCurlReturn {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean) => void;
  preset: CurlPreset;
  setPreset: (preset: CurlPreset) => void;
  paperStiffness: number;
  setPaperStiffness: (stiffness: number) => void;
  maxCurlAngleDeg: number;
  setMaxCurlAngleDeg: (angle: number) => void;
  shadowDepth: number;
  setShadowDepth: (depth: number) => void;
  isPeelCornerEnabled: boolean;
  setIsPeelCornerEnabled: (peel: boolean) => void;
  isRtl: boolean;
  setIsRtl: (rtl: boolean) => void;
  dragProgress: number;
  setDragProgress: (progress: number) => void;
  velocityPx: number;
  setVelocityPx: (vel: number) => void;
  effectiveAngleDeg: number;
  cornerPeelPercent: number;
  shadowOpacity: number;
  transformMatrixCss: string;
  spineShadowCss: string;
  isCompleted: boolean;
  toggleHUD: () => void;
  resetToPreset: (preset: CurlPreset) => void;
  simulateTurn: (progress: number, velocity?: number) => void;
}

export function usePageCurl({
  seriesId,
  initialPreset = 'tankobon_stiff',
  isRtl: initialIsRtl = true,
}: UsePageCurlProps = {}): UsePageCurlReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isHUDVisible, setIsHUDVisible] = useState<boolean>(false);
  const [preset, setPresetState] = useState<CurlPreset>(initialPreset);

  const initialConfig = PAGE_CURL_PRESETS[initialPreset] || PAGE_CURL_PRESETS.tankobon_stiff;
  const [paperStiffness, setPaperStiffness] = useState<number>(initialConfig.paperStiffness);
  const [maxCurlAngleDeg, setMaxCurlAngleDeg] = useState<number>(initialConfig.maxCurlAngleDeg);
  const [shadowDepth, setShadowDepth] = useState<number>(initialConfig.shadowDepth);
  const [isPeelCornerEnabled, setIsPeelCornerEnabled] = useState<boolean>(true);
  const [isRtl, setIsRtl] = useState<boolean>(initialIsRtl);

  const [dragProgress, setDragProgress] = useState<number>(0.0);
  const [velocityPx, setVelocityPx] = useState<number>(0);

  const toggleHUD = useCallback(() => {
    setIsHUDVisible((prev) => !prev);
  }, []);

  const resetToPreset = useCallback((targetPreset: CurlPreset) => {
    const config = PAGE_CURL_PRESETS[targetPreset] || PAGE_CURL_PRESETS.tankobon_stiff;
    setPresetState(targetPreset);
    setPaperStiffness(config.paperStiffness);
    setMaxCurlAngleDeg(config.maxCurlAngleDeg);
    setShadowDepth(config.shadowDepth);
  }, []);

  const setPreset = useCallback((newPreset: CurlPreset) => {
    resetToPreset(newPreset);
  }, [resetToPreset]);

  const simulateTurn = useCallback((progress: number, velocity: number = 0) => {
    setDragProgress(Math.max(0.00, Math.min(1.00, progress)));
    setVelocityPx(velocity);
  }, []);

  // Keyboard shortcut: 'K' toggles HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl && (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  // Purely parametric 2.5D page curl transform projection
  const {
    effectiveAngleDeg,
    cornerPeelPercent,
    shadowOpacity,
    transformMatrixCss,
    spineShadowCss,
    isCompleted,
  } = useMemo(() => {
    if (!isEnabled || dragProgress <= 0.001) {
      return {
        effectiveAngleDeg: 0,
        cornerPeelPercent: 0,
        shadowOpacity: 0,
        transformMatrixCss: 'none',
        spineShadowCss: 'none',
        isCompleted: false,
      };
    }

    const clampedProgress = Math.max(0.00, Math.min(1.00, dragProgress));
    const clampedStiffness = Math.max(0.20, Math.min(1.00, paperStiffness));
    const clampedMaxAngle = Math.max(15.0, Math.min(85.0, maxCurlAngleDeg));
    const clampedShadow = Math.max(0.00, Math.min(1.00, shadowDepth));

    const velocityFactor = Math.max(-10.0, Math.min(10.0, velocityPx / 300.0));
    const baseAngle = clampedProgress * clampedMaxAngle * (1.0 - clampedStiffness * 0.3);
    const dynamicAngle = Math.max(0.0, Math.min(90.0, baseAngle + velocityFactor));
    const effectiveAngle = isRtl ? -dynamicAngle : dynamicAngle;

    const cornerPeel = isPeelCornerEnabled
      ? parseFloat((Math.sin(clampedProgress * Math.PI) * (1.0 - clampedStiffness * 0.5) * 100).toFixed(1))
      : 0;

    const shadowOp = parseFloat((Math.sin(clampedProgress * Math.PI) * clampedShadow).toFixed(2));
    const skewFactor = parseFloat((Math.sin(clampedProgress * Math.PI) * (1.0 - clampedStiffness) * 4.0).toFixed(2));
    const transformCss = `perspective(1000px) rotateY(${effectiveAngle.toFixed(1)}deg) skewY(${isRtl ? -skewFactor : skewFactor}deg)`;
    const spineCss = `linear-gradient(${isRtl ? 'to left' : 'to right'}, rgba(0, 0, 0, ${shadowOp}) 0%, transparent 40px)`;

    return {
      effectiveAngleDeg: parseFloat(effectiveAngle.toFixed(1)),
      cornerPeelPercent: cornerPeel,
      shadowOpacity: shadowOp,
      transformMatrixCss: transformCss,
      spineShadowCss: spineCss,
      isCompleted: clampedProgress >= 0.95,
    };
  }, [isEnabled, dragProgress, paperStiffness, maxCurlAngleDeg, shadowDepth, isPeelCornerEnabled, isRtl, velocityPx]);

  return {
    isEnabled,
    setIsEnabled,
    isHUDVisible,
    setIsHUDVisible,
    preset,
    setPreset,
    paperStiffness,
    setPaperStiffness,
    maxCurlAngleDeg,
    setMaxCurlAngleDeg,
    shadowDepth,
    setShadowDepth,
    isPeelCornerEnabled,
    setIsPeelCornerEnabled,
    isRtl,
    setIsRtl,
    dragProgress,
    setDragProgress,
    velocityPx,
    setVelocityPx,
    effectiveAngleDeg,
    cornerPeelPercent,
    shadowOpacity,
    transformMatrixCss,
    spineShadowCss,
    isCompleted,
    toggleHUD,
    resetToPreset,
    simulateTurn,
  };
}
