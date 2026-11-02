export type EffectiveConnectionType = 'slow-2g' | '2g' | '3g' | '4g';
export type AssetTier = 'low' | 'balanced' | 'high';

export interface NetworkStatus {
  online: boolean;
  saveData: boolean;
  effectiveType: EffectiveConnectionType;
  tier: AssetTier;
  downlinkMb?: number;
  rttMs?: number;
}

type NetworkListener = (status: NetworkStatus) => void;

class NetworkStatusService {
  private listeners: Set<NetworkListener> = new Set();
  private cachedStatus: NetworkStatus;

  constructor() {
    this.cachedStatus = this.computeStatus();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleConnectionChange);
      window.addEventListener('offline', this.handleConnectionChange);

      const navConn = this.getNavigatorConnection();
      if (navConn && typeof navConn.addEventListener === 'function') {
        navConn.addEventListener('change', this.handleConnectionChange);
      }
    }
  }

  private getNavigatorConnection(): any {
    if (typeof navigator !== 'undefined') {
      return (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    }
    return null;
  }

  private computeStatus(): NetworkStatus {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const navConn = this.getNavigatorConnection();

    const saveData = Boolean(navConn?.saveData);
    const effectiveType: EffectiveConnectionType = navConn?.effectiveType || '4g';
    const downlinkMb = typeof navConn?.downlink === 'number' ? navConn.downlink : undefined;
    const rttMs = typeof navConn?.rtt === 'number' ? navConn.rtt : undefined;

    let tier: AssetTier = 'high';
    if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
      tier = 'low';
    } else if (effectiveType === '3g' || (downlinkMb !== undefined && downlinkMb < 2.0)) {
      tier = 'balanced';
    }

    return {
      online: isOnline,
      saveData,
      effectiveType,
      tier,
      downlinkMb,
      rttMs,
    };
  }

  private handleConnectionChange = () => {
    this.cachedStatus = this.computeStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(this.cachedStatus);
      } catch {
        // Suppress listener error
      }
    });
  };

  public getNetworkStatus(): NetworkStatus {
    return this.cachedStatus;
  }

  public isSaveDataEnabled(): boolean {
    return this.cachedStatus.saveData;
  }

  public shouldPrefetch(mobilePrefetchAllowed = true): boolean {
    if (!this.cachedStatus.online) return false;
    if (this.cachedStatus.saveData) return false;

    // If cellular 2G/3G and user opted out of mobile prefetch
    if (!mobilePrefetchAllowed && (this.cachedStatus.effectiveType === '2g' || this.cachedStatus.effectiveType === '3g' || this.cachedStatus.effectiveType === 'slow-2g')) {
      return false;
    }

    return true;
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * For testing purposes only: override current status
   */
  public _overrideStatus(status: Partial<NetworkStatus>) {
    this.cachedStatus = { ...this.cachedStatus, ...status };
    this.listeners.forEach((l) => l(this.cachedStatus));
  }
}

export const networkStatusService = new NetworkStatusService();
