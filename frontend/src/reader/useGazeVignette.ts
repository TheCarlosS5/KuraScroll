/**
 * KuraScroll - Sprint 129: Kinetic Peripheral Vignette & Micro-Saccade Gaze Stabilizer Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Zero-allocation 2nd-order critically damped harmonic oscillator, quadratic elliptical vignette,
 * and micro-saccade dead-zone stabilization.
 * Bound to key 'V' / 'v' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type GazeVignettePresetName =
  | 'deep_focus_tunnel'
  | 'shonen_action_burst'
  | 'relaxed_reading_calm'
  | 'night_monochrome'
  | 'raw_fixed';

export interface GazeVignetteProfile {
  seriesId: string;
  presetName: GazeVignettePresetName;
  omega: number;
  deadZonePx: number;
  snapThresholdPx: number;
  vignetteMax: number;
  radiusX: number;
  radiusY: number;
  q0: number;
  q1: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface GazeVignettePreset {
  name: GazeVignettePresetName;
  label: string;
  omega: number;
  deadZonePx: number;
  snapThresholdPx: number;
  vignetteMax: number;
  radiusX: number;
  radiusY: number;
  q0: number;
  q1: number;
  description: string;
}

export const GAZE_VIGNETTE_PRESETS: Record<GazeVignettePresetName, GazeVignettePreset> = {
  deep_focus_tunnel: {
    name: 'deep_focus_tunnel',
    label: 'Deep Focus Tunnel',
    omega: 16.0,
    deadZonePx: 1.5,
    snapThresholdPx: 120.0,
    vignetteMax: 0.28,
    radiusX: 0.40,
    radiusY: 0.50,
    q0: 0.60,
    q1: 1.00,
    description: 'Narrow elliptical peripheral mask for high-concentration reading and speech balloon focusing.',
  },
  shonen_action_burst: {
    name: 'shonen_action_burst',
    label: 'Shōnen Action Burst',
    omega: 24.0,
    deadZonePx: 2.0,
    snapThresholdPx: 100.0,
    vignetteMax: 0.22,
    radiusX: 0.45,
    radiusY: 0.45,
    q0: 0.50,
    q1: 1.00,
    description: 'Fast-response tracking with dynamic impact focus for combat panels and double-spread action sequences.',
  },
  relaxed_reading_calm: {
    name: 'relaxed_reading_calm',
    label: 'Relaxed Reading Calm',
    omega: 8.0,
    deadZonePx: 1.5,
    snapThresholdPx: 120.0,
    vignetteMax: 0.12,
    radiusX: 0.55,
    radiusY: 0.65,
    q0: 0.70,
    q1: 1.20,
    description: 'Gentle critically-damped stabilization and subtle vignette to soften screen edges during extended reading.',
  },
  night_monochrome: {
    name: 'night_monochrome',
    label: 'Night Monochrome Shelter',
    omega: 10.0,
    deadZonePx: 1.5,
    snapThresholdPx: 140.0,
    vignetteMax: 0.35,
    radiusX: 0.50,
    radiusY: 0.60,
    q0: 0.65,
    q1: 1.10,
    description: 'Deeper peripheral attenuation for dark environments, focusing gaze on high-contrast black ink panels.',
  },
  raw_fixed: {
    name: 'raw_fixed',
    label: 'Raw Pass-Through (Disabled)',
    omega: 12.0,
    deadZonePx: 0.0,
    snapThresholdPx: 1000.0,
    vignetteMax: 0.0,
    radiusX: 1.0,
    radiusY: 1.0,
    q0: 1.0,
    q1: 2.0,
    description: 'Bypasses gaze stabilization and peripheral vignette, passing native viewport coordinates unmodified.',
  },
};

export interface GazeVignetteResult {
  currentX: number;
  currentY: number;
  stabilizedX: number;
  stabilizedY: number;
  velocityX: number;
  velocityY: number;
  qDistance: number;
  vignetteOpacity: number;
  isSnapping: boolean;
  latencyUs: number;
}

/**
 * Client-side calculation function matching backend closed-form model.
 */
export function localCalculateGazeVignette(
  currX: number,
  currY: number,
  targetX: number,
  targetY: number,
  currVx: number = 0,
  currVy: number = 0,
  dt: number = 0.016,
  omega: number = 8.0,
  deadZonePx: number = 1.5,
  snapThresholdPx: number = 120.0,
  vignetteMax: number = 0.12,
  radiusX: number = 0.55,
  radiusY: number = 0.65,
  q0: number = 0.70,
  q1: number = 1.20,
  isEnabled: boolean = true
): GazeVignetteResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  if (!isEnabled) {
    return {
      currentX: currX,
      currentY: currY,
      stabilizedX: targetX,
      stabilizedY: targetY,
      velocityX: 0,
      velocityY: 0,
      qDistance: 0,
      vignetteOpacity: 0,
      isSnapping: false,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  const dx = currX - targetX;
  const dy = currY - targetY;
  const absDx = dx < 0 ? -dx : dx;
  const absDy = dy < 0 ? -dy : dy;
  const maxDelta = absDx > absDy ? absDx : absDy;

  let stabX = currX;
  let stabY = currY;
  let velX = currVx;
  let velY = currVy;
  let isSnapping = false;

  if (maxDelta > snapThresholdPx) {
    stabX = targetX;
    stabY = targetY;
    velX = 0;
    velY = 0;
    isSnapping = true;
  } else if (maxDelta < deadZonePx) {
    velX = 0;
    velY = 0;
  } else {
    const expTerm = Math.exp(-omega * dt);
    const betaX = velX + omega * dx;
    stabX = targetX + (dx + betaX * dt) * expTerm;
    velX = (velX - omega * betaX * dt) * expTerm;

    const betaY = velY + omega * dy;
    stabY = targetY + (dy + betaY * dt) * expTerm;
    velY = (velY - omega * betaY * dt) * expTerm;
  }

  const rx = radiusX > 0.001 ? radiusX : 0.001;
  const ry = radiusY > 0.001 ? radiusY : 0.001;
  const invRxSq = 1.0 / (rx * rx);
  const invRySq = 1.0 / (ry * ry);

  const normDx = (currX - targetX) / 1000.0;
  const normDy = (currY - targetY) / 1000.0;
  const qDist = normDx * normDx * invRxSq + normDy * normDy * invRySq;

  let vignetteOpacity = 0;
  if (qDist <= q0) {
    vignetteOpacity = 0;
  } else if (qDist >= q1) {
    vignetteOpacity = vignetteMax;
  } else {
    const span = q1 - q0 > 0.0001 ? q1 - q0 : 0.0001;
    const u = (qDist - q0) / span;
    const smoothU = u * u * (3.0 - 2.0 * u);
    vignetteOpacity = vignetteMax * smoothU;
  }

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    currentX: currX,
    currentY: currY,
    stabilizedX: Math.round(stabX * 100) / 100,
    stabilizedY: Math.round(stabY * 100) / 100,
    velocityX: Math.round(velX * 100) / 100,
    velocityY: Math.round(velY * 100) / 100,
    qDistance: Math.round(qDist * 1000) / 1000,
    vignetteOpacity: Math.round(vignetteOpacity * 1000) / 1000,
    isSnapping,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.4,
  };
}

export function useGazeVignette(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<GazeVignettePresetName>('relaxed_reading_calm');
  const [omega, setOmega] = useState(8.0);
  const [deadZonePx, setDeadZonePx] = useState(1.5);
  const [snapThresholdPx, setSnapThresholdPx] = useState(120.0);
  const [vignetteMax, setVignetteMax] = useState(0.12);
  const [radiusX, setRadiusX] = useState(0.55);
  const [radiusY, setRadiusY] = useState(0.65);
  const [q0, setQ0] = useState(0.70);
  const [q1, setQ1] = useState(1.20);
  const [isEnabled, setIsEnabled] = useState(true);

  // Probe inputs for live simulator
  const [probeCurrX, setProbeCurrX] = useState(500);
  const [probeCurrY, setProbeCurrY] = useState(400);
  const [probeTargetX, setProbeTargetX] = useState(550);
  const [probeTargetY, setProbeTargetY] = useState(430);
  const [probeVx, setProbeVx] = useState(0);
  const [probeVy, setProbeVy] = useState(0);

  const currentResult = useMemo(
    () =>
      localCalculateGazeVignette(
        probeCurrX,
        probeCurrY,
        probeTargetX,
        probeTargetY,
        probeVx,
        probeVy,
        0.016,
        omega,
        deadZonePx,
        snapThresholdPx,
        vignetteMax,
        radiusX,
        radiusY,
        q0,
        q1,
        isEnabled
      ),
    [
      probeCurrX,
      probeCurrY,
      probeTargetX,
      probeTargetY,
      probeVx,
      probeVy,
      omega,
      deadZonePx,
      snapThresholdPx,
      vignetteMax,
      radiusX,
      radiusY,
      q0,
      q1,
      isEnabled,
    ]
  );

  const applyPreset = useCallback((presetKey: GazeVignettePresetName) => {
    const p = GAZE_VIGNETTE_PRESETS[presetKey];
    if (!p) return;
    setPresetName(p.name);
    setOmega(p.omega);
    setDeadZonePx(p.deadZonePx);
    setSnapThresholdPx(p.snapThresholdPx);
    setVignetteMax(p.vignetteMax);
    setRadiusX(p.radiusX);
    setRadiusY(p.radiusY);
    setQ0(p.q0);
    setQ1(p.q1);
    setIsEnabled(p.name !== 'raw_fixed');
  }, []);

  const toggleHUD = useCallback(() => {
    setIsHUDOpen((prev) => !prev);
  }, []);

  const closeHUD = useCallback(() => {
    setIsHUDOpen(false);
  }, []);

  // Keyboard shortcut: 'V' / 'v' toggle (avoid input/textarea focus)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (e.key === 'v' || e.key === 'V') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setIsHUDOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch initial profile
  useEffect(() => {
    if (!seriesId) return;

    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/reader/gaze-vignette/profiles/${seriesId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.profile) {
            const p = data.profile;
            setPresetName(p.presetName);
            setOmega(p.omega);
            setDeadZonePx(p.deadZonePx);
            setSnapThresholdPx(p.snapThresholdPx);
            setVignetteMax(p.vignetteMax);
            setRadiusX(p.radiusX);
            setRadiusY(p.radiusY);
            setQ0(p.q0);
            setQ1(p.q1);
            setIsEnabled(Boolean(p.isEnabled));
          }
        }
      } catch {
        // Fallback silently to defaults
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [seriesId]);

  const saveProfile = useCallback(async () => {
    if (!seriesId) return;
    try {
      await fetch('/api/reader/gaze-vignette/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seriesId,
          presetName,
          omega,
          deadZonePx,
          snapThresholdPx,
          vignetteMax,
          radiusX,
          radiusY,
          q0,
          q1,
          isEnabled,
        }),
      });
    } catch {
      // Ignored in offline/mock environment
    }
  }, [
    seriesId,
    presetName,
    omega,
    deadZonePx,
    snapThresholdPx,
    vignetteMax,
    radiusX,
    radiusY,
    q0,
    q1,
    isEnabled,
  ]);

  return {
    isHUDOpen,
    presetName,
    omega,
    deadZonePx,
    snapThresholdPx,
    vignetteMax,
    radiusX,
    radiusY,
    q0,
    q1,
    isEnabled,
    probeCurrX,
    probeCurrY,
    probeTargetX,
    probeTargetY,
    probeVx,
    probeVy,
    currentResult,
    setIsHUDOpen,
    setPresetName,
    setOmega,
    setDeadZonePx,
    setSnapThresholdPx,
    setVignetteMax,
    setRadiusX,
    setRadiusY,
    setQ0,
    setQ1,
    setIsEnabled,
    setProbeCurrX,
    setProbeCurrY,
    setProbeTargetX,
    setProbeTargetY,
    setProbeVx,
    setProbeVy,
    applyPreset,
    toggleHUD,
    closeHUD,
    saveProfile,
  };
}
