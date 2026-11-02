import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  DialogueSearchService,
  DialogueBubbleInput,
} from '../../../../src/backend/services/dialogue-search-service.js';

describe('DialogueSearchService (Sprint 60)', () => {
  let db: DatabaseInstance;
  let service: DialogueSearchService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Seed dummy series and chapters
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser-op', 'one-piece', 'One Piece', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES 
        ('chap-1', 'ser-op', 1, 'Romance Dawn', '/path/1.cbz', 20),
        ('chap-2', 'ser-op', 2, 'That Guy Luffy', '/path/2.cbz', 20),
        ('chap-10', 'ser-op', 10, 'Luffy vs Buggy', '/path/10.cbz', 20)
    `).run();

    service = new DialogueSearchService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('sanitizes hostile and malformed FTS5 search queries', () => {
    expect(DialogueSearchService.sanitizeQuery('   ')).toBe('');
    expect(DialogueSearchService.sanitizeQuery('""unclosed quote')).toBe('unclosed quote');
    expect(DialogueSearchService.sanitizeQuery('wildcard* and (parens) +plus~')).toBe('wildcard and parens plus');
    expect(DialogueSearchService.sanitizeQuery('海賊王:*:*')).toBe('海賊王');
  });

  it('indexes batch of speech bubbles and updates trigger FTS5 table', () => {
    const bubbles: DialogueBubbleInput[] = [
      {
        id: 'bub-1',
        chapterId: 'chap-1',
        pageNumber: 1,
        bubbleIndex: 0,
        x: 10, y: 10, w: 20, h: 15,
        text: '海賊王に俺はなる！',
        language: 'ja',
        bubbleType: 'SPEECH',
      },
      {
        id: 'bub-2',
        chapterId: 'chap-1',
        pageNumber: 2,
        bubbleIndex: 1,
        x: 30, y: 40, w: 25, h: 20,
        text: 'シャンクス、腕が…！',
        language: 'ja',
        bubbleType: 'SCREAM',
      },
    ];

    const count = service.indexBatch(bubbles);
    expect(count).toBe(2);
    expect(service.getTotalCount()).toBe(2);
  });

  it('performs CJK trigram substring search for queries >= 3 characters', () => {
    const bubbles: DialogueBubbleInput[] = [
      {
        id: 'bub-1',
        chapterId: 'chap-1',
        pageNumber: 5,
        bubbleIndex: 0,
        x: 10, y: 10, w: 20, h: 20,
        text: '海賊王に俺はなる！',
      },
      {
        id: 'bub-2',
        chapterId: 'chap-2',
        pageNumber: 3,
        bubbleIndex: 0,
        x: 15, y: 15, w: 30, h: 25,
        text: 'ゴムゴムのピストル！',
      },
    ];
    service.indexBatch(bubbles);

    const res = service.search({ query: '海賊王' });
    expect(res.results.length).toBe(1);
    expect(res.results[0].bubbleId).toBe('bub-1');
    expect(res.results[0].text).toContain('海賊王');
    expect(res.queryTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('uses fallback substring search for short queries (< 3 characters)', () => {
    const bubbles: DialogueBubbleInput[] = [
      {
        id: 'bub-short-1',
        chapterId: 'chap-1',
        pageNumber: 1,
        bubbleIndex: 0,
        x: 10, y: 10, w: 20, h: 20,
        text: 'ゾロ！どこだ！',
      },
      {
        id: 'bub-short-2',
        chapterId: 'chap-1',
        pageNumber: 2,
        bubbleIndex: 0,
        x: 10, y: 10, w: 20, h: 20,
        text: 'ナミさん、危ない！',
      },
    ];
    service.indexBatch(bubbles);

    // 2-character Japanese query "ゾロ"
    const res = service.search({ query: 'ゾロ' });
    expect(res.results.length).toBe(1);
    expect(res.results[0].bubbleId).toBe('bub-short-1');

    // 1-character kanji query "危"
    const resKanji = service.search({ query: '危' });
    expect(resKanji.results.length).toBe(1);
    expect(resKanji.results[0].bubbleId).toBe('bub-short-2');
  });

  it('enforces anti-spoiler causal progress filtering', () => {
    const bubbles: DialogueBubbleInput[] = [
      {
        id: 'bub-early',
        chapterId: 'chap-1',
        pageNumber: 5,
        bubbleIndex: 0,
        x: 10, y: 10, w: 20, h: 20,
        text: '巨大な敵が現れた！',
      },
      {
        id: 'bub-spoiler',
        chapterId: 'chap-10', // Later chapter
        pageNumber: 12,
        bubbleIndex: 0,
        x: 10, y: 10, w: 20, h: 20,
        text: '巨大な敵の正体はあいつだったのか！',
      },
    ];
    service.indexBatch(bubbles);

    // Reader is only on Chapter 2: maxChapterNumber = 2
    const resProtected = service.search({
      query: '巨大な敵',
      maxChapterNumber: 2,
    });

    expect(resProtected.results.length).toBe(1);
    expect(resProtected.results[0].bubbleId).toBe('bub-early');

    // Without spoiler protection: both results returned
    const resUnprotected = service.search({
      query: '巨大な敵',
    });
    expect(resUnprotected.results.length).toBe(2);
  });

  it('scopes search by seriesId and chapterId', () => {
    // Add another series
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser-naruto', 'naruto', 'Naruto', 'manga', 'ongoing')
    `).run();
    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path, page_count)
      VALUES ('chap-naruto-1', 'ser-naruto', 1, 'Uzumaki Naruto', '/path/n1.cbz', 20)
    `).run();

    service.indexBatch([
      {
        id: 'bub-op',
        chapterId: 'chap-1',
        pageNumber: 1,
        bubbleIndex: 0,
        x: 10, y: 10, w: 20, h: 20,
        text: '絶対に諦めない！',
      },
      {
        id: 'bub-naruto',
        chapterId: 'chap-naruto-1',
        pageNumber: 1,
        bubbleIndex: 0,
        x: 10, y: 10, w: 20, h: 20,
        text: 'まっすぐ自分の言葉は曲げねぇ、絶対に諦めない！',
      },
    ]);

    const resOnePieceOnly = service.search({
      query: '諦めない',
      seriesId: 'ser-op',
    });
    expect(resOnePieceOnly.results.length).toBe(1);
    expect(resOnePieceOnly.results[0].bubbleId).toBe('bub-op');
  });

  it('runs optimizeFtsIndex without errors', () => {
    expect(() => service.optimizeFtsIndex()).not.toThrow();
  });
});
