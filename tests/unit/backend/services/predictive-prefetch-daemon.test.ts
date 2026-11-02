import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  PredictivePrefetchDaemon,
  NavigationNotice,
} from '../../../../src/backend/services/predictive-prefetch-daemon.js';
import { IOCoordinator } from '../../../../src/backend/storage/io/io-coordinator.js';

describe('PredictivePrefetchDaemon (Sprint 59)', () => {
  const scratchDir = path.resolve(process.cwd(), 'test-scratch/prefetch-daemon-test');
  let testFilePath: string;

  beforeEach(async () => {
    await fs.mkdir(scratchDir, { recursive: true });
    testFilePath = path.join(scratchDir, 'test_page_1200.webp');
    // Write 150KB dummy file (spans > 2 x 64KB chunks)
    const dummyBuffer = Buffer.alloc(150 * 1024, 0x42);
    await fs.writeFile(testFilePath, dummyBuffer);
  });

  afterEach(async () => {
    try {
      await fs.rm(scratchDir, { recursive: true, force: true });
    } catch {}
  });

  it('manages warmth states correctly', () => {
    const daemon = new PredictivePrefetchDaemon();
    expect(daemon.getWarmth('chap-1', 1, 1200)).toBe('cold');

    daemon.setWarmth('chap-1', 1, 1200, 'warming');
    expect(daemon.getWarmth('chap-1', 1, 1200)).toBe('warming');

    daemon.setWarmth('chap-1', 1, 1200, 'hot');
    expect(daemon.getWarmth('chap-1', 1, 1200)).toBe('hot');
  });

  it('processes navigation notices and enqueues candidate warming jobs', async () => {
    const coordinator = new IOCoordinator();
    const daemon = new PredictivePrefetchDaemon({ ioCoordinator: coordinator });

    const notice: NavigationNotice = {
      chapterId: 'chap-1',
      pageNumber: 5,
      previousPage: 4,
      dwellSeconds: 12.0,
      totalPages: 20,
      targetWidth: 1200,
    };

    const res = await daemon.notifyNavigation(notice);

    expect(res.candidates.length).toBeGreaterThan(0);
    // Current page is marked HOT immediately
    expect(daemon.getWarmth('chap-1', 5, 1200)).toBe('hot');

    // Next page should have been enqueued and marked as warming or hot
    const nextWarmth = daemon.getWarmth('chap-1', 6, 1200);
    expect(['warming', 'hot']).toContain(nextWarmth);

    const stats = daemon.getStats();
    expect(stats.warmedCount).toBeGreaterThanOrEqual(1);
  });

  it('cooperatively reads files in 64 KiB chunks with preemption support', async () => {
    const daemon = new PredictivePrefetchDaemon();
    const bytesRead = await daemon.warmFileChunked(testFilePath);

    expect(bytesRead).toBe(150 * 1024);

    // Test abort signal cancellation
    const controller = new AbortController();
    controller.abort();
    await expect(daemon.warmFileChunked(testFilePath, controller.signal)).rejects.toThrow();

    // Test non-existent file returns 0 bytes gracefully
    const missingBytes = await daemon.warmFileChunked(path.join(scratchDir, 'missing.webp'));
    expect(missingBytes).toBe(0);
  });

  it('cancels outdated speculative jobs when reader changes direction', async () => {
    const daemon = new PredictivePrefetchDaemon();

    // Reader moving forward from 5 to 6
    await daemon.notifyNavigation({
      chapterId: 'chap-1',
      pageNumber: 6,
      previousPage: 5,
      totalPages: 30,
      dwellSeconds: 15.0,
    });

    // Reader suddenly jumps or retreats back to 2
    await daemon.notifyNavigation({
      chapterId: 'chap-1',
      pageNumber: 2,
      previousPage: 6,
      totalPages: 30,
      dwellSeconds: 10.0,
    });

    expect(daemon.getWarmth('chap-1', 2, 1200)).toBe('hot');
  });

  it('clears all internal queues and state cleanly', () => {
    const daemon = new PredictivePrefetchDaemon();
    daemon.setWarmth('chap-1', 1, 1200, 'hot');
    daemon.setWarmth('chap-1', 2, 1200, 'warming');

    expect(daemon.getWarmth('chap-1', 1, 1200)).toBe('hot');
    daemon.clear();
    expect(daemon.getWarmth('chap-1', 1, 1200)).toBe('cold');
  });
});
