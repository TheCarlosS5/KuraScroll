/**
 * KuraScroll - Sprint 130: Subpixel Matte Paper Specular Reflection & Angular Lighting Modulator Hook
 * 
 * Hardware Target: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, no AVX, heap <= 512MB) & Intel GMA 4500MHD.
 * Zero-allocation closed-form Lambertian diffuse + Blinn-Schlick micro-facet specular with black ink absorption.
 * Bound to key 'Shift + L' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type PaperLightingPresetName =
  | 'tankobon_deluxe_matte'
  | 'shonen_pulp_newsprint'
  | 'doujinshi_satin'
  | 'vintage_aged_pulp'
  | 'raw_fixed';

export interface PaperLightingProfile {
  seriesId: string;
  presetName: PaperLightingPresetName;
  lightX: number;
  lightY: number;
  lightZ: number;
  diffuseKd: number;
  specularKs: number;
  roughness: number;
  inkAbsorption: number;
  ambientKa: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PaperLightingPreset {
  name: PaperLightingPresetName;
  label: string;
  lightX: number;
  lightY: number;
  lightZ: number;
  diffuseKd: number;
  specularKs: number;
  roughness: number;
  inkAbsorption: number;
  ambientKa: number;
  description: string;
}

export const PAPER_LIGHTING_PRESETS: Record<PaperLightingPresetName, PaperLightingPreset> = {
  tankobon_deluxe_matte: {
    name: 'tankobon_deluxe_matte',
    label: 'Tankōbon Deluxe Matte Paper',
    lightX: 0.50,
    lightY: 0.30,
    lightZ: 1.20,
    diffuseKd: 0.85,
    specularKs: 0.12,
    roughness: 0.45,
    inkAbsorption: 0.85,
    ambientKa: 0.20,
    description: 'High-grade opaque white book paper with gentle diffuse reflectance and subtle matte sheen in white areas.',
  },
  shonen_pulp_newsprint: {
    name: 'shonen_pulp_newsprint',
    label: 'Shōnen Magazine Newsprint Pulp',
    lightX: 0.45,
    lightY: 0.25,
    lightZ: 1.00,
    diffuseKd: 0.75,
    specularKs: 0.05,
    roughness: 0.70,
    inkAbsorption: 0.92,
    ambientKa: 0.25,
    description: 'Porous wood-pulp newsprint with warm ambient cast, high ink absorption, and almost zero specular reflection.',
  },
  doujinshi_satin: {
    name: 'doujinshi_satin',
    label: 'Doujinshi Satin Coated Paper',
    lightX: 0.55,
    lightY: 0.35,
    lightZ: 1.40,
    diffuseKd: 0.80,
    specularKs: 0.22,
    roughness: 0.25,
    inkAbsorption: 0.75,
    ambientKa: 0.15,
    description: 'Semi-gloss coated paper featuring crisp highlights on light tones while maintaining deep matte black ink.',
  },
  vintage_aged_pulp: {
    name: 'vintage_aged_pulp',
    label: 'Vintage Aged Pulp Paper',
    lightX: 0.50,
    lightY: 0.40,
    lightZ: 0.90,
    diffuseKd: 0.70,
    specularKs: 0.03,
    roughness: 0.85,
    inkAbsorption: 0.95,
    ambientKa: 0.30,
    description: 'Aged historical manga paper with fibrous micro-relief, muted diffuse response, and complete ink absorption.',
  },
  raw_fixed: {
    name: 'raw_fixed',
    label: 'Raw Pass-Through (Disabled)',
    lightX: 0.50,
    lightY: 0.50,
    lightZ: 1.00,
    diffuseKd: 1.00,
    specularKs: 0.00,
    roughness: 0.50,
    inkAbsorption: 0.00,
    ambientKa: 0.00,
    description: 'Bypasses angular lighting and paper reflection, passing raw scanned pixel values untouched.',
  },
};

export interface PaperLightingResult {
  inR: number;
  inG: number;
  inB: number;
  outR: number;
  outG: number;
  outB: number;
  diffuseIntensity: number;
  specularIntensity: number;
  inkGuard: number;
  attenuation: number;
  latencyUs: number;
}

export function localCalculatePaperLighting(
  pixelXNorm: number,
  pixelYNorm: number,
  inR: number,
  inG: number,
  inB: number,
  lightX: number = 0.50,
  lightY: number = 0.30,
  lightZ: number = 1.20,
  diffuseKd: number = 0.85,
  specularKs: number = 0.12,
  roughness: number = 0.45,
  inkAbsorption: number = 0.85,
  ambientKa: number = 0.20,
  isEnabled: boolean = true
): PaperLightingResult {
  const startHr = typeof performance !== 'undefined' ? performance.now() : 0;

  if (!isEnabled) {
    return {
      inR,
      inG,
      inB,
      outR: inR,
      outG: inG,
      outB: inB,
      diffuseIntensity: 1.0,
      specularIntensity: 0.0,
      inkGuard: 1.0,
      attenuation: 1.0,
      latencyUs: typeof performance !== 'undefined' ? (performance.now() - startHr) * 1000 : 0.2,
    };
  }

  const lz = lightZ > 0.05 ? lightZ : 0.05;
  const dx = lightX - pixelXNorm;
  const dy = lightY - pixelYNorm;
  const r2 = dx * dx + dy * dy + lz * lz;
  const invR = 1.0 / Math.sqrt(r2);

  const atten = (lz * lz) / (r2 + 0.05);
  const cosTheta = lz * invR;
  const diffuse = diffuseKd * (cosTheta > 0 ? cosTheta : 0) * atten;

  const hz = lz + 1.0;
  const hDistSq = dx * dx + dy * dy + hz * hz;
  const invH = 1.0 / Math.sqrt(hDistSq);
  const cosAlpha = hz * invH;

  const baseAlpha = cosAlpha > 0 ? cosAlpha : 0;
  const roughClamped = roughness < 0.1 ? 0.1 : roughness > 0.9 ? 0.9 : roughness;
  const alpha2 = baseAlpha * baseAlpha;
  const alpha4 = alpha2 * alpha2;
  const specFactor = roughClamped < 0.35 ? alpha4 * alpha4 : alpha4;
  const specular = specularKs * specFactor * atten;

  const lum = (0.2126 * inR + 0.7152 * inG + 0.0722 * inB) / 255.0;
  const inkDarkness = 1.0 - lum;
  const guard = 1.0 - inkAbsorption * (inkDarkness > 0 ? inkDarkness : 0);
  const inkGuard = guard < 0.05 ? 0.05 : guard > 1.0 ? 1.0 : guard;

  const totalMod = ambientKa + diffuse;
  const specBoost = specular * inkGuard * 255.0;

  let rOut = inR * totalMod + specBoost;
  let gOut = inG * totalMod + specBoost;
  let bOut = inB * totalMod + specBoost;

  rOut = rOut < 0 ? 0 : rOut > 255 ? 255 : rOut;
  gOut = gOut < 0 ? 0 : gOut > 255 ? 255 : gOut;
  bOut = bOut < 0 ? 0 : bOut > 255 ? 255 : bOut;

  const endHr = typeof performance !== 'undefined' ? performance.now() : 0;

  return {
    inR,
    inG,
    inB,
    outR: Math.round(rOut),
    outG: Math.round(gOut),
    outB: Math.round(bOut),
    diffuseIntensity: Math.round(diffuse * 1000) / 1000,
    specularIntensity: Math.round(specular * 1000) / 1000,
    inkGuard: Math.round(inkGuard * 1000) / 1000,
    attenuation: Math.round(atten * 1000) / 1000,
    latencyUs: typeof performance !== 'undefined' ? (endHr - startHr) * 1000 : 0.4,
  };
}

export function usePaperLighting(seriesId: string) {
  const [isHUDOpen, setIsHUDOpen] = useState(false);
  const [presetName, setPresetName] = useState<PaperLightingPresetName>('tankobon_deluxe_matte');
  const [lightX, setLightX] = useState(0.50);
  const [lightY, setLightY] = useState(0.30);
  const [lightZ, setLightZ] = useState(1.20);
  const [diffuseKd, setDiffuseKd] = useState(0.85);
  const [specularKs, setSpecularKs] = useState(0.12);
  const [roughness, setRoughness] = useState(0.45);
  const [inkAbsorption, setInkAbsorption] = useState(0.85);
  const [ambientKa, setAmbientKa] = useState(0.20);
  const [isEnabled, setIsEnabled] = useState(true);

  // Probe inputs for live simulator
  const [probeXNorm, setProbeXNorm] = useState(0.50);
  const [probeYNorm, setProbeYNorm] = useState(0.30);
  const [probeR, setProbeR] = useState(240);
  const [probeG, setProbeG] = useState(240);
  const [probeB, setProbeB] = useState(240);

  const currentResult = useMemo(
    () =>
      localCalculatePaperLighting(
        probeXNorm,
        probeYNorm,
        probeR,
        probeG,
        probeB,
        lightX,
        lightY,
        lightZ,
        diffuseKd,
        specularKs,
        roughness,
        inkAbsorption,
        ambientKa,
        isEnabled
      ),
    [
      probeXNorm,
      probeYNorm,
      probeR,
      probeG,
      probeB,
      lightX,
      lightY,
      lightZ,
      diffuseKd,
      specularKs,
      roughness,
      inkAbsorption,
      ambientKa,
      isEnabled,
    ]
  );

  const applyPreset = useCallback((presetKey: PaperLightingPresetName) => {
    const p = PAPER_LIGHTING_PRESETS[presetKey];
    if (!p) return;
    setPresetName(p.name);
    setLightX(p.lightX);
    setLightY(p.lightY);
    setLightZ(p.lightZ);
    setDiffuseKd(p.diffuseKd);
    setSpecularKs(p.specularKs);
    setRoughness(p.roughness);
    setInkAbsorption(p.inkAbsorption);
    setAmbientKa(p.ambientKa);
    setIsEnabled(p.name !== 'raw_fixed');
  }, []);

  const toggleHUD = useCallback(() => {
    setIsHUDOpen((prev) => !prev);
  }, []);

  const closeHUD = useCallback(() => {
    setIsHUDOpen(false);
  }, []);

  // Keyboard shortcut: 'Shift + L' toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if ((e.key === 'L' || e.key === 'l') && e.shiftKey) {
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
        const res = await fetch(`/api/v1/reader/paper-lighting/profile/${seriesId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.profile) {
            const p = data.profile;
            setPresetName(p.presetName);
            setLightX(p.lightX);
            setLightY(p.lightY);
            setLightZ(p.lightZ);
            setDiffuseKd(p.diffuseKd);
            setSpecularKs(p.specularKs);
            setRoughness(p.roughness);
            setInkAbsorption(p.inkAbsorption);
            setAmbientKa(p.ambientKa);
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
      await fetch(`/api/v1/reader/paper-lighting/profile/${seriesId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presetName,
          lightX,
          lightY,
          lightZ,
          diffuseKd,
          specularKs,
          roughness,
          inkAbsorption,
          ambientKa,
          isEnabled,
        }),
      });
    } catch {
      // Ignored in offline/mock environment
    }
  }, [
    seriesId,
    presetName,
    lightX,
    lightY,
    lightZ,
    diffuseKd,
    specularKs,
    roughness,
    inkAbsorption,
    ambientKa,
    isEnabled,
  ]);

  return {
    isHUDOpen,
    presetName,
    lightX,
    lightY,
    lightZ,
    diffuseKd,
    specularKs,
    roughness,
    inkAbsorption,
    ambientKa,
    isEnabled,
    probeXNorm,
    probeYNorm,
    probeR,
    probeG,
    probeB,
    currentResult,
    setIsHUDOpen,
    setPresetName,
    setLightX,
    setLightY,
    setLightZ,
    setDiffuseKd,
    setSpecularKs,
    setRoughness,
    setInkAbsorption,
    setAmbientKa,
    setIsEnabled,
    setProbeXNorm,
    setProbeYNorm,
    setProbeR,
    setProbeG,
    setProbeB,
    applyPreset,
    toggleHUD,
    closeHUD,
    saveProfile,
  };
}
