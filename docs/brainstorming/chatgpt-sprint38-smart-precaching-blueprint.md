# Sprint 38: Smart Pre-caching & Bandwidth-Aware Asset Compression Blueprint
**Architectural Blueprint & Hardware-Grounded Guidance from Senior ChatGPT (Brave MCP)**
**Platform:** KuraScroll (Standalone Sister Platform to KuraStream, KS Monogram)
**Target Host:** Intel Pentium T4500 (2C/2T @ 2.30GHz, RAM <= 512MB V8, Penryn 45nm, Intel GMA 4500MHD)
**Storage Target:** 4TB Mechanical HDD (SATA II, 5400/7200 RPM, ~75–100 random IOPS, 12–15ms radial seek latency)

---

## 1. Executive Summary & Objective

In **Sprint 38**, we address the mechanical seek latency bottleneck of the 4TB SATA II HDD by creating a cohesive, predictive pre-caching and bandwidth-aware asset compression system. With reading velocity calculated via the EMA filter ($\alpha = 0.25$) from Sprint 37, the reader can accurately anticipate upcoming page-turns. However, unconstrained pre-fetching on a mechanical hard drive leads to head thrashing, buffer bloat, and queue starvation for interactive reads.

This sprint integrates:
1. **Dynamic Asymmetric Pre-caching Window:** Clamping forward page pre-fetching dynamically based on real-time EMA velocity ($N_{forward} = \text{clamp}(\lceil 12.0 / v_{EMA} \rceil, 1, 4)$, $N_{backward} = 1$).
2. **Network Information API & Save-Data Awareness:** Adaptive asset delivery adapting quality (WebP 65 vs 82) and dimensions (1080px vs 1440px) under high latency or metered connections.
3. **Coordinated Multi-Tier Caching:** Service Worker Cache Storage FIFO capped at 30 pages on the client, coordinated with Fastify ByteLRU (256MB cap) on the host.
4. **Active I/O Preemption & AbortController Cancellation:** Stale prefetch requests are immediately aborted on page scrub or chapter jump, routed through the backend `IOCoordinator` with `NORMAL` priority to prevent starving `CRITICAL` interactive reads.

---

## 2. Core Architectural Pillars

### Pillar A: Velocity-Guided Adaptive Prefetch Window ($N_{forward}$)
- **Formula:**
  $$N_{forward} = \max\left(1, \min\left(4, \left\lceil \frac{12.0}{v_{EMA}} \right\rceil\right)\right)$$
  - Rapid reader ($v_{EMA} \le 4.0\text{ s/page}$): $N_{forward} = 3 \text{ to } 4$ pages.
  - Moderate reader ($4.0\text{ s} < v_{EMA} \le 10.0\text{ s}$): $N_{forward} = 2$ pages.
  - Deep reader ($v_{EMA} > 10.0\text{ s/page}$): $N_{forward} = 1$ page.
  - Backward window: Fixed at $N_{backward} = 1$ (prior page is almost always already resident in client memory/LRU).
- **Debounce:** 300ms idle trigger after page turn before queuing prefetch requests to prevent triggering I/O while the reader rapidly scrubs through chapters.

### Pillar B: Network Information API & Tiered Compression
- **Client Detection:**
  ```typescript
  interface NetworkStatus {
    saveData: boolean;
    effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
    tier: 'low' | 'balanced' | 'high';
  }
  ```
  - If `saveData === true` or `effectiveType in ('slow-2g', '2g', '3g')`, tier is `'low'`.
  - Client sends `Save-Data: on` header or query parameter `?tier=low`.
- **Backend Quality Adaptation:**
  - High tier: WebP quality 82, target width 1440px.
  - Low tier: WebP quality 65, target width 1080px (reduces payload by ~42% with negligible visual degradation on GMA 4500MHD display).

### Pillar C: Coordinated Multi-Tier Caching Strategy
- **Layer 1: Fastify ByteLRU (Host RAM):**
  - Host RAM budget: 256MB dedicated to ByteLRU image cache.
  - Pointers and metadata kept in L2 cache (1MB Penryn limit).
- **Layer 2: Service Worker Cache Storage (Client Storage):**
  - Cache name: `kura-scroll-page-cache-v1`.
  - Max entries: 30 entries (FIFO eviction). Eviction runs asynchronously without blocking rendering.
- **Layer 3: DOM Zero-Leak Lifecycle:**
  - Fast page teardown; object URLs created for blobs are revoked with `URL.revokeObjectURL()`.

### Pillar D: Active Preemption & AbortController Cancellation
- **Client Cancellation:** Each prefetch cycle holds an `AbortController`. If a new page navigation occurs before prefetch completes, pending network requests are aborted via `abort()`.
- **Host I/O Queue Protection:** Prefetch requests sent with header `X-Purpose: prefetch` are marked with `Priority.NORMAL` in `IOCoordinator`. Any real interactive read (`Priority.CRITICAL`) preempts the prefetch queue via the `PauseGate`.

---

## 3. Implementation Plan & File Structure

1. **Backend:**
   - [`src/backend/config/asset-tier-config.ts`](file:///C:/Users/Admin/dev/kura-scroll/src/backend/config/asset-tier-config.ts): Definition of asset compression tiers (`low`, `balanced`, `high`).
   - [`src/backend/routes/static-storage.ts`](file:///C:/Users/Admin/dev/kura-scroll/src/backend/routes/static-storage.ts): Tier-aware parameter handling and prefetch priority header detection (`X-Purpose: prefetch`).
   - Unit tests: `tests/backend/storage/asset-tier.test.ts`.

2. **Frontend:**
   - [`frontend/src/services/network-status-service.ts`](file:///C:/Users/Admin/dev/kura-scroll/frontend/src/services/network-status-service.ts): Network Information API listener with graceful fallback.
   - [`frontend/src/reader/AdaptivePrefetchEngine.ts`](file:///C:/Users/Admin/dev/kura-scroll/frontend/src/reader/AdaptivePrefetchEngine.ts): Advanced prefetch controller factoring in EMA velocity, network tier, AbortController cancellation, and 300ms debounce.
   - Unit tests: `frontend/tests/reader/AdaptivePrefetchEngine.test.ts` & `frontend/tests/services/network-status-service.test.ts`.
   - Reader integration in `frontend/src/pages/ReaderPage.tsx` and `frontend/src/components/reader/MangaReader.tsx`.

3. **Verification & Benchmarks:**
   - Benchmark: `docs/reports/sprint38-smart-precaching-benchmark.md`.
   - Full monorepo verification: Backend (418+ tests), Frontend (219+ tests), 11/11 SLAs Passed, Vite build.
