import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/backend/app';
import { createDatabase, runMigrations, DatabaseInstance } from '../../src/backend/db/database';
import { SeriesRepository } from '../../src/backend/repositories/series-repository';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

// ============================================================================
// Statistical & Latency Metrics Helper
// ============================================================================

export interface LatencyStats {
  count: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
  stdDevMs: number;
}

export function computeLatencyStats(latencies: number[]): LatencyStats {
  if (latencies.length === 0) {
    return { count: 0, minMs: 0, maxMs: 0, meanMs: 0, p50Ms: 0, p90Ms: 0, p95Ms: 0, p99Ms: 0, stdDevMs: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / count;

  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  const getPercentile = (p: number) => {
    const idx = Math.min(Math.floor((p / 100) * count), count - 1);
    return sorted[idx];
  };

  return {
    count,
    minMs: +sorted[0].toFixed(2),
    maxMs: +sorted[count - 1].toFixed(2),
    meanMs: +mean.toFixed(2),
    p50Ms: +getPercentile(50).toFixed(2),
    p90Ms: +getPercentile(90).toFixed(2),
    p95Ms: +getPercentile(95).toFixed(2),
    p99Ms: +getPercentile(99).toFixed(2),
    stdDevMs: +stdDev.toFixed(2),
  };
}

function printAsciiTable(title: string, rows: [string, string | number][]) {
  console.log(`\n===============================================================`);
  console.log(` BENCHMARK REPORT: ${title}`);
  console.log(`===============================================================`);
  for (const [key, val] of rows) {
    console.log(` ${key.padEnd(35)} : ${val}`);
  }
  console.log(`===============================================================\n`);
}

// ============================================================================
// Catalog Search Concurrency Benchmark Suite
// ============================================================================

describe('KuraScroll Catalog Search & Multilingual FTS5 Concurrency Stress Benchmark', () => {
  const testBaseDir = path.resolve(__dirname, `../../tmp/benchmark-catalog-${Date.now()}`);
  const dbPath = path.join(testBaseDir, 'catalog-bench.db');

  let db: DatabaseInstance;
  let repo: SeriesRepository;

  beforeAll(async () => {
    try {
      if (fsSync.existsSync(testBaseDir)) {
        await fs.rm(testBaseDir, { recursive: true, force: true });
      }
    } catch {}
    await fs.mkdir(testBaseDir, { recursive: true });

    db = createDatabase(dbPath);
    runMigrations(db);

    // Optimize SQLite WAL pragmas for high-throughput catalog reading
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA cache_size = -64000;'); // 64 MB page cache
    db.exec('PRAGMA temp_store = MEMORY;');

    repo = new SeriesRepository(db);

    // Seed diverse multilingual catalog across Manga, Manhwa, Manhua, and Comics
    const catalogData = [
      {
        id: 's_demon_slayer',
        slug: 'demon-slayer',
        titlePrimary: 'Demon Slayer: Kimetsu no Yaiba',
        type: 'manga' as const,
        status: 'completed' as const,
        demographic: 'shounen' as const,
        synopsis: 'Tanjiro sets out to turn his demonized sister Nezuko back into a human.',
        titles: [
          { languageCode: 'en', title: 'Demon Slayer: Kimetsu no Yaiba', isPrimary: true },
          { languageCode: 'ja-ro', title: 'Kimetsu no Yaiba' },
          { languageCode: 'ja', title: '鬼滅の刃' },
          { languageCode: 'es', title: 'Guardianes de la Noche' },
        ],
      },
      {
        id: 's_solo_leveling',
        slug: 'solo-leveling',
        titlePrimary: 'Solo Leveling',
        type: 'manhwa' as const,
        status: 'completed' as const,
        demographic: 'shounen' as const,
        synopsis: 'Sung Jinwoo ascends as the Shadow Monarch.',
        titles: [
          { languageCode: 'en', title: 'Solo Leveling', isPrimary: true },
          { languageCode: 'ko', title: '나 혼자만 레벨업' },
          { languageCode: 'ja', title: '俺だけレベルアップな件' },
          { languageCode: 'es', title: 'Solo Leveling: Solo yo subo de nivel' },
        ],
      },
      {
        id: 's_chainsaw_man',
        slug: 'chainsaw-man',
        titlePrimary: 'Chainsaw Man',
        type: 'manga' as const,
        status: 'ongoing' as const,
        demographic: 'shounen' as const,
        synopsis: 'Denji merges with Pochita to become Chainsaw Man.',
        titles: [
          { languageCode: 'en', title: 'Chainsaw Man', isPrimary: true },
          { languageCode: 'ja', title: 'チェンソーマン' },
          { languageCode: 'es', title: 'El Hombre Motosierra' },
        ],
      },
      {
        id: 's_tower_of_god',
        slug: 'tower-of-god',
        titlePrimary: 'Tower of God',
        type: 'manhwa' as const,
        status: 'ongoing' as const,
        demographic: 'shounen' as const,
        synopsis: 'What do you desire? Money and wealth? Glory? Reach the top of the tower.',
        titles: [
          { languageCode: 'en', title: 'Tower of God', isPrimary: true },
          { languageCode: 'ko', title: '신의 탑' },
          { languageCode: 'ja', title: '神之塔 -Tower of God-' },
          { languageCode: 'es', title: 'Torre de Dios' },
        ],
      },
      {
        id: 's_jujutsu_kaisen',
        slug: 'jujutsu-kaisen',
        titlePrimary: 'Jujutsu Kaisen',
        type: 'manga' as const,
        status: 'completed' as const,
        demographic: 'shounen' as const,
        synopsis: 'Yuji Itadori swallows a cursed finger to enter the world of sorcery.',
        titles: [
          { languageCode: 'en', title: 'Jujutsu Kaisen', isPrimary: true },
          { languageCode: 'ja', title: '呪術廻戦' },
          { languageCode: 'es', title: 'Guerra de Magia' },
        ],
      },
      {
        id: 's_tbate',
        slug: 'the-beginning-after-the-end',
        titlePrimary: 'The Beginning After the End',
        type: 'comic' as const,
        status: 'ongoing' as const,
        demographic: 'shounen' as const,
        synopsis: 'King Grey is reborn into a magical new world filled with beasts and mana.',
        titles: [
          { languageCode: 'en', title: 'The Beginning After the End', isPrimary: true },
          { languageCode: 'es', title: 'El Comienzo Después del Fin' },
          { languageCode: 'ko', title: '끝이 아닌 시작' },
        ],
      },
      {
        id: 's_orv',
        slug: 'omniscient-readers-viewpoint',
        titlePrimary: "Omniscient Reader's Viewpoint",
        type: 'manhwa' as const,
        status: 'ongoing' as const,
        demographic: 'shounen' as const,
        synopsis: 'Only Dokja knows the end of the world.',
        titles: [
          { languageCode: 'en', title: 'Omniscient Reader', isPrimary: true },
          { languageCode: 'ko', title: '전지적 독자 시점' },
          { languageCode: 'es', title: 'Punto de Vista del Lector Omnisciente' },
        ],
      },
      {
        id: 's_aot',
        slug: 'attack-on-titan',
        titlePrimary: 'Attack on Titan',
        type: 'manga' as const,
        status: 'completed' as const,
        demographic: 'shounen' as const,
        synopsis: 'Humanity lives behind giant walls to escape the human-eating Titans.',
        titles: [
          { languageCode: 'en', title: 'Attack on Titan', isPrimary: true },
          { languageCode: 'ja', title: '進撃の巨人' },
          { languageCode: 'ja-ro', title: 'Shingeki no Kyojin' },
          { languageCode: 'es', title: 'Ataque a los Titanes' },
        ],
      },
      {
        id: 's_outcast',
        slug: 'the-outcast',
        titlePrimary: 'The Outcast',
        type: 'manhua' as const,
        status: 'ongoing' as const,
        demographic: 'shounen' as const,
        synopsis: 'Zhang Chulan is attacked by zombies in a graveyard and awakened to his power.',
        titles: [
          { languageCode: 'en', title: 'The Outcast', isPrimary: true },
          { languageCode: 'zh', title: '一人之下' },
          { languageCode: 'es', title: 'El Proscrito' },
        ],
      },
      {
        id: 's_nano_machine',
        slug: 'nano-machine',
        titlePrimary: 'Nano Machine',
        type: 'manhwa' as const,
        status: 'ongoing' as const,
        demographic: 'shounen' as const,
        synopsis: 'An illegitimate son of the Demon Cult receives nanomachine injections from the future.',
        titles: [
          { languageCode: 'en', title: 'Nano Machine', isPrimary: true },
          { languageCode: 'ko', title: '나노마신' },
          { languageCode: 'es', title: 'Máquina Nano' },
        ],
      },
    ];

    // Seed master catalog records and full-text search indexes
    for (const item of catalogData) {
      repo.createSeries({
        id: item.id,
        slug: item.slug,
        titlePrimary: item.titlePrimary,
        type: item.type,
        status: item.status,
        demographic: item.demographic,
        synopsis: item.synopsis,
      });
      repo.addSeriesTitles(item.id, item.titles);
    }
  }, 30000);

  afterAll(async () => {
    try {
      db.close();
    } catch {}
    try {
      await fs.rm(testBaseDir, { recursive: true, force: true });
    } catch {}
  });

  // ==========================================================================
  // Benchmark 1: 100 Concurrent Multilingual + Combined Filter Queries
  // (type + status + FTS5 search in Spanish, Japanese Kanji, and Korean)
  // ==========================================================================
  it('benchmarks 100 concurrent multilingual FTS5 queries with combined type and status filters', async () => {
    const app = buildApp({ db, storageRoot: testBaseDir });
    await app.ready();

    // Define 10 diverse multilingual queries pairing FTS5 search terms with combined filters
    const testCases = [
      // Spanish queries + filters
      { q: 'Guardianes', type: 'manga', status: 'completed', expectedSlug: 'demon-slayer', lang: 'es' },
      { q: 'Motosierra', type: 'manga', status: 'ongoing', expectedSlug: 'chainsaw-man', lang: 'es' },
      { q: 'Torre', type: 'manhwa', status: 'ongoing', expectedSlug: 'tower-of-god', lang: 'es' },
      { q: 'Magia', type: 'manga', status: 'completed', expectedSlug: 'jujutsu-kaisen', lang: 'es' },
      { q: 'Titanes', type: 'manga', status: 'completed', expectedSlug: 'attack-on-titan', lang: 'es' },
      // Japanese Kanji queries + filters
      { q: '鬼滅', type: 'manga', status: 'completed', expectedSlug: 'demon-slayer', lang: 'ja' },
      { q: '呪術', type: 'manga', status: 'completed', expectedSlug: 'jujutsu-kaisen', lang: 'ja' },
      { q: '進撃', type: 'manga', status: 'completed', expectedSlug: 'attack-on-titan', lang: 'ja' },
      // Korean queries + filters
      { q: '레벨업', type: 'manhwa', status: 'completed', expectedSlug: 'solo-leveling', lang: 'ko' },
      { q: '나노마신', type: 'manhwa', status: 'ongoing', expectedSlug: 'nano-machine', lang: 'ko' },
    ];

    const totalConcurrentQueries = 100;
    const latencies: number[] = [];

    const startTime = performance.now();

    // Fire 100 concurrent requests simultaneously across the 10 test case variations
    const queryPromises = Array.from({ length: totalConcurrentQueries }, async (_, i) => {
      const tc = testCases[i % testCases.length];
      const url = `/api/v1/series?q=${encodeURIComponent(tc.q)}&type=${tc.type}&status=${tc.status}&limit=10`;

      const reqStart = performance.now();
      const res = await app.inject({ method: 'GET', url });
      const reqEnd = performance.now();

      latencies.push(reqEnd - reqStart);

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(Array.isArray(json.items)).toBe(true);
      expect(json.items.length).toBeGreaterThanOrEqual(1);

      // Verify that every returned item strictly satisfies the combined filters
      for (const item of json.items) {
        expect(item.type).toBe(tc.type);
        expect(item.status).toBe(tc.status);
      }

      // Verify canonical series was resolved accurately via FTS5
      const match = json.items.find((item: any) => item.slug === tc.expectedSlug);
      expect(match).toBeDefined();
    });

    await Promise.all(queryPromises);
    const endTime = performance.now();
    const durationMs = endTime - startTime;

    const stats = computeLatencyStats(latencies);
    const throughput = +((totalConcurrentQueries / (durationMs / 1000))).toFixed(2);

    // Assert high concurrency performance thresholds under monorepo load
    expect(latencies.length).toBe(totalConcurrentQueries);
    expect(stats.p50Ms).toBeLessThan(2500);
    expect(stats.p95Ms).toBeLessThan(3000);
    expect(stats.p99Ms).toBeLessThan(4000);
    expect(throughput).toBeGreaterThan(25);

    printAsciiTable('100 CONCURRENT MULTILINGUAL FTS5 + COMBINED FILTER QUERIES', [
      ['Total Concurrent Queries', totalConcurrentQueries],
      ['Languages Tested', 'Spanish (es), Japanese Kanji (ja), Korean (ko)'],
      ['Combined Filters', 'type + status + FTS5 Match'],
      ['Success Rate', '100% (100 / 100 OK)'],
      ['Total Elapsed Duration', `${durationMs.toFixed(2)} ms`],
      ['Throughput (Queries/sec)', `${throughput} queries/s`],
      ['Latency Min', `${stats.minMs} ms`],
      ['Latency Mean', `${stats.meanMs} ms`],
      ['Latency P50 (Median)', `${stats.p50Ms} ms`],
      ['Latency P90', `${stats.p90Ms} ms`],
      ['Latency P95', `${stats.p95Ms} ms`],
      ['Latency P99', `${stats.p99Ms} ms`],
      ['Latency Max', `${stats.maxMs} ms`],
      ['Standard Deviation', `${stats.stdDevMs} ms`],
    ]);

    await app.close();
  }, 30000);

  // ==========================================================================
  // Benchmark 2: 100 Concurrent Pure Multilingual FTS5 Full-Text Queries
  // (Evaluating raw FTS5 index scan speed across languages without type/status filters)
  // ==========================================================================
  it('benchmarks 100 concurrent unconstrained multilingual FTS5 queries', async () => {
    const app = buildApp({ db, storageRoot: testBaseDir });
    await app.ready();

    const terms = [
      'Guardianes de la Noche',
      'El Hombre Motosierra',
      '鬼滅の刃',
      '呪術廻戦',
      '進撃の巨人',
      '나 혼자만 레벨업',
      '신의 탑',
      '전지적 독자 시점',
      '나노마신',
      '一人之下',
    ];

    const totalConcurrentQueries = 100;
    const latencies: number[] = [];

    const startTime = performance.now();

    const queryPromises = Array.from({ length: totalConcurrentQueries }, async (_, i) => {
      const q = terms[i % terms.length];
      const url = `/api/v1/series?q=${encodeURIComponent(q)}&limit=10`;

      const reqStart = performance.now();
      const res = await app.inject({ method: 'GET', url });
      const reqEnd = performance.now();

      latencies.push(reqEnd - reqStart);
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.items.length).toBeGreaterThanOrEqual(1);
    });

    await Promise.all(queryPromises);
    const endTime = performance.now();
    const durationMs = endTime - startTime;

    const stats = computeLatencyStats(latencies);
    const throughput = +((totalConcurrentQueries / (durationMs / 1000))).toFixed(2);

    expect(latencies.length).toBe(totalConcurrentQueries);
    expect(stats.p50Ms).toBeLessThan(2000);
    expect(throughput).toBeGreaterThan(25);

    printAsciiTable('100 CONCURRENT PURE MULTILINGUAL FTS5 FULL-TEXT QUERIES', [
      ['Total Concurrent Queries', totalConcurrentQueries],
      ['Total Elapsed Duration', `${durationMs.toFixed(2)} ms`],
      ['Throughput (Queries/sec)', `${throughput} queries/s`],
      ['Latency Min', `${stats.minMs} ms`],
      ['Latency Mean', `${stats.meanMs} ms`],
      ['Latency P50 (Median)', `${stats.p50Ms} ms`],
      ['Latency P95', `${stats.p95Ms} ms`],
      ['Latency P99', `${stats.p99Ms} ms`],
      ['Latency Max', `${stats.maxMs} ms`],
    ]);

    await app.close();
  }, 30000);

  // ==========================================================================
  // Benchmark 3: 100 Concurrent Filtered Catalog Browsing Queries
  // (Evaluating type + status structured index scans and pagination)
  // ==========================================================================
  it('benchmarks 100 concurrent structured catalog filter and pagination queries', async () => {
    const app = buildApp({ db, storageRoot: testBaseDir });
    await app.ready();

    const filterCombinations = [
      { type: 'manga', status: 'completed' },
      { type: 'manga', status: 'ongoing' },
      { type: 'manhwa', status: 'completed' },
      { type: 'manhwa', status: 'ongoing' },
      { type: 'manhua', status: 'ongoing' },
      { type: 'comic', status: 'ongoing' },
    ];

    const totalConcurrentQueries = 100;
    const latencies: number[] = [];

    const startTime = performance.now();

    const queryPromises = Array.from({ length: totalConcurrentQueries }, async (_, i) => {
      const fc = filterCombinations[i % filterCombinations.length];
      const page = (i % 2) + 1;
      const url = `/api/v1/series?type=${fc.type}&status=${fc.status}&page=${page}&limit=5`;

      const reqStart = performance.now();
      const res = await app.inject({ method: 'GET', url });
      const reqEnd = performance.now();

      latencies.push(reqEnd - reqStart);
      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(Array.isArray(json.items)).toBe(true);
    });

    await Promise.all(queryPromises);
    const endTime = performance.now();
    const durationMs = endTime - startTime;

    const stats = computeLatencyStats(latencies);
    const throughput = +((totalConcurrentQueries / (durationMs / 1000))).toFixed(2);

    expect(stats.p50Ms).toBeLessThan(2000);
    expect(throughput).toBeGreaterThan(25);

    printAsciiTable('100 CONCURRENT STRUCTURED CATALOG FILTER & PAGINATION QUERIES', [
      ['Total Concurrent Queries', totalConcurrentQueries],
      ['Total Elapsed Duration', `${durationMs.toFixed(2)} ms`],
      ['Throughput (Queries/sec)', `${throughput} queries/s`],
      ['Latency Min', `${stats.minMs} ms`],
      ['Latency Mean', `${stats.meanMs} ms`],
      ['Latency P50 (Median)', `${stats.p50Ms} ms`],
      ['Latency P95', `${stats.p95Ms} ms`],
      ['Latency P99', `${stats.p99Ms} ms`],
      ['Latency Max', `${stats.maxMs} ms`],
    ]);

    await app.close();
  }, 30000);
});
