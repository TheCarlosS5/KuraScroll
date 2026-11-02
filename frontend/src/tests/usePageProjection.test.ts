import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageProjection } from '../reader/usePageProjection';

describe('Sprint 81 - usePageProjection Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default options', () => {
    const { result } = renderHook(() =>
      usePageProjection({ enableKeyboard: false })
    );

    expect(result.current.isOpen).toBe(false);
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.pitch).toBe(0.0);
    expect(result.current.yaw).toBe(0.0);
    expect(result.current.perspective).toBe(1000);
    expect(result.current.keystone).toBe(0.0);
    expect(result.current.focalPlanePreset).toBe('flat_orthodox');
  });

  it('controls HUD visibility correctly', () => {
    const { result } = renderHook(() =>
      usePageProjection({ enableKeyboard: false })
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

  it('updates pitch, yaw, perspective, and keystone with proper clamping', () => {
    const { result } = renderHook(() =>
      usePageProjection({ enableKeyboard: false })
    );

    act(() => {
      result.current.setPitch(50.0); // Clamped to 35.0
    });
    expect(result.current.pitch).toBe(35.0);
    expect(result.current.focalPlanePreset).toBe('custom');

    act(() => {
      result.current.setPitch(-45.0); // Clamped to -35.0
    });
    expect(result.current.pitch).toBe(-35.0);

    act(() => {
      result.current.setYaw(40.0); // Clamped to 25.0
    });
    expect(result.current.yaw).toBe(25.0);

    act(() => {
      result.current.setPerspective(2500); // Clamped to 2000
    });
    expect(result.current.perspective).toBe(2000);

    act(() => {
      result.current.setKeystone(1.5); // Clamped to 1.0
    });
    expect(result.current.keystone).toBe(1.0);
  });

  it('applies presets correctly', () => {
    const { result } = renderHook(() =>
      usePageProjection({ enableKeyboard: false })
    );

    act(() => {
      result.current.applyPreset('desk_tilt_20');
    });

    expect(result.current.focalPlanePreset).toBe('desk_tilt_20');
    expect(result.current.pitch).toBe(18.0);
    expect(result.current.perspective).toBe(1200);
    expect(result.current.keystone).toBe(0.25);

    act(() => {
      result.current.applyPreset('easel_stand_15');
    });
    expect(result.current.pitch).toBe(28.0);
    expect(result.current.focalPlanePreset).toBe('easel_stand_15');
  });

  it('toggles enabled state and calculates CSS transforms', () => {
    const { result } = renderHook(() =>
      usePageProjection({ enableKeyboard: false })
    );

    expect(result.current.cssTransform).toContain('perspective(');

    act(() => {
      result.current.toggleEnabled();
    });

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.cssTransform).toBe('none');
  });
});
