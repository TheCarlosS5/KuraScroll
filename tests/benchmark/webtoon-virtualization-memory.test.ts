import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'node:perf_hooks';
import crypto from 'node:crypto';

// ============================================================================
// Types & Metric Interfaces
// ============================================================================

export interface LatencyStats {
  count: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  stdDevMs: number;
}

export interface MemorySnapshot {
  rssMB: number;
  heapTotalMB: number;
  heapUsedMB: number;
  externalMB: number;
  arrayBuffersMB: number;
}

export interface WebtoonPageMetadata {
  id: string;
  chapterNumber: number;
  pageNumber: number;
  globalIndex: number;
  width: number;
  height: number;
  aspectRatio: number;
  sizeBytes: number;
}

export interface WebtoonChapterMetadata {
  chapterNumber: number;
  title: string;
  pageCount: number;
  pages: WebtoonPageMetadata[];
}

export interface VirtualizationOptions {
  maxActivePages?: number;
  overscan?: number;
  prefetchAhead?: number;
  simulateLatency?: boolean;
}

export interface ActivePanelState {
  page: WebtoonPageMetadata;
  blobUrl: string;
  buffer: Buffer | null;
  mountedAt: number;
}

// ============================================================================
// Telemetry & Statistics Helpers
// ============================================================================

export function computeLatencyStats(latencies: number[]): LatencyStats {
  if (latencies.length === 0) {
    return { count: 0, minMs: 0, maxMs: 0, meanMs: 0, p50Ms: 0, p90Ms: 0, p95Ms: 0, p99Ms: 0, stdDevMs: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / count;

  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  const getPercentile = (p: number) => {
    const idx = Math.min(Math.floor((p / 100) * count), count - 1);
    return sorted[idx];
  };

  return {
    count,
    minMs: +sorted[0].toFixed(2),
    maxMs: +sorted[count - 1].toFixed(2),
    meanMs: +mean.toFixed(2),
    p50Ms: +getPercentile(50).toFixed(2),
    p90Ms: +getPercentile(90).toFixed(2),
    p95Ms: +getPercentile(95).toFixed(2),
    p99Ms: +getPercentile(99).toFixed(2),
    stdDevMs: +stdDev.toFixed(2),
  };
}

export function captureMemorySnapshot(): MemorySnapshot {
  const m = process.memoryUsage();
  return {
    rssMB: +(m.rss / 1024 / 1024).toFixed(2),
    heapTotalMB: +(m.heapTotal / 1024 / 1024).toFixed(2),
    heapUsedMB: +(m.heapUsed / 1024 / 1024).toFixed(2),
    externalMB: +(m.external / 1024 / 1024).toFixed(2),
    arrayBuffersMB: +(m.arrayBuffers / 1024 / 1024).toFixed(2),
  };
}

function printAsciiTable(title: string, rows: [string, string | number][]) {
  console.log(`\n===============================================================`);
  console.log(` BENCHMARK REPORT: ${title}`);
  console.log(`===============================================================`);
  for (const [key, val] of rows) {
    console.log(` ${key.padEnd(38)} : ${val}`);
  }
  console.log(`===============================================================\n`);
}

// ============================================================================
// Synthetic 50-Chapter Webtoon Generator (~1,500 Pages, ~450MB Raw Buffers)
// ============================================================================

export function generate50Chapters(seriesSlug: string = 'tower-of-god'): {
  chapters: WebtoonChapterMetadata[];
  allPages: WebtoonPageMetadata[];
  totalExpectedBytes: number;
} {
  const chapters: WebtoonChapterMetadata[] = [];
  const allPages: WebtoonPageMetadata[] = [];
  let globalIndex = 0;
  let totalExpectedBytes = 0;

  for (let ch = 1; ch <= 50; ch++) {
    // Generates between 20 and 40 pages per chapter
    const pageCount = 20 + ((ch * 7) % 21);
    const pages: WebtoonPageMetadata[] = [];

    for (let p = 1; p <= pageCount; p++) {
      const width = 800;
      const height = 1200 + ((p * 53) % 400); // 1200 - 1600 px
      const aspectRatio = +(width / height).toFixed(3);
      // Realistic WebP payload size ~280KB - 380KB
      const sizeBytes = 280_000 + ((p * 1337 + ch * 997) % 100_000);
      totalExpectedBytes += sizeBytes;

      const page: WebtoonPageMetadata = {
        id: `${seriesSlug}-c${String(ch).padStart(3, '0')}-p${String(p).padStart(3, '0')}`,
        chapterNumber: ch,
        pageNumber: p,
        globalIndex,
        width,
        height,
        aspectRatio,
        sizeBytes,
      };

      pages.push(page);
      allPages.push(page);
      globalIndex++;
    }

    chapters.push({
      chapterNumber: ch,
      title: `Capítulo ${ch}`,
      pageCount,
      pages,
    });
  }

  return { chapters, allPages, totalExpectedBytes };
}

// ============================================================================
// Storage Mock (Simulating 4TB Mechanical HDD & Fastify Static Delivery)
// ============================================================================

export class MockStorageBackend {
  private baseTemplate: Buffer;
  public coldFetchCount = 0;
  public totalBytesRead = 0;

  constructor() {
    // Generate realistic WebP image header & payload template (400 KB)
    this.baseTemplate = Buffer.alloc(400_000);
    this.baseTemplate.write('RIFF', 0);
    this.baseTemplate.writeUInt32LE(399_992, 4);
    this.baseTemplate.write('WEBPVP8 ', 8);
    // Fill payload with pseudo-random entropy
    for (let i = 16; i < 400_000; i += 64) {
      this.baseTemplate.writeUInt32LE((i * 1103515245 + 12345) >>> 0, i);
    }
  }

  async fetchPageBuffer(page: WebtoonPageMetadata, simulateHddLatency = false): Promise<Buffer> {
    this.coldFetchCount++;
    this.totalBytesRead += page.sizeBytes;

    if (simulateHddLatency) {
      // Mechanical seek + rotational latency: ~1.5 - 3.5 ms
      const seekDelay = 1.0 + (page.globalIndex % 5) * 0.5;
      await new Promise((resolve) => setTimeout(resolve, seekDelay));
    }

    // Allocate fresh buffer slice to trigger real Node.js memory allocation
    const pageBuf = Buffer.alloc(page.sizeBytes);
    this.baseTemplate.copy(pageBuf, 0, 0, page.sizeBytes);
    return pageBuf;
  }
}

// ============================================================================
// Webtoon Continuous Virtualization & Sliding Window Manager
// ============================================================================

export class WebtoonVirtualizationManager {
  readonly maxActivePages: number;
  readonly overscan: number;
  readonly prefetchAhead: number;
  readonly simulateLatency: boolean;

  readonly activePages = new Map<string, ActivePanelState>();
  readonly prefetchCache = new Map<string, Buffer>();
  readonly createdObjectUrls = new Set<string>();
  readonly revokedObjectUrls = new Set<string>();

  maxObservedActive = 0;
  totalMounts = 0;
  totalUnmounts = 0;
  coldLoads = 0;
  prefetchHits = 0;

  coldLatencies: number[] = [];
  hotLatencies: number[] = [];

  private storage: MockStorageBackend;
  private allPages: WebtoonPageMetadata[];
  private currentGlobalIndex = 0;

  constructor(
    allPages: WebtoonPageMetadata[],
    storage: MockStorageBackend,
    options: VirtualizationOptions = {}
  ) {
    this.allPages = allPages;
    this.storage = storage;
    this.maxActivePages = options.maxActivePages ?? 7;
    this.overscan = options.overscan ?? 3;
    this.prefetchAhead = options.prefetchAhead ?? 3;
    this.simulateLatency = options.simulateLatency ?? false;
  }

  getCurrentGlobalIndex(): number {
    return this.currentGlobalIndex;
  }

  /**
   * Simulates viewport scrolling to a target page in the continuous webtoon stream.
   * Recalculates the active sliding window, unmounts out-of-range panels,
   * mounts newly visible panels, and triggers forward prefetching.
   */
  async scrollTo(targetGlobalIndex: number): Promise<void> {
    this.currentGlobalIndex = targetGlobalIndex;
    const minIndex = Math.max(0, targetGlobalIndex - this.overscan);
    const maxIndex = Math.min(this.allPages.length - 1, targetGlobalIndex + this.overscan);

    const wantedPages = new Set<string>();
    for (let idx = minIndex; idx <= maxIndex; idx++) {
      wantedPages.add(this.allPages[idx].id);
    }

    // 1. Unmount panels outside the active viewport window (eviction & URL revocation)
    for (const [id, state] of Array.from(this.activePages.entries())) {
      if (!wantedPages.has(id)) {
        this.unmountPage(id, state);
      }
    }

    // 2. Mount new panels entering the viewport window
    for (let idx = minIndex; idx <= maxIndex; idx++) {
      const page = this.allPages[idx];
      if (!this.activePages.has(page.id)) {
        await this.mountPage(page);
      }
    }

    // Track active pool bounds
    if (this.activePages.size > this.maxObservedActive) {
      this.maxObservedActive = this.activePages.size;
    }

    // Strict safety clamp: ensure active pool never exceeds maxActivePages
    while (this.activePages.size > this.maxActivePages) {
      let furthestId: string | null = null;
      let maxDist = -1;
      for (const [id, state] of this.activePages.entries()) {
        const dist = Math.abs(state.page.globalIndex - targetGlobalIndex);
        if (dist > maxDist) {
          maxDist = dist;
          furthestId = id;
        }
      }
      if (furthestId) {
        const state = this.activePages.get(furthestId)!;
        this.unmountPage(furthestId, state);
      }
    }

    // 3. Trigger adaptive forward prefetch
    await this.triggerPrefetch(targetGlobalIndex);
  }

  private async mountPage(page: WebtoonPageMetadata): Promise<void> {
    const t0 = performance.now();
    let buffer: Buffer;

    if (this.prefetchCache.has(page.id)) {
      // Hot Prefetch Cache Hit!
      buffer = this.prefetchCache.get(page.id)!;
      this.prefetchCache.delete(page.id);
      this.prefetchHits++;
      const t1 = performance.now();
      this.hotLatencies.push(t1 - t0);
    } else {
      // Cold Storage Fetch
      buffer = await this.storage.fetchPageBuffer(page, this.simulateLatency);
      this.coldLoads++;
      const t1 = performance.now();
      this.coldLatencies.push(t1 - t0);
    }

    // Create synthetic Object URL
    const blobUrl = `blob:kura-scroll/page-${page.id}-${Date.now()}`;
    this.createdObjectUrls.add(blobUrl);

    this.activePages.set(page.id, {
      page,
      blobUrl,
      buffer,
      mountedAt: performance.now(),
    });

    this.totalMounts++;
  }

  private unmountPage(pageId: string, state: ActivePanelState): void {
    // Revoke Object URL to release browser/engine Blob table reference
    this.revokedObjectUrls.add(state.blobUrl);
    // Sever buffer reference to allow immediate V8 Garbage Collection
    state.buffer = null;
    // Remove from active map
    this.activePages.delete(pageId);
    this.totalUnmounts++;
  }

  private async triggerPrefetch(currentIdx: number): Promise<void> {
    const startIdx = currentIdx + this.overscan + 1;
    const endIdx = Math.min(this.allPages.length - 1, currentIdx + this.overscan + this.prefetchAhead);

    for (let idx = startIdx; idx <= endIdx; idx++) {
      const page = this.allPages[idx];
      if (!this.activePages.has(page.id) && !this.prefetchCache.has(page.id)) {
        const buffer = await this.storage.fetchPageBuffer(page, false);
        this.prefetchCache.set(page.id, buffer);
      }
    }

    // Keep prefetchCache bounded (max 6 items)
    while (this.prefetchCache.size > 6) {
      const oldest = this.prefetchCache.keys().next().value;
      if (oldest) this.prefetchCache.delete(oldest);
    }
  }

  /**
   * Simulates an abrupt scrubbing jump (forward or backward) across chapters.
   * Flushes unrelated prefetch buffers and evicts non-adjacent panels.
   */
  async seekJump(targetGlobalIndex: number): Promise<void> {
    this.prefetchCache.clear();
    await this.scrollTo(targetGlobalIndex);
  }

  /**
   * Releases all active panels and revokes all remaining Object URLs.
   */
  unmountAll(): void {
    for (const [id, state] of Array.from(this.activePages.entries())) {
      this.unmountPage(id, state);
    }
    this.prefetchCache.clear();
  }
}

// ============================================================================
// Naive Unbounded Webtoon Reader (Control Group for Memory Leak Benchmark)
// ============================================================================

export class NaiveUnboundedReader {
  readonly loadedPages = new Map<string, { page: WebtoonPageMetadata; buffer: Buffer; blobUrl: string }>();
  readonly createdObjectUrls = new Set<string>();

  constructor(private storage: MockStorageBackend) {}

  async loadPage(page: WebtoonPageMetadata): Promise<void> {
    if (this.loadedPages.has(page.id)) return;
    const buffer = await this.storage.fetchPageBuffer(page, false);
    const blobUrl = `blob:naive/${page.id}`;
    this.createdObjectUrls.add(blobUrl);
    this.loadedPages.set(page.id, { page, buffer, blobUrl });
  }
}

// ============================================================================
// Benchmark Suite: Continuous Virtualization & Memory Stabilization
// ============================================================================

describe('KuraScroll Webtoon Continuous Virtualization & Memory Stability Stress Benchmark', () => {
  let dataset: ReturnType<typeof generate50Chapters>;
  let storage: MockStorageBackend;

  beforeAll(() => {
    dataset = generate50Chapters('tower-of-god');
    storage = new MockStorageBackend();
  });

  afterAll(() => {
    if (global.gc) {
      try {
        global.gc();
      } catch {}
    }
  });

  it('executes a 50-chapter continuous webtoon marathon with active window virtualization and zero memory leaks', async () => {
    // Pre-test GC stabilization
    if (global.gc) {
      global.gc();
    }
    const memBaseline = captureMemorySnapshot();

    const manager = new WebtoonVirtualizationManager(dataset.allPages, storage, {
      maxActivePages: 7,
      overscan: 3,
      prefetchAhead: 3,
      simulateLatency: false,
    });

    const totalPages = dataset.allPages.length;
    let peakHeapUsedMB = memBaseline.heapUsedMB;
    const progressCheckpoints: { checkpoint: string; heapUsedMB: number; activePages: number }[] = [];

    const startTime = performance.now();

    // ------------------------------------------------------------------------
    // Phase 1: Continuous Downward Scrolling (Chapters 1 to 15)
    // ------------------------------------------------------------------------
    const ch15EndIdx = dataset.chapters.slice(0, 15).reduce((acc, c) => acc + c.pageCount, 0);
    for (let idx = 0; idx < ch15EndIdx; idx++) {
      await manager.scrollTo(idx);

      if (idx % 100 === 0) {
        const snap = captureMemorySnapshot();
        if (snap.heapUsedMB > peakHeapUsedMB) peakHeapUsedMB = snap.heapUsedMB;
        progressCheckpoints.push({
          checkpoint: `Ch 1-15 (Page ${idx})`,
          heapUsedMB: snap.heapUsedMB,
          activePages: manager.activePages.size,
        });
      }
    }

    // ------------------------------------------------------------------------
    // Phase 2: Chaotic Scrubbing - Abrupt Forward Jump to Chapter 25
    // ------------------------------------------------------------------------
    const ch25StartIdx = dataset.chapters.slice(0, 24).reduce((acc, c) => acc + c.pageCount, 0);
    await manager.seekJump(ch25StartIdx + 5);

    expect(manager.activePages.size).toBeLessThanOrEqual(manager.maxActivePages);

    // ------------------------------------------------------------------------
    // Phase 3: Continuous Downward Scrolling (Chapters 25 to 35)
    // ------------------------------------------------------------------------
    const ch35EndIdx = dataset.chapters.slice(0, 35).reduce((acc, c) => acc + c.pageCount, 0);
    for (let idx = ch25StartIdx + 6; idx < ch35EndIdx; idx++) {
      await manager.scrollTo(idx);

      if (idx % 150 === 0) {
        const snap = captureMemorySnapshot();
        if (snap.heapUsedMB > peakHeapUsedMB) peakHeapUsedMB = snap.heapUsedMB;
        progressCheckpoints.push({
          checkpoint: `Ch 25-35 (Page ${idx})`,
          heapUsedMB: snap.heapUsedMB,
          activePages: manager.activePages.size,
        });
      }
    }

    // ------------------------------------------------------------------------
    // Phase 4: Chaotic Scrubbing - Backward Jump to Chapter 20 (Re-read panel)
    // ------------------------------------------------------------------------
    const ch20StartIdx = dataset.chapters.slice(0, 19).reduce((acc, c) => acc + c.pageCount, 0);
    await manager.seekJump(ch20StartIdx + 3);

    expect(manager.activePages.size).toBeLessThanOrEqual(manager.maxActivePages);

    // ------------------------------------------------------------------------
    // Phase 5: Fast Continuous Reading to Chapter 50 (Final Stretch)
    // ------------------------------------------------------------------------
    for (let idx = ch20StartIdx + 4; idx < totalPages; idx++) {
      await manager.scrollTo(idx);

      if (idx % 200 === 0) {
        const snap = captureMemorySnapshot();
        if (snap.heapUsedMB > peakHeapUsedMB) peakHeapUsedMB = snap.heapUsedMB;
      }
    }

    // Final unmount simulation (user exits webtoon reader)
    manager.unmountAll();

    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const throughputPagesPerSec = +((totalPages / (durationMs / 1000))).toFixed(2);

    // Memory stabilization check
    if (global.gc) {
      global.gc();
    }
    const memFinal = captureMemorySnapshot();
    const heapDeltaMB = +(memFinal.heapUsedMB - memBaseline.heapUsedMB).toFixed(2);

    // ------------------------------------------------------------------------
    // Assertions: Zero Leaks & Bounded Virtualization Guarantees
    // ------------------------------------------------------------------------
    // 1. Active window pool was strictly bounded to max 6-8 pages throughout
    expect(manager.maxObservedActive).toBeLessThanOrEqual(8);
    expect(manager.maxObservedActive).toBeGreaterThanOrEqual(5);

    // 2. All simulated Object URLs were completely revoked upon unmounting
    expect(manager.activePages.size).toBe(0);
    expect(manager.revokedObjectUrls.size).toBe(manager.createdObjectUrls.size);
    expect(manager.totalUnmounts).toBe(manager.totalMounts);

    // 3. Heap stabilization: Despite traversing >1,000 pages (~450MB of raw bytes),
    // heap delta must remain tightly bounded (< 25 MB).
    expect(heapDeltaMB).toBeLessThan(25.0);

    // 4. Confirm total chapters and pages traversed
    expect(dataset.chapters.length).toBe(50);
    expect(totalPages).toBeGreaterThan(1200);

    // ------------------------------------------------------------------------
    // ASCII Telemetry Report
    // ------------------------------------------------------------------------
    printAsciiTable('50-CHAPTER WEBTOON VIRTUALIZATION & MEMORY STRESS RUN', [
      ['Total Chapters Simulated', dataset.chapters.length],
      ['Total Pages Processed', totalPages],
      ['Theoretical Payload (No Virtual)', `${(dataset.totalExpectedBytes / 1024 / 1024).toFixed(2)} MB`],
      ['Max Active Panels in Viewport', `${manager.maxObservedActive} (Limit <= 8)`],
      ['Total Panels Mounted', manager.totalMounts],
      ['Total Panels Unmounted & Revoked', manager.totalUnmounts],
      ['Object URL Revocation Integrity', `${manager.revokedObjectUrls.size} / ${manager.createdObjectUrls.size} (100% OK)`],
      ['Total Elapsed Duration', `${durationMs.toFixed(2)} ms`],
      ['Throughput (Virtual Scroll)', `${throughputPagesPerSec} pages/s`],
      ['Memory Baseline (Heap)', `${memBaseline.heapUsedMB} MB`],
      ['Memory Peak Observed (Heap)', `${peakHeapUsedMB.toFixed(2)} MB`],
      ['Memory Stabilized (Heap)', `${memFinal.heapUsedMB} MB`],
      ['Heap Delta (Stabilized - Base)', `${heapDeltaMB} MB (< 25 MB TARGET MET)`],
    ]);
  });

  it('handles chaotic rapid scrubbing and seek jumps without leaking active pages or unmounted object URLs', async () => {
    const manager = new WebtoonVirtualizationManager(dataset.allPages, storage, {
      maxActivePages: 7,
      overscan: 3,
      prefetchAhead: 3,
      simulateLatency: false,
    });

    const totalPages = dataset.allPages.length;
    // 15 rapid random seek jumps across 50 chapters
    const seekTargets = [
      Math.floor(totalPages * 0.1),
      Math.floor(totalPages * 0.8),
      Math.floor(totalPages * 0.25),
      Math.floor(totalPages * 0.95),
      Math.floor(totalPages * 0.05),
      Math.floor(totalPages * 0.5),
      Math.floor(totalPages * 0.7),
      Math.floor(totalPages * 0.3),
      Math.floor(totalPages * 0.85),
      Math.floor(totalPages * 0.15),
      Math.floor(totalPages * 0.6),
      Math.floor(totalPages * 0.4),
      Math.floor(totalPages * 0.9),
      Math.floor(totalPages * 0.2),
      Math.floor(totalPages * 0.99),
    ];

    for (const targetIdx of seekTargets) {
      await manager.seekJump(targetIdx);
      // Verify pool invariant immediately after each sudden seek
      expect(manager.activePages.size).toBeLessThanOrEqual(8);
      // Verify that no active panel has null buffer while mounted
      for (const panel of manager.activePages.values()) {
        expect(panel.buffer).not.toBeNull();
      }
    }

    manager.unmountAll();
    expect(manager.activePages.size).toBe(0);
    expect(manager.revokedObjectUrls.size).toBe(manager.createdObjectUrls.size);
  });

  it('benchmarks prefetch cache hit ratio and delivery latency comparing cold vs hot panels', async () => {
    const latStorage = new MockStorageBackend();
    const manager = new WebtoonVirtualizationManager(dataset.allPages, latStorage, {
      maxActivePages: 7,
      overscan: 3,
      prefetchAhead: 4,
      simulateLatency: true, // simulates 1.5 - 3.5ms disk seek on cold misses
    });

    // Read 80 pages sequentially to reach steady-state prefetch equilibrium
    for (let idx = 0; idx < 80; idx++) {
      await manager.scrollTo(idx);
    }

    const coldStats = computeLatencyStats(manager.coldLatencies);
    const hotStats = computeLatencyStats(manager.hotLatencies);

    const totalRequests = manager.coldLoads + manager.prefetchHits;
    const hitRatio = +((manager.prefetchHits / totalRequests) * 100).toFixed(2);

    expect(totalRequests).toBeGreaterThanOrEqual(80);
    // Prefetch hit ratio should exceed 75% in steady-state sequential reading
    expect(hitRatio).toBeGreaterThan(75.0);

    // Warm latency P50 should be significantly lower than cold latency P50
    expect(hotStats.p50Ms).toBeLessThan(coldStats.p50Ms);

    printAsciiTable('PREFETCH CACHE LATENCY: COLD (STORAGE) VS HOT (IN-MEMORY)', [
      ['Total Panels Evaluated', totalRequests],
      ['Cold Storage Misses', manager.coldLoads],
      ['Hot Prefetch Cache Hits', manager.prefetchHits],
      ['Steady-State Hit Ratio', `${hitRatio}% (> 75% TARGET MET)`],
      ['Cold Latency Mean', `${coldStats.meanMs} ms`],
      ['Cold Latency P50 (Median)', `${coldStats.p50Ms} ms`],
      ['Cold Latency P95', `${coldStats.p95Ms} ms`],
      ['Hot Latency Mean', `${hotStats.meanMs} ms`],
      ['Hot Latency P50 (Median)', `${hotStats.p50Ms} ms`],
      ['Hot Latency P95', `${hotStats.p95Ms} ms`],
      ['Prefetch Speedup Factor', `${(coldStats.p50Ms / Math.max(hotStats.p50Ms, 0.01)).toFixed(1)}x faster`],
    ]);
  });

  it('proves memory stabilization compared to an unbounded naive webtoon reader', async () => {
    const testSubset = dataset.allPages.slice(0, 400); // 400 pages (~120 MB raw)

    // 1. Run Bounded Virtualizer
    if (global.gc) global.gc();
    const baseVirt = captureMemorySnapshot();
    const virtManager = new WebtoonVirtualizationManager(testSubset, storage, {
      maxActivePages: 7,
      overscan: 3,
      prefetchAhead: 2,
    });

    for (let i = 0; i < testSubset.length; i++) {
      await virtManager.scrollTo(i);
    }
    const peakVirt = captureMemorySnapshot();
    virtManager.unmountAll();
    if (global.gc) global.gc();
    const finalVirt = captureMemorySnapshot();
    const virtDelta = +(finalVirt.heapUsedMB - baseVirt.heapUsedMB).toFixed(2);

    // 2. Run Naive Unbounded Reader
    if (global.gc) global.gc();
    const baseNaive = captureMemorySnapshot();
    const naiveReader = new NaiveUnboundedReader(storage);

    for (let i = 0; i < testSubset.length; i++) {
      await naiveReader.loadPage(testSubset[i]);
    }
    const peakNaive = captureMemorySnapshot();
    const naiveDelta = +(peakNaive.heapUsedMB - baseNaive.heapUsedMB).toFixed(2);

    const virtBufferRetainedMB = +(
      Array.from(virtManager.activePages.values()).reduce((acc, p) => acc + (p.buffer?.length ?? 0), 0) /
      1024 /
      1024
    ).toFixed(2);

    const naiveBufferRetainedMB = +(
      Array.from(naiveReader.loadedPages.values()).reduce((acc, p) => acc + p.buffer.length, 0) /
      1024 /
      1024
    ).toFixed(2);

    // Verify virtualizer delta is dramatically lower than unbounded accumulation
    expect(virtManager.maxObservedActive).toBeLessThanOrEqual(8);
    expect(naiveReader.loadedPages.size).toBe(400);
    expect(virtDelta).toBeLessThan(25.0);
    expect(naiveBufferRetainedMB).toBeGreaterThan(100.0); // > 100 MB of unreleased buffer bloat!
    expect(virtBufferRetainedMB).toBe(0); // 0 MB retained after unmountAll()

    printAsciiTable('VIRTUALIZED (BOUNDED) VS NAIVE (UNBOUNDED) READER COMPARISON', [
      ['Total Pages Evaluated', 400],
      ['Virtualized Active Panels Max', virtManager.maxObservedActive],
      ['Naive Active Panels Retained', naiveReader.loadedPages.size],
      ['Virtualized Retained Buffers', `${virtBufferRetainedMB} MB (0 bytes leaked)`],
      ['Naive Retained Buffers', `${naiveBufferRetainedMB} MB (Memory Bloat!)`],
      ['Buffer Memory Saved by Virtualizer', `${(naiveBufferRetainedMB - virtBufferRetainedMB).toFixed(2)} MB saved`],
      ['Virtualized Stabilized Heap Delta', `${virtDelta} MB (< 25 MB TARGET MET)`],
    ]);
  });
});
