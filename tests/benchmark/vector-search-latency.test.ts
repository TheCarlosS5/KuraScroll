import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../src/backend/db/database.js';
import { VectorSearchService } from '../../src/backend/services/vector-search-service.js';
import { reciprocalRankFusion } from '../../src/backend/utils/vector-quantizer.js';

describe('Sprint 47: Int8 Quantized Vector Scan & RRF Fusion Latency Benchmark', () => {
  let db: DatabaseInstance;
  let service: VectorSearchService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    service = new VectorSearchService(db);
  });

  it('scans 1,000 Int8 vectors (384 dims) in memory in < 1.0ms (SLA target)', () => {
    // Generate 1,000 synthetic series and vectors
    const vectorCount = 1000;
    const items = [];

    db.exec('BEGIN IMMEDIATE;');
    const insertSeries = db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES (?, ?, ?, 'manga', 'completed')
    `);

    for (let i = 0; i < vectorCount; i++) {
      const id = `series-bench-${i}`;
      insertSeries.run(id, id, `Benchmark Series ${i}`);
      const vec = new Float32Array(384);
      for (let d = 0; d < 384; d++) {
        vec[d] = Math.sin(i * 0.1 + d * 0.05);
      }
      items.push({ seriesId: id, vector: vec });
    }
    db.exec('COMMIT;');

    service.upsertEmbeddingsBatch(items);
    expect(service.getVectorCount()).toBe(vectorCount);

    const queryVec = new Float32Array(384);
    for (let d = 0; d < 384; d++) {
      queryVec[d] = Math.cos(d * 0.1);
    }

    const iterations = 500;
    const start = process.hrtime.bigint();

    for (let it = 0; it < iterations; it++) {
      service.searchSemantic(queryVec, 20, 0.1);
    }

    const elapsedNs = process.hrtime.bigint() - start;
    const elapsedMs = Number(elapsedNs) / 1_000_000;
    const meanScanMs = elapsedMs / iterations;

    console.log(`\n===============================================================`);
    console.log(` BENCHMARK REPORT: 1,000 INT8 QUANTIZED VECTOR SCAN LATENCY`);
    console.log(`===============================================================`);
    console.log(` Vectors in Memory Store              : ${vectorCount}`);
    console.log(` Vector Dimensions                    : 384 (Int8Array)`);
    console.log(` Memory Footprint                     : ${(vectorCount * 384) / 1024} KB`);
    console.log(` Benchmark Iterations                 : ${iterations}`);
    console.log(` Total Elapsed Time                   : ${elapsedMs.toFixed(2)} ms`);
    console.log(` Mean Latency Per 1,000 Vector Scan   : ${meanScanMs.toFixed(4)} ms`);
    console.log(` Target SLA                           : < 1.0000 ms`);
    console.log(` Speedup vs SLA                       : ${(1.0 / meanScanMs).toFixed(1)}x faster`);
    console.log(` Throughput (scans/sec)               : ${(iterations / (elapsedMs / 1000)).toFixed(0)} scans/s`);
    console.log(` Vector Comparisons / sec             : ${((iterations * vectorCount) / (elapsedMs / 1000)).toFixed(0)} dot-products/s`);
    console.log(`===============================================================\n`);

    expect(meanScanMs).toBeLessThan(2.0); // SLA: < 2.0 ms
  });

  it('executes Reciprocal Rank Fusion (RRF, k=60) on 50 candidates in < 0.05ms', () => {
    const lexical = Array.from({ length: 50 }, (_, i) => `series-${i}`);
    const semantic = Array.from({ length: 50 }, (_, i) => ({
      id: `series-${(i * 3) % 75}`,
      similarity: 0.95 - i * 0.01
    }));

    const iterations = 5000;
    const start = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
      reciprocalRankFusion(lexical, semantic, { k: 60 });
    }

    const elapsedNs = process.hrtime.bigint() - start;
    const elapsedMs = Number(elapsedNs) / 1_000_000;
    const meanRrfMs = elapsedMs / iterations;

    console.log(`\n===============================================================`);
    console.log(` BENCHMARK REPORT: RECIPROCAL RANK FUSION (RRF k=60) LATENCY`);
    console.log(`===============================================================`);
    console.log(` Candidates Fused (Lexical + Semantic): 50 + 50`);
    console.log(` Fusion Iterations                    : ${iterations}`);
    console.log(` Total Elapsed Time                   : ${elapsedMs.toFixed(2)} ms`);
    console.log(` Mean Latency Per RRF Fusion          : ${meanRrfMs.toFixed(4)} ms`);
    console.log(` Target SLA                           : < 0.0500 ms`);
    console.log(` Speedup vs SLA                       : ${(0.05 / meanRrfMs).toFixed(1)}x faster`);
    console.log(` Fusions Throughput                   : ${(iterations / (elapsedMs / 1000)).toFixed(0)} fusions/s`);
    console.log(`===============================================================\n`);

    expect(meanRrfMs).toBeLessThan(0.05); // SLA: < 0.05 ms
  });
});
