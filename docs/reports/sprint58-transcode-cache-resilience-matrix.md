# Sprint 58: QA Resilience Test Plan & Transcode Cache Matrix
**Feature:** Ahead-Of-Time Downsampling & Disk Cache Engine  
**Target Host Platform:** Intel Pentium T4500 (2C/2T) & Sharp Image Processing Pipeline

---

## 1. Executive Summary & Objective

In **Sprint 58**, KuraScroll introduces the **Ahead-Of-Time (AOT) Downsampling & Disk Cache Engine**, offloading image scaling (WebP/AVIF generation for mobile/tablet tiers) to background workers and caching results on the 4TB mechanical SATA II hard drive.

Because transcoding images on a dual-core Pentium T4500 is CPU-intensive, duplicate transcode jobs must be eliminated, HTTP caching semantics must be strictly observed, corrupt cache files must trigger automatic recovery, and LRU eviction must protect disk storage quotas (e.g. 5GB).

Our QA resilience test suite rigorously verifies:
1. Concurrent transcode deduplication (preventing multiple Sharp processes from transcoding the same page simultaneously).
2. ETag generation (SHA256/mtime-based) and HTTP 304 Not Modified verification.
3. Corrupt cache file recovery (automatic cache invalidate & re-transcode on read error).
4. LRU eviction threshold enforcement when disk cache reaches configured quota (e.g. 5GB).

---

## 2. Adversarial Test Case Matrix

### Case 1: Concurrent Transcode Deduplication
- **Scenario:** 5 simultaneous client requests arrive for the exact same chapter page at a custom target resolution before it has been transcoded or cached.
- **Behavioral Expectation:**
  - The transcode manager must use a promise map / job deduplication lock so that only **one** Sharp transcoding process executes for that resource.
  - The remaining 4 concurrent requests must await the resolving promise of the active transcode job rather than spawning redundant CPU-heavy Sharp instances.
- **Test Implementation Outline (`tests/backend/resilience/transcode-cache.test.ts`):**
  ```typescript
  it('deduplicates concurrent transcode requests to prevent multiple Sharp instances spawning for the same page', async () => {
    const manager = new TranscodeCacheManager({ maxConcurrent: 2 });
    const transcodeSpy = vi.spyOn(manager, 'executeSharpTranscode');

    const promises = Array.from({ length: 5 }, () => manager.getOrTranscode('page-1.webp', { width: 800 }));
    await Promise.all(promises);

    expect(transcodeSpy).toHaveBeenCalledTimes(1);
  });
  ```

---

### Case 2: ETag Generation & HTTP 304 Not Modified Verification
- **Scenario:** A client requests an image that is already cached on disk, providing an `If-None-Match` header matching the current resource ETag.
- **Behavioral Expectation:**
  - The server generates a deterministic ETag based on file content hash (SHA256) and source modification time (mtime).
  - When `If-None-Match` matches, the server returns HTTP `304 Not Modified` with zero body bytes, saving network bandwidth and disk reads.
- **Test Implementation Outline (`tests/backend/routes/transcode-routes.test.ts`):**
  ```typescript
  it('returns HTTP 304 Not Modified when client provides matching If-None-Match ETag', async () => {
    const initialRes = await app.inject({ method: 'GET', url: '/api/v1/image/transcode?path=p1.webp&w=800' });
    const etag = initialRes.headers['etag'];

    const cachedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/image/transcode?path=p1.webp&w=800',
      headers: { 'if-none-match': etag }
    });

    expect(cachedRes.statusCode).toBe(304);
    expect(cachedRes.payload).toBe('');
  });
  ```

---

### Case 3: Corrupt Cache File Recovery
- **Scenario:** A cached transcoded image file on disk has been truncated or corrupted (e.g., zero-byte file or invalid WebP magic bytes).
- **Behavioral Expectation:**
  - When the reader attempts to read the corrupted cache file, validation checks (image magic byte verification or Sharp decode test) detect the corruption.
  - The system automatically invalidates the cache entry, re-triggers the AOT transcode job, serves the fresh image, and heals the disk cache.
- **Test Implementation Outline (`tests/backend/resilience/transcode-cache.test.ts`):**
  ```typescript
  it('automatically invalidates and re-transcodes corrupted cache files on read error', async () => {
    const cachePath = await transcodeManager.getCachePath('page-1.webp', { width: 800 });
    await fs.writeFile(cachePath, Buffer.from('corrupted-zero-bytes')); // corrupt file

    const result = await transcodeManager.getOrTranscode('page-1.webp', { width: 800 });
    expect(result.isFreshTranscode).toBe(true);
    
    const isValid = await verifyImageValid(cachePath);
    expect(isValid).toBe(true);
  });
  ```

---

### Case 4: LRU Eviction Threshold Enforcement (5GB Quota)
- **Scenario:** The disk cache directory exceeds the configured quota limit (e.g., 5GB max size), triggered by new transcode writes.
- **Behavioral Expectation:**
  - The LRU (Least Recently Used) eviction worker scans cache access timestamps and purges oldest files until total cache usage drops below the watermark (e.g., 80% of quota).
- **Test Implementation Outline (`tests/backend/resilience/transcode-cache.test.ts`):**
  ```typescript
  it('enforces LRU eviction when disk cache exceeds configured quota', async () => {
    const manager = new TranscodeCacheManager({ quotaBytes: 1000 }); // small quota for test
    
    await manager.injectMockCacheFiles([
      { name: 'old.webp', size: 600, lastAccess: 1000 },
      { name: 'new.webp', size: 500, lastAccess: 2000 }
    ]);

    await manager.enforceQuota();

    expect(await manager.exists('old.webp')).toBe(false); // Evicted (LRU)
    expect(await manager.exists('new.webp')).toBe(true);  // Retained
  });
  ```

---

## 3. Deliverables & Artifact Summary
- This resilience test plan document (`docs/reports/sprint58-transcode-cache-resilience-matrix.md`).
- Automated test suites:
  - `tests/backend/resilience/transcode-cache.test.ts`
  - `tests/backend/routes/transcode-routes.test.ts`
