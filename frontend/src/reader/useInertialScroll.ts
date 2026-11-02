/**
 * KuraScroll - Sprint 88: Saccadic Motion Trajectory Smoothing & Dynamic Inertial Scroller Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 & Intel GMA 4500MHD.
 * Provides a zero-allocation spring-damper / friction decay kinematic physics model
 * that converts jagged mechanical mouse-wheel notches into fluid 60 FPS gliding.
 * Bound to key 'N' for HUD toggling.
 */

import { useState, useEffect, useCallback } from 'react';

export type InertialPresetId = 'smooth_glider' | 'natural_paper' | 'crisp_snap';

export interface InertialPresetConfig {
  id: InertialPresetId;
  label: string;
  frictionCoefficient: number;
  springTension: number;
  velocityClampPx: number;
  description: string;
}

export const INERTIAL_PRESETS: Record<InertialPresetId, InertialPresetConfig> = {
  smooth_glider: {
    id: 'smooth_glider',
    label: 'Smooth Glider (Webtoon)',
    frictionCoefficient: 0.94,
    springTension: 100.0,
    velocityClampPx: 4000.0,
    description: 'Extended fluid gliding with minimal drag for long manhwa chapters',
  },
  natural_paper: {
    id: 'natural_paper',
    label: 'Natural Paper (Tactile)',
    frictionCoefficient: 0.90,
    springTension: 150.0,
    velocityClampPx: 3000.0,
    description: 'Balanced friction mimicking physical high-gsm manga paper drag',
  },
  crisp_snap: {
    id: 'crisp_snap',
    label: 'Crisp Snap (Snappy)',
    frictionCoefficient: 0.85,
    springTension: 220.0,
    velocityClampPx: 2500.0,
    description: 'High damping with fast deceleration to prevent dialogue overshoot',
  },
};

export interface UseInertialScrollProps {
  seriesId?: string;
  initialPreset?: InertialPresetId;
  onScrollUpdate?: (newPosition: number) => void;
}

export interface UseInertialScrollReturn {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean) => void;
  preset: InertialPresetId;
  setPreset: (preset: InertialPresetId) => void;
  currentPos: number;
  targetPos: number;
  velocity: number;
  isResting: boolean;
  frictionCoefficient: number;
  springTension: number;
  toggleHUD: () => void;
  applyImpulse: (deltaY: number) => void;
  stepPhysics: (deltaTimeMs?: number) => void;
}

export function useInertialScroll({
  seriesId,
  initialPreset = 'natural_paper',
  onScrollUpdate,
}: UseInertialScrollProps = {}): UseInertialScrollReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isHUDVisible, setIsHUDVisible] = useState<boolean>(false);
  const [preset, setPreset] = useState<InertialPresetId>(initialPreset);
  const [currentPos, setCurrentPos] = useState<number>(0);
  const [targetPos, setTargetPos] = useState<number>(0);
  const [velocity, setVelocity] = useState<number>(0);
  const [isResting, setIsResting] = useState<boolean>(true);

  const activeConfig = INERTIAL_PRESETS[preset] || INERTIAL_PRESETS.natural_paper;

  const toggleHUD = useCallback(() => {
    setIsHUDVisible((prev) => !prev);
  }, []);

  const applyImpulse = useCallback(
    (deltaY: number) => {
      if (!isEnabled) {
        setTargetPos((prev) => {
          const next = prev + deltaY;
          setCurrentPos(next);
          if (onScrollUpdate) onScrollUpdate(next);
          return next;
        });
        return;
      }

      setTargetPos((prev) => prev + deltaY);
      setVelocity((v) => {
        const nextV = v + deltaY * 8.0;
        return Math.max(-activeConfig.velocityClampPx, Math.min(activeConfig.velocityClampPx, nextV));
      });
      setIsResting(false);
    },
    [isEnabled, activeConfig, onScrollUpdate]
  );

  const stepPhysics = useCallback(
    (deltaTimeMs: number = 16.6667) => {
      if (isResting || !isEnabled) return;

      const dt = Math.min(0.1, deltaTimeMs / 1000);
      const displacement = currentPos - targetPos;
      const springForce = -activeConfig.springTension * displacement;
      const acceleration = springForce; // mass = 1.0

      let nextV = (velocity + acceleration * dt) * activeConfig.frictionCoefficient;
      nextV = Math.max(-activeConfig.velocityClampPx, Math.min(activeConfig.velocityClampPx, nextV));

      let nextP = currentPos + nextV * dt;

      if (Math.abs(nextV) < 0.10 && Math.abs(nextP - targetPos) < 0.1) {
        nextP = targetPos;
        nextV = 0;
        setIsResting(true);
      }

      setCurrentPos(nextP);
      setVelocity(nextV);
      if (onScrollUpdate) onScrollUpdate(nextP);
    },
    [isResting, isEnabled, currentPos, targetPos, velocity, activeConfig, onScrollUpdate]
  );

  // Global hotkey 'N' listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          toggleHUD();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleHUD]);

  return {
    isEnabled,
    setIsEnabled,
    isHUDVisible,
    setIsHUDVisible,
    preset,
    setPreset,
    currentPos,
    targetPos,
    velocity,
    isResting,
    frictionCoefficient: activeConfig.frictionCoefficient,
    springTension: activeConfig.springTension,
    toggleHUD,
    applyImpulse,
    stepPhysics,
  };
}
