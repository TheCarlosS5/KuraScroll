/**
 * KuraScroll - Sprint 133: Cellulose Fiber Micro-Relief & Paper Grain Texture Hook (SLA 97)
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Zero-allocation closed-form procedural cellulose fiber PRNG, perturbed normal gradient, grazing light modulation,
 * and black ink absorption barrier ($K \ge 0.999 \implies \text{Relief} = 0$).
 * Bound to key 'Shift + F' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type CelluloseReliefPresetName =
  | 'tankobon_woodfree_matte'
  | 'shonen_pulp_unbleached'
  | 'kanzenban_cotton_satin'
  | 'vintage_aged_newsprint'
  | 'raw_fixed';

export interface CelluloseReliefProfile {
  seriesId: string;
  presetName: CelluloseReliefPresetName;
  grainScale: number;
  reliefDepth: number;
  fiberDensity: number;
  lightAngle: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CelluloseReliefPreset {
  name: CelluloseReliefPresetName;
  label: string;
  grainScale: number;
  reliefDepth: number;
  fiberDensity: number;
  lightAngle: number;
  description: string;
}

export const CELLULOSE_RELIEF_PRESETS: Record<CelluloseReliefPresetName, CelluloseReliefPreset> = {
  tankobon_woodfree_matte: {
    name: 'tankobon_woodfree_matte',
    label: 'Tankōbon Standard Woodfree',
    grainScale: 1.00,
    reliefDepth: 0.25,
    fiberDensity: 0.50,
    lightAngle: 0.785398, // 45 deg
    description: 'Commercial manga pocket edition paper with balanced mineral loading and subtle matte fiber relief.',
  },
  shonen_pulp_unbleached: {
    name: 'shonen_pulp_unbleached',
    label: 'Shōnen Magazine Unbleached Pulp',
    grainScale: 1.40,
    reliefDepth: 0.45,
    fiberDensity: 0.75,
    lightAngle: 0.645772, // ~37 deg
    description: 'Rustic recycled thermomechanical wood pulp with prominent fibrous ridges and micro-shadowing.',
  },
  kanzenban_cotton_satin: {
    name: 'kanzenban_cotton_satin',
    label: 'Kanzenban Cotton Satin',
    grainScale: 0.60,
    reliefDepth: 0.08,
    fiberDensity: 0.20,
    lightAngle: 0.855211, // ~49 deg
    description: 'Collector edition super-calendered Kraft paper with long cotton fibers and ultra-smooth satin surface.',
  },
  vintage_aged_newsprint: {
    name: 'vintage_aged_newsprint',
    label: 'Vintage Aged Newsprint',
    grainScale: 1.80,
    reliefDepth: 0.60,
    fiberDensity: 0.85,
    lightAngle: 0.523599, // 30 deg
    description: 'Oxidized yellowed newsprint with micro-flaking cellulose and pronounced tactile depth under grazing light.',
  },
  raw_fixed: {
    name: 'raw_fixed',
    label: 'Raw Pass-Through (Disabled)',
    grainScale: 1.00,
    reliefDepth: 0.00,
    fiberDensity: 0.00,
    lightAngle: 0.785398,
    description: 'Completely bypasses cellulose relief synthesis for perfectly flat digital rendering.',
  },
};

export interface CelluloseReliefResult {
  x: number;
  y: number;
  kDensity: number;
  height: number;
  diffuseLight: number;
  effectiveRelief: number;
  isSuppressedByInk: boolean;
  latencyUs: number;
}

const STATIC_CLIENT_RESULT: CelluloseReliefResult = {
  x: 0,
  y: 0,
  kDensity: 0,
  height: 0,
  diffuseLight: 0,
  effectiveRelief: 0,
  isSuppressedByInk: false,
  latencyUs: 0,
};

function hash2D(x: number, y: number, seed: number = 0x1337): number {
  const h =
    Math.imul((x | 0) ^ 0x45d9f3b, 0x27d4eb2d) ^
    Math.imul((y | 0) ^ 0x165667b1, 0x27d4eb2d) ^
    (seed | 0);
  return ((h ^ (h >>> 15)) & 0x7fffffff) / 0x7fffffff;
}

export function evaluateClientCelluloseRelief(
  x: number,
  y: number,
  kDensity: number,
  grainScale: number = 1.00,
  reliefDepth: number = 0.25,
  fiberDensity: number = 0.50,
  lightAngle: number = 0.785398,
  isEnabled: boolean = true
): CelluloseReliefResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const clampedK = Math.max(0.0, Math.min(1.0, kDensity));

  if (!isEnabled || reliefDepth <= 0.0001 || clampedK >= 0.999) {
    STATIC_CLIENT_RESULT.x = x;
    STATIC_CLIENT_RESULT.y = y;
    STATIC_CLIENT_RESULT.kDensity = clampedK;
    STATIC_CLIENT_RESULT.height = 0.0;
    STATIC_CLIENT_RESULT.diffuseLight = 1.0;
    STATIC_CLIENT_RESULT.effectiveRelief = 0.0;
    STATIC_CLIENT_RESULT.isSuppressedByInk = clampedK >= 0.999;
    STATIC_CLIENT_RESULT.latencyUs = typeof performance !== 'undefined' ? (performance.now() - t0) * 1000 : 0.2;
    return STATIC_CLIENT_RESULT;
  }

  const sx = (x * grainScale) | 0;
  const sy = (y * grainScale) | 0;
  const grain = hash2D(sx, sy);
  const filament = Math.sin(x * 0.15 + grain * 3.141592653589793) * Math.cos(y * 0.08);
  const height = grain * (1.0 - fiberDensity) + Math.abs(filament) * fiberDensity;

  const gR = hash2D(sx + 1, sy);
  const gL = hash2D(sx - 1, sy);
  const gD = hash2D(sx, sy + 1);
  const gU = hash2D(sx, sy - 1);
  const dhdx = (gR - gL) * 0.5;
  const dhdy = (gD - gU) * 0.5;

  const nx = -reliefDepth * dhdx;
  const ny = -reliefDepth * dhdy;
  const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + 1.0);
  const normX = nx * invLen;
  const normY = ny * invLen;
  const normZ = invLen;

  const lx = Math.cos(lightAngle);
  const lz = Math.sin(lightAngle);
  const dotNL = normX * lx + normZ * lz;
  const diffuseLight = Math.max(0.0, dotNL);

  const effectiveRelief = diffuseLight * (1.0 - clampedK);

  STATIC_CLIENT_RESULT.x = x;
  STATIC_CLIENT_RESULT.y = y;
  STATIC_CLIENT_RESULT.kDensity = clampedK;
  STATIC_CLIENT_RESULT.height = height;
  STATIC_CLIENT_RESULT.diffuseLight = diffuseLight;
  STATIC_CLIENT_RESULT.effectiveRelief = effectiveRelief;
  STATIC_CLIENT_RESULT.isSuppressedByInk = clampedK > 0.05;
  STATIC_CLIENT_RESULT.latencyUs = typeof performance !== 'undefined' ? (performance.now() - t0) * 1000 : 0.2;

  return STATIC_CLIENT_RESULT;
}

export interface UseCelluloseReliefOptions {
  seriesId: string;
  initialPreset?: CelluloseReliefPresetName;
  onProfileChange?: (profile: CelluloseReliefProfile) => void;
}

export interface UseCelluloseReliefReturn {
  profile: CelluloseReliefProfile;
  isHudOpen: boolean;
  setHudOpen: (open: boolean) => void;
  toggleHud: () => void;
  applyPreset: (presetName: CelluloseReliefPresetName) => void;
  updateProfile: (updates: Partial<CelluloseReliefProfile>) => void;
  toggleEnabled: () => void;
  evaluateRelief: (x: number, y: number, kDensity: number) => CelluloseReliefResult;
}

export function useCelluloseRelief({
  seriesId,
  initialPreset = 'tankobon_woodfree_matte',
  onProfileChange,
}: UseCelluloseReliefOptions): UseCelluloseReliefReturn {
  const [isHudOpen, setHudOpen] = useState(false);

  const defaultProfile = useMemo<CelluloseReliefProfile>(() => {
    const preset = CELLULOSE_RELIEF_PRESETS[initialPreset] || CELLULOSE_RELIEF_PRESETS.tankobon_woodfree_matte;
    return {
      seriesId,
      presetName: preset.name,
      grainScale: preset.grainScale,
      reliefDepth: preset.reliefDepth,
      fiberDensity: preset.fiberDensity,
      lightAngle: preset.lightAngle,
      isEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }, [seriesId, initialPreset]);

  const [profile, setProfileState] = useState<CelluloseReliefProfile>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = window.localStorage.getItem(`kura_cr_${seriesId}`);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch {
        // ignore storage errors
      }
    }
    return defaultProfile;
  });

  const toggleHud = useCallback(() => {
    setHudOpen((prev) => !prev);
  }, []);

  const updateProfile = useCallback(
    (updates: Partial<CelluloseReliefProfile>) => {
      setProfileState((prev) => {
        const next: CelluloseReliefProfile = {
          ...prev,
          ...updates,
          grainScale: updates.grainScale !== undefined ? Math.max(0.1, Math.min(5.0, updates.grainScale)) : prev.grainScale,
          reliefDepth: updates.reliefDepth !== undefined ? Math.max(0.0, Math.min(1.0, updates.reliefDepth)) : prev.reliefDepth,
          fiberDensity: updates.fiberDensity !== undefined ? Math.max(0.0, Math.min(1.0, updates.fiberDensity)) : prev.fiberDensity,
          lightAngle: updates.lightAngle !== undefined ? Math.max(0.0, Math.min(Math.PI / 2, updates.lightAngle)) : prev.lightAngle,
          updatedAt: Date.now(),
        };

        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem(`kura_cr_${seriesId}`, JSON.stringify(next));
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
    (presetName: CelluloseReliefPresetName) => {
      const preset = CELLULOSE_RELIEF_PRESETS[presetName] || CELLULOSE_RELIEF_PRESETS.tankobon_woodfree_matte;
      updateProfile({
        presetName: preset.name,
        grainScale: preset.grainScale,
        reliefDepth: preset.reliefDepth,
        fiberDensity: preset.fiberDensity,
        lightAngle: preset.lightAngle,
        isEnabled: presetName !== 'raw_fixed',
      });
    },
    [updateProfile]
  );

  const toggleEnabled = useCallback(() => {
    updateProfile({ isEnabled: !profile.isEnabled });
  }, [profile.isEnabled, updateProfile]);

  const evaluateRelief = useCallback(
    (x: number, y: number, kDensity: number): CelluloseReliefResult => {
      return evaluateClientCelluloseRelief(
        x,
        y,
        kDensity,
        profile.grainScale,
        profile.reliefDepth,
        profile.fiberDensity,
        profile.lightAngle,
        profile.isEnabled
      );
    },
    [profile]
  );

  // Keyboard shortcut listener for 'Shift + F'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
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
    evaluateRelief,
  };
}
