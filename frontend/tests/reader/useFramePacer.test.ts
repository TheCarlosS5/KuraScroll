import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFramePacer } from '../../src/reader/useFramePacer.js';

describe('useFramePacer React Hook Unit Tests (Sprint 54)', () => {
  it('initializes with nominal_60 state and default 60 FPS stats', () => {
    const { result } = renderHook(() => useFramePacer());

    expect(result.current.governorState).toBe('nominal_60');
    expect(result.current.stats.fps).toBe(60.0);
    expect(result.current.stats.dropRatePct).toBe(0.0);
  });

  it('records frame ticks and maintains nominal state under 16.6ms intervals', () => {
    const { result } = renderHook(() => useFramePacer());

    act(() => {
      let t = 1000;
      for (let i = 0; i < 20; i++) {
        result.current.recordFrame(t);
        t += 16.67;
      }
      result.current.refreshStats();
    });

    expect(result.current.governorState).toBe('nominal_60');
    expect(result.current.stats.samplesCount).toBeGreaterThanOrEqual(19);
  });

  it('allows manual override to paced_30 and back to null', () => {
    const { result } = renderHook(() => useFramePacer());

    act(() => {
      result.current.setManualOverride('paced_30');
    });

    expect(result.current.governorState).toBe('paced_30');

    act(() => {
      result.current.setManualOverride(null);
    });

    expect(result.current.governorState).toBe('nominal_60');
  });

  it('handles tab visibilitychange suspension gracefully', () => {
    const { result } = renderHook(() => useFramePacer());

    act(() => {
      // Simulate tab hidden
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    act(() => {
      // Simulate tab visible again
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.governorState).toBe('nominal_60');
  });
});
