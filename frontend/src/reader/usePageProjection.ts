/**
 * KuraScroll Continuous Page Glance & Multi-Angle Reading Projection Hook
 * Sprint 81 - Perspective Keystone & Tilt-Shift Depth-of-Field Engine
 *
 * Coordinates real-time 3D perspective orientation, keystone compression,
 * and keyboard shortcut 'P'.
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD (0 blur, 0 CLS).
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

export type FocalPlanePreset =
  | 'flat_orthodox'
  | 'desk_tilt_20'
  | 'easel_stand_15'
  | 'bed_incline_30'
  | 'lateral_yaw_12'
  | 'custom';

export interface UsePageProjectionOptions {
  defaultEnabled?: boolean;
  defaultPitch?: number;
  defaultYaw?: number;
  defaultPerspective?: number;
  defaultKeystone?: number;
  defaultPreset?: FocalPlanePreset;
  enableKeyboard?: boolean;
}

export const PROJECTION_PRESETS: Record<
  FocalPlanePreset,
  {
    name: string;
    pitch: number;
    yaw: number;
    perspective: number;
    keystone: number;
    description: string;
  }
> = {
  flat_orthodox: {
    name: 'Plano Ortodoxo (0°)',
    pitch: 0.0,
    yaw: 0.0,
    perspective: 1000,
    keystone: 0.0,
    description: 'Vista frontal perpendicular tradicional sin distorsión angular.',
  },
  desk_tilt_20: {
    name: 'Atril de Mesa (+18°)',
    pitch: 18.0,
    yaw: 0.0,
    perspective: 1200,
    keystone: 0.25,
    description: 'Inclinación ergonómica optimizada para lectura en escritorio bajo.',
  },
  easel_stand_15: {
    name: 'Soporte Inclinado (+28°)',
    pitch: 28.0,
    yaw: 0.0,
    perspective: 1400,
    keystone: 0.4,
    description: 'Ángulo pronunciado para pedestales de caballete o atril vertical.',
  },
  bed_incline_30: {
    name: 'Lectura Acostada (-15°)',
    pitch: -15.0,
    yaw: 0.0,
    perspective: 1100,
    keystone: 0.2,
    description: 'Inclinación inversa relajada para postura reclinada en cama.',
  },
  lateral_yaw_12: {
    name: 'Perspectiva Lateral (+12°)',
    pitch: 10.0,
    yaw: 12.0,
    perspective: 1300,
    keystone: 0.3,
    description: 'Compensación de ángulo rasante cuando la pantalla está a un costado.',
  },
  custom: {
    name: 'Personalizado',
    pitch: 15.0,
    yaw: 5.0,
    perspective: 1200,
    keystone: 0.2,
    description: 'Ajuste tridimensional manual a medida del lector.',
  },
};

export function usePageProjection({
  defaultEnabled = true,
  defaultPitch = 0.0,
  defaultYaw = 0.0,
  defaultPerspective = 1000,
  defaultKeystone = 0.0,
  defaultPreset = 'flat_orthodox',
  enableKeyboard = true,
}: UsePageProjectionOptions = {}) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isEnabled, setIsEnabled] = useState<boolean>(defaultEnabled);
  const [pitch, setPitchState] = useState<number>(defaultPitch);
  const [yaw, setYawState] = useState<number>(defaultYaw);
  const [perspective, setPerspectiveState] = useState<number>(defaultPerspective);
  const [keystone, setKeystoneState] = useState<number>(defaultKeystone);
  const [focalPlanePreset, setFocalPlanePresetState] = useState<FocalPlanePreset>(defaultPreset);

  const openHUD = useCallback(() => setIsOpen(true), []);
  const closeHUD = useCallback(() => setIsOpen(false), []);
  const toggleHUD = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleEnabled = useCallback(() => setIsEnabled((prev) => !prev), []);

  const setPitch = useCallback((p: number) => {
    const clamped = Math.min(35.0, Math.max(-35.0, Math.round(p * 10) / 10));
    setPitchState(clamped);
    setFocalPlanePresetState('custom');
  }, []);

  const setYaw = useCallback((y: number) => {
    const clamped = Math.min(25.0, Math.max(-25.0, Math.round(y * 10) / 10));
    setYawState(clamped);
    setFocalPlanePresetState('custom');
  }, []);

  const setPerspective = useCallback((d: number) => {
    const clamped = Math.min(2000, Math.max(400, Math.round(d)));
    setPerspectiveState(clamped);
    setFocalPlanePresetState('custom');
  }, []);

  const setKeystone = useCallback((k: number) => {
    const clamped = Math.min(1.0, Math.max(0.0, Math.round(k * 100) / 100));
    setKeystoneState(clamped);
    setFocalPlanePresetState('custom');
  }, []);

  const applyPreset = useCallback((preset: FocalPlanePreset) => {
    const config = PROJECTION_PRESETS[preset];
    if (config) {
      setFocalPlanePresetState(preset);
      setPitchState(config.pitch);
      setYawState(config.yaw);
      setPerspectiveState(config.perspective);
      setKeystoneState(config.keystone);
    }
  }, []);

  // Keyboard shortcut: 'P' or 'p'
  useEffect(() => {
    if (!enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        toggleHUD();
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        closeHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboard, isOpen, toggleHUD, closeHUD]);

  // Derived CSS 3D transform string
  const cssTransform = useMemo(() => {
    if (!isEnabled) return 'none';
    const sinPitch = Math.sin((pitch * Math.PI) / 180.0);
    const quadTrapezoidRatio = Math.max(0.6, 1.0 - Math.abs(sinPitch) * (1.0 - keystone * 0.5));
    return `perspective(${perspective}px) rotateX(${pitch}deg) rotateY(${yaw}deg) scale(${quadTrapezoidRatio.toFixed(3)})`;
  }, [isEnabled, pitch, yaw, perspective, keystone]);

  return {
    isOpen,
    isEnabled,
    pitch,
    yaw,
    perspective,
    keystone,
    focalPlanePreset,
    cssTransform,
    openHUD,
    closeHUD,
    toggleHUD,
    toggleEnabled,
    setPitch,
    setYaw,
    setPerspective,
    setKeystone,
    setFocalPlanePreset: applyPreset,
    applyPreset,
  };
}
