import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HapticDriver } from '../reader/HapticDriver.js';

describe('Sprint 56 - HapticDriver Unit Tests', () => {
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('safely handles environments without navigator.vibrate (e.g. desktop/iOS Safari)', () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });

    const driver = new HapticDriver();
    expect(driver.isSupported()).toBe(false);
    expect(driver.trigger(0)).toBe(false);
    expect(driver.enableFromUserGesture()).toBe(false);
    expect(() => driver.cancel()).not.toThrow();
  });

  it('correctly triggers vibration patterns when navigator.vibrate is available', () => {
    const mockVibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(globalThis, 'navigator', {
      value: { vibrate: mockVibrate },
      writable: true,
      configurable: true,
    });

    const driver = new HapticDriver();
    expect(driver.isSupported()).toBe(true);

    const ok0 = driver.trigger(0); // LIGERO: [10]
    expect(ok0).toBe(true);
    expect(mockVibrate).toHaveBeenCalledWith([10]);

    const ok2 = driver.trigger(2); // PESADO: [28, 24, 16]
    expect(ok2).toBe(true);
    expect(mockVibrate).toHaveBeenCalledWith([28, 24, 16]);

    driver.cancel();
    expect(mockVibrate).toHaveBeenCalledWith(0);
  });
});
