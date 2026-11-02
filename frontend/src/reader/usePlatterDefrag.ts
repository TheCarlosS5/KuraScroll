/**
 * Sprint 63 - Client-Side Platter Defrag & Cylinder Re-Ordering Hook
 *
 * Provides reactive PLI monitoring, cylinder optimization dispatching,
 * and defragmentation progress tracking for 4TB Mechanical SATA II HDD.
 */

import { useState, useCallback, useEffect } from 'react';

export type DefragStatus = 'idle' | 'analyzing' | 'defragmenting' | 'complete';

export interface PlatterLocalityReport {
  seriesId?: string;
  totalChapters: number;
  pli: number;
  fragmentationPercent: number;
  isFragmented: boolean;
  recommendation: 'OPTIMAL' | 'ACCEPTABLE' | 'DEFRAGMENTATION_RECOMMENDED';
  estimatedSeekReductionPercent: number;
  measuredDurationMs: number;
}

export interface DefragOptimizationResult {
  seriesId: string;
  initialPli: number;
  optimizedPli: number;
  chaptersProcessed: number;
  bytesReordered: number;
  durationMs: number;
}

export interface UsePlatterDefragOptions {
  seriesId?: string;
  apiBaseUrl?: string;
  autoAnalyze?: boolean;
}

export interface UsePlatterDefragReturn {
  status: DefragStatus;
  report: PlatterLocalityReport | null;
  fragmentationPercent: number;
  pli: number;
  lastResult: DefragOptimizationResult | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  analyzeSeries: (targetSeriesId?: string) => Promise<PlatterLocalityReport | null>;
  optimizeSeries: (targetSeriesId?: string, maxChapters?: number) => Promise<DefragOptimizationResult | null>;
  open: () => void;
  close: () => void;
  toggleOpen: () => void;
}

export function usePlatterDefrag(
  options: UsePlatterDefragOptions = {}
): UsePlatterDefragReturn {
  const { seriesId, apiBaseUrl = '', autoAnalyze = false } = options;

  const [status, setStatus] = useState<DefragStatus>('idle');
  const [report, setReport] = useState<PlatterLocalityReport | null>(null);
  const [lastResult, setLastResult] = useState<DefragOptimizationResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);

  const analyzeSeries = useCallback(
    async (targetSeriesId?: string): Promise<PlatterLocalityReport | null> => {
      const id = targetSeriesId || seriesId;
      if (!id) {
        setError('No series ID specified for PLI analysis');
        return null;
      }

      setIsLoading(true);
      setStatus('analyzing');
      setError(null);

      try {
        const url = `${apiBaseUrl}/api/v1/storage/platter/pli?seriesId=${encodeURIComponent(id)}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to analyze series PLI: HTTP ${res.status}`);
        }
        const data = await res.json();
        const rep = data.report as PlatterLocalityReport;
        setReport(rep);
        setStatus('idle');
        return rep;
      } catch (err: any) {
        setError(err.message || 'Error evaluating platter locality');
        setStatus('idle');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [seriesId, apiBaseUrl]
  );

  const optimizeSeries = useCallback(
    async (
      targetSeriesId?: string,
      maxChapters?: number
    ): Promise<DefragOptimizationResult | null> => {
      const id = targetSeriesId || seriesId;
      if (!id) {
        setError('No series ID specified for platter optimization');
        return null;
      }

      setIsLoading(true);
      setStatus('defragmenting');
      setError(null);

      try {
        const url = `${apiBaseUrl}/api/v1/storage/platter/optimize`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seriesId: id, maxChapters }),
        });

        if (!res.ok) {
          throw new Error(`Failed to optimize series platter: HTTP ${res.status}`);
        }

        const data = await res.json();
        const optResult = data.result as DefragOptimizationResult;
        setLastResult(optResult);

        // Update local report to reflect optimized PLI
        setReport((prev) => ({
          seriesId: id,
          totalChapters: optResult.chaptersProcessed,
          estimatedSeekReductionPercent: 0,
          measuredDurationMs: optResult.durationMs,
          ...prev,
          pli: optResult.optimizedPli,
          fragmentationPercent: Math.round((1 - optResult.optimizedPli) * 1000) / 10,
          isFragmented: optResult.optimizedPli < 0.7,
          recommendation: 'OPTIMAL',
        }));

        setStatus('complete');
        return optResult;
      } catch (err: any) {
        setError(err.message || 'Error defragmenting platter sectors');
        setStatus('idle');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [seriesId, apiBaseUrl]
  );

  useEffect(() => {
    if (autoAnalyze && seriesId) {
      analyzeSeries(seriesId);
    }
  }, [autoAnalyze, seriesId, analyzeSeries]);

  const fragmentationPercent = report?.fragmentationPercent ?? 0;
  const pli = report?.pli ?? 1.0;

  return {
    status,
    report,
    fragmentationPercent,
    pli,
    lastResult,
    isOpen,
    isLoading,
    error,
    analyzeSeries,
    optimizeSeries,
    open,
    close,
    toggleOpen,
  };
}
