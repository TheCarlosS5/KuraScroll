export class PauseGate {
  private paused = false;
  private waiters: Array<() => void> = [];

  get isPaused(): boolean {
    return this.paused;
  }

  get waitingCount(): number {
    return this.waiters.length;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    const currentWaiters = this.waiters;
    this.waiters = [];
    for (const resolve of currentWaiters) {
      resolve();
    }
  }

  async checkpoint(signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted();
    if (!this.paused) return;

    return new Promise<void>((resolve, reject) => {
      let isSettled = false;

      const fulfill = () => {
        if (isSettled) return;
        isSettled = true;
        if (signal) {
          signal.removeEventListener('abort', onAbort);
        }
        resolve();
      };

      const onAbort = () => {
        if (isSettled) return;
        isSettled = true;
        const idx = this.waiters.indexOf(fulfill);
        if (idx !== -1) {
          this.waiters.splice(idx, 1);
        }
        reject(signal?.reason || new Error('This operation was aborted'));
      };

      this.waiters.push(fulfill);

      if (signal) {
        if (signal.aborted) {
          onAbort();
        } else {
          signal.addEventListener('abort', onAbort, { once: true });
        }
      }
    });
  }
}
