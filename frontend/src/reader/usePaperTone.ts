/**
 * Sprint 64 - Client-Side Paper Tone & E-Ink Palette Remapper Hook
 *
 * Provides reactive paper tone preset selection, parameter adjustments (warmth, contrast, brightness),
 * hardware-accelerated SVG matrix synthesis, and keyboard accessibility ('T').
 * Designed for Intel GMA 4500MHD: 0 CSS blur, 0 backdrop-filter, CLS = 0.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

export type PaperTonePreset =
  | 'ORIGINAL'
  | 'SEPIA_CALIDO'
  | 'PAPEL_E_INK'
  | 'PERIODICO_VINTAGE'
  | 'AMBAR_MEDIANOCHE'
  | 'NOIR_ALTO_CONTRASTE';

export const PRESET_MATRICES: Record<PaperTonePreset, number[]> = {
  ORIGINAL: [
    1, 0, 0, 0, 0,
    0, 1, 0, 0, 0,
    0, 0, 1, 0, 0,
    0, 0, 0, 1, 0,
  ],
  SEPIA_CALIDO: [
    0.393, 0.769, 0.189, 0, 0.05,
    0.349, 0.686, 0.168, 0, 0.02,
    0.272, 0.534, 0.131, 0, -0.02,
    0, 0, 0, 1, 0,
  ],
  PAPEL_E_INK: [
    0.280, 0.560, 0.110, 0, 0.04,
    0.280, 0.560, 0.110, 0, 0.04,
    0.260, 0.540, 0.100, 0, 0.02,
    0, 0, 0, 1, 0,
  ],
  PERIODICO_VINTAGE: [
    0.350, 0.650, 0.150, 0, 0.08,
    0.320, 0.620, 0.140, 0, 0.06,
    0.250, 0.500, 0.100, 0, 0.01,
    0, 0, 0, 1, 0,
  ],
  AMBAR_MEDIANOCHE: [
    0.350, 0.650, 0.150, 0, 0.10,
    0.250, 0.550, 0.100, 0, 0.04,
    0.020, 0.050, 0.010, 0, 0.00,
    0, 0, 0, 1, 0,
  ],
  NOIR_ALTO_CONTRASTE: [
    0.500, 1.000, 0.200, 0, -0.15,
    0.500, 1.000, 0.200, 0, -0.15,
    0.500, 1.000, 0.200, 0, -0.15,
    0, 0, 0, 1, 0,
  ],
};

export function computeClientSvgMatrix(
  preset: PaperTonePreset,
  warmth = 0.0,
  contrast = 1.0,
  brightness = 1.0
): string {
  const base = [...(PRESET_MATRICES[preset] || PRESET_MATRICES.ORIGINAL)];

  // Apply brightness
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      base[row * 5 + col] *= brightness;
    }
  }

  // Apply contrast
  if (contrast !== 1.0) {
    const offset = 0.5 * (1.0 - contrast);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        base[row * 5 + col] *= contrast;
      }
      base[row * 5 + 4] += offset;
    }
  }

  // Apply warmth
  if (warmth !== 0.0) {
    base[0 * 5 + 4] += warmth * 0.08;
    base[2 * 5 + 4] += -warmth * 0.12;
  }

  return base
    .map((v) => Math.round(Math.max(-2.0, Math.min(2.0, v)) * 1000) / 1000)
    .join(' ');
}

export interface UsePaperToneOptions {
  seriesId?: string;
  userId?: string;
  apiBaseUrl?: string;
  enableKeyboardShortcut?: boolean;
}

export interface UsePaperToneReturn {
  preset: PaperTonePreset;
  warmth: number;
  contrast: number;
  brightness: number;
  svgMatrix: string;
  filterStyle: React.CSSProperties;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  setPreset: (preset: PaperTonePreset) => void;
  setWarmth: (warmth: number) => void;
  setContrast: (contrast: number) => void;
  setBrightness: (brightness: number) => void;
  saveProfile: () => Promise<void>;
  resetToDefault: () => Promise<void>;
  open: () => void;
  close: () => void;
  toggleOpen: () => void;
}

export function usePaperTone(options: UsePaperToneOptions = {}): UsePaperToneReturn {
  const {
    seriesId,
    userId = 'default_user',
    apiBaseUrl = '',
    enableKeyboardShortcut = true,
  } = options;

  const [preset, setPresetState] = useState<PaperTonePreset>('ORIGINAL');
  const [warmth, setWarmthState] = useState(0.0);
  const [contrast, setContrastState] = useState(1.0);
  const [brightness, setBrightnessState] = useState(1.0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);

  const setPreset = useCallback((p: PaperTonePreset) => {
    setPresetState(p);
  }, []);

  const setWarmth = useCallback((w: number) => {
    setWarmthState(Math.max(-1.0, Math.min(1.0, Math.round(w * 100) / 100)));
  }, []);

  const setContrast = useCallback((c: number) => {
    setContrastState(Math.max(0.5, Math.min(2.0, Math.round(c * 100) / 100)));
  }, []);

  const setBrightness = useCallback((b: number) => {
    setBrightnessState(Math.max(0.5, Math.min(1.5, Math.round(b * 100) / 100)));
  }, []);

  // Compute SVG matrix dynamically
  const svgMatrix = useMemo(() => {
    return computeClientSvgMatrix(preset, warmth, contrast, brightness);
  }, [preset, warmth, contrast, brightness]);

  // CSS filter attribute applying SVG matrix by id
  const filterStyle = useMemo<React.CSSProperties>(() => {
    if (preset === 'ORIGINAL' && warmth === 0.0 && contrast === 1.0 && brightness === 1.0) {
      return {};
    }
    return {
      filter: 'url(#kura-paper-tone-filter)',
    };
  }, [preset, warmth, contrast, brightness]);

  // Fetch initial profile
  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (userId) queryParams.set('userId', userId);
        if (seriesId) queryParams.set('seriesId', seriesId);

        const res = await fetch(`${apiBaseUrl}/api/v1/reader/tone/profile?${queryParams.toString()}`);
        if (!res.ok) return;

        const data = await res.json();
        if (isMounted && data.profile) {
          setPresetState(data.profile.preset || 'ORIGINAL');
          setWarmthState(data.profile.warmth ?? 0.0);
          setContrastState(data.profile.contrast ?? 1.0);
          setBrightnessState(data.profile.brightness ?? 1.0);
        }
      } catch {}
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [seriesId, userId, apiBaseUrl]);

  // Save profile to backend
  const saveProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/reader/tone/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          seriesId: seriesId || null,
          preset,
          warmth,
          contrast,
          brightness,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save tone profile: HTTP ${res.status}`);
      }
    } catch (err: any) {
      setError(err.message || 'Error saving paper tone profile');
    } finally {
      setIsLoading(false);
    }
  }, [userId, seriesId, preset, warmth, contrast, brightness, apiBaseUrl]);

  // Reset profile to default
  const resetToDefault = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (userId) queryParams.set('userId', userId);
      if (seriesId) queryParams.set('seriesId', seriesId);

      await fetch(`${apiBaseUrl}/api/v1/reader/tone/profile?${queryParams.toString()}`, {
        method: 'DELETE',
      });

      setPresetState('ORIGINAL');
      setWarmthState(0.0);
      setContrastState(1.0);
      setBrightnessState(1.0);
    } catch (err: any) {
      setError(err.message || 'Error resetting paper tone profile');
    } finally {
      setIsLoading(false);
    }
  }, [userId, seriesId, apiBaseUrl]);

  // Keyboard shortcut 't' to toggle HUD
  useEffect(() => {
    if (!enableKeyboardShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        toggleOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardShortcut, toggleOpen]);

  return {
    preset,
    warmth,
    contrast,
    brightness,
    svgMatrix,
    filterStyle,
    isOpen,
    isLoading,
    error,
    setPreset,
    setWarmth,
    setContrast,
    setBrightness,
    saveProfile,
    resetToDefault,
    open,
    close,
    toggleOpen,
  };
}
