import { describe, it, expect } from 'vitest';
import {
  normalizeTitle,
  jaroWinklerSimilarity,
  compositeSimilarity
} from '../../src/backend/utils/fuzzy-matcher.js';

describe('Sprint 43: Fuzzy Matcher & Deduplication Latency Benchmark', () => {
  it('evaluates Jaro-Winkler similarity across 2,000 iterations in < 0.05ms per pair', () => {
    const titlesA = [
      'Solo Leveling [Asura Scans]',
      'Attack on Titan [HQ]',
      'Tōkyō Revengers (Official)',
      'SPY×FAMILY [Digital Colored]',
      'Chainsaw Man {MangaDex}',
      'Mushoku Tensei ~Isekai Ittara Honki Dasu~',
      'Demon Slayer: Kimetsu no Yaiba',
      'One Piece (Digital Colored Comics)'
    ];

    const titlesB = [
      'Solo Leveling (Official)',
      'Attack on Titan',
      'Toukyou Revengers',
      'SPY x FAMILY',
      'Chainsaw Man [HD]',
      'Mushoku Tensei',
      'Kimetsu no Yaiba',
      'One Piece [Official]'
    ];

    const iterations = 2000;

    // Warmup JIT
    for (let i = 0; i < 500; i++) {
      const idx = i % titlesA.length;
      compositeSimilarity(titlesA[idx], titlesB[idx]);
    }

    const startTime = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      const idx = i % titlesA.length;
      compositeSimilarity(titlesA[idx], titlesB[idx]);
    }

    const elapsedNs = process.hrtime.bigint() - startTime;
    const elapsedMs = Number(elapsedNs) / 1_000_000;
    const meanLatencyMs = elapsedMs / iterations;

    console.log(`\n===============================================================`);
    console.log(` BENCHMARK REPORT: COMPOSITE JARO-WINKLER FUZZY MATCHING LATENCY`);
    console.log(`===============================================================`);
    console.log(` Total Iterations Evaluated           : ${iterations}`);
    console.log(` Total Elapsed Time                  : ${elapsedMs.toFixed(2)} ms`);
    console.log(` Mean Latency per Pair Evaluation    : ${meanLatencyMs.toFixed(4)} ms`);
    console.log(` Target Latency SLA                  : < 0.0500 ms`);
    console.log(` Speedup Factor vs SLA               : ${(0.05 / meanLatencyMs).toFixed(1)}x faster`);
    console.log(` Evaluations Throughput (pairs/sec)  : ${(iterations / (elapsedMs / 1000)).toFixed(0)} pairs/s`);
    console.log(`===============================================================\n`);

    expect(meanLatencyMs).toBeLessThan(0.05); // SLA: < 50 microseconds
  });
});
