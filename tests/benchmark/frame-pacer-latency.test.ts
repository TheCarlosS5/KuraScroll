import { describe, it, expect } from 'vitest';
import { FramePacer } from '../../src/backend/utils/frame-pacer.js';
import { createDatabase, runMigrations } from '../../src/backend/db/database.js';
import { FrameTelemetryService } from '../../src/backend/services/frame-telemetry-service.js';

describe('Sprint 54 Benchmark: Frame Pacer Latency & Zero-Allocation SLA', () => {
  it('SLA 18: FramePacer recordFrame executes in < 0.005 ms per tick (Zero-allocation target)', () => {
    const pacer = new FramePacer({ bufferSize: 60 });

    // Warmup
    let t = 1000;
    for (let i = 0; i < 100; i++) {
      pacer.recordFrame(t);
      t += 16.67;
    }

    const iterations = 50000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      pacer.recordFrame(t);
      t += 16.67;
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    console.log(`[Sprint 54 SLA 18] FramePacer recordFrame avg latency: ${(avgLatencyMs * 1000).toFixed(3)} µs (${avgLatencyMs.toFixed(6)} ms) | ${(1000 / avgLatencyMs).toFixed(0)} ticks/sec`);

    expect(avgLatencyMs).toBeLessThan(0.005);
  });

  it('FrameTelemetryService recordReport executes in < 0.5 ms', () => {
    const db = createDatabase(':memory:');
    runMigrations(db);
    const service = new FrameTelemetryService(db);

    const iters = 500;
    const start = performance.now();
    for (let i = 0; i < iters; i++) {
      service.recordReport({
        userId: `reader_${i % 10}`,
        fpsAverage: 55.0,
        dropRatePct: 4.5,
        governorState: 'nominal_60',
        readingMode: 'manga',
      });
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iters;

    console.log(`[Sprint 54] FrameTelemetryService recordReport avg latency: ${avgLatencyMs.toFixed(4)} ms`);
    expect(avgLatencyMs).toBeLessThan(0.5);
  });
});
