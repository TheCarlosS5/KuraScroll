/**
 * KuraScroll - Sprint 105: Cross-Chapter Kinetic Scroll Momentum Deceleration & Seam Pre-Baking Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 (2C/2T @ 2.3GHz, Penryn 45nm, no AVX) & 4TB Mechanical SATA II HDD.
 * Maintains viscous momentum deceleration and seamless pre-baking trigger evaluation at chapter seams.
 * Bound to key 'J' / 'j' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type DecelerationMode = 'smooth_continuous' | 'tactile_snap' | 'rapid_glide' | 'disabled' | 'custom';

export interface ChapterSeamProfile {
  seriesId: string;
  decelerationMode: DecelerationMode;
  seamThresholdPx: number;
  dampingFactor: number;
  preBakePanels: number;
  isMagneticSnap: boolean;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ChapterSeamKinematicsResult {
  adjustedVelocity: number;
  distanceToSeamPx: number;
  seamResistancePct: number;
  isPreBakeActive: boolean;
  preBakePanels: number;
  isMagneticSnapped: boolean;
  decelerationMode: DecelerationMode;
  latencyUs: number;
}

export interface ChapterSeamPreset {
  name: DecelerationMode;
  decelerationMode: DecelerationMode;
  label: string;
  seamThresholdPx: number;
  dampingFactor: number;
  preBakePanels: number;
  isMagneticSnap: boolean;
  description: string;
}

export const CHAPTER_SEAM_PRESETS: Record<DecelerationMode, ChapterSeamPreset> = {
  smooth_continuous: {
    name: 'smooth_continuous',
    decelerationMode: 'smooth_continuous',
    label: 'Smooth Continuous (Webtoon Binge)',
    seamThresholdPx: 160,
    dampingFactor: 0.85,
    preBakePanels: 4,
    isMagneticSnap: true,
    description: 'Gentle viscous resistance before chapter seam with seamless momentum continuation',
  },
  tactile_snap: {
    name: 'tactile_snap',
    decelerationMode: 'tactile_snap',
    label: 'Tactile Volume Snap (Tankōbon Style)',
    seamThresholdPx: 240,
    dampingFactor: 0.92,
    preBakePanels: 2,
    isMagneticSnap: true,
    description: 'Distinct physical tactile resistance simulating end-of-volume turn with magnetic boundary latching',
  },
  rapid_glide: {
    name: 'rapid_glide',
    decelerationMode: 'rapid_glide',
    label: 'Rapid Glide (Fast Skim)',
    seamThresholdPx: 96,
    dampingFactor: 0.45,
    preBakePanels: 6,
    isMagneticSnap: false,
    description: 'Minimal boundary friction and broad pre-baking window for high-speed catalog skimming',
  },
  disabled: {
    name: 'disabled',
    decelerationMode: 'disabled',
    label: 'Disabled (Pure Inertia)',
    seamThresholdPx: 160,
    dampingFactor: 0.0,
    preBakePanels: 0,
    isMagneticSnap: false,
    description: 'Unmodified raw browser scrolling without seam resistance or pre-bake caching',
  },
  custom: {
    name: 'custom',
    decelerationMode: 'custom',
    label: 'Custom User Curve',
    seamThresholdPx: 160,
    dampingFactor: 0.85,
    preBakePanels: 4,
    isMagneticSnap: true,
    description: 'Fine-tuned user kinetic momentum curve and pre-bake parameters',
  },
};

export function localCalculateChapterSeamKinematics(
  currentVelocity: number = 0,
  distanceToSeamPx: number = 500,
  seamThresholdPx: number = 160,
  dampingFactor: number = 0.85,
  preBakePanels: number = 4,
  isMagneticSnap: boolean = true,
  mode: DecelerationMode = 'smooth_continuous',
  isEnabled: boolean = true
): ChapterSeamKinematicsResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  const threshold = Math.max(32, Math.min(600, seamThresholdPx));
  const damping = Math.max(0.10, Math.min(0.99, dampingFactor));
  const panels = Math.max(1, Math.min(12, preBakePanels));
  const dist = Math.max(0, distanceToSeamPx);

  if (!isEnabled || mode === 'disabled') {
    const endHr = typeof performance !== 'undefined' ? performance.now() : 0;
    return {
      adjustedVelocity: currentVelocity,
      distanceToSeamPx: dist,
      seamResistancePct: 0,
      isPreBakeActive: false,
      preBakePanels: 0,
      isMagneticSnapped: false,
      decelerationMode: mode,
      latencyUs: (endHr - startHr) * 1000,
    };
  }

  const preBakeDistancePx = panels * 250;
  const isPreBakeActive = dist <= preBakeDistancePx;

  let seamResistancePct = 0;
  let adjustedVelocity = currentVelocity;
  let isMagneticSnapped = false;

  if (dist < threshold) {
    const proximity = 1.0 - (dist / threshold);
    seamResistancePct = Math.round(proximity * 100 * damping);
    const decayMultiplier = Math.exp(-damping * proximity * 2.5);
    adjustedVelocity = currentVelocity * decayMultiplier;

    if (isMagneticSnap && dist <= 30 && Math.abs(currentVelocity) < 150) {
      isMagneticSnapped = true;
      adjustedVelocity = 0;
    }
  }

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    adjustedVelocity: Number(adjustedVelocity.toFixed(2)),
    distanceToSeamPx: dist,
    seamResistancePct,
    isPreBakeActive,
    preBakePanels: panels,
    isMagneticSnapped,
    decelerationMode: mode,
    latencyUs: (endHr - startHr) * 1000,
  };
}

export interface UseChapterSeamProps {
  seriesId?: string;
  initialMode?: DecelerationMode;
  currentVelocity?: number;
  distanceToSeamPx?: number;
}

export interface UseChapterSeamReturn {
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  toggleHUD: () => void;
  profile: ChapterSeamProfile;
  setProfile: React.Dispatch<React.SetStateAction<ChapterSeamProfile>>;
  result: ChapterSeamKinematicsResult;
  applyPreset: (mode: DecelerationMode) => void;
}

export function useChapterSeam(props: UseChapterSeamProps = {}): UseChapterSeamReturn {
  const {
    seriesId = 'default-series',
    initialMode = 'smooth_continuous',
    currentVelocity = 0,
    distanceToSeamPx = 500,
  } = props;

  const [isHUDVisible, setIsHUDVisible] = useState(false);

  const initialProfile = useMemo<ChapterSeamProfile>(() => {
    const preset = CHAPTER_SEAM_PRESETS[initialMode] || CHAPTER_SEAM_PRESETS.smooth_continuous;
    return {
      seriesId,
      decelerationMode: preset.decelerationMode,
      seamThresholdPx: preset.seamThresholdPx,
      dampingFactor: preset.dampingFactor,
      preBakePanels: preset.preBakePanels,
      isMagneticSnap: preset.isMagneticSnap,
      isEnabled: true,
      createdAt: 0,
      updatedAt: 0,
    };
  }, [seriesId, initialMode]);

  const [profile, setProfile] = useState<ChapterSeamProfile>(initialProfile);

  const toggleHUD = useCallback(() => {
    setIsHUDVisible(prev => !prev);
  }, []);

  // Keyboard shortcut listener: 'J' / 'j'
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (event.key === 'j' || event.key === 'J') {
        event.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  // Compute chapter seam kinematics result
  const result = useMemo(() => {
    return localCalculateChapterSeamKinematics(
      currentVelocity,
      distanceToSeamPx,
      profile.seamThresholdPx,
      profile.dampingFactor,
      profile.preBakePanels,
      profile.isMagneticSnap,
      profile.decelerationMode,
      profile.isEnabled
    );
  }, [
    currentVelocity,
    distanceToSeamPx,
    profile.seamThresholdPx,
    profile.dampingFactor,
    profile.preBakePanels,
    profile.isMagneticSnap,
    profile.decelerationMode,
    profile.isEnabled,
  ]);

  const applyPreset = useCallback((mode: DecelerationMode) => {
    const preset = CHAPTER_SEAM_PRESETS[mode];
    if (!preset) return;
    setProfile(prev => ({
      ...prev,
      decelerationMode: preset.decelerationMode,
      seamThresholdPx: preset.seamThresholdPx,
      dampingFactor: preset.dampingFactor,
      preBakePanels: preset.preBakePanels,
      isMagneticSnap: preset.isMagneticSnap,
      updatedAt: Date.now(),
    }));
  }, []);

  return {
    isHUDVisible,
    setIsHUDVisible,
    toggleHUD,
    profile,
    setProfile,
    result,
    applyPreset,
  };
}
