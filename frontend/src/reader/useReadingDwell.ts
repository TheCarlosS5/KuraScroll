/**
 * KuraScroll - Sprint 98: Predictive Intelligent Pre-Reading Micro-Heatmap Dwell Predictor Hook
 * 
 * Hardware-tuned for Intel Pentium T4500 & Mechanical 4TB HDD (5400 RPM).
 * Predicts reader dwell time per page based on reading velocity and scene density.
 * Defers physical HDD head seek requests until the urgency threshold (<= 800ms) is reached.
 * Bound to key 'D' for HUD toggling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

export type PredictionMode = 'cadence_adaptive' | 'action_heavy' | 'dialogue_dense' | 'custom';

export interface ReadingDwellPresetConfig {
  mode: PredictionMode;
  label: string;
  baseDwellMs: number;
  complexityWeight: number;
  urgencyThresholdMs: number;
  isPrefetchTriggerEnabled: boolean;
  description: string;
}

export const READING_DWELL_PRESETS: Record<PredictionMode, ReadingDwellPresetConfig> = {
  cadence_adaptive: {
    mode: 'cadence_adaptive',
    label: 'Cadence Adaptive (Standard Shōnen/Seinen)',
    baseDwellMs: 4500,
    complexityWeight: 1.25,
    urgencyThresholdMs: 800,
    isPrefetchTriggerEnabled: true,
    description: 'Dynamic pacing based on moving average reading velocity and visual panel complexity',
  },
  action_heavy: {
    mode: 'action_heavy',
    label: 'Action Heavy (Fast Double Spreads & Kinetic Combat)',
    baseDwellMs: 2500,
    complexityWeight: 0.85,
    urgencyThresholdMs: 600,
    isPrefetchTriggerEnabled: true,
    description: 'Rapid page turnaround with accelerated prefetch priming for splash panels and battle sequences',
  },
  dialogue_dense: {
    mode: 'dialogue_dense',
    label: 'Dialogue Dense (Mystery & Psychological)',
    baseDwellMs: 7500,
    complexityWeight: 1.80,
    urgencyThresholdMs: 1000,
    isPrefetchTriggerEnabled: true,
    description: 'Extended dwell allowance with late seek dispatch for text-heavy psychological manga',
  },
  custom: {
    mode: 'custom',
    label: 'Custom User Cadence Profile',
    baseDwellMs: 4500,
    complexityWeight: 1.25,
    urgencyThresholdMs: 800,
    isPrefetchTriggerEnabled: true,
    description: 'Custom tuned dwell parameters and prefetch thresholds',
  },
};

export interface UseReadingDwellProps {
  seriesId?: string;
  initialMode?: PredictionMode;
}

export interface UseReadingDwellReturn {
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  isHUDVisible: boolean;
  setIsHUDVisible: (visible: boolean) => void;
  mode: PredictionMode;
  setMode: (mode: PredictionMode) => void;
  baseDwellMs: number;
  setBaseDwellMs: (val: number) => void;
  complexityWeight: number;
  setComplexityWeight: (val: number) => void;
  urgencyThresholdMs: number;
  setUrgencyThresholdMs: (val: number) => void;
  isPrefetchTriggerEnabled: boolean;
  setIsPrefetchTriggerEnabled: (val: boolean) => void;
  elapsedMs: number;
  setElapsedMs: (val: number) => void;
  predictedTotalDwellMs: number;
  remainingDwellMs: number;
  progressPct: number;
  isUrgentPrefetchTriggered: boolean;
  urgencyRatio: number;
  dwellProgressBarColor: string;
  toggleHUD: () => void;
  resetToPreset: (mode: PredictionMode) => void;
  togglePrefetchTrigger: () => void;
  resetElapsedMs: () => void;
}

export function useReadingDwell({
  seriesId,
  initialMode = 'cadence_adaptive',
}: UseReadingDwellProps = {}): UseReadingDwellReturn {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isHUDVisible, setIsHUDVisible] = useState<boolean>(false);
  const [mode, setModeState] = useState<PredictionMode>(initialMode);

  const initialConfig = READING_DWELL_PRESETS[initialMode] || READING_DWELL_PRESETS.cadence_adaptive;
  const [baseDwellMs, setBaseDwellMs] = useState<number>(initialConfig.baseDwellMs);
  const [complexityWeight, setComplexityWeight] = useState<number>(initialConfig.complexityWeight);
  const [urgencyThresholdMs, setUrgencyThresholdMs] = useState<number>(initialConfig.urgencyThresholdMs);
  const [isPrefetchTriggerEnabled, setIsPrefetchTriggerEnabled] = useState<boolean>(initialConfig.isPrefetchTriggerEnabled);
  const [elapsedMs, setElapsedMs] = useState<number>(0);

  const toggleHUD = useCallback(() => {
    setIsHUDVisible((prev) => !prev);
  }, []);

  const resetToPreset = useCallback((targetMode: PredictionMode) => {
    const config = READING_DWELL_PRESETS[targetMode] || READING_DWELL_PRESETS.cadence_adaptive;
    setModeState(targetMode);
    setBaseDwellMs(config.baseDwellMs);
    setComplexityWeight(config.complexityWeight);
    setUrgencyThresholdMs(config.urgencyThresholdMs);
    setIsPrefetchTriggerEnabled(config.isPrefetchTriggerEnabled);
  }, []);

  const setMode = useCallback((newMode: PredictionMode) => {
    resetToPreset(newMode);
  }, [resetToPreset]);

  const togglePrefetchTrigger = useCallback(() => {
    setIsPrefetchTriggerEnabled((prev) => !prev);
  }, []);

  const resetElapsedMs = useCallback(() => {
    setElapsedMs(0);
  }, []);

  // Keyboard shortcut: 'D' toggles HUD
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl && (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        toggleHUD();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleHUD]);

  // Derived metrics calculation with zero GC allocations
  const {
    predictedTotalDwellMs,
    remainingDwellMs,
    progressPct,
    isUrgentPrefetchTriggered,
    urgencyRatio,
    dwellProgressBarColor,
  } = useMemo(() => {
    if (!isEnabled) {
      return {
        predictedTotalDwellMs: 0,
        remainingDwellMs: 0,
        progressPct: 0,
        isUrgentPrefetchTriggered: false,
        urgencyRatio: 0,
        dwellProgressBarColor: '#71717a',
      };
    }

    const clampedBase = Math.max(1000, Math.min(30000, Math.round(baseDwellMs)));
    const clampedWeight = Math.max(0.50, Math.min(3.00, parseFloat(complexityWeight.toFixed(2))));
    const clampedUrgency = Math.max(200, Math.min(3000, Math.round(urgencyThresholdMs)));
    const clampedElapsed = Math.max(0, Math.round(elapsedMs));

    const total = Math.round(clampedBase * clampedWeight);
    const remaining = Math.max(0, total - clampedElapsed);
    const pct = total > 0
      ? Math.min(100, Math.round((clampedElapsed / total) * 100))
      : 100;

    const isUrgent = isPrefetchTriggerEnabled && remaining <= clampedUrgency;
    const ratio = total > 0
      ? parseFloat(((total - remaining) / total).toFixed(2))
      : 1.0;

    let barColor = '#38bdf8'; // Sky blue standard
    if (isUrgent) {
      barColor = '#10b981'; // Emerald: prefetch triggered
    } else if (remaining <= clampedUrgency * 1.5) {
      barColor = '#f59e0b'; // Amber: entering prefetch window
    }

    return {
      predictedTotalDwellMs: total,
      remainingDwellMs: remaining,
      progressPct: pct,
      isUrgentPrefetchTriggered: isUrgent,
      urgencyRatio: ratio,
      dwellProgressBarColor: barColor,
    };
  }, [isEnabled, baseDwellMs, complexityWeight, urgencyThresholdMs, elapsedMs, isPrefetchTriggerEnabled]);

  return {
    isEnabled,
    setIsEnabled,
    isHUDVisible,
    setIsHUDVisible,
    mode,
    setMode,
    baseDwellMs,
    setBaseDwellMs,
    complexityWeight,
    setComplexityWeight,
    urgencyThresholdMs,
    setUrgencyThresholdMs,
    isPrefetchTriggerEnabled,
    setIsPrefetchTriggerEnabled,
    elapsedMs,
    setElapsedMs,
    predictedTotalDwellMs,
    remainingDwellMs,
    progressPct,
    isUrgentPrefetchTriggered,
    urgencyRatio,
    dwellProgressBarColor,
    toggleHUD,
    resetToPreset,
    togglePrefetchTrigger,
    resetElapsedMs,
  };
}
