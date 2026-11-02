/**
 * Sprint 56 - High-Performance Web Vibration API Driver
 *
 * Implements graceful no-op on desktop environments and iOS Safari.
 * Ensures zero unhandled exceptions when hardware vibration is absent.
 */

import { ImpactIntensity, HAPTIC_PATTERNS } from './ImpactRouter.js';

export class HapticDriver {
  private isAvailable: boolean;
  private userGestureActivated: boolean = false;

  constructor() {
    this.isAvailable =
      typeof navigator !== 'undefined' &&
      'vibrate' in navigator &&
      typeof navigator.vibrate === 'function';
  }

  public isSupported(): boolean {
    return this.isAvailable;
  }

  public enableFromUserGesture(): boolean {
    this.userGestureActivated = true;
    if (this.isAvailable) {
      try {
        // Quick 5ms test tick to prime hardware vibration actuator
        return navigator.vibrate(5);
      } catch {
        return false;
      }
    }
    return false;
  }

  public trigger(intensity: ImpactIntensity): boolean {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const pattern = HAPTIC_PATTERNS[intensity];
      return navigator.vibrate(pattern as number[]);
    } catch {
      return false;
    }
  }

  public cancel(): void {
    if (this.isAvailable) {
      try {
        navigator.vibrate(0);
      } catch {
        // silent no-op
      }
    }
  }
}
