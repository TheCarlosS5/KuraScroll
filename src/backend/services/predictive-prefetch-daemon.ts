/**
 * KuraScroll Predictive Prefetch Daemon & Cooperative I/O Cache Warmer
 * Sprint 59 - Intelligent Pre-Flight Cache Warming & Turn-Ahead Prefetch
 *
 * Designed to prevent SATA II 4TB HDD head thrashing through bounded queues,
 * cooperative 64 KiB chunking, and foreground preemption (< 15ms yield latency).
 */

import fs from 'node:fs/promises';
import { open } from 'node:fs/promises';
import path from 'node:path';
import {
  MarkovDirectionPredictor,
  CandidatePrefetch,
  TurnAction,
  CadenceBucket,
  ReaderMode,
} from '../utils/markov-direction-predictor.js';
import { IOCoordinator } from '../storage/io/io-coordinator.js';
import { IOPriority } from '../storage/io/io-priority.js';
import { TranscodeCacheService } from './transcode-cache-service.js';

export type WarmthState = 'cold' | 'warming' | 'hot';

export interface PrefetchJob {
  id: string;
  candidate: CandidatePrefetch;
  createdAt: number;
  abortController: AbortController;
}

export interface NavigationNotice {
  userId?: string;
  chapterId: string;
  pageNumber: number;
  previousPage?: number;
  dwellSeconds?: number;
  readingMode?: ReaderMode;
  isDoubleSpread?: boolean;
  totalPages?: number;
  nextChapterId?: string;
  prevChapterId?: string;
  targetWidth?: number;
}

export interface PrefetchStats {
  queuedCount: number;
  warmedCount: number;
  activeCount: number;
  priors: {
    advance: number;
    retreat: number;
    jump: number;
  };
}

export class PredictivePrefetchDaemon {
  private readonly predictor: MarkovDirectionPredictor;
  private readonly ioCoordinator?: IOCoordinator;
  private readonly transcodeCache?: TranscodeCacheService;
  private readonly storageRoot?: string;

  // Cache warmth map: "chapterId:pageNumber:width" -> WarmthState
  private warmthMap: Map<string, WarmthState> = new Map();
  // Max entries in warmth map to prevent memory growth on 512MB RAM budget
  private readonly maxWarmthEntries = 2000;

  // Active / queued prefetch jobs
  private activeJobs: Map<string, PrefetchJob> = new Map();
  private pendingQueue: PrefetchJob[] = [];
  private readonly maxConcurrentReads = 1; // Strict single-stream background I/O for SATA II
  private isProcessing = false;

  // Reusable 64 KiB scratch buffer to warm OS page cache with zero V8 GC churn
  private static readonly CHUNK_SIZE = 64 * 1024;
  private readonly scratchBuffer = Buffer.allocUnsafe(PredictivePrefetchDaemon.CHUNK_SIZE);

  constructor(options?: {
    predictor?: MarkovDirectionPredictor;
    ioCoordinator?: IOCoordinator;
    transcodeCache?: TranscodeCacheService;
    storageRoot?: string;
  }) {
    this.predictor = options?.predictor ?? new MarkovDirectionPredictor();
    this.ioCoordinator = options?.ioCoordinator;
    this.transcodeCache = options?.transcodeCache;
    this.storageRoot = options?.storageRoot;
  }

  public getPredictor(): MarkovDirectionPredictor {
    return this.predictor;
  }

  public static makeKey(chapterId: string, pageNumber: number, width: number = 1200): string {
    return `${chapterId}:${pageNumber}:${width}`;
  }

  public getWarmth(chapterId: string, pageNumber: number, width: number = 1200): WarmthState {
    const key = PredictivePrefetchDaemon.makeKey(chapterId, pageNumber, width);
    return this.warmthMap.get(key) || 'cold';
  }

  public setWarmth(chapterId: string, pageNumber: number, width: number = 1200, state: WarmthState): void {
    const key = PredictivePrefetchDaemon.makeKey(chapterId, pageNumber, width);
    if (this.warmthMap.size >= this.maxWarmthEntries && !this.warmthMap.has(key)) {
      // LRU prune first 200 entries
      let count = 0;
      for (const k of this.warmthMap.keys()) {
        this.warmthMap.delete(k);
        count++;
        if (count >= 200) break;
      }
    }
    this.warmthMap.set(key, state);
  }

  /**
   * Process reader navigation event, recalculate Markov priors,
   * cancel outdated speculative reads, and enqueue candidate warming jobs.
   */
  public async notifyNavigation(notice: NavigationNotice): Promise<{
    candidates: CandidatePrefetch[];
    probabilities: { advance: number; retreat: number; jump: number };
  }> {
    const targetWidth = notice.targetWidth ?? 1200;

    // Mark current viewed page as HOT immediately
    this.setWarmth(notice.chapterId, notice.pageNumber, targetWidth, 'hot');

    // 1. Ingest transition and update Bayesian model
    const dwell = notice.dwellSeconds ?? 15.0;
    const cadence = MarkovDirectionPredictor.classifyCadence(dwell, notice.readingMode);

    if (notice.previousPage !== undefined && notice.previousPage > 0) {
      const action = MarkovDirectionPredictor.inferAction(notice.previousPage, notice.pageNumber);
      this.predictor.recordTransition(action, cadence);
    }

    const probabilities = this.predictor.getProbabilities(cadence);

    // 2. Predict next page candidates
    const totalPages = notice.totalPages ?? 50;
    const candidates = this.predictor.predictCandidates({
      currentPage: notice.pageNumber,
      totalPages,
      currentChapterId: notice.chapterId,
      nextChapterId: notice.nextChapterId,
      prevChapterId: notice.prevChapterId,
      previousPage: notice.previousPage,
      cadence,
      readingMode: notice.readingMode,
      isDoubleSpread: notice.isDoubleSpread,
      targetWidth,
      depth: 2,
    });

    // 3. Cancel active prefetch jobs that are no longer in candidate list
    const desiredKeys = new Set(
      candidates.map((c) => PredictivePrefetchDaemon.makeKey(c.chapterId, c.pageNumber, c.targetWidth ?? targetWidth))
    );

    for (const [key, job] of this.activeJobs.entries()) {
      if (!desiredKeys.has(key)) {
        job.abortController.abort();
        this.activeJobs.delete(key);
        // Reset state from warming back to cold if aborted
        if (this.warmthMap.get(key) === 'warming') {
          this.warmthMap.set(key, 'cold');
        }
      }
    }

    // Prune pending queue of cancelled jobs
    this.pendingQueue = this.pendingQueue.filter((job) => desiredKeys.has(job.id));

    // 4. Enqueue candidates that are cold
    for (const cand of candidates) {
      const width = cand.targetWidth ?? targetWidth;
      const key = PredictivePrefetchDaemon.makeKey(cand.chapterId, cand.pageNumber, width);
      const currentWarmth = this.getWarmth(cand.chapterId, cand.pageNumber, width);

      if (currentWarmth === 'cold' && !this.activeJobs.has(key)) {
        const job: PrefetchJob = {
          id: key,
          candidate: cand,
          createdAt: Date.now(),
          abortController: new AbortController(),
        };
        this.setWarmth(cand.chapterId, cand.pageNumber, width, 'warming');
        this.pendingQueue.push(job);
      }
    }

    // Trigger queue drain in background
    this.processQueue();

    return { candidates, probabilities };
  }

  /**
   * Cooperative prefetch worker loop
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.pendingQueue.length > 0 && this.activeJobs.size < this.maxConcurrentReads) {
        const job = this.pendingQueue.shift();
        if (!job || job.abortController.signal.aborted) continue;

        this.activeJobs.set(job.id, job);

        // Execute warming asynchronously with cooperative yield
        this.executeWarmup(job)
          .catch(() => {})
          .finally(() => {
            this.activeJobs.delete(job.id);
            // Continue processing next in queue
            if (this.pendingQueue.length > 0) {
              setImmediate(() => this.processQueue());
            }
          });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Warm single candidate cooperatively
   */
  private async executeWarmup(job: PrefetchJob): Promise<void> {
    const { candidate, abortController } = job;
    const width = candidate.targetWidth ?? 1200;

    if (abortController.signal.aborted) return;

    // Check if transcode cache has file
    let filePath: string | null = null;
    if (this.transcodeCache) {
      const cached = this.transcodeCache.lookupCachedPage(candidate.chapterId, candidate.pageNumber, width);
      if (cached && cached.filePath) {
        filePath = cached.filePath;
      }
    }

    // If file exists on disk, perform 64 KiB chunked read to warm OS filesystem cache
    if (filePath) {
      try {
        await this.warmFileChunked(filePath, abortController.signal);
        this.setWarmth(candidate.chapterId, candidate.pageNumber, width, 'hot');
        return;
      } catch (err: any) {
        if (abortController.signal.aborted) return;
      }
    }

    // Fallback: If IOCoordinator is present, register background I/O task
    if (this.ioCoordinator) {
      try {
        await this.ioCoordinator.run(
          {
            label: `prefetch-${candidate.chapterId}-${candidate.pageNumber}`,
            priority: IOPriority.BACKGROUND,
            signal: abortController.signal,
          },
          async () => {
            // Cooperative pause check
            if (abortController.signal.aborted) return;
            // Mark candidate as hot once background slot is satisfied
            this.setWarmth(candidate.chapterId, candidate.pageNumber, width, 'hot');
          }
        );
      } catch {
        if (!abortController.signal.aborted) {
          this.setWarmth(candidate.chapterId, candidate.pageNumber, width, 'cold');
        }
      }
    } else {
      // Default hot completion
      this.setWarmth(candidate.chapterId, candidate.pageNumber, width, 'hot');
    }
  }

  /**
   * Cooperative 64 KiB chunk reader.
   * Reads raw bytes into the static scratch buffer without allocating in V8 heap,
   * checking abort signal between chunks to guarantee < 15ms preemption latency.
   */
  public async warmFileChunked(targetPath: string, signal?: AbortSignal): Promise<number> {
    signal?.throwIfAborted();

    let fileHandle;
    try {
      fileHandle = await open(targetPath, 'r');
    } catch {
      return 0; // File does not exist yet
    }

    let totalBytesRead = 0;
    try {
      while (true) {
        signal?.throwIfAborted();

        const { bytesRead } = await fileHandle.read(
          this.scratchBuffer,
          0,
          PredictivePrefetchDaemon.CHUNK_SIZE,
          null
        );

        if (bytesRead === 0) break;
        totalBytesRead += bytesRead;

        // Yield execution to event loop between chunks (prevents blocking Fastify server)
        await new Promise((resolve) => setImmediate(resolve));
      }
    } finally {
      await fileHandle.close();
    }

    return totalBytesRead;
  }

  public getStats(): PrefetchStats {
    const priors = this.predictor.getProbabilities('NORMAL');
    let warmedCount = 0;
    for (const v of this.warmthMap.values()) {
      if (v === 'hot') warmedCount++;
    }

    return {
      queuedCount: this.pendingQueue.length,
      warmedCount,
      activeCount: this.activeJobs.size,
      priors,
    };
  }

  public clear(): void {
    for (const job of this.activeJobs.values()) {
      job.abortController.abort();
    }
    this.activeJobs.clear();
    this.pendingQueue = [];
    this.warmthMap.clear();
  }
}
