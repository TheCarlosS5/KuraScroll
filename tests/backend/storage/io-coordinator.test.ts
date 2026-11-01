import { describe, it, expect, beforeEach } from 'vitest';
import { PauseGate } from '../../../src/backend/storage/io/pause-gate.js';
import { IOCoordinator } from '../../../src/backend/storage/io/io-coordinator.js';
import { IOPriority } from '../../../src/backend/storage/io/io-priority.js';

describe('Shared I/O Concurrency Coordinator & PauseGate Suite', () => {
  describe('PauseGate', () => {
    let gate: PauseGate;

    beforeEach(() => {
      gate = new PauseGate();
    });

    it('resolves immediately when not paused', async () => {
      const start = Date.now();
      await gate.checkpoint();
      expect(Date.now() - start).toBeLessThan(20);
      expect(gate.waitingCount).toBe(0);
    });

    it('pauses and resumes multiple concurrent checkpoints cleanly', async () => {
      gate.pause();
      expect(gate.isPaused).toBe(true);

      let p1Resolved = false;
      let p2Resolved = false;

      const p1 = gate.checkpoint().then(() => {
        p1Resolved = true;
      });
      const p2 = gate.checkpoint().then(() => {
        p2Resolved = true;
      });

      expect(gate.waitingCount).toBe(2);
      expect(p1Resolved).toBe(false);
      expect(p2Resolved).toBe(false);

      gate.resume();
      await Promise.all([p1, p2]);

      expect(p1Resolved).toBe(true);
      expect(p2Resolved).toBe(true);
      expect(gate.waitingCount).toBe(0);
      expect(gate.isPaused).toBe(false);
    });

    it('rejects immediately if AbortSignal is already aborted', async () => {
      gate.pause();
      const controller = new AbortController();
      controller.abort();

      await expect(gate.checkpoint(controller.signal)).rejects.toThrow();
      expect(gate.waitingCount).toBe(0);
    });

    it('rejects waiting checkpoint when AbortSignal triggers mid-pause', async () => {
      gate.pause();
      const controller = new AbortController();

      const checkpointPromise = gate.checkpoint(controller.signal);
      expect(gate.waitingCount).toBe(1);

      controller.abort();
      await expect(checkpointPromise).rejects.toThrow();
      expect(gate.waitingCount).toBe(0);

      // Subsequent resume causes no errors
      gate.resume();
    });
  });

  describe('IOCoordinator Priority & Cooperative Preemption', () => {
    let coordinator: IOCoordinator;

    beforeEach(() => {
      coordinator = new IOCoordinator({
        maxConcurrentInteractive: 1,
        maxConcurrentBackground: 1,
      });
    });

    it('executes CRITICAL and HIGH interactive tasks before BACKGROUND tasks', async () => {
      const order: string[] = [];

      // Start an interactive blocker task to hold the single interactive slot
      let unblock: () => void = () => {};
      const blocker = coordinator.run(
        { priority: IOPriority.HIGH, label: 'blocker' },
        () =>
          new Promise<void>((r) => {
            unblock = r;
          })
      );

      // Now queue High, Critical, and Background tasks while slot is busy
      const pBg = coordinator.run(
        { priority: IOPriority.BACKGROUND, label: 'backup-task' },
        async () => {
          order.push('bg');
          return 'bg';
        }
      );

      const pHigh = coordinator.run(
        { priority: IOPriority.HIGH, label: 'page-load' },
        async () => {
          order.push('high');
          return 'high';
        }
      );

      const pCrit = coordinator.run(
        { priority: IOPriority.CRITICAL, label: 'zen-reader' },
        async () => {
          order.push('critical');
          return 'critical';
        }
      );

      // Release blocker
      unblock();
      const [resBg, resHigh, resCrit] = await Promise.all([pBg, pHigh, pCrit]);

      expect(resBg).toBe('bg');
      expect(resHigh).toBe('high');
      expect(resCrit).toBe('critical');

      // Critical must run before High, and High must run before Background
      const critIdx = order.indexOf('critical');
      const highIdx = order.indexOf('high');
      const bgIdx = order.indexOf('bg');
      expect(critIdx).toBeLessThan(highIdx);
      expect(highIdx).toBeLessThan(bgIdx);
    });

    it('cooperatively yields background task at checkpoint when interactive task enters', async () => {
      let yielded = false;
      const progress: string[] = [];

      const bgTask = coordinator.run(
        { priority: IOPriority.BACKGROUND, label: 'scan-files' },
        async (ctx) => {
          progress.push('step-1');

          // Checkpoint 1
          await ctx.checkpoint();
          progress.push('step-2');

          // Checkpoint 2
          await ctx.checkpoint();
          progress.push('step-3');
          return 'done';
        }
      );

      // Give bgTask a millisecond to start step 1
      await new Promise((r) => setTimeout(r, 5));

      // Inject interactive task
      const interactiveTask = coordinator.run(
        { priority: IOPriority.CRITICAL, label: 'user-flip' },
        async () => {
          progress.push('interactive-read');
          yielded = true;
          return 'flip';
        }
      );

      await Promise.all([bgTask, interactiveTask]);

      expect(progress).toContain('step-1');
      expect(progress).toContain('interactive-read');
      expect(progress).toContain('step-3');
      expect(yielded).toBe(true);
    });

    it('tracks metrics accurately across completed jobs', async () => {
      await coordinator.run(
        { priority: IOPriority.HIGH, label: 'interactive-1' },
        async () => 42
      );

      const metrics = coordinator.getMetrics();
      expect(metrics.totalCompleted).toBe(1);
      expect(metrics.totalErrors).toBe(0);
      expect(metrics.activeInteractive).toBe(0);
      expect(metrics.queuedCount).toBe(0);
    });
  });
});
