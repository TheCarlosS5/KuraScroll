import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BatterySaverEngine } from '../../src/services/battery-saver-engine';

describe('BatterySaverEngine Service (Sprint 33)', () => {
  let engine: BatterySaverEngine;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (engine) engine.destroy();
  });

  it('initializes gracefully when navigator.getBattery is unavailable', async () => {
    // Delete getBattery if present
    const originalNavigator = global.navigator;
    const mockNavigator = { ...originalNavigator };
    delete (mockNavigator as any).getBattery;
    vi.stubGlobal('navigator', mockNavigator);

    engine = new BatterySaverEngine();
    await engine.init();

    const state = engine.getState();
    expect(state.isSupported).toBe(false);
    expect(state.isPowerSaverActive).toBe(false);

    vi.unstubAllGlobals();
  });

  it('notifies subscribers when battery state updates', async () => {
    engine = new BatterySaverEngine();
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('activates power saver when visibility state becomes hidden', () => {
    engine = new BatterySaverEngine();

    // Simulate tab hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });

    document.dispatchEvent(new Event('visibilitychange'));

    const state = engine.getState();
    expect(state.isTabHidden).toBe(true);
    expect(state.isPowerSaverActive).toBe(true);
  });
});
