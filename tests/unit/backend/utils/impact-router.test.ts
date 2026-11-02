import { describe, it, expect, beforeEach } from 'vitest';
import {
  ImpactRouter,
  ImpactPolicy,
  ImpactEvent,
  HAPTIC_PATTERNS,
  RUMBLE_SPECS,
} from '../../../../src/backend/utils/impact-router.js';

describe('Sprint 56 - ImpactRouter Unit Tests', () => {
  let router: ImpactRouter;
  let basePolicy: ImpactPolicy;

  beforeEach(() => {
    router = new ImpactRouter(16);
    basePolicy = {
      hapticsEnabled: true,
      screenRumbleEnabled: true,
      maxHapticIntensity: 2,
      maxRumbleIntensity: 2,
      reducedMotion: false,
      hapticsWithReducedMotion: false,
      batterySaver: false,
      thermalState: 0,
      documentVisible: true,
    };
  });

  it('correctly dispatches LIGERO, MEDIO, and PESADO impact events', () => {
    // 0 = LIGERO
    const d0 = router.enqueue(
      { id: 'evt_0', source: 'sfx', intensity: 0, timestamp: 1000 },
      basePolicy
    );
    expect(d0.accepted).toBe(true);
    expect(d0.dispatchedHapticIntensity).toBe(0);
    expect(d0.dispatchedRumbleIntensity).toBe(0);
    expect(d0.hapticPattern).toEqual(HAPTIC_PATTERNS[0]);
    expect(d0.rumbleDurationMs).toBe(RUMBLE_SPECS[0].durationMs);

    // 1 = MEDIO (after 500ms cooldown)
    const d1 = router.enqueue(
      { id: 'evt_1', source: 'sfx', intensity: 1, timestamp: 1600 },
      basePolicy
    );
    expect(d1.accepted).toBe(true);
    expect(d1.dispatchedHapticIntensity).toBe(1);
    expect(d1.dispatchedRumbleIntensity).toBe(1);
    expect(d1.hapticPattern).toEqual(HAPTIC_PATTERNS[1]);

    // 2 = PESADO (after 500ms cooldown)
    const d2 = router.enqueue(
      { id: 'evt_2', source: 'onomatopoeia', intensity: 2, timestamp: 2200 },
      basePolicy
    );
    expect(d2.accepted).toBe(true);
    expect(d2.dispatchedHapticIntensity).toBe(2);
    expect(d2.dispatchedRumbleIntensity).toBe(2);
    expect(d2.hapticPattern).toEqual(HAPTIC_PATTERNS[2]);
  });

  it('rejects rapid triggers within the cooldown window', () => {
    // LIGERO cooldown is 100ms
    const d0 = router.enqueue(
      { id: 'evt_0', source: 'sfx', intensity: 0, timestamp: 1000 },
      basePolicy
    );
    expect(d0.accepted).toBe(true);

    const d1 = router.enqueue(
      { id: 'evt_1', source: 'sfx', intensity: 0, timestamp: 1050 },
      basePolicy
    );
    expect(d1.accepted).toBe(false);
    expect(d1.suppressionReason).toBe('cooldown');
  });

  it('allows preemption: PESADO interrupts pending LIGERO within cooldown', () => {
    const d0 = router.enqueue(
      { id: 'evt_0', source: 'sfx', intensity: 0, timestamp: 1000 },
      basePolicy
    );
    expect(d0.accepted).toBe(true);

    // 20ms later, a PESADO (intensity 2) punch arrives -> should preempt
    const d1 = router.enqueue(
      { id: 'evt_1', source: 'sfx', intensity: 2, timestamp: 1020 },
      basePolicy
    );
    expect(d1.accepted).toBe(true);
    expect(d1.dispatchedHapticIntensity).toBe(2);
  });

  it('rejects duplicate event IDs within ring buffer capacity', () => {
    const d0 = router.enqueue(
      { id: 'duplicate_bubble_sfx', source: 'onomatopoeia', intensity: 1, timestamp: 1000 },
      basePolicy
    );
    expect(d0.accepted).toBe(true);

    // Re-render or scroll repeat 400ms later with same ID
    const d1 = router.enqueue(
      { id: 'duplicate_bubble_sfx', source: 'onomatopoeia', intensity: 1, timestamp: 1400 },
      basePolicy
    );
    expect(d1.accepted).toBe(false);
    expect(d1.suppressionReason).toBe('duplicate');
  });

  it('strictly respects prefers-reduced-motion by suppressing rumble', () => {
    basePolicy.reducedMotion = true;
    basePolicy.hapticsWithReducedMotion = false;

    const d0 = router.enqueue(
      { id: 'evt_rm_1', source: 'sfx', intensity: 1, timestamp: 1000 },
      basePolicy
    );
    expect(d0.accepted).toBe(false);
    expect(d0.suppressionReason).toBe('reduced_motion');

    // If user explicitly enables hapticsWithReducedMotion
    basePolicy.hapticsWithReducedMotion = true;
    const d1 = router.enqueue(
      { id: 'evt_rm_2', source: 'sfx', intensity: 1, timestamp: 1500 },
      basePolicy
    );
    expect(d1.accepted).toBe(true);
    expect(d1.dispatchedHapticIntensity).toBe(1);
    expect(d1.dispatchedRumbleIntensity).toBeUndefined(); // Rumble remains strictly disabled
  });

  it('silences all impacts during Battery Saver mode', () => {
    basePolicy.batterySaver = true;

    const d = router.enqueue(
      { id: 'evt_bs', source: 'sfx', intensity: 2, timestamp: 1000 },
      basePolicy
    );
    expect(d.accepted).toBe(false);
    expect(d.suppressionReason).toBe('battery_saver');
  });

  it('silences all impacts during Thermal Throttling Guard EMERGENCY state', () => {
    basePolicy.thermalState = 2; // EMERGENCY

    const d = router.enqueue(
      { id: 'evt_th_emerg', source: 'sfx', intensity: 2, timestamp: 1000 },
      basePolicy
    );
    expect(d.accepted).toBe(false);
    expect(d.suppressionReason).toBe('thermal_emergency');
  });

  it('clamps screen rumble to LIGERO when ThermalGuard is in LOCKED_30 state', () => {
    basePolicy.thermalState = 1; // LOCKED_30

    const d = router.enqueue(
      { id: 'evt_th_lock', source: 'sfx', intensity: 2, timestamp: 1000 },
      basePolicy
    );
    expect(d.accepted).toBe(true);
    expect(d.dispatchedHapticIntensity).toBe(2);
    expect(d.dispatchedRumbleIntensity).toBe(0); // clamped to LIGERO (0)
  });

  it('suppresses impacts when the browser document/tab is hidden', () => {
    basePolicy.documentVisible = false;

    const d = router.enqueue(
      { id: 'evt_hidden', source: 'sfx', intensity: 1, timestamp: 1000 },
      basePolicy
    );
    expect(d.accepted).toBe(false);
    expect(d.suppressionReason).toBe('document_hidden');
  });
});
