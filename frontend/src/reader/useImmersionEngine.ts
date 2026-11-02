/**
 * Sprint 56 - React Hook for Dynamic Haptic Feedback & Screen Rumble Engine
 *
 * Integrates Web Vibration API, CSS translate3d compositor rumble,
 * accessibility gates (prefers-reduced-motion), battery saver, and thermal guard.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ImpactRouter,
  ImpactIntensity,
  ImpactSource,
  ImpactPolicy,
  ImpactDispatchDecision,
} from './ImpactRouter.js';
import { HapticDriver } from './HapticDriver.js';
import { ScreenRumbleDriver } from './ScreenRumbleDriver.js';

export interface ImmersionPreferencesState {
  hapticsEnabled: boolean;
  screenRumbleEnabled: boolean;
  maxHapticIntensity: ImpactIntensity;
  maxRumbleIntensity: ImpactIntensity;
  hapticsWithReducedMotion: boolean;
}

const DEFAULT_PREFERENCES: ImmersionPreferencesState = {
  hapticsEnabled: false,
  screenRumbleEnabled: false,
  maxHapticIntensity: 1,
  maxRumbleIntensity: 1,
  hapticsWithReducedMotion: false,
};

export function useImmersionEngine(options?: {
  batterySaver?: boolean;
  thermalState?: 0 | 1 | 2;
  stageElementRef?: React.RefObject<HTMLElement | null>;
}) {
  const [preferences, setPreferences] = useState<ImmersionPreferencesState>(DEFAULT_PREFERENCES);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isHapticSupported, setIsHapticSupported] = useState<boolean>(false);

  const routerRef = useRef<ImpactRouter>(new ImpactRouter());
  const hapticDriverRef = useRef<HapticDriver>(new HapticDriver());
  const rumbleDriverRef = useRef<ScreenRumbleDriver>(new ScreenRumbleDriver());

  // In-memory batch telemetry accumulator to prevent SATA II write amplification
  const batchTelemetryRef = useRef({
    triggerCount: 0,
    hapticApiAttempts: 0,
    hapticAcceptedCount: 0,
    hapticSuppressedCount: 0,
    rumbleAttemptCount: 0,
    rumbleExecutedCount: 0,
    rumbleSuppressedCount: 0,
  });

  // Attach stage element ref to rumble driver
  useEffect(() => {
    if (options?.stageElementRef?.current) {
      rumbleDriverRef.current.setTargetElement(options.stageElementRef.current);
    }
  }, [options?.stageElementRef]);

  // Check Web Vibration API availability
  useEffect(() => {
    setIsHapticSupported(hapticDriverRef.current.isSupported());
  }, []);

  // Listen to prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);

    const handler = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
      if (e.matches) {
        rumbleDriverRef.current.cancel();
      }
    };

    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  // Listen to visibilitychange: cancel immediately on hidden tab
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibility = () => {
      if (document.hidden) {
        hapticDriverRef.current.cancel();
        rumbleDriverRef.current.cancel();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Fetch initial preferences from backend
  useEffect(() => {
    let isMounted = true;
    async function loadPreferences() {
      try {
        const res = await fetch('/api/v1/users/me/immersion-preferences');
        if (res.ok) {
          const json = await res.json();
          if (json.data && isMounted) {
            setPreferences({
              hapticsEnabled: Boolean(json.data.hapticsEnabled),
              screenRumbleEnabled: Boolean(json.data.screenRumbleEnabled),
              maxHapticIntensity: json.data.maxHapticIntensity ?? 1,
              maxRumbleIntensity: json.data.maxRumbleIntensity ?? 1,
              hapticsWithReducedMotion: Boolean(json.data.hapticsWithReducedMotion),
            });
          }
        }
      } catch {
        // Fallback to local default
      }
    }
    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, []);

  // Flush telemetry batch
  const flushTelemetry = useCallback(async () => {
    const batch = batchTelemetryRef.current;
    if (batch.triggerCount === 0) return;

    const payload = {
      sessionId: 'session_' + (typeof window !== 'undefined' ? window.sessionStorage?.getItem('kura_session') || 'active' : 'default'),
      sourceType: 'sfx' as const,
      intensity: 1 as ImpactIntensity,
      ...batch,
    };

    // Reset buffer immediately
    batchTelemetryRef.current = {
      triggerCount: 0,
      hapticApiAttempts: 0,
      hapticAcceptedCount: 0,
      hapticSuppressedCount: 0,
      rumbleAttemptCount: 0,
      rumbleExecutedCount: 0,
      rumbleSuppressedCount: 0,
    };

    try {
      await fetch('/api/v1/telemetry/impact-batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // Non-critical telemetry failure
    }
  }, []);

  // Flush on beforeunload
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleUnload = () => {
      flushTelemetry();
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [flushTelemetry]);

  // Update preferences
  const updatePreferences = useCallback(
    async (patch: Partial<ImmersionPreferencesState>) => {
      const next = { ...preferences, ...patch };
      setPreferences(next);

      try {
        await fetch('/api/v1/users/me/immersion-preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        });
      } catch {
        // Optimistic local state preserved
      }
    },
    [preferences]
  );

  // Dispatch impact event
  const dispatchImpact = useCallback(
    (source: ImpactSource, intensity: ImpactIntensity, customId?: string): ImpactDispatchDecision => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const id = customId || `${source}_${intensity}_${Math.floor(now)}`;

      const policy: ImpactPolicy = {
        hapticsEnabled: preferences.hapticsEnabled,
        screenRumbleEnabled: preferences.screenRumbleEnabled,
        maxHapticIntensity: preferences.maxHapticIntensity,
        maxRumbleIntensity: preferences.maxRumbleIntensity,
        reducedMotion,
        hapticsWithReducedMotion: preferences.hapticsWithReducedMotion,
        batterySaver: Boolean(options?.batterySaver),
        thermalState: options?.thermalState ?? 0,
        documentVisible: typeof document !== 'undefined' ? !document.hidden : true,
      };

      const decision = routerRef.current.enqueue(
        {
          id,
          source,
          intensity,
          timestamp: now,
        },
        policy
      );

      // Track telemetry stats
      const tel = batchTelemetryRef.current;
      tel.triggerCount++;

      if (decision.accepted) {
        if (decision.dispatchedHapticIntensity !== undefined) {
          tel.hapticApiAttempts++;
          const ok = hapticDriverRef.current.trigger(decision.dispatchedHapticIntensity);
          if (ok) tel.hapticAcceptedCount++;
          else tel.hapticSuppressedCount++;
        }
        if (decision.dispatchedRumbleIntensity !== undefined) {
          tel.rumbleAttemptCount++;
          const ok = rumbleDriverRef.current.trigger(decision.dispatchedRumbleIntensity);
          if (ok) tel.rumbleExecutedCount++;
          else tel.rumbleSuppressedCount++;
        }
      } else {
        tel.hapticSuppressedCount++;
        tel.rumbleSuppressedCount++;
      }

      // Flush if batch threshold reached (32 impacts)
      if (tel.triggerCount >= 32) {
        flushTelemetry();
      }

      return decision;
    },
    [preferences, reducedMotion, options?.batterySaver, options?.thermalState, flushTelemetry]
  );

  const testVibration = useCallback((): boolean => {
    return hapticDriverRef.current.enableFromUserGesture();
  }, []);

  const testRumble = useCallback((): boolean => {
    return rumbleDriverRef.current.trigger(preferences.maxRumbleIntensity);
  }, [preferences.maxRumbleIntensity]);

  return {
    preferences,
    reducedMotion,
    isHapticSupported,
    updatePreferences,
    dispatchImpact,
    testVibration,
    testRumble,
    flushTelemetry,
  };
}
