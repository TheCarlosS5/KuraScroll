import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCloudlessSync } from '../reader/useCloudlessSync';

describe('Sprint 85 - useCloudlessSync Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options', () => {
    const { result } = renderHook(() =>
      useCloudlessSync({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.mode).toBe('local_broadcast');
    expect(result.current.localDeviceId).toBe('local_device');
    expect(result.current.vectorClock).toBe(1);
    expect(result.current.chaptersCompleted).toBe(0);
    expect(result.current.totalReadingSeconds).toBe(0);
    expect(result.current.streakDays).toBe(1);
    expect(result.current.milestoneUnlocked).toBeNull();
  });

  it('controls HUD visibility correctly', () => {
    const { result } = renderHook(() =>
      useCloudlessSync({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.openHUD();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeHUD();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggleHUD();
    });
    expect(result.current.isOpen).toBe(true);
  });

  it('records chapter completion and unlocks milestones', () => {
    const { result } = renderHook(() =>
      useCloudlessSync({ enableKeyboard: false, defaultChaptersCompleted: 9 })
    );

    act(() => {
      result.current.recordChapterComplete(); // Advances to 10
    });

    expect(result.current.chaptersCompleted).toBe(10);
    expect(result.current.vectorClock).toBe(2);
    expect(result.current.milestoneUnlocked).toContain('10 Capítulos Completados');

    act(() => {
      result.current.dismissMilestone();
    });
    expect(result.current.milestoneUnlocked).toBeNull();
  });

  it('reconciles state with remote peer and bumps vector clock', () => {
    const { result } = renderHook(() =>
      useCloudlessSync({
        enableKeyboard: false,
        defaultChaptersCompleted: 5,
        defaultReadingSeconds: 1800,
      })
    );

    act(() => {
      result.current.reconcileWithPeer({
        vectorClock: 6,
        chaptersCompleted: 15,
        totalReadingSeconds: 3600,
        streakDays: 4,
      });
    });

    expect(result.current.vectorClock).toBe(7); // max(1, 6) + 1
    expect(result.current.chaptersCompleted).toBe(15);
    expect(result.current.totalReadingSeconds).toBe(3600);
    expect(result.current.streakDays).toBe(4);
  });
});
