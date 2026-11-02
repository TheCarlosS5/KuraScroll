# Sprint 59: QA Resilience Test Plan & Predictive Prefetch Matrix
**Feature:** Intelligent Pre-Flight Cache Warming & Turn-Ahead Prefetch Daemon  
**Target Host Platform:** Intel Pentium T4500 (2C/2T) & 4TB Mechanical SATA II HDD

---

## 1. Executive Summary & Objective

In **Sprint 59**, KuraScroll introduces the **Intelligent Pre-Flight Cache Warming & Turn-Ahead Prefetch Daemon**, predicting user reading trajectory and pre-loading upcoming pages into RAM and disk cache.

Operating on an Intel Pentium T4500 with a 4TB mechanical SATA II hard drive (75-100 random IOPS, 12-15ms seek latency) and a strict **512MB V8 RAM ceiling**, unconstrained background prefetching would cause severe mechanical disk head thrashing and out-of-memory crashes.

Our QA resilience test suite rigorously verifies:
1. Rapid flip cancellation (flipping back and forth between pages 10 and 11 aborts obsolete background prefetch jobs).
2. Chapter boundary warm-up (reading the final page of Chapter $N$ pre-warms Page 1 of Chapter $N+1$ with zero UI stutter).
3. Strict RAM ceiling enforcement (prefetch memory cache evicts unreferenced pages to stay under 512MB).
4. I/O coordinator yield verification (interactive `CRITICAL` reads preempt background prefetch tasks within $< 15\text{ ms}$).

---

## 2. Adversarial Test Case Matrix

### Case 1: Rapid Flip Cancellation
- **Scenario:** The user rapidly toggles back and forth between pages 10 and 11 every 200ms.
- **Behavioral Expectation:**
  - The prefetch daemon must immediately abort obsolete background prefetch tasks for pages 12, 13, etc., via `AbortController` cancellation.
  - Disk I/O must not be flooded with speculative read requests for discarded page trajectories.
- **Test Implementation Outline (`frontend/tests/services/predictive-prefetch.test.ts`):**
  ```typescript
  it('cancels obsolete background prefetch jobs immediately when user rapidly flips between pages 10 and 11', async () => {
    const daemon = new PredictivePrefetchDaemon();
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');

    daemon.navigateToPage(10);
    daemon.navigateToPage(11);
    daemon.navigateToPage(10);
    daemon.navigateToPage(11);

    await vi.advanceTimersByTimeAsync(300);
    expect(abortSpy).toHaveBeenCalled();
  });
  ```

---

### Case 2: Chapter Boundary Warm-up ($N \rightarrow N+1$)
- **Scenario:** The user reaches and views the final page of Chapter 15.
- **Behavioral Expectation:**
  - The daemon detects chapter boundary proximity and triggers background pre-warming of Page 1 of Chapter 16.
  - Pre-warming must execute at `IOPriority.BACKGROUND` with zero UI stutter or dropped frames on the reader view.
- **Test Implementation Outline (`tests/backend/resilience/chapter-warmup.test.ts`):**
  ```typescript
  it('pre-warms Page 1 of Chapter N+1 when user reads final page of Chapter N with zero UI stutter', async () => {
    const daemon = new PredictivePrefetchDaemon();
    const prefetchSpy = vi.spyOn(daemon, 'queuePrefetch');

    await daemon.navigateToPage({ chapterId: 'chap-15', pageNumber: 30, isLastPage: true });

    expect(prefetchSpy).toHaveBeenCalledWith(expect.objectContaining({
      chapterId: 'chap-16',
      pageNumber: 1,
      priority: 'BACKGROUND'
    }));
  });
  ```

---

### Case 3: Strict RAM Ceiling Enforcement (512MB V8 Heap)
- **Scenario:** Prefetching dozens of high-resolution manga pages until memory consumption approaches the 512MB V8 heap threshold.
- **Behavioral Expectation:**
  - The in-memory prefetch LRU cache must strictly enforce size limits, evicting unreferenced page blobs (`URL.revokeObjectURL()`) to prevent V8 heap OOM crashes.
- **Test Implementation Outline (`frontend/tests/services/predictive-prefetch.test.ts`):**
  ```typescript
  it('strictly evicts unreferenced prefetched pages to maintain RAM usage under 512MB V8 heap', async () => {
    const cache = new PrefetchMemoryCache({ maxBytes: 50 * 1024 * 1024 }); // 50MB test cap
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    for (let i = 1; i <= 100; i++) {
      cache.store(`page-${i}`, createMockBlob(2 * 1024 * 1024)); // 2MB each
    }

    expect(cache.getCurrentSizeBytes()).toBeLessThanOrEqual(50 * 1024 * 1024);
    expect(revokeSpy).toHaveBeenCalled();
  });
  ```

---

### Case 4: I/O Coordinator Yield Verification (< 15ms SLA)
- **Scenario:** A background prefetch task is actively streaming page data from the 4TB mechanical HDD when an interactive reader navigation request (`IOPriority.CRITICAL`) arrives.
- **Behavioral Expectation:**
  - The `IOCoordinator` and `PauseGate` must immediately pause the prefetch task and yield disk access to the interactive read.
  - Interactive page read latency must remain under **15ms**.
- **Test Implementation Outline (`tests/backend/resilience/io-coordinator-yield.test.ts`):**
  ```typescript
  it('preempts background prefetch tasks and serves interactive critical reads within 15ms', async () => {
    const coordinator = new SharedIOCoordinator();
    
    // Start heavy background prefetch
    coordinator.run({ priority: IOPriority.BACKGROUND }, async () => {
      await slowDiskRead(500);
    });

    // Fire critical interactive read
    const start = performance.now();
    await coordinator.run({ priority: IOPriority.CRITICAL }, async () => {
      return fastDiskRead(2);
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(15);
  });
  ```

---

## 3. Deliverables & Artifact Summary
- This resilience test plan document (`docs/reports/sprint59-predictive-prefetch-resilience-matrix.md`).
- Automated test suites:
  - `frontend/tests/services/predictive-prefetch.test.ts`
  - `tests/backend/resilience/chapter-warmup.test.ts`
  - `tests/backend/resilience/io-coordinator-yield.test.ts`
