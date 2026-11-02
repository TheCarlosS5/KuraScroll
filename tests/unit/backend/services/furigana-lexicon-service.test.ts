import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  FuriganaLexiconService,
  LexiconEntryInput,
  MAX_LRU_ENTRIES,
} from '../../../../src/backend/services/furigana-lexicon-service.js';

describe('FuriganaLexiconService (Sprint 62)', () => {
  let db: DatabaseInstance;
  let service: FuriganaLexiconService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES 
        ('ser-bleach', 'bleach', 'Bleach', 'manga', 'completed'),
        ('ser-op', 'one-piece', 'One Piece', 'manga', 'ongoing')
    `).run();

    service = new FuriganaLexiconService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('normalizes half-width Katakana and Unicode NFC', () => {
    expect(FuriganaLexiconService.normalizeTerm(' ﾊﾞﾝｶｲ ')).toBe('バンカイ');
    expect(FuriganaLexiconService.normalizeTerm('ﾜﾝﾋﾟｰｽ')).toBe('ワンピース');
    expect(FuriganaLexiconService.normalizeTerm(' ﾗｾﾝｶﾞﾝ ')).toBe('ラセンガン');
  });

  it('retrieves seeded iconic manga terms from SQLite and caches in LRU', () => {
    const entry = service.getEntry('卍解');
    expect(entry).not.toBeNull();
    expect(entry?.term).toBe('卍解');
    expect(entry?.reading).toBe('ばんかい');
    expect(entry?.romaji).toBe('bankai');
    expect(entry?.category).toBe('SERIES_LORE');

    // Second retrieval should hit LRU cache
    const cachedEntry = service.getEntry('卍解');
    expect(cachedEntry).toEqual(entry);

    const stats = service.getStats();
    expect(stats.hitCount).toBeGreaterThanOrEqual(1);
    expect(stats.cachedEntries).toBeGreaterThanOrEqual(1);
  });

  it('prioritizes series-specific lore over global definitions', () => {
    // Insert global term
    service.upsertEntry({
      term: '宝物',
      reading: 'たからもの',
      romaji: 'takaramono',
      category: 'VOCAB',
      definitionEs: 'Objeto precioso de gran valor material o sentimental.',
      seriesId: null,
    });

    // Insert series-specific term for One Piece
    service.upsertEntry({
      term: '宝物',
      reading: 'ワンピース',
      romaji: 'one piece',
      category: 'SERIES_LORE',
      definitionEs: 'El tesoro legendario que dejó el Rey de los Piratas, Gol D. Roger.',
      seriesId: 'ser-op',
    });

    // Lookup with ser-op context should return One Piece definition
    const opEntry = service.getEntry('宝物', 'ser-op');
    expect(opEntry).not.toBeNull();
    expect(opEntry?.reading).toBe('ワンピース');
    expect(opEntry?.definitionEs).toContain('Gol D. Roger');

    // Lookup with another series or without series should return global definition
    const globalEntry = service.getEntry('宝物', 'ser-bleach');
    expect(globalEntry).not.toBeNull();
    expect(globalEntry?.reading).toBe('たからもの');
  });

  it('returns null gracefully for non-existent terms', () => {
    const entry = service.getEntry('存在しない用語_99999');
    expect(entry).toBeNull();
  });

  it('searches lexicon entries by substring in term, reading or romaji', () => {
    const results = service.searchEntries('bankai');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].term).toBe('卍解');

    const cjkResults = service.searchEntries('覇気');
    expect(cjkResults.length).toBeGreaterThanOrEqual(1);
    expect(cjkResults[0].term).toContain('覇王色');
  });

  it('handles malicious injection payloads safely without syntax failure', () => {
    const malicious = "'; DROP TABLE cjk_lexicon_entries; --";
    const entry = service.getEntry(malicious);
    expect(entry).toBeNull();

    // Verify table remains intact
    const stats = service.getStats();
    expect(stats.totalEntries).toBeGreaterThan(0);
  });

  it('evicts oldest entries when LRU cache capacity is exceeded', () => {
    service.clearLruCache();

    // Insert MAX_LRU_ENTRIES + 10 entries
    for (let i = 0; i < MAX_LRU_ENTRIES + 10; i++) {
      service.upsertEntry({
        term: `term_${i}`,
        reading: `reading_${i}`,
        romaji: `romaji_${i}`,
        category: 'VOCAB',
        definitionEs: `Definicion ${i}`,
      });
    }

    const stats = service.getStats();
    expect(stats.cachedEntries).toBeLessThanOrEqual(MAX_LRU_ENTRIES);
  });
});
