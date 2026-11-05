/**
 * KuraScroll Offline Service Worker
 * Provides offline resilience with:
 * - CacheFirst for static WebP manga pages & images (/storage/..., /pages/...)
 * - NetworkFirst with cache fallback for chapter manifests and series catalog (/api/v1/...)
 * - Precache for application shell (HTML, CSS, JS)
 */

export const CACHE_NAMES = {
  STATIC: 'kura-scroll-static-v2',
  IMAGES: 'kura-scroll-images-v2',
  API: 'kura-scroll-api-v2',
} as const;

export const PRECACHE_ASSETS = [
  '/',
  '/index.html',
] as const;

interface ExtendableEvent extends Event {
  waitUntil(fn: Promise<any>): void;
}

interface FetchEvent extends Event {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

interface ServiceWorkerGlobalScope {
  addEventListener(type: string, listener: (event: any) => void): void;
  skipWaiting(): Promise<void>;
  clients: {
    claim(): Promise<void>;
    matchAll(options?: any): Promise<any[]>;
  };
}

const sw = self as unknown as ServiceWorkerGlobalScope;

/**
 * Predicate to identify static manga page images and thumbnails.
 * Matches /storage/..., /pages/..., and standard image extensions (.webp, .png, .jpg).
 */
export function isImageRequest(url: URL): boolean {
  const pathname = url.pathname.toLowerCase();
  return (
    pathname.includes('/storage/') ||
    pathname.includes('/pages/') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.avif') ||
    pathname.endsWith('.gif')
  );
}

/**
 * Strict allowlist of explicitly public API routes for offline caching.
 * All other API paths (progress, preferences, auth, sync, uploads, admin, private user data)
 * bypass the Cache API entirely.
 */
export function isApiRequest(url: URL): boolean {
  const p = url.pathname;
  if (!p.startsWith('/api/v1/')) {
    return false;
  }

  // 1. Series Catalog, Search, and Public Series Details
  if (p === '/api/v1/series' || p === '/api/v1/series/search') {
    return true;
  }
  if (/^\/api\/v1\/series\/[^/]+$/.test(p)) {
    return true;
  }
  if (/^\/api\/v1\/series\/[^/]+\/chapters$/.test(p)) {
    return true;
  }
  if (/^\/api\/v1\/series\/[^/]+\/comments$/.test(p)) {
    return true;
  }

  // 2. Published Chapters, Manifests, Pages, Covers & Tile Metadata
  if (/^\/api\/v1\/chapters\/[^/]+$/.test(p)) {
    return true;
  }
  if (/^\/api\/v1\/chapters\/[^/]+\/manifest$/.test(p)) {
    return true;
  }
  if (/^\/api\/v1\/chapters\/[^/]+\/pages\/[^/]+$/.test(p)) {
    return true;
  }
  if (/^\/api\/v1\/covers\/[^/]+$/.test(p)) {
    return true;
  }
  if (/^\/api\/v1\/tiles\/[^/]+\/[^/]+\/meta$/.test(p)) {
    return true;
  }

  // 3. Public User Profiles (EXCLUDING /api/v1/users/me)
  if (/^\/api\/v1\/users\/[^/]+$/.test(p) && p !== '/api/v1/users/me') {
    return true;
  }

  // Strict fail-closed fallback: Any other /api/v1 route is bypassed from Cache API
  return false;
}

/**
 * Predicate to identify App Shell assets (HTML navigation, JS chunks, CSS styles).
 */
export function isAppShellRequest(request: Request, url: URL): boolean {
  return (
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')
  );
}

// 1. Install Event: Precache Application Shell
sw.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAMES.STATIC);
      try {
        await cache.addAll(PRECACHE_ASSETS);
      } catch (err) {
        // Precache error in dev mode is non-fatal
        console.warn('[SW] Precache notice:', err);
      }
      await sw.skipWaiting();
    })()
  );
});

// 2. Activate Event: Invalidate old caches
sw.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const expectedCaches = new Set<string>(Object.values(CACHE_NAMES));
      const existingCaches = await caches.keys();

      await Promise.all(
        existingCaches.map((cacheName) => {
          if (!expectedCaches.has(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );

      await sw.clients.claim();
    })()
  );
});

// 3. Fetch Event Routing
sw.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // Only handle HTTP/HTTPS GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Strategy 1: CacheFirst for Manga Pages & WebP Images
  if (isImageRequest(url)) {
    event.respondWith(handleCacheFirst(request, CACHE_NAMES.IMAGES));
    return;
  }

  // Strategy 2: NetworkFirst with Cache Fallback for Chapter Manifests and Catalog
  if (isApiRequest(url)) {
    event.respondWith(handleNetworkFirst(request, CACHE_NAMES.API));
    return;
  }

  // Strategy 3: NetworkFirst / Cache fallback for App Shell
  if (isAppShellRequest(request, url)) {
    event.respondWith(handleAppShell(request));
    return;
  }
});

/**
 * CacheFirst Strategy:
 * Immediately serves cached images (zero network delay).
 * Fetches from network on cache miss, caches the response, and returns it.
 */
export async function handleCacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    // If offline and not in cache, return 504 Gateway Timeout
    return new Response('Manga page image unavailable offline', {
      status: 504,
      statusText: 'Gateway Timeout (Offline)',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * NetworkFirst Strategy:
 * Fetches the latest data from server first; on success, updates local cache.
 * If offline or server unreachable, seamlessly returns the cached manifest.
 */
export async function handleNetworkFirst(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cacheControl = networkResponse.headers.get('cache-control') || '';
      if (!cacheControl.includes('no-store') && !cacheControl.includes('private')) {
        cache.put(request, networkResponse.clone());
      }
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      const cloned = cachedResponse.clone();
      const headers = new Headers(cloned.headers);
      headers.set('X-Kura-Offline', 'true');

      return new Response(cloned.body, {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });
    }

    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'No cached manifest available while offline',
        offline: true,
      }),
      {
        status: 503,
        statusText: 'Service Unavailable (Offline)',
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * App Shell Strategy:
 * Tries network, falls back to cached asset or index.html.
 */
export async function handleAppShell(request: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAMES.STATIC);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    const indexFallback = await cache.match('/index.html');
    if (indexFallback) {
      return indexFallback;
    }
    return new Response('Application shell unavailable offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
