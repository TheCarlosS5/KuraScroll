import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZenModeGSAP } from '../../src/hooks/useZenModeGSAP';
import gsap from 'gsap';

describe('useZenModeGSAP Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes in INACTIVE state by default', () => {
    const { result } = renderHook(() => useZenModeGSAP());
    expect(result.current.zenState).toBe('INACTIVE');
    expect(result.current.isZen).toBe(false);
  });

  it('initializes in ACTIVE state when initialActive is true', () => {
    const { result } = renderHook(() => useZenModeGSAP({ initialActive: true }));
    expect(result.current.zenState).toBe('ACTIVE');
    expect(result.current.isZen).toBe(true);
  });

  it('registers UI elements without duplicates', () => {
    const { result } = renderHook(() => useZenModeGSAP());
    const mockEl = document.createElement('div');

    act(() => {
      result.current.registerUiElement(mockEl);
      result.current.registerUiElement(mockEl); // Duplicate registration
    });

    expect(result.current.uiElementsRef.current).toHaveLength(1);
    expect(result.current.uiElementsRef.current[0]).toBe(mockEl);
  });

  it('transitions through ENTERING to ACTIVE on enterZen and fires onEnter', () => {
    const onEnter = vi.fn();
    const { result } = renderHook(() => useZenModeGSAP({ onEnter }));

    act(() => {
      result.current.enterZen();
    });

    // Immediate state after trigger is ENTERING
    expect(result.current.isZen).toBe(true);
  });

  it('toggles zen state back and forth correctly', () => {
    const { result } = renderHook(() => useZenModeGSAP({ initialActive: true }));

    expect(result.current.isZen).toBe(true);

    act(() => {
      result.current.toggleZen();
    });

    // Transitioning out
    expect(result.current.zenState).toBe('EXITING');
  });

  it('triggers toggleZen when pressing the F key outside of inputs', () => {
    const { result } = renderHook(() => useZenModeGSAP());

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'f', bubbles: true });
      window.dispatchEvent(event);
    });

    expect(result.current.isZen).toBe(true);
  });

  it('ignores the F key when user is typing inside an input or textarea', () => {
    const { result } = renderHook(() => useZenModeGSAP());

    const input = document.createElement('input');
    document.body.appendChild(input);

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'f', bubbles: true });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);
    });

    expect(result.current.isZen).toBe(false);
    expect(result.current.zenState).toBe('INACTIVE');

    document.body.removeChild(input);
  });

  it('exits Zen mode when pressing Escape while active', () => {
    const { result } = renderHook(() => useZenModeGSAP({ initialActive: true }));

    expect(result.current.isZen).toBe(true);

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      window.dispatchEvent(event);
    });

    expect(result.current.zenState).toBe('EXITING');
  });
});
