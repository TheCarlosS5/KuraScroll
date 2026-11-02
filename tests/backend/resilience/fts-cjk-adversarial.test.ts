import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Sprint 36: FTS Sanitizer & Natural CJK Fuzzy Tokenizer Utility
 */
function sanitizeFtsQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    return '';
  }

  // Strip invisible control characters, UTF-8 surrogates, and XSS vectors
  const cleaned = query
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .trim();

  if (!cleaned) {
    return '';
  }

  // For CJK and general text, if we want prefix matching or tokenization matching unicode61:
  // Using unicode61 tokenizer in SQLite FTS5 indexes characters/words. If we wrap single CJK characters in quotes, e.g. "進撃",
  // unicode61 might expect prefix matching or token form. Let's return sanitized query with safe prefix wildcard or unquoted tokens when appropriate.
  const tokens = cleaned.match(/[\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu);
  
  if (!tokens || tokens.length === 0) {
    return '';
  }

  // Return tokens with prefix wildcard * for robust matching
  return tokens.map(t => `"${t.replace(/"/g, '""')}"*`).join(' OR ');
}

describe('Sprint 36: FTS Adversarial & CJK Fuzzy Tokenizer Resilience Suite', () => {
  let db: DatabaseInstance;
  let testSandbox: string;

  beforeEach(async () => {
    testSandbox = path.resolve(__dirname, 'sandbox-sprint36');
    await fs.mkdir(testSandbox, { recursive: true });

    db = createDatabase(':memory:');
    runMigrations(db);

    // Setup FTS5 virtual table for series search matching schema.sql
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS series_search_fts USING fts5(
        series_id UNINDEXED,
        title,
        tokenize = 'unicode61 remove_diacritics 2',
        prefix = '1 2 3'
      );

      INSERT INTO series_search_fts (series_id, title) VALUES
        ('s-1', '進撃の巨人 Shingeki no Kyojin Attack on Titan action manga'),
        ('s-2', '鬼滅の刃 Kimetsu no Yaiba Demon Slayer action'),
        ('s-3', 'なると ナルト Naruto Ninja shinobi shonen manga'),
        ('s-4', '나 혼자만 레벨업 Solo Leveling Korean hunter manhwa');
    `);
  });

  afterEach(async () => {
    db.close();
    await fs.rm(testSandbox, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. Hostile and malformed search inputs
  // =========================================================================
  const hostileInputs = [
    '"',
    '"""',
    '"unclosed quote',
    '( ( ) )',
    '*)))',
    '+ - ~ ^ =',
    'AND',
    'OR',
    'NOT',
    'AND OR NOT AND',
    '\u0000\u001F\u007Finvisible\u009F',
    '<script>alert(1)</script>',
    '💥🔥🚀'
  ];

  for (const hostile of hostileInputs) {
    it(`1.x: safely sanitizes hostile input without throwing fts5 syntax error: ${JSON.stringify(hostile)}`, () => {
      const sanitized = sanitizeFtsQuery(hostile);
      
      // Attempt to execute FTS5 query against database; should NEVER throw syntax error
      expect(() => {
        db.prepare(`
          SELECT * FROM series_search_fts WHERE series_search_fts MATCH ?
        `).all(sanitized || 'dummy_fallback');
      }).not.toThrow();
    });
  }

  // =========================================================================
  // 2. CJK queries
  // =========================================================================
  const cjkQueries = [
    { query: '進撃', expectedMatchId: 's-1' },
    { query: '鬼', expectedMatchId: 's-2' },
    { query: 'なると', expectedMatchId: 's-3' },
    { query: 'ナルト', expectedMatchId: 's-3' },
    { query: '나 혼자', expectedMatchId: 's-4' }
  ];

  for (const cjk of cjkQueries) {
    it(`2.x: successfully resolves CJK query without FTS5 error: ${cjk.query}`, () => {
      const sanitized = sanitizeFtsQuery(cjk.query);
      expect(sanitized).not.toBe('');

      let results: any[] = [];
      expect(() => {
        results = db.prepare(`
          SELECT series_id FROM series_search_fts WHERE series_search_fts MATCH ?
        `).all(sanitized);
      }).not.toThrow();

      expect(results.some(r => r.series_id === cjk.expectedMatchId)).toBe(true);
    });
  }
});
