/**
 * Service Worker Registration & Offline Network Detection Helper
 * Provides registration, unregistration, cache clearing, and reactive online/offline monitoring.
 */

export interface ServiceWorkerRegistrationState {
  supported: boolean;
  registered: boolean;
  online: boolean;
  registration: ServiceWorkerRegistration | null;
}

export type NetworkStatusListener = (isOnline: boolean) => void;

export class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private listeners: Set<NetworkStatusListener> = new Set();
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  constructor() {
    this.initNetworkListeners();
  }

  /**
   * Checks if Service Worker API is supported in the current environment.
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator;
  }

  /**
   * Returns current online status. Defaults to true if unavailable.
   */
  public isOnline(): boolean {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  }

  /**
   * Registers the Service Worker script.
   */
  public async register(
    swUrl = '/service-worker.js',
    options?: RegistrationOptions
  ): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) {
      return null;
    }

    try {
      this.registration = await navigator.serviceWorker.register(swUrl, options);

      this.registration.addEventListener('updatefound', () => {
        const installingWorker = this.registration?.installing;
        if (installingWorker) {
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New offline content is available; please reload.');
            }
          });
        }
      });

      return this.registration;
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
      return null;
    }
  }

  /**
   * Unregisters all active service workers.
   */
  public async unregister(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const results = await Promise.all(registrations.map((r) => r.unregister()));
      this.registration = null;
      return results.every(Boolean);
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the active Service Worker registration.
   */
  public async getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported()) {
      return null;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ?? null;
  }

  /**
   * Subscribes to network online/offline events.
   * Immediately invokes the callback with current status and returns an unsubscribe function.
   */
  public onNetworkChange(callback: NetworkStatusListener): () => void {
    this.listeners.add(callback);
    callback(this.isOnline());

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Clears all CacheStorage caches created by the application.
   */
  public async clearCaches(): Promise<boolean> {
    if (typeof caches === 'undefined') {
      return false;
    }
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets current state snapshot.
   */
  public getState(): ServiceWorkerRegistrationState {
    return {
      supported: this.isSupported(),
      registered: this.registration !== null,
      online: this.isOnline(),
      registration: this.registration,
    };
  }

  /**
   * Cleans up event listeners.
   */
  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.onlineHandler) window.removeEventListener('online', this.onlineHandler);
      if (this.offlineHandler) window.removeEventListener('offline', this.offlineHandler);
    }
    this.listeners.clear();
  }

  private initNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    this.onlineHandler = () => this.notifyListeners(true);
    this.offlineHandler = () => this.notifyListeners(false);

    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  private notifyListeners(online: boolean): void {
    for (const listener of this.listeners) {
      listener(online);
    }
  }
}

// Global Singleton Instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Functional Exports
export const registerServiceWorker = (swUrl?: string, options?: RegistrationOptions) =>
  serviceWorkerManager.register(swUrl, options);

export const unregisterServiceWorkers = () =>
  serviceWorkerManager.unregister();

export const isOnline = () =>
  serviceWorkerManager.isOnline();

export const onNetworkStatusChange = (callback: NetworkStatusListener) =>
  serviceWorkerManager.onNetworkChange(callback);

export const isServiceWorkerSupported = () =>
  serviceWorkerManager.isSupported();

export const clearOfflineCaches = () =>
  serviceWorkerManager.clearCaches();
