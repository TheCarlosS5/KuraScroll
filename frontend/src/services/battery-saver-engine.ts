export interface BatteryState {
  isSupported: boolean;
  batteryLevel: number | null; // 0.0 to 1.0
  isCharging: boolean | null;
  isPowerSaverActive: boolean;
  isTabHidden: boolean;
}

export type BatterySaverListener = (state: BatteryState) => void;

/**
 * BatterySaverEngine
 * Hardware battery monitoring & memory recovery engine.
 * Automatically throttles frame prefetch and disables heavy transitions
 * when host battery falls below 20% or browser tab is hidden.
 */
export class BatterySaverEngine {
  private static readonly ACTIVATION_THRESHOLD = 0.20; // 20% battery triggers power saver
  private static readonly RECOVERY_THRESHOLD = 0.23;   // 23% recovery hysteresis prevents rapid oscillation

  private battery: any = null;
  private listeners = new Set<BatterySaverListener>();

  private state: BatteryState = {
    isSupported: false,
    batteryLevel: null,
    isCharging: null,
    isPowerSaverActive: false,
    isTabHidden: typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false,
  };

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    if (typeof window === 'undefined') return;

    // 1. Setup Tab Inactivity & Memory Release Listener
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // 2. Setup Battery API with graceful fallback for Firefox/Safari
    if ('getBattery' in navigator && typeof (navigator as any).getBattery === 'function') {
      try {
        this.battery = await (navigator as any).getBattery();
        this.state.isSupported = true;
        this.updateBatteryState();

        this.battery.addEventListener('levelchange', this.handleBatteryChange);
        this.battery.addEventListener('chargingchange', this.handleBatteryChange);
      } catch {
        // Fallback without crash on security restriction
        this.state.isSupported = false;
      }
    } else {
      this.state.isSupported = false;
    }

    this.notify();
  }

  private handleBatteryChange = (): void => {
    this.updateBatteryState();
    this.notify();
  };

  private handleVisibilityChange = (): void => {
    if (typeof document === 'undefined') return;
    const isHidden = document.visibilityState === 'hidden';
    this.state.isTabHidden = isHidden;

    if (isHidden) {
      // Automatically activate power saver while tab is hidden in background
      this.state.isPowerSaverActive = true;
      document.documentElement.setAttribute('data-battery-saver', 'true');
    } else {
      // Re-evaluate battery level on tab focus
      this.evaluatePowerSaverMode();
    }

    this.notify();
  };

  private updateBatteryState(): void {
    if (!this.battery) return;
    this.state.batteryLevel = this.battery.level ?? 1.0;
    this.state.isCharging = this.battery.charging ?? false;
    this.evaluatePowerSaverMode();
  }

  private evaluatePowerSaverMode(): void {
    const level = this.state.batteryLevel;
    if (level === null) {
      this.state.isPowerSaverActive = false;
    } else if (level <= BatterySaverEngine.ACTIVATION_THRESHOLD) {
      this.state.isPowerSaverActive = true;
    } else if (level >= BatterySaverEngine.RECOVERY_THRESHOLD) {
      this.state.isPowerSaverActive = false;
    }

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute(
        'data-battery-saver',
        this.state.isPowerSaverActive ? 'true' : 'false'
      );
    }
  }

  public getState(): BatteryState {
    return { ...this.state };
  }

  public subscribe(listener: BatterySaverListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const current = this.getState();
    for (const listener of this.listeners) {
      listener(current);
    }
  }

  public destroy(): void {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
    if (this.battery) {
      this.battery.removeEventListener('levelchange', this.handleBatteryChange);
      this.battery.removeEventListener('chargingchange', this.handleBatteryChange);
      this.battery = null;
    }
    this.listeners.clear();
  }
}

export const batterySaverEngine = new BatterySaverEngine();
