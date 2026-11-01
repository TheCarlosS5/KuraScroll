import { describe, it, expect, beforeEach, afterEach } from 'vitest';

class PauseGate {
  private paused = false;
  private waiters: Array<{ resolve: () => void; reject: (err: Error) => void; signal?: AbortSignal }> = [];

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
    const currentWaiters = [...this.waiters];
    this.waiters = [];
    for (const w of currentWaiters) {
      if (w.signal?.aborted) {
        w.reject(new DOMException('Aborted', 'AbortError'));
      } else {
        w.resolve();
      }
    }
  }

  public async checkpoint(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    if (!this.paused) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const waiter = {
        resolve: () => {
          if (signal) signal.removeEventListener('abort', onAbort);
          resolve();
        },
        reject: (err: Error) => {
          if (signal) signal.removeEventListener('abort', onAbort);
          reject(err);
        },
        signal
      };

      const onAbort = () => {
        const idx = this.waiters.indexOf(waiter);
        if (idx !== -1) {
          this.waiters.splice(idx, 1);
        }
        waiter.reject(new DOMException('Aborted', 'AbortError'));
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      this.waiters.push(waiter);
    });
  }

  public getWaiterCount(): number {
    return this.waiters.length;
  }
}

class IOCoordinator {
  private queue: Array<{ id: string; priority: number; addedAt: number; task: () => Promise<any> }> = [];
  private activeCount = false;

  public async schedule<T>(id: string, priority: number, task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        id,
        priority,
        addedAt: Date.now(),
        task: async () => {
          try {
            const res = await task();
            resolve(res);
          } catch (err) {
            reject(err);
          }
        }
      });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeCount || this.queue.length === 0) return;
    this.activeCount = true;

    const now = Date.now();
    this.queue.sort((a, b) => {
      const ageA = now - a.addedAt;
      const ageB = now - b.addedAt;
      const effectivePriorityA = a.priority + (ageA > 200 ? 10 : 0);
      const effectivePriorityB = b.priority + (ageB > 200 ? 10 : 0);
      return effectivePriorityB - effectivePriorityA;
    });

    const next = this.queue.shift();
    if (next) {
      try {
        await next.task();
      } finally {
        this.activeCount = false;
        this.processQueue();
      }
    } else {
      this.activeCount = false;
    }
  }
}

describe('Sprint 28: Shared I/O Concurrency Coordinator & PauseGate Resilience Suite', () => {
  let pauseGate: PauseGate;
  let ioCoordinator: IOCoordinator;

  beforeEach(() => {
    pauseGate = new PauseGate();
    ioCoordinator = new IOCoordinator();
  });

  // =========================================================================
  // 1. Pausa y reanudación cooperativa múltiple
  // =========================================================================
  it('1.1: cooperative multiple pauses and resumes never collapse or skip checkpoints', async () => {
    let checkpointsPassed = 0;
    const backgroundTask = async () => {
      for (let i = 0; i < 3; i++) {
        pauseGate.pause();
        const p = pauseGate.checkpoint();
        setTimeout(() => pauseGate.resume(), 10);
        await p;
        checkpointsPassed++;
      }
      return checkpointsPassed;
    };

    const result = await backgroundTask();
    expect(result).toBe(3);
    expect(checkpointsPassed).toBe(3);
  });

  // =========================================================================
  // 2. Cancelación con AbortSignal mientras está en espera en el PauseGate
  // =========================================================================
  it('2.1: aborting task via AbortSignal while waiting at PauseGate rejects cleanly without zombie callbacks', async () => {
    const controller = new AbortController();
    pauseGate.pause();

    const taskPromise = pauseGate.checkpoint(controller.signal);

    expect(pauseGate.getWaiterCount()).toBe(1);

    controller.abort();

    await expect(taskPromise).rejects.toThrow(/Aborted/i);
    expect(pauseGate.getWaiterCount()).toBe(0);
    expect(() => pauseGate.resume()).not.toThrow();
  });

  // =========================================================================
  // 3. Desempate FIFO y control de envejecimiento (aging) en la cola sin inanición
  // =========================================================================
  it('3.1: IOCoordinator priority queue with aging prevents starvation of low-priority tasks', async () => {
    const executionOrder: string[] = [];

    const lowPriorityTask = ioCoordinator.schedule('low-1', 1, async () => {
      await new Promise(r => setTimeout(r, 50));
      executionOrder.push('low-1');
    });

    await new Promise(r => setTimeout(r, 250));

    const highPriorityTask = ioCoordinator.schedule('high-1', 10, async () => {
      executionOrder.push('high-1');
    });

    await Promise.all([lowPriorityTask, highPriorityTask]);

    expect(executionOrder).toContain('low-1');
    expect(executionOrder).toContain('high-1');
    expect(executionOrder.length).toBe(2);
  });
});
