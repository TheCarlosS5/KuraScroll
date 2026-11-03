/**
 * KuraScroll - Sprint 134: Dynamic Ink Splatter & Bleed Feathering Physics Hook (SLA 98)
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Zero-allocation closed-form procedural ink splatter PRNG, Rayleigh-Plateau micro-droplet ejection,
 * and Jurin-Washburn capillary paper bleed feathering.
 * Bound to key 'Shift + S' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type InkSplatterPresetName =
  | 'shonen_impact_burst'
  | 'vintage_gpen_newsprint'
  | 'deluxe_bristol_clean'
  | 'dramatic_blood_splatter'
  | 'raw_fixed';

export interface InkSplatterProfile {
  seriesId: string;
  presetName: InkSplatterPresetName;
  strokeVelocity: number;
  bleedRadiusPx: number;
  splatterDensity: number;
  wickingRate: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InkSplatterPreset {
  name: InkSplatterPresetName;
  label: string;
  strokeVelocity: number;
  bleedRadiusPx: number;
  splatterDensity: number;
  wickingRate: number;
  description: string;
}

export const INK_SPLATTER_PRESETS: Record<InkSplatterPresetName, InkSplatterPreset> = {
  shonen_impact_burst: {
    name: 'shonen_impact_burst',
    label: 'Shōnen Action Impact Burst',
    strokeVelocity: 750.0,
    bleedRadiusPx: 1.8,
    splatterDensity: 0.70,
    wickingRate: 0.55,
    description: 'Dynamic G-pen ink micro-droplet ejection and capillary feathering for high-impact combat SFX and onomatopoeia.',
  },
  vintage_gpen_newsprint: {
    name: 'vintage_gpen_newsprint',
    label: 'Vintage G-Pen Newsprint',
    strokeVelocity: 200.0,
    bleedRadiusPx: 2.4,
    splatterDensity: 0.25,
    wickingRate: 0.80,
    description: 'Traditional dip-pen drawing on unsized recycled pulp with deep fibrous capillary bleed along paper pores.',
  },
  deluxe_bristol_clean: {
    name: 'deluxe_bristol_clean',
    label: 'Deluxe Bristol Kent Board',
    strokeVelocity: 300.0,
    bleedRadiusPx: 0.4,
    splatterDensity: 0.10,
    wickingRate: 0.15,
    description: 'Ultra-sized professional manga art board with near-zero capillary wicking and crisp line containment.',
  },
  dramatic_blood_splatter: {
    name: 'dramatic_blood_splatter',
    label: 'Dramatic Splatter Burst',
    strokeVelocity: 950.0,
    bleedRadiusPx: 3.2,
    splatterDensity: 0.90,
    wickingRate: 0.65,
    description: 'High-velocity visceral ink spray for climactic battle manga and horror/seinen splash spreads.',
  },
  raw_fixed: {
    name: 'raw_fixed',
    label: 'Raw Pass-Through (Disabled)',
    strokeVelocity: 0.0,
    bleedRadiusPx: 0.0,
    splatterDensity: 0.0,
    wickingRate: 0.0,
    description: 'Completely bypasses splatter physics and feathering, delivering perfectly crisp vector edges.',
  },
};

export interface InkSplatterDroplet {
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

export interface InkSplatterResult {
  originX: number;
  originY: number;
  dropletCount: number;
  effectiveBleed: number;
  wickingSpread: number;
  isSuppressed: boolean;
  latencyUs: number;
  droplets: InkSplatterDroplet[];
}

const MAX_DROPLETS = 16;
const CLIENT_DROPLETS_POOL: InkSplatterDroplet[] = Array.from({ length: MAX_DROPLETS }, () => ({
  x: 0,
  y: 0,
  radius: 0,
  opacity: 0,
}));

const STATIC_CLIENT_RESULT: InkSplatterResult = {
  originX: 0,
  originY: 0,
  dropletCount: 0,
  effectiveBleed: 0,
  wickingSpread: 0,
  isSuppressed: false,
  latencyUs: 0,
  droplets: CLIENT_DROPLETS_POOL,
};

function hash2D(x: number, y: number, seed: number = 0x501a): number {
  const h =
    Math.imul((x | 0) ^ 0x45d9f3b, 0x27d4eb2d) ^
    Math.imul((y | 0) ^ 0x165667b1, 0x27d4eb2d) ^
    (seed | 0);
  return ((h ^ (h >>> 15)) & 0x7fffffff) / 0x7fffffff;
}

export function evaluateClientInkSplatter(
  originX: number,
  originY: number,
  angleRad: number = 0,
  strokeVelocity: number = 250.0,
  bleedRadiusPx: number = 1.2,
  splatterDensity: number = 0.3,
  wickingRate: number = 0.4,
  isEnabled: boolean = true
): InkSplatterResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const velocity = Math.max(0.0, Math.min(1000.0, strokeVelocity));
  const bleedRadius = Math.max(0.0, Math.min(5.0, bleedRadiusPx));
  const density = Math.max(0.0, Math.min(1.0, splatterDensity));
  const wicking = Math.max(0.0, Math.min(1.0, wickingRate));

  if (!isEnabled || (velocity <= 0.001 && bleedRadius <= 0.001)) {
    STATIC_CLIENT_RESULT.originX = originX;
    STATIC_CLIENT_RESULT.originY = originY;
    STATIC_CLIENT_RESULT.dropletCount = 0;
    STATIC_CLIENT_RESULT.effectiveBleed = 0.0;
    STATIC_CLIENT_RESULT.wickingSpread = 0.0;
    STATIC_CLIENT_RESULT.isSuppressed = true;
    STATIC_CLIENT_RESULT.latencyUs = typeof performance !== 'undefined' ? (performance.now() - t0) * 1000 : 0.2;
    return STATIC_CLIENT_RESULT;
  }

  const effectiveBleed = bleedRadius * (1.0 + wicking * 0.5);
  const wickingSpread = bleedRadius > 0 ? (effectiveBleed - bleedRadius) / bleedRadius : 0.0;

  if (velocity <= 0.001) {
    STATIC_CLIENT_RESULT.originX = originX;
    STATIC_CLIENT_RESULT.originY = originY;
    STATIC_CLIENT_RESULT.dropletCount = 0;
    STATIC_CLIENT_RESULT.effectiveBleed = effectiveBleed;
    STATIC_CLIENT_RESULT.wickingSpread = wickingSpread;
    STATIC_CLIENT_RESULT.isSuppressed = false;
    STATIC_CLIENT_RESULT.latencyUs = typeof performance !== 'undefined' ? (performance.now() - t0) * 1000 : 0.2;
    return STATIC_CLIENT_RESULT;
  }

  const maxCount = Math.min(MAX_DROPLETS, Math.floor(density * (velocity / 100.0) * 2.0));
  const dropletCount = Math.max(1, maxCount);

  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  for (let i = 0; i < dropletCount; i++) {
    const rnd1 = hash2D((originX + i * 17) | 0, (originY + i * 23) | 0, i);
    const rnd2 = hash2D((originX + i * 31) | 0, (originY + i * 47) | 0, i + 99);

    const dist = (velocity * 0.04) * (rnd1 * 0.8 + 0.2);
    const lateral = (rnd2 - 0.5) * 12.0 * (1.0 - rnd1 * 0.5);

    const dx = cosA * dist - sinA * lateral;
    const dy = sinA * dist + cosA * lateral;

    const drop = CLIENT_DROPLETS_POOL[i];
    drop.x = originX + dx;
    drop.y = originY + dy;
    drop.radius = Math.max(0.4, (1.8 - rnd1 * 1.2) * (density + 0.2));
    drop.opacity = Math.max(0.3, Math.min(1.0, 1.0 - (dist / (velocity * 0.06))));
  }

  STATIC_CLIENT_RESULT.originX = originX;
  STATIC_CLIENT_RESULT.originY = originY;
  STATIC_CLIENT_RESULT.dropletCount = dropletCount;
  STATIC_CLIENT_RESULT.effectiveBleed = effectiveBleed;
  STATIC_CLIENT_RESULT.wickingSpread = wickingSpread;
  STATIC_CLIENT_RESULT.isSuppressed = false;
  STATIC_CLIENT_RESULT.latencyUs = typeof performance !== 'undefined' ? (performance.now() - t0) * 1000 : 0.2;

  return STATIC_CLIENT_RESULT;
}

export interface UseInkSplatterOptions {
  seriesId: string;
  initialPreset?: InkSplatterPresetName;
  onProfileChange?: (profile: InkSplatterProfile) => void;
}

export interface UseInkSplatterReturn {
  profile: InkSplatterProfile;
  isHudOpen: boolean;
  setHudOpen: (open: boolean) => void;
  toggleHud: () => void;
  applyPreset: (presetName: InkSplatterPresetName) => void;
  updateProfile: (updates: Partial<InkSplatterProfile>) => void;
  toggleEnabled: () => void;
  evaluateSplatter: (originX: number, originY: number, angleRad?: number, velocity?: number) => InkSplatterResult;
}

export function useInkSplatter({
  seriesId,
  initialPreset = 'shonen_impact_burst',
  onProfileChange,
}: UseInkSplatterOptions): UseInkSplatterReturn {
  const [isHudOpen, setHudOpen] = useState(false);

  const defaultProfile = useMemo<InkSplatterProfile>(() => {
    const preset = INK_SPLATTER_PRESETS[initialPreset] || INK_SPLATTER_PRESETS.shonen_impact_burst;
    return {
      seriesId,
      presetName: preset.name,
      strokeVelocity: preset.strokeVelocity,
      bleedRadiusPx: preset.bleedRadiusPx,
      splatterDensity: preset.splatterDensity,
      wickingRate: preset.wickingRate,
      isEnabled: true,
      createdAt: 0,
      updatedAt: 0,
    };
  }, [seriesId, initialPreset]);

  const [profile, setProfileState] = useState<InkSplatterProfile>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(`kura_is_${seriesId}`);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch {
        // ignore
      }
    }
    return defaultProfile;
  });

  const toggleHud = useCallback(() => {
    setHudOpen((prev) => !prev);
  }, []);

  const updateProfile = useCallback(
    (updates: Partial<InkSplatterProfile>) => {
      setProfileState((prev) => {
        const next: InkSplatterProfile = {
          ...prev,
          ...updates,
          strokeVelocity: updates.strokeVelocity !== undefined ? Math.max(0.0, Math.min(1000.0, updates.strokeVelocity)) : prev.strokeVelocity,
          bleedRadiusPx: updates.bleedRadiusPx !== undefined ? Math.max(0.0, Math.min(5.0, updates.bleedRadiusPx)) : prev.bleedRadiusPx,
          splatterDensity: updates.splatterDensity !== undefined ? Math.max(0.0, Math.min(1.0, updates.splatterDensity)) : prev.splatterDensity,
          wickingRate: updates.wickingRate !== undefined ? Math.max(0.0, Math.min(1.0, updates.wickingRate)) : prev.wickingRate,
          updatedAt: Date.now(),
        };

        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(`kura_is_${seriesId}`, JSON.stringify(next));
          } catch {
            // ignore
          }
        }

        if (onProfileChange) {
          onProfileChange(next);
        }

        return next;
      });
    },
    [seriesId, onProfileChange]
  );

  const applyPreset = useCallback(
    (presetName: InkSplatterPresetName) => {
      const preset = INK_SPLATTER_PRESETS[presetName] || INK_SPLATTER_PRESETS.shonen_impact_burst;
      updateProfile({
        presetName: preset.name,
        strokeVelocity: preset.strokeVelocity,
        bleedRadiusPx: preset.bleedRadiusPx,
        splatterDensity: preset.splatterDensity,
        wickingRate: preset.wickingRate,
        isEnabled: presetName !== 'raw_fixed',
      });
    },
    [updateProfile]
  );

  const toggleEnabled = useCallback(() => {
    updateProfile({ isEnabled: !profile.isEnabled });
  }, [profile.isEnabled, updateProfile]);

  const evaluateSplatter = useCallback(
    (originX: number, originY: number, angleRad: number = 0, velocity?: number): InkSplatterResult => {
      return evaluateClientInkSplatter(
        originX,
        originY,
        angleRad,
        velocity ?? profile.strokeVelocity,
        profile.bleedRadiusPx,
        profile.splatterDensity,
        profile.wickingRate,
        profile.isEnabled
      );
    },
    [profile]
  );

  // Keyboard shortcut listener for 'Shift + S'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        toggleHud();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleHud]);

  return {
    profile,
    isHudOpen,
    setHudOpen,
    toggleHud,
    applyPreset,
    updateProfile,
    toggleEnabled,
    evaluateSplatter,
  };
}
