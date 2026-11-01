import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';

describe('Database and Migrations', () => {
  let db: DatabaseInstance;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('creates all tables including series, series_titles and series_search_fts', () => {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tables = rows.map((r) => r.name);

    expect(tables).toContain('series');
    expect(tables).toContain('series_titles');
    expect(tables).toContain('series_search_fts');
    expect(tables).toContain('volumes');
    expect(tables).toContain('chapters');
    expect(tables).toContain('chapter_pages');
    expect(tables).toContain('user_progress');
  });

  it('triggers populate series_search_fts automatically on series_titles insert', () => {
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('kny', 'kimetsu-no-yaiba', 'Demon Slayer: Kimetsu no Yaiba', 'manga', 'completed');

      INSERT INTO series_titles (series_id, language_code, title, is_primary)
      VALUES ('kny', 'ja', '鬼滅の刃', 1);

      INSERT INTO series_titles (series_id, language_code, title, is_primary)
      VALUES ('kny', 'es', 'Guardianes de la Noche', 0);
    `);

    const ftsResults = db
      .prepare("SELECT * FROM series_search_fts WHERE series_search_fts MATCH '\"Guardianes\"*'")
      .all() as { series_id: string; title: string }[];

    expect(ftsResults.length).toBe(1);
    expect(ftsResults[0].series_id).toBe('kny');
    expect(ftsResults[0].title).toBe('Guardianes de la Noche');
  });
});
