import { useEffect, useRef, useState, useCallback } from 'react';
import { FramePacer, GovernorState, FramePacerStats } from '../utils/frame-pacer';

export interface UseFramePacerOptions {
  autoReportTelemetry?: boolean;
  userId?: string;
  readingMode?: string;
}

export function useFramePacer(options: UseFramePacerOptions = {}) {
  const pacerRef = useRef<FramePacer | null>(null);
  if (!pacerRef.current) {
    pacerRef.current = new FramePacer();
  }

  const [governorState, setGovernorState] = useState<GovernorState>('nominal_60');
  const [stats, setStats] = useState<FramePacerStats>(() => pacerRef.current!.calculateStats());

  // Handle tab visibility change to avoid background burst penalties
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        pacerRef.current?.pause();
      } else {
        pacerRef.current?.resume(performance.now());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const recordFrame = useCallback((timestamp: number) => {
    const pacer = pacerRef.current;
    if (!pacer) return { shouldRender: true, state: 'nominal_60' as GovernorState };

    const tick = pacer.recordFrame(timestamp);
    if (tick.state !== governorState) {
      setGovernorState(tick.state);
    }
    return tick;
  }, [governorState]);

  const setManualOverride = useCallback((override: GovernorState | null) => {
    pacerRef.current?.setManualOverride(override);
    const effective = pacerRef.current?.effectiveState() || 'nominal_60';
    setGovernorState(effective);
  }, []);

  const refreshStats = useCallback(() => {
    if (pacerRef.current) {
      setStats(pacerRef.current.calculateStats());
    }
  }, []);

  return {
    governorState,
    stats,
    recordFrame,
    setManualOverride,
    refreshStats,
  };
}
