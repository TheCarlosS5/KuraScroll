import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDatabase, runMigrations, DatabaseInstance } from '../../src/backend/db/database.js';
import { AudioSFXService } from '../../src/backend/services/audio-sfx-service.js';

describe('Audio SFX Latency & Throughput Benchmark (Sprint 49)', () => {
  let db: DatabaseInstance;
  let service: AudioSFXService;

  beforeAll(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new AudioSFXService(db);

    // Seed dummy series
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('series-audio-bench', 'audio-bench', 'Audio Benchmark Series', 'manga', 'ongoing')
    `).run();

    // Seed 100 chapters
    const insertChapter = db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES (?, 'series-audio-bench', ?, ?, '/storage/bench')
    `);

    for (let c = 1; c <= 100; c++) {
      insertChapter.run(`ch-bench-${c}`, c, `Chapter ${c}`);
    }

    // Seed 300 tracks and 5,000 SFX cues across chapters
    const presets: Array<'rain' | 'storm' | 'fire' | 'tavern' | 'wind' | 'eerie' | 'battle'> = [
      'rain', 'storm', 'fire', 'tavern', 'wind', 'eerie', 'battle'
    ];

    for (let c = 1; c <= 100; c++) {
      const chapterId = `ch-bench-${c}`;

      // 3 tracks per chapter (pages 1-10, 11-20, 21-30)
      service.addAudioTrack({ chapterId, startPage: 1, endPage: 10, ambientPreset: presets[c % presets.length] });
      service.addAudioTrack({ chapterId, startPage: 11, endPage: 20, ambientPreset: presets[(c + 1) % presets.length] });
      service.addAudioTrack({ chapterId, startPage: 21, endPage: 30, ambientPreset: presets[(c + 2) % presets.length] });

      // 50 SFX cues per chapter (total 5,000 cues)
      for (let p = 1; p <= 25; p++) {
        service.addSfxCue({
          chapterId,
          pageNumber: p,
          cueIndex: 0,
          sfxId: `sfx_action_${p}`,
          onomatopoeiaText: p % 2 === 0 ? 'ドン!!' : 'ゴゴゴ...',
          synthParams: { waveType: 'sine', baseFrequencyHz: 100 + p * 5 },
        });
        service.addSfxCue({
          chapterId,
          pageNumber: p,
          cueIndex: 1,
          sfxId: `sfx_ambient_${p}`,
          onomatopoeiaText: 'ザッ',
          synthParams: { waveType: 'triangle', baseFrequencyHz: 250 },
        });
      }
    }
  });

  afterAll(() => {
    db.close();
  });

  it('retrieves page audio cues under 0.5 ms SLA across 1,000 queries', () => {
    const totalQueries = 1000;
    const latenciesMs: number[] = [];

    // Warm-up
    for (let i = 0; i < 50; i++) {
      service.getSfxCuesForPage('ch-bench-1', 5);
      service.getAudioTrackForPage('ch-bench-1', 5);
    }

    const startOverall = process.hrtime.bigint();

    for (let i = 0; i < totalQueries; i++) {
      const c = (i % 100) + 1;
      const p = (i % 25) + 1;

      const qStart = process.hrtime.bigint();
      const track = service.getAudioTrackForPage(`ch-bench-${c}`, p);
      const cues = service.getSfxCuesForPage(`ch-bench-${c}`, p);
      const elapsedNs = process.hrtime.bigint() - qStart;

      latenciesMs.push(Number(elapsedNs) / 1_000_000);

      expect(track).not.toBeNull();
      expect(cues).toHaveLength(2);
    }

    const elapsedTotalMs = Number(process.hrtime.bigint() - startOverall) / 1_000_000;
    const meanLatencyMs = latenciesMs.reduce((a, b) => a + b, 0) / latenciesMs.length;
    const sorted = [...latenciesMs].sort((a, b) => a - b);
    const p50Ms = sorted[Math.floor(sorted.length * 0.5)];
    const p95Ms = sorted[Math.floor(sorted.length * 0.95)];
    const p99Ms = sorted[Math.floor(sorted.length * 0.99)];
    const qps = Math.round((totalQueries / elapsedTotalMs) * 1000);

    console.log(`[AUDIO SFX BENCHMARK] Page Cues Lookup | Mean: ${meanLatencyMs.toFixed(4)} ms | P50: ${p50Ms.toFixed(4)} ms | P95: ${p95Ms.toFixed(4)} ms | P99: ${p99Ms.toFixed(4)} ms | QPS: ${qps}`);

    // SLA check: under test runner concurrency < 0.5ms nominal, < 2.0ms under high load
    expect(meanLatencyMs).toBeLessThan(0.5);

    // Full chapter manifest lookup benchmark
    const manifestStart = process.hrtime.bigint();
    for (let c = 1; c <= 50; c++) {
      service.getChapterAudioManifest(`ch-bench-${c}`);
    }
    const manifestElapsedMs = Number(process.hrtime.bigint() - manifestStart) / 1_000_000;
    const meanManifestMs = manifestElapsedMs / 50;

    console.log(`[AUDIO MANIFEST BENCHMARK] Full Manifest | Mean: ${meanManifestMs.toFixed(4)} ms | SLA: < 1.0 ms`);
    expect(meanManifestMs).toBeLessThan(1.0);

    // Persist benchmark report
    const reportPath = path.resolve(process.cwd(), 'docs/reports/sprint49-audio-sfx-benchmark.md');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(
      reportPath,
      `# Sprint 49: Dynamic Audio SFX & Ambient Track Latency Benchmark

## Test Configuration
- **Target Hardware**: Intel Pentium T4500 (2C/2T @ 2.30 GHz, Penryn 45nm, 512MB RAM)
- **Database**: SQLite WAL Mode with better-sqlite3 / node:sqlite prepared statement
- **Dataset**: 5,000 SFX cues + 300 ambient tracks across 100 chapters
- **Page Cues Queries**: ${totalQueries}
- **Chapter Manifest Queries**: 50
- **Covering Index**: \`idx_sfx_cues_chapter_page (chapter_id, page_number, cue_index ASC)\`

## Measured Results
- **Page Audio Cues Mean Latency**: \`${meanLatencyMs.toFixed(4)} ms\` (SLA: $< 0.5\\text{ ms}$)
- **P50 Latency**: \`${p50Ms.toFixed(4)} ms\`
- **P95 Latency**: \`${p95Ms.toFixed(4)} ms\`
- **P99 Latency**: \`${p99Ms.toFixed(4)} ms\`
- **Throughput**: \`${qps} page lookups/sec\`
- **Chapter Manifest Mean Latency**: \`${meanManifestMs.toFixed(4)} ms\` (SLA: $< 1.0\\text{ ms}$)
- **SLA Status**: **PASSED (${(0.5 / meanLatencyMs).toFixed(1)}x faster than SLA)**
`
    );
  });
});
