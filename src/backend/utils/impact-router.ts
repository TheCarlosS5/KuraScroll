/**
 * Sprint 56 - Zero-Allocation Impact Feedback Router & Arbitrator
 *
 * Designed under strict constraints for Intel Pentium T4500 (2 cores, Penryn 45nm, <= 512MB heap)
 * and Intel GMA 4500MHD (CLS = 0, translate3d compositor only).
 *
 * P95 Dispatch Latency SLA 20: < 0.01 ms (< 10 microseconds) across 100,000+ dispatches.
 */

export type ImpactIntensity = 0 | 1 | 2; // 0 = LIGERO, 1 = MEDIO, 2 = PESADO
export type ImpactSource = 'sfx' | 'onomatopoeia' | 'manual';

export const IMPACT_INTENSITY = {
  LIGERO: 0 as ImpactIntensity,
  MEDIO: 1 as ImpactIntensity,
  PESADO: 2 as ImpactIntensity,
} as const;

/**
 * Standard Web Vibration API pattern definitions.
 * Single allocation at module boot.
 */
export const HAPTIC_PATTERNS: Readonly<Record<ImpactIntensity, readonly number[]>> = {
  0: Object.freeze([10]),              // LIGERO: 10ms discrete tick
  1: Object.freeze([16, 22, 10]),       // MEDIO: double pulse
  2: Object.freeze([28, 24, 16]),       // PESADO: heavy punch impact
};

export const HAPTIC_COOLDOWNS_MS: Readonly<Record<ImpactIntensity, number>> = {
  0: 100,
  1: 150,
  2: 220,
};

export const RUMBLE_SPECS: Readonly<Record<ImpactIntensity, { readonly durationMs: number; readonly maxDisplacementPx: number; readonly cssClass: string }>> = {
  0: Object.freeze({ durationMs: 45, maxDisplacementPx: 0.75, cssClass: 'rumble-light' }),
  1: Object.freeze({ durationMs: 60, maxDisplacementPx: 1.5, cssClass: 'rumble-medium' }),
  2: Object.freeze({ durationMs: 80, maxDisplacementPx: 2.5, cssClass: 'rumble-heavy' }),
};

export interface ImpactEvent {
  id: string;
  source: ImpactSource;
  intensity: ImpactIntensity;
  timestamp: number;
  pageId?: string;
}

export interface ImpactPolicy {
  hapticsEnabled: boolean;
  screenRumbleEnabled: boolean;
  maxHapticIntensity: ImpactIntensity;
  maxRumbleIntensity: ImpactIntensity;
  reducedMotion: boolean;
  hapticsWithReducedMotion: boolean;
  batterySaver: boolean;
  thermalState: 0 | 1 | 2; // 0 = NORMAL, 1 = LOCKED_30, 2 = EMERGENCY
  documentVisible: boolean;
}

export type SuppressionReason =
  | 'disabled'
  | 'reduced_motion'
  | 'battery_saver'
  | 'thermal_emergency'
  | 'document_hidden'
  | 'cooldown'
  | 'duplicate';

export interface ImpactDispatchDecision {
  accepted: boolean;
  suppressionReason?: SuppressionReason;
  dispatchedHapticIntensity?: ImpactIntensity;
  dispatchedRumbleIntensity?: ImpactIntensity;
  hapticPattern?: readonly number[];
  rumbleDurationMs?: number;
  rumbleMaxDisplacementPx?: number;
  rumbleCssClass?: string;
}

const DEFAULT_RING_BUFFER_CAPACITY = 64;

export class ImpactRouter {
  private readonly ringCapacity: number;
  private readonly ringBuffer: string[];
  private ringIndex: number = 0;
  private ringCount: number = 0;

  private lastDispatchTimestamp: number = -Infinity;
  private lastDispatchedIntensity: ImpactIntensity = 0;

  // Pre-allocated decision response object to guarantee zero GC allocations in hot loops
  private readonly reusableDecision: ImpactDispatchDecision = {
    accepted: false,
  };

  constructor(ringCapacity: number = DEFAULT_RING_BUFFER_CAPACITY) {
    this.ringCapacity = Math.max(16, ringCapacity);
    this.ringBuffer = new Array<string>(this.ringCapacity).fill('');
  }

  /**
   * Evaluates an impact event against runtime policy, cooldowns, and deduplication ring.
   * Runs in O(1) time without dynamic heap allocations.
   */
  public enqueue(event: ImpactEvent, policy: ImpactPolicy): ImpactDispatchDecision {
    const res = this.reusableDecision;
    res.accepted = false;
    res.suppressionReason = undefined;
    res.dispatchedHapticIntensity = undefined;
    res.dispatchedRumbleIntensity = undefined;
    res.hapticPattern = undefined;
    res.rumbleDurationMs = undefined;
    res.rumbleMaxDisplacementPx = undefined;
    res.rumbleCssClass = undefined;

    // 1. Tab visibility gate
    if (!policy.documentVisible) {
      res.suppressionReason = 'document_hidden';
      return res;
    }

    // 2. Battery Saver gate (Sprint 33)
    if (policy.batterySaver) {
      res.suppressionReason = 'battery_saver';
      return res;
    }

    // 3. Thermal Throttling Guard Emergency step (Sprint 54)
    if (policy.thermalState === 2) {
      res.suppressionReason = 'thermal_emergency';
      return res;
    }

    // 4. Deduplication ring buffer check
    if (event.id && this.isDuplicate(event.id)) {
      res.suppressionReason = 'duplicate';
      return res;
    }

    // 5. Cooldown & preemption check
    const elapsed = event.timestamp - this.lastDispatchTimestamp;
    const requiredCooldown = HAPTIC_COOLDOWNS_MS[event.intensity];
    const isPreemption = event.intensity > this.lastDispatchedIntensity && elapsed < requiredCooldown;

    if (elapsed < requiredCooldown && !isPreemption) {
      res.suppressionReason = 'cooldown';
      return res;
    }

    // 6. Arbitrate Haptic Feedback channel
    let effectiveHaptic: ImpactIntensity | undefined = undefined;
    if (policy.hapticsEnabled) {
      const allowedByReducedMotion = !policy.reducedMotion || policy.hapticsWithReducedMotion;
      if (allowedByReducedMotion) {
        effectiveHaptic = Math.min(event.intensity, policy.maxHapticIntensity) as ImpactIntensity;
      }
    }

    // 7. Arbitrate Screen Rumble channel
    let effectiveRumble: ImpactIntensity | undefined = undefined;
    if (policy.screenRumbleEnabled && !policy.reducedMotion) {
      effectiveRumble = Math.min(event.intensity, policy.maxRumbleIntensity) as ImpactIntensity;
      // ThermalGuard LOCKED_30 clamp: degrade to LIGERO
      if (policy.thermalState === 1 && effectiveRumble > 0) {
        effectiveRumble = 0;
      }
    }

    // If both channels are inactive under current policy
    if (effectiveHaptic === undefined && effectiveRumble === undefined) {
      res.suppressionReason = policy.reducedMotion ? 'reduced_motion' : 'disabled';
      return res;
    }

    // 8. Commit to ring buffer & state
    if (event.id) {
      this.recordEventId(event.id);
    }
    this.lastDispatchTimestamp = event.timestamp;
    this.lastDispatchedIntensity = event.intensity;

    res.accepted = true;
    if (effectiveHaptic !== undefined) {
      res.dispatchedHapticIntensity = effectiveHaptic;
      res.hapticPattern = HAPTIC_PATTERNS[effectiveHaptic];
    }
    if (effectiveRumble !== undefined) {
      res.dispatchedRumbleIntensity = effectiveRumble;
      const spec = RUMBLE_SPECS[effectiveRumble];
      res.rumbleDurationMs = spec.durationMs;
      res.rumbleMaxDisplacementPx = spec.maxDisplacementPx;
      res.rumbleCssClass = spec.cssClass;
    }

    return res;
  }

  /**
   * Resets cooldown and ring buffer state.
   */
  public reset(): void {
    this.ringBuffer.fill('');
    this.ringIndex = 0;
    this.ringCount = 0;
    this.lastDispatchTimestamp = -Infinity;
    this.lastDispatchedIntensity = 0;
  }

  private isDuplicate(id: string): boolean {
    const limit = Math.min(this.ringCount, this.ringCapacity);
    for (let i = 0; i < limit; i++) {
      if (this.ringBuffer[i] === id) {
        return true;
      }
    }
    return false;
  }

  private recordEventId(id: string): void {
    this.ringBuffer[this.ringIndex] = id;
    this.ringIndex = (this.ringIndex + 1) % this.ringCapacity;
    if (this.ringCount < this.ringCapacity) {
      this.ringCount++;
    }
  }
}
