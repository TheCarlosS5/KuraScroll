/**
 * KuraScroll - Sprint 102: Adaptive Per-Panel Reading Path Spatial Occlusion & Balloon Collision Avoider Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 (2C/2T @ 2.3GHz, Penryn 45nm, no AVX) & Intel GMA 4500MHD.
 * Provides real-time 2D AABB collision avoidance calculation to prevent floating overlays from occluding speech balloons.
 * Bound to key 'O' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type AvoidanceStrategy = 'minimal_euclidean' | 'reading_gravity_downward' | 'opposite_margin' | 'clamp_only';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  importance?: number;
}

export interface ViewportBounds {
  width: number;
  height: number;
}

export interface BalloonCollisionProfile {
  seriesId: string;
  avoidanceStrategy: AvoidanceStrategy;
  safetyMarginPx: number;
  maxDisplacementPx: number;
  preferVerticalShift: boolean;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CollisionAvoidanceResult {
  displacedBox: BoundingBox;
  dx: number;
  dy: number;
  displacementMagnitude: number;
  hasCollision: boolean;
  collidingBalloonIndices: number[];
  strategyApplied: AvoidanceStrategy;
  latencyUs: number;
}

export const BALLOON_COLLISION_PRESETS: Record<AvoidanceStrategy, {
  name: AvoidanceStrategy;
  avoidanceStrategy: AvoidanceStrategy;
  label: string;
  safetyMarginPx: number;
  maxDisplacementPx: number;
  preferVerticalShift: boolean;
  description: string;
}> = {
  minimal_euclidean: {
    name: 'minimal_euclidean',
    avoidanceStrategy: 'minimal_euclidean',
    label: 'Minimal Euclidean (Standard Adaptive)',
    safetyMarginPx: 12,
    maxDisplacementPx: 120,
    preferVerticalShift: true,
    description: 'Finds the shortest distance displacement vector to clear speech balloons with minimal visual displacement',
  },
  reading_gravity_downward: {
    name: 'reading_gravity_downward',
    avoidanceStrategy: 'reading_gravity_downward',
    label: 'Reading Gravity Downward (Webtoon Flow)',
    safetyMarginPx: 16,
    maxDisplacementPx: 180,
    preferVerticalShift: true,
    description: 'Preferentially shifts overlays downwards into empty gutter spacing below speech balloons',
  },
  opposite_margin: {
    name: 'opposite_margin',
    avoidanceStrategy: 'opposite_margin',
    label: 'Opposite Margin (High-Density Tankōbon)',
    safetyMarginPx: 8,
    maxDisplacementPx: 250,
    preferVerticalShift: false,
    description: 'Flips overlay to the opposite lateral gutter margin when dialogue spans vertical column',
  },
  clamp_only: {
    name: 'clamp_only',
    avoidanceStrategy: 'clamp_only',
    label: 'Subtle Clamp Only (Static Viewport)',
    safetyMarginPx: 6,
    maxDisplacementPx: 50,
    preferVerticalShift: true,
    description: 'Only clamps overlays to visible screen boundaries without aggressively dodging dialogue',
  },
};

export function localCalculateBalloonCollisionAvoidance(
  overlayBox: BoundingBox,
  balloonBoxes: BoundingBox[] = [],
  viewport: ViewportBounds = { width: 1280, height: 720 },
  strategy: AvoidanceStrategy = 'minimal_euclidean',
  safetyMarginPx: number = 12,
  maxDisplacementPx: number = 120,
  preferVerticalShift: boolean = true,
  isEnabled: boolean = true
): CollisionAvoidanceResult {
  const start = performance.now();

  const margin = Math.max(0, Math.min(64, safetyMarginPx));
  const maxDisp = Math.max(20, Math.min(400, maxDisplacementPx));
  const vpW = Math.max(100, viewport.width);
  const vpH = Math.max(100, viewport.height);

  let ox = Math.max(0, Math.min(vpW - overlayBox.width, overlayBox.x));
  let oy = Math.max(0, Math.min(vpH - overlayBox.height, overlayBox.y));
  const ow = Math.min(vpW, overlayBox.width);
  const oh = Math.min(vpH, overlayBox.height);

  if (!isEnabled || balloonBoxes.length === 0 || strategy === 'clamp_only') {
    return {
      displacedBox: { x: ox, y: oy, width: ow, height: oh },
      dx: ox - overlayBox.x,
      dy: oy - overlayBox.y,
      displacementMagnitude: Math.hypot(ox - overlayBox.x, oy - overlayBox.y),
      hasCollision: false,
      collidingBalloonIndices: [],
      strategyApplied: strategy,
      latencyUs: (performance.now() - start) * 1000,
    };
  }

  const collidingIndices: number[] = [];
  let minCandidateLeft = ox;
  let maxCandidateRight = ox + ow;
  let minCandidateTop = oy;
  let maxCandidateBottom = oy + oh;

  for (let i = 0; i < balloonBoxes.length; i++) {
    const b = balloonBoxes[i];
    const overlapX = Math.max(0, Math.min(ox + ow, b.x + b.width + margin) - Math.max(ox, b.x - margin));
    const overlapY = Math.max(0, Math.min(oy + oh, b.y + b.height + margin) - Math.max(oy, b.y - margin));

    if (overlapX > 0 && overlapY > 0) {
      collidingIndices.push(i);
      minCandidateLeft = Math.min(minCandidateLeft, b.x - margin);
      maxCandidateRight = Math.max(maxCandidateRight, b.x + b.width + margin);
      minCandidateTop = Math.min(minCandidateTop, b.y - margin);
      maxCandidateBottom = Math.max(maxCandidateBottom, b.y + b.height + margin);
    }
  }

  if (collidingIndices.length === 0) {
    return {
      displacedBox: { x: ox, y: oy, width: ow, height: oh },
      dx: 0,
      dy: 0,
      displacementMagnitude: 0,
      hasCollision: false,
      collidingBalloonIndices: [],
      strategyApplied: strategy,
      latencyUs: (performance.now() - start) * 1000,
    };
  }

  let finalX = ox;
  let finalY = oy;

  if (strategy === 'reading_gravity_downward') {
    const targetY = maxCandidateBottom;
    const dy = targetY - oy;
    if (dy <= maxDisp && targetY + oh <= vpH) {
      finalY = targetY;
    } else {
      const fallbackY = minCandidateTop - oh;
      if (fallbackY >= 0 && (oy - fallbackY) <= maxDisp) {
        finalY = fallbackY;
      }
    }
  } else if (strategy === 'opposite_margin') {
    if (ox < (vpW >> 1)) {
      finalX = Math.min(vpW - ow, ox + maxDisp);
    } else {
      finalX = Math.max(0, ox - maxDisp);
    }
  } else {
    // Minimal Euclidean
    interface Candidate {
      x: number;
      y: number;
      dist: number;
      valid: boolean;
    }

    const candDown: Candidate = {
      x: ox,
      y: maxCandidateBottom,
      dist: Math.abs(maxCandidateBottom - oy),
      valid: maxCandidateBottom + oh <= vpH && Math.abs(maxCandidateBottom - oy) <= maxDisp,
    };

    const candUp: Candidate = {
      x: ox,
      y: minCandidateTop - oh,
      dist: Math.abs(oy - (minCandidateTop - oh)),
      valid: minCandidateTop - oh >= 0 && Math.abs(oy - (minCandidateTop - oh)) <= maxDisp,
    };

    const candRight: Candidate = {
      x: maxCandidateRight,
      y: oy,
      dist: Math.abs(maxCandidateRight - ox),
      valid: maxCandidateRight + ow <= vpW && Math.abs(maxCandidateRight - ox) <= maxDisp,
    };

    const candLeft: Candidate = {
      x: minCandidateLeft - ow,
      y: oy,
      dist: Math.abs(ox - (minCandidateLeft - ow)),
      valid: minCandidateLeft - ow >= 0 && Math.abs(ox - (minCandidateLeft - ow)) <= maxDisp,
    };

    const candidates = [candDown, candUp, candRight, candLeft];
    let bestCandidate: Candidate | null = null;
    let minScore = Infinity;

    for (let c = 0; c < candidates.length; c++) {
      const cand = candidates[c];
      if (!cand.valid) continue;

      let score = cand.dist;
      if (preferVerticalShift && (c === 0 || c === 1)) {
        score *= 0.85;
      }

      if (score < minScore) {
        minScore = score;
        bestCandidate = cand;
      }
    }

    if (bestCandidate) {
      finalX = bestCandidate.x;
      finalY = bestCandidate.y;
    } else {
      finalX = Math.max(0, Math.min(vpW - ow, ox));
      finalY = Math.max(0, Math.min(vpH - oh, oy));
    }
  }

  finalX = Math.max(0, Math.min(vpW - ow, finalX));
  finalY = Math.max(0, Math.min(vpH - oh, finalY));

  const dx = finalX - overlayBox.x;
  const dy = finalY - overlayBox.y;
  const displacementMagnitude = Math.hypot(dx, dy);

  return {
    displacedBox: { x: finalX, y: finalY, width: ow, height: oh },
    dx,
    dy,
    displacementMagnitude: Math.round(displacementMagnitude * 100) / 100,
    hasCollision: true,
    collidingBalloonIndices: collidingIndices,
    strategyApplied: strategy,
    latencyUs: (performance.now() - start) * 1000,
  };
}

export interface UseBalloonCollisionProps {
  seriesId?: string;
  initialStrategy?: AvoidanceStrategy;
  overlayBox?: BoundingBox;
  balloonBoxes?: BoundingBox[];
  viewport?: ViewportBounds;
}

export interface UseBalloonCollisionReturn {
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean | ((prev: boolean) => boolean)) => void;
  toggleHUD: () => void;
  profile: BalloonCollisionProfile;
  setProfile: React.Dispatch<React.SetStateAction<BalloonCollisionProfile>>;
  result: CollisionAvoidanceResult;
  applyPreset: (presetKey: AvoidanceStrategy) => void;
}

export function useBalloonCollision(props: UseBalloonCollisionProps = {}): UseBalloonCollisionReturn {
  const {
    seriesId = 'default-series',
    initialStrategy = 'minimal_euclidean',
    overlayBox = { x: 200, y: 200, width: 140, height: 70 },
    balloonBoxes = [{ x: 180, y: 180, width: 160, height: 100 }],
    viewport = { width: 1280, height: 720 },
  } = props;

  const [isHUDVisible, setIsHUDVisible] = useState(false);

  const initialProfile = useMemo<BalloonCollisionProfile>(() => {
    const preset = BALLOON_COLLISION_PRESETS[initialStrategy] || BALLOON_COLLISION_PRESETS.minimal_euclidean;
    return {
      seriesId,
      avoidanceStrategy: preset.avoidanceStrategy,
      safetyMarginPx: preset.safetyMarginPx,
      maxDisplacementPx: preset.maxDisplacementPx,
      preferVerticalShift: preset.preferVerticalShift,
      isEnabled: true,
      createdAt: 0,
      updatedAt: 0,
    };
  }, [seriesId, initialStrategy]);

  const [profile, setProfile] = useState<BalloonCollisionProfile>(initialProfile);

  const toggleHUD = useCallback(() => {
    setIsHUDVisible(prev => !prev);
  }, []);

  // Keyboard shortcut listener: 'O' / 'o'
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (event.key === 'o' || event.key === 'O') {
        event.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  // Compute collision avoidance result
  const result = useMemo(() => {
    return localCalculateBalloonCollisionAvoidance(
      overlayBox,
      balloonBoxes,
      viewport,
      profile.avoidanceStrategy,
      profile.safetyMarginPx,
      profile.maxDisplacementPx,
      profile.preferVerticalShift,
      profile.isEnabled
    );
  }, [
    overlayBox,
    balloonBoxes,
    viewport,
    profile.avoidanceStrategy,
    profile.safetyMarginPx,
    profile.maxDisplacementPx,
    profile.preferVerticalShift,
    profile.isEnabled,
  ]);

  const applyPreset = useCallback((presetKey: AvoidanceStrategy) => {
    const preset = BALLOON_COLLISION_PRESETS[presetKey];
    if (!preset) return;
    setProfile(prev => ({
      ...prev,
      avoidanceStrategy: preset.avoidanceStrategy,
      safetyMarginPx: preset.safetyMarginPx,
      maxDisplacementPx: preset.maxDisplacementPx,
      preferVerticalShift: preset.preferVerticalShift,
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
