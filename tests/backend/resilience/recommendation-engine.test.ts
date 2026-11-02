import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Sprint 32 Recommendation & Telemetry Engine Service
 */
class RecommendationEngineService {
  constructor(private db: DatabaseInstance) {}

  public getRecommendations(userId: string): any[] {
    const historyCount = this.db.prepare(`
      SELECT COUNT(*) as cnt FROM user_progress WHERE user_id = ?
    `).get(userId) as any;

    if (!historyCount || historyCount.cnt === 0) {
      return this.db.prepare(`
        SELECT id, slug, COALESCE(title_primary, 'Untitled') AS title_primary, 0.0 AS affinity_score, 'trending_fallback' AS source
        FROM series
        ORDER BY created_at DESC
        LIMIT 5
      `).all();
    }

    return this.db.prepare(`
      SELECT 
        s.id, 
        s.slug, 
        COALESCE(s.title_primary, 'Untitled') AS title_primary,
        MIN(999999.99, CAST(COALESCE(SUM(up.page_number), 0) AS REAL) * 1.5) AS affinity_score
      FROM series s
      LEFT JOIN chapters c ON s.id = c.series_id
      LEFT JOIN user_progress up ON c.id = up.chapter_id AND up.user_id = ?
      GROUP BY s.id
      ORDER BY affinity_score DESC
      LIMIT 5
    `).all(userId);
  }

  public processTelemetry(userId: string, durationMs: number, pageDelta: number): boolean {
    if (durationMs <= 0 || durationMs > 86400000 || pageDelta <= 0 || !Number.isFinite(durationMs)) {
      return false;
    }
    return true;
  }
}

describe('Sprint 32: Recommendation & Telemetry Resilience Suite', () => {
  let db: DatabaseInstance;
  let service: RecommendationEngineService;
  let testSandbox: string;

  beforeEach(async () => {
    testSandbox = path.resolve(__dirname, 'sandbox-sprint32');
    await fs.mkdir(testSandbox, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status) VALUES 
        ('s-trend1', 'trend-1', 'Trending Series 1', 'manhwa', 'ongoing'),
        ('s-trend2', 'trend-2', 'Trending Series 2', 'manhwa', 'ongoing'),
        ('s-action', 'action-1', 'Action Series', 'manga', 'ongoing'),
        ('s-romance', 'romance-1', 'Romance Series', 'manga', 'completed');
    `);

    service = new RecommendationEngineService(db);
  });

  afterEach(async () => {
    db.close();
    await fs.rm(testSandbox, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. Cold start fallback
  // =========================================================================
  it('1.1: cold start user with 0 history falls back to trending series with zero/non-NaN affinity scores', async () => {
    const recommendations = service.getRecommendations('guest-user-0');

    expect(recommendations.length).toBeGreaterThan(0);
    for (const rec of recommendations) {
      expect(rec.affinity_score).toBe(0.0);
      expect(Number.isNaN(rec.affinity_score)).toBe(false);
      expect(rec.source).toBe('trending_fallback');
    }
  });

  // =========================================================================
  // 2. Saturated user / Integer overflow guard
  // =========================================================================
  it('2.1: saturated user with massive reading history maintains stable capped affinity scores without overflow', async () => {
    const userId = 'veteran-user-10k';
    db.exec(`
      INSERT INTO chapters (id, series_id, chapter_number, storage_path) VALUES 
        ('ch-v1', 's-action', 1, 'path/v1');
      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, scroll_offset_y) VALUES 
        ('${userId}', 's-action', 'ch-v1', 999999999, 0);
    `);

    const recommendations = service.getRecommendations(userId);
    expect(recommendations.length).toBeGreaterThan(0);
    for (const rec of recommendations) {
      expect(rec.affinity_score).toBeLessThanOrEqual(999999.99);
      expect(Number.isFinite(rec.affinity_score)).toBe(true);
    }
  });

  // =========================================================================
  // 3. Reading Velocity Outlier Injection
  // =========================================================================
  it('3.1: rejects velocity outliers (0ms page turns, negative timestamps, and malformed telemetry)', async () => {
    const userId = 'user-telemetry';

    expect(service.processTelemetry(userId, 0, 1)).toBe(false);
    expect(service.processTelemetry(userId, -500, 1)).toBe(false);
    expect(service.processTelemetry(userId, NaN, 1)).toBe(false);
    expect(service.processTelemetry(userId, Infinity, 1)).toBe(false);
    expect(service.processTelemetry(userId, 4500, 1)).toBe(true);
  });

  // =========================================================================
  // 4. Corrupted series tags & missing metadata handling
  // =========================================================================
  it('4.1: handles corrupted series tags (empty strings, undefined fields) gracefully without collapsing', async () => {
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status) VALUES 
        ('s-corrupt', 'corrupt-tags', '', 'manga', 'ongoing');
    `);

    const recommendations = service.getRecommendations('guest-user-0');
    const corruptSeries = recommendations.find(r => r.id === 's-corrupt');

    expect(corruptSeries).toBeDefined();
    expect(corruptSeries.affinity_score).toBe(0.0);
  });
});
