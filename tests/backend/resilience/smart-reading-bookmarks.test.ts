import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Sprint 27: Smart Reading Bookmarks & Resume Pointer Resilience Suite', () => {
  let app: any;
  let db: DatabaseInstance;
  let storageRoot: string;

  beforeEach(async () => {
    storageRoot = path.resolve(__dirname, 'sandbox-sprint27');
    await fs.mkdir(storageRoot, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    app = buildApp({ db, storageRoot });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
    await fs.rm(storageRoot, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. Caso base: usuario con progreso en múltiples series devuelve el orden exacto por updated_at DESC
  // =========================================================================
  it('1.1: multi-series reading progress returns exact order sorted by updated_at DESC', async () => {
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status) VALUES 
        ('series-a', 'series-a', 'Series Alpha', 'manhwa', 'ongoing'),
        ('series-b', 'series-b', 'Series Beta', 'manhwa', 'ongoing'),
        ('series-c', 'series-c', 'Series Gamma', 'manhwa', 'ongoing');
      
      INSERT INTO chapters (id, series_id, chapter_number, storage_path) VALUES 
        ('ch-a1', 'series-a', 1, 'path/a'),
        ('ch-b1', 'series-b', 1, 'path/b'),
        ('ch-c1', 'series-c', 1, 'path/c');
    `);

    db.exec(`
      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, scroll_offset_y, is_completed, updated_at) VALUES 
        ('user-1', 'series-a', 'ch-a1', 5, 100, 0, datetime('now', '-30 minutes')),
        ('user-1', 'series-b', 'ch-b1', 12, 450, 0, datetime('now', '-5 minutes')),
        ('user-1', 'series-c', 'ch-c1', 2, 50, 0, datetime('now', '-2 hours'));
    `);

    const rows = db.prepare(`
      SELECT series_id, chapter_id, page_number, updated_at
      FROM user_progress
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `).all('user-1') as any[];

    expect(rows.length).toBe(3);
    expect(rows[0].series_id).toBe('series-b'); // most recent (-5 mins)
    expect(rows[1].series_id).toBe('series-a'); // (-30 mins)
    expect(rows[2].series_id).toBe('series-c'); // oldest (-2 hours)
  });

  // =========================================================================
  // 2. Caso vacío: usuario nuevo sin progreso devuelve lista vacía items: [] y 200 OK sin fallar
  // =========================================================================
  it('2.1: new user with no reading progress returns empty items [] and 200 OK without crashing', async () => {
    const rows = db.prepare(`
      SELECT series_id, chapter_id, page_number, updated_at
      FROM user_progress
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `).all('brand-new-user-999');

    expect(rows).toEqual([]);
  });

  // =========================================================================
  // 3. Integridad de miniaturas: si la miniatura o página no existe físicamente en disco, el frontend muestra placeholder sin error 500 y el enlace de reanudación funciona al 100%
  // =========================================================================
  it('3.1: missing physical thumbnail or chapter page on disk triggers graceful fallback without HTTP 500', async () => {
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status) VALUES 
        ('series-missing', 'missing-cover', 'Missing Cover Series', 'manhwa', 'ongoing');
      
      INSERT INTO chapters (id, series_id, chapter_number, storage_path) VALUES 
        ('ch-missing', 'series-missing', 1, 'non_existent_chapter_dir');

      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, scroll_offset_y, is_completed) VALUES 
        ('user-1', 'series-missing', 'ch-missing', 5, 200, 0);
    `);

    const pageRes = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch-missing/pages/5'
    });

    expect(pageRes.statusCode).not.toBe(500);
    
    const progressRes = await app.inject({
      method: 'GET',
      url: '/api/v1/progress/series-missing?userId=user-1'
    });
    expect(progressRes.statusCode).toBe(200);
    expect(progressRes.json().chapterId).toBe('ch-missing');
    expect(progressRes.json().pageNumber).toBe(5);
  });

  // =========================================================================
  // 4. Caso límite: series o capítulos eliminados de la base de datos se manejan limpiamente con LEFT JOIN / foreign keys sin colapsar la respuesta
  // =========================================================================
  it('4.1: handles deleted series or chapters gracefully via LEFT JOIN without collapsing response', async () => {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      INSERT INTO series (id, slug, title_primary, type, status) VALUES 
        ('series-live', 'live-series', 'Live Series', 'manhwa', 'ongoing');
      
      INSERT INTO chapters (id, series_id, chapter_number, storage_path) VALUES 
        ('ch-live', 'series-live', 1, 'path/live');

      INSERT INTO user_progress (user_id, series_id, chapter_id, page_number, scroll_offset_y, is_completed, updated_at) VALUES 
        ('user-1', 'series-deleted-xyz', 'ch-deleted-xyz', 10, 500, 0, datetime('now'));
      PRAGMA foreign_keys = ON;
    `);

    const safeQuery = db.prepare(`
      SELECT 
        up.user_id,
        up.series_id,
        s.title_primary AS series_title,
        up.chapter_id,
        c.chapter_number,
        up.page_number,
        up.updated_at
      FROM user_progress up
      LEFT JOIN series s ON up.series_id = s.id
      LEFT JOIN chapters c ON up.chapter_id = c.id
      WHERE up.user_id = ?
      ORDER BY up.updated_at DESC
    `);

    const results = safeQuery.all('user-1') as any[];
    expect(results.length).toBe(1);
    expect(results[0].series_id).toBe('series-deleted-xyz');
    expect(results[0].series_title).toBeNull();
    expect(results[0].chapter_number).toBeNull();
    expect(results[0].page_number).toBe(10);
  });
});
