import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ServiceWorkerManager,
  registerServiceWorker,
  unregisterServiceWorkers,
  isOnline,
  onNetworkStatusChange,
  isServiceWorkerSupported,
  clearOfflineCaches,
} from '../../src/services/service-worker-registration';
import {
  isImageRequest,
  isApiRequest,
  isAppShellRequest,
  handleCacheFirst,
  handleNetworkFirst,
  CACHE_NAMES,
} from '../../src/service-worker';

describe('ServiceWorkerManager & Registration Service', () => {
  let originalNavigator: any;
  let mockRegister: any;
  let mockGetRegistration: any;
  let mockGetRegistrations: any;

  beforeEach(() => {
    originalNavigator = global.navigator;

    mockRegister = vi.fn().mockResolvedValue({
      addEventListener: vi.fn(),
      installing: null,
      active: null,
    });

    mockGetRegistration = vi.fn().mockResolvedValue(null);
    mockGetRegistrations = vi.fn().mockResolvedValue([
      { unregister: vi.fn().mockResolvedValue(true) },
    ]);

    Object.defineProperty(global, 'navigator', {
      value: {
        onLine: true,
        serviceWorker: {
          register: mockRegister,
          getRegistration: mockGetRegistration,
          getRegistrations: mockGetRegistrations,
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('detects Service Worker support accurately', () => {
    expect(isServiceWorkerSupported()).toBe(true);

    Object.defineProperty(global, 'navigator', {
      value: { onLine: true },
      writable: true,
      configurable: true,
    });

    const manager = new ServiceWorkerManager();
    expect(manager.isSupported()).toBe(false);
  });

  it('detects online and offline status and reacts to window network events', () => {
    expect(isOnline()).toBe(true);

    const manager = new ServiceWorkerManager();
    const statusHistory: boolean[] = [];

    const unsubscribe = manager.onNetworkChange((status) => {
      statusHistory.push(status);
    });

    // Initial state received immediately
    expect(statusHistory).toEqual([true]);

    // Simulate going offline
    Object.defineProperty(global.navigator, 'onLine', { value: false, configurable: true });
    window.dispatchEvent(new Event('offline'));
    expect(statusHistory).toEqual([true, false]);

    // Simulate going back online
    Object.defineProperty(global.navigator, 'onLine', { value: true, configurable: true });
    window.dispatchEvent(new Event('online'));
    expect(statusHistory).toEqual([true, false, true]);

    // Unsubscribe and ensure no further triggers
    unsubscribe();
    window.dispatchEvent(new Event('offline'));
    expect(statusHistory).toEqual([true, false, true]);

    manager.destroy();
  });

  it('registers Service Worker with custom or default script path', async () => {
    const reg = await registerServiceWorker('/custom-sw.js');
    expect(mockRegister).toHaveBeenCalledWith('/custom-sw.js', undefined);
    expect(reg).not.toBeNull();
  });

  it('handles registration failure gracefully without crashing', async () => {
    mockRegister.mockRejectedValueOnce(new Error('SecurityError'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const reg = await registerServiceWorker();
    expect(reg).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('unregisters all active service workers successfully', async () => {
    const success = await unregisterServiceWorkers();
    expect(success).toBe(true);
    expect(mockGetRegistrations).toHaveBeenCalled();
  });

  it('clears offline caches when clearOfflineCaches is called', async () => {
    const mockDelete = vi.fn().mockResolvedValue(true);
    const mockKeys = vi.fn().mockResolvedValue(['cache-1', 'cache-2']);

    Object.defineProperty(global, 'caches', {
      value: {
        keys: mockKeys,
        delete: mockDelete,
      },
      writable: true,
      configurable: true,
    });

    const res = await clearOfflineCaches();
    expect(res).toBe(true);
    expect(mockKeys).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalledWith('cache-1');
    expect(mockDelete).toHaveBeenCalledWith('cache-2');
  });
});

describe('Service Worker Request Classification', () => {
  it('correctly classifies image and manga page requests for CacheFirst', () => {
    expect(isImageRequest(new URL('http://localhost:5173/storage/series/solo-leveling/v1/c1/001.webp'))).toBe(true);
    expect(isImageRequest(new URL('http://localhost:5173/api/v1/chapters/solo-leveling-c1/pages/001.webp'))).toBe(true);
    expect(isImageRequest(new URL('http://localhost:5173/storage/covers/hero.png'))).toBe(true);
    expect(isImageRequest(new URL('http://localhost:5173/images/banner.jpg'))).toBe(true);

    expect(isImageRequest(new URL('http://localhost:5173/api/v1/series'))).toBe(false);
    expect(isImageRequest(new URL('http://localhost:5173/index.html'))).toBe(false);
  });

  it('correctly classifies API and manifest requests for NetworkFirst', () => {
    expect(isApiRequest(new URL('http://localhost:5173/api/v1/series'))).toBe(true);
    expect(isApiRequest(new URL('http://localhost:5173/api/v1/chapters/solo-leveling-c1'))).toBe(true);
    expect(isApiRequest(new URL('http://localhost:5173/api/v1/progress/solo-leveling'))).toBe(true);

    expect(isApiRequest(new URL('http://localhost:5173/index.html'))).toBe(false);
    expect(isApiRequest(new URL('http://localhost:5173/storage/test.webp'))).toBe(false);
  });

  it('correctly classifies App Shell navigation and static assets', () => {
    const navRequest = { mode: 'navigate' } as Request;
    expect(isAppShellRequest(navRequest, new URL('http://localhost:5173/series/solo-leveling'))).toBe(true);
    expect(isAppShellRequest({ mode: 'cors' } as Request, new URL('http://localhost:5173/assets/index.js'))).toBe(true);
    expect(isAppShellRequest({ mode: 'cors' } as Request, new URL('http://localhost:5173/index.css'))).toBe(true);
  });
});

describe('Service Worker Caching Strategies', () => {
  let mockMatch: any;
  let mockPut: any;
  let mockCache: any;

  beforeEach(() => {
    mockMatch = vi.fn();
    mockPut = vi.fn();
    mockCache = {
      match: mockMatch,
      put: mockPut,
    };

    Object.defineProperty(global, 'caches', {
      value: {
        open: vi.fn().mockResolvedValue(mockCache),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handleCacheFirst serves from cache when available without network fetch', async () => {
    const cachedResponse = new Response('cached-webp-binary', { status: 200 });
    mockMatch.mockResolvedValueOnce(cachedResponse);

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const request = new Request('http://localhost:5173/storage/test.webp');
    const result = await handleCacheFirst(request, CACHE_NAMES.IMAGES);

    expect(result).toBe(cachedResponse);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('handleCacheFirst fetches from network and populates cache on cache miss', async () => {
    mockMatch.mockResolvedValueOnce(null);
    const networkResponse = new Response('network-webp-data', { status: 200 });
    global.fetch = vi.fn().mockResolvedValue(networkResponse);

    const request = new Request('http://localhost:5173/storage/page1.webp');
    const result = await handleCacheFirst(request, CACHE_NAMES.IMAGES);

    expect(result.status).toBe(200);
    expect(mockPut).toHaveBeenCalledWith(request, expect.any(Response));
  });

  it('handleNetworkFirst fetches fresh API manifest and updates local cache', async () => {
    const freshData = JSON.stringify({ series: 'solo-leveling', chapters: [1, 2] });
    const networkResponse = new Response(freshData, { status: 200, headers: { 'Content-Type': 'application/json' } });
    global.fetch = vi.fn().mockResolvedValue(networkResponse);

    const request = new Request('http://localhost:5173/api/v1/series/solo-leveling');
    const result = await handleNetworkFirst(request, CACHE_NAMES.API);

    expect(result.status).toBe(200);
    expect(mockPut).toHaveBeenCalledWith(request, expect.any(Response));
  });

  it('handleNetworkFirst seamlessly falls back to cached manifest when offline', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch (Offline)'));

    const cachedData = JSON.stringify({ series: 'solo-leveling', cached: true });
    const cachedResponse = new Response(cachedData, { status: 200, headers: { 'Content-Type': 'application/json' } });
    mockMatch.mockResolvedValueOnce(cachedResponse);

    const request = new Request('http://localhost:5173/api/v1/series/solo-leveling');
    const result = await handleNetworkFirst(request, CACHE_NAMES.API);

    expect(result.status).toBe(200);
    expect(result.headers.get('X-Kura-Offline')).toBe('true');
    const body = await result.json();
    expect(body.cached).toBe(true);
  });

  it('handleNetworkFirst returns 503 JSON fallback when offline and uncached', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    mockMatch.mockResolvedValueOnce(null);

    const request = new Request('http://localhost:5173/api/v1/series/unknown');
    const result = await handleNetworkFirst(request, CACHE_NAMES.API);

    expect(result.status).toBe(503);
    const body = await result.json();
    expect(body.offline).toBe(true);
  });
});
