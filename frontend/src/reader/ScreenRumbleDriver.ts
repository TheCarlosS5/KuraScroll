/**
 * Sprint 56 - Screen Rumble Driver for Intel GMA 4500MHD
 *
 * Exclusively manipulates .reader-stage via transform: translate3d.
 * Never touches window, body, html, or floating HUDs.
 * CLS = 0, zero forced synchronous reflows, zero CSS blur.
 */

import { ImpactIntensity, RUMBLE_SPECS } from './ImpactRouter.js';

export class ScreenRumbleDriver {
  private targetElement: HTMLElement | null = null;
  private activeTimeoutId: any = null;

  constructor(targetElement?: HTMLElement | null) {
    if (targetElement) {
      this.targetElement = targetElement;
    }
  }

  public setTargetElement(element: HTMLElement | null): void {
    this.targetElement = element;
  }

  public trigger(intensity: ImpactIntensity): boolean {
    const el = this.targetElement || (typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.reader-stage') : null);
    if (!el) {
      return false;
    }

    const spec = RUMBLE_SPECS[intensity];
    if (!spec) {
      return false;
    }

    // Clear previous timer if still running
    if (this.activeTimeoutId) {
      clearTimeout(this.activeTimeoutId);
      this.activeTimeoutId = null;
    }

    // Remove existing rumble classes without forced reflow
    el.classList.remove('rumble-light', 'rumble-medium', 'rumble-heavy');

    // Trigger new rumble class
    el.classList.add(spec.cssClass);

    this.activeTimeoutId = setTimeout(() => {
      if (el) {
        el.classList.remove(spec.cssClass);
      }
      this.activeTimeoutId = null;
    }, spec.durationMs);

    return true;
  }

  public cancel(): void {
    if (this.activeTimeoutId) {
      clearTimeout(this.activeTimeoutId);
      this.activeTimeoutId = null;
    }
    const el = this.targetElement || (typeof document !== 'undefined' ? document.querySelector<HTMLElement>('.reader-stage') : null);
    if (el) {
      el.classList.remove('rumble-light', 'rumble-medium', 'rumble-heavy');
    }
  }
}
