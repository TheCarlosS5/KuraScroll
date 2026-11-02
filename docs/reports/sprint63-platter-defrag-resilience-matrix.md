# Sprint 63: QA Resilience Test Plan & Platter Defragmenter Matrix
**Feature:** CBZ Platter Defragmenter & Reorder Engine  
**Target Host Platform:** Intel Pentium T4500 (2C/2T) & 4TB Mechanical SATA II HDD (Platter Seek Optimization)

---

## 1. Executive Summary & Objective

In **Sprint 63**, KuraScroll introduces the **CBZ Platter Defragmenter & Reorder Engine**, re-packing and re-ordering sequential archive entries (`p001.webp`, `p002.webp`) contiguously onto mechanical hard drive platters to minimize radial head seek latency during sequential chapter reading.

Operating against a 4TB mechanical SATA II hard drive under tight disk constraints and power failure risks requires bulletproof transaction safety.

Our QA resilience test suite rigorously verifies:
1. Abrupt power loss / process termination mid-rewrite.
2. Atomic file renaming (`fs.renameSync`) for data protection against partial writes.
3. Insufficient disk space guards (< 500MB available free space abort condition).
4. Immediate preemption when an interactive reader requests a page (`IOCoordinator` `CRITICAL` priority).

---

## 2. Adversarial Test Case Matrix

### Case 1: Abrupt Power Loss / Process Termination Mid-Rewrite
- **Scenario:** The defragmenter is actively rewriting a 200MB CBZ archive when the process is abruptly terminated (`SIGKILL` or power cut) halfway through stream writing.
- **Behavioral Expectation:**
- The original `.cbz` archive must remain 100% untouched and intact in its original location (no zero-byte corruption or truncated partial files).
- Temporary staging files (`.cbz.tmp`) must be cleaned up on next startup.
- **Test Implementation Outline (`tests/backend/resilience/platter-defrag.test.ts`):**
  ```typescript
  it('preserves original CBZ archive intact when process is abruptly killed mid-rewrite', async () => {
    const defrag = new PlatterDefragmenter({ db, fileStorage });
    const originalHash = await computeFileHash('series/chap-1.cbz');

    // Simulate abrupt crash during rewrite
    await expect(defrag.defragmentArchive('series/chap-1.cbz', { simulateCrashAtPercent: 50 })).rejects.toThrow();

    const postCrashHash = await computeFileHash('series/chap-1.cbz');
    expect(postCrashHash).toBe(originalHash); // Uncorrupted
  });
  ```

---

### Case 2: Atomic File Renaming (`fs.renameSync`)
- **Scenario:** Verifying that archive updates are written to a temporary staging file on the same volume and swapped atomically via `fs.renameSync`.
- **Behavioral Expectation:**
  - Readers opening the file during or immediately after defragmentation never encounter partial ZIP headers or race conditions.
- **Test Implementation Outline (`tests/backend/resilience/platter-defrag.test.ts`):**
  ```typescript
  it('uses atomic file renaming to swap defragmented archives safely', async () => {
    const renameSpy = vi.spyOn(fs, 'renameSync');
    const defrag = new PlatterDefragmenter({ db, fileStorage });

    await defrag.defragmentArchive('series/chap-1.cbz');
    expect(renameSpy).toHaveBeenCalled();
  });
  ```

---

### Case 3: Insufficient Disk Space Guards (< 500MB)
- **Scenario:** Triggering archive defragmentation when free disk space on the target volume is below the 500MB threshold.
- **Behavioral Expectation:**
  - The defragmenter must check available disk space (`fs.statfs` or platform check) before starting.
  - If free space < 500MB, it aborts immediately with a `LowDiskSpaceError` without starting write operations or filling the disk.
- **Test Implementation Outline (`tests/backend/resilience/platter-defrag.test.ts`):**
  ```typescript
  it('aborts defragmentation immediately with LowDiskSpaceError when free space is < 500MB', async () => {
    vi.spyOn(fs, 'statfs').mockResolvedValue({ bavail: 100 * 1024 * 1024 } as any); // 100MB free
    const defrag = new PlatterDefragmenter({ db, fileStorage });

    await expect(defrag.defragmentArchive('series/chap-1.cbz')).rejects.toThrow(/LowDiskSpaceError/);
  });
  ```

---

### Case 4: Immediate Preemption by Interactive Reader (`IOCoordinator`)
- **Scenario:** A background platter defragmentation task is running at `IOPriority.BACKGROUND` when the user opens a chapter and requests an interactive page load (`IOPriority.CRITICAL`).
- **Behavioral Expectation:**
  - The `IOCoordinator` and `PauseGate` must instantly suspend the defrag writer stream, serving the interactive read within $< 15\text{ ms}$, then resume defrag in background.
- **Test Implementation Outline (`tests/backend/resilience/platter-defrag.test.ts`):**
  ```typescript
  it('preempts background defragmentation instantly when interactive reader requests a page', async () => {
    const defrag = new PlatterDefragmenter({ db, fileStorage, ioCoordinator });

    const defragPromise = defrag.defragmentArchive('series/chap-1.cbz');

    const start = performance.now();
    await ioCoordinator.run({ priority: 'CRITICAL' }, async () => {
      return fastReadPage('chap-1', 1);
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(15);
    await defragPromise;
  });
  ```

---

## 3. Deliverables & Artifact Summary
- This resilience test plan document (`docs/reports/sprint63-platter-defrag-resilience-matrix.md`).
- Automated test suites:
  - `tests/backend/resilience/platter-defrag.test.ts`
  - `tests/backend/routes/maintenance-routes.test.ts` (updated)
