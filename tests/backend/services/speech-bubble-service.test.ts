import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { SpeechBubbleService } from '../../../src/backend/services/speech-bubble-service.js';

describe('SpeechBubbleService Unit Tests (Sprint 46)', () => {
  let db: DatabaseInstance;
  let service: SpeechBubbleService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s-bubble', 'one-piece', 'One Piece', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, page_count, storage_path)
      VALUES ('op-c1', 's-bubble', 1.0, 50, '/storage/op-c1')
    `).run();

    service = new SpeechBubbleService(db, { cacheLimitPages: 10 });
  });

  it('returns empty bubbles array for page with no dialogue annotations', () => {
    const res = service.getPageBubbles('op-c1', 1);

    expect(res.success).toBe(true);
    expect(res.chapterId).toBe('op-c1');
    expect(res.pageNumber).toBe(1);
    expect(res.totalBubbles).toBe(0);
    expect(res.bubbles).toEqual([]);
  });

  it('upserts and retrieves speech bubbles with ruby furigana and multilingual translations', () => {
    const inserted = service.upsertPageBubbles('op-c1', 1, [
      {
        index: 0,
        bbox: { x: 68.5, y: 12.0, width: 22.4, height: 35.8 },
        readingDirection: 'vertical',
        rawText: '海賊王に俺はなる！',
        translatedTextEs: '¡Voy a ser el Rey de los Piratas!',
        translatedTextEn: "I'm going to become the King of the Pirates!",
        ruby: [
          { base: '海賊王', ruby: 'かいぞくおう' },
          { base: 'に', ruby: null },
          { base: '俺', ruby: 'おれ' },
          { base: 'は', ruby: null },
          { base: 'なる', ruby: null },
          { base: '！', ruby: null }
        ],
        confidence: 0.98
      }
    ]);

    expect(inserted).toBe(1);

    const res = service.getPageBubbles('op-c1', 1);
    expect(res.totalBubbles).toBe(1);

    const b0 = res.bubbles[0];
    expect(b0.id).toBe('op-c1-p1-b0');
    expect(b0.rawText).toBe('海賊王に俺はなる！');
    expect(b0.translations.es).toBe('¡Voy a ser el Rey de los Piratas!');
    expect(b0.translations.en).toBe("I'm going to become the King of the Pirates!");
    expect(b0.ruby).toBeDefined();
    expect(b0.ruby?.length).toBe(6);
    expect(b0.ruby?.[0]).toEqual({ base: '海賊王', ruby: 'かいぞくおう' });
    expect(b0.bbox.x).toBe(68.5);
    expect(b0.readingDirection).toBe('vertical');
  });

  it('clamps coordinates outside [0.0, 100.0] into safe percentages', () => {
    service.upsertPageBubbles('op-c1', 2, [
      {
        bbox: { x: -15.0, y: 150.0, width: 120.0, height: -10.0 },
        rawText: 'テスト'
      }
    ]);

    const res = service.getPageBubbles('op-c1', 2);
    expect(res.totalBubbles).toBe(1);

    const b = res.bubbles[0];
    expect(b.bbox.x).toBe(0.0);
    expect(b.bbox.y).toBe(100.0);
    expect(b.bbox.width).toBeLessThanOrEqual(100.0);
    expect(b.bbox.height).toBeGreaterThan(0.0);
  });

  it('serves repeat requests from in-memory LRU page cache', () => {
    service.upsertPageBubbles('op-c1', 3, [
      {
        bbox: { x: 20, y: 20, width: 30, height: 30 },
        rawText: 'Cached bubble'
      }
    ]);

    // First query populates cache
    const res1 = service.getPageBubbles('op-c1', 3);
    // Second query hits cache
    const res2 = service.getPageBubbles('op-c1', 3);

    expect(res1).toBe(res2); // Strict object reference equality proves cache hit
  });

  it('bulk imports multi-page manifest and calculates chapter summary', () => {
    const importRes = service.importComicTextManifest({
      chapterId: 'op-c1',
      pages: [
        {
          pageNumber: 5,
          bubbles: [
            { bbox: { x: 10, y: 10, width: 20, height: 20 }, rawText: 'Page 5 bubble 1' },
            { bbox: { x: 40, y: 40, width: 20, height: 20 }, rawText: 'Page 5 bubble 2' }
          ]
        },
        {
          pageNumber: 6,
          bubbles: [
            { bbox: { x: 15, y: 15, width: 25, height: 25 }, rawText: 'Page 6 bubble 1' }
          ]
        }
      ]
    });

    expect(importRes.pagesImported).toBe(2);
    expect(importRes.bubblesImported).toBe(3);

    const summary = service.getChapterBubblesSummary('op-c1');
    expect(summary.totalBubbles).toBe(3);
    expect(summary.pagesWithBubbles).toBe(2);
  });

  it('handles malformed ruby JSON gracefully in database', () => {
    // Manually insert corrupt JSON into DB
    db.prepare(`
      INSERT INTO chapter_speech_bubbles (
        id, chapter_id, page_number, bubble_index, bbox_x, bbox_y, bbox_width, bbox_height,
        raw_text, ruby_furigana
      ) VALUES ('corrupt-1', 'op-c1', 9, 0, 10, 10, 20, 20, 'Raw text', '{ invalid json [}')
    `).run();

    const res = service.getPageBubbles('op-c1', 9);
    expect(res.totalBubbles).toBe(1);
    expect(res.bubbles[0].ruby).toBeUndefined(); // Safe fallback without throwing SyntaxError
  });
});
