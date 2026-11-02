import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../src/backend/db/database.js';
import { EyeCareService } from '../../src/backend/services/eye-care-service.js';
import { classifyPageChroma } from '../../src/backend/utils/color-classifier.js';

describe('Sprint 50 Benchmark: Eye Care & Chroma Classification Latency SLA', () => {
  let db: DatabaseInstance;
  let service: EyeCareService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new EyeCareService(db);

    // Seed test users
    for (let i = 0; i < 50; i++) {
      service.upsertPreferences(`bench_user_${i}`, {
        filterMode: i % 2 === 0 ? 'smart_invert' : 'sepia_warm',
        brightnessPct: 95,
        contrastPct: 105,
        blueLightReductionPct: 40,
      });
    }
  });

  it('SLA 14: classifyPageChroma executes in < 0.05 ms per 8x8 buffer (Zero-allocation target)', () => {
    const buf = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      buf[i] = (i * 7) % 256;
    }

    // Warmup
    for (let i = 0; i < 100; i++) {
      classifyPageChroma(buf);
    }

    const iterations = 5000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      classifyPageChroma(buf);
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    console.log(`[Sprint 50] classifyPageChroma avg latency: ${avgLatencyMs.toFixed(5)} ms (${(1000 / avgLatencyMs).toFixed(0)} scans/sec)`);

    // Strict assertion: Average under 0.05 ms (50 microseconds)
    expect(avgLatencyMs).toBeLessThan(0.05);
  });

  it('SLA: getPreferences executes in < 0.5 ms per query', () => {
    // Warmup
    for (let i = 0; i < 10; i++) {
      service.getPreferences(`bench_user_${i}`);
    }

    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      service.getPreferences(`bench_user_${i % 50}`);
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    console.log(`[Sprint 50] EyeCare getPreferences avg latency: ${avgLatencyMs.toFixed(4)} ms`);

    expect(avgLatencyMs).toBeLessThan(0.5);
  });

  it('SLA: buildCssFilter executes in < 0.02 ms per computation', () => {
    const params = {
      filterMode: 'smart_invert' as const,
      isMonochromePage: true,
      brightnessPct: 90,
      contrastPct: 115,
      blueLightReductionPct: 20,
    };

    const iterations = 5000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      service.buildCssFilter(params);
    }
    const elapsed = performance.now() - start;
    const avgLatencyMs = elapsed / iterations;

    console.log(`[Sprint 50] buildCssFilter avg latency: ${avgLatencyMs.toFixed(5)} ms`);

    expect(avgLatencyMs).toBeLessThan(0.02);
  });
});
