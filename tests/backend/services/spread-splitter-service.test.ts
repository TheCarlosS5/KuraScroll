import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { SpreadSplitterService } from '../../../src/backend/services/spread-splitter-service.js';

describe('Sprint 51: SpreadSplitterService', () => {
  let db: DatabaseInstance;
  let service: SpreadSplitterService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Seed dummy series and chapter for foreign key integrity
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser_test', 'ser-test', 'Test Series', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('chap_101', 'ser_test', 101, 'Chapter 101', '/storage/chap101')
    `).run();

    service = new SpreadSplitterService(db);
  });

  it('upserts and retrieves spread manifest for a chapter page', () => {
    const created = service.upsertSpreadManifest({
      chapterId: 'chap_101',
      pageNumber: 42,
      width: 2400,
      height: 1800,
      readingDirection: 'rtl',
    });

    expect(created.chapterId).toBe('chap_101');
    expect(created.sourcePageNumber).toBe(42);
    expect(created.layoutDecision).toBe('split_spread');
    expect(created.splitOrder).toBe('rtl');
    expect(created.segments).toHaveLength(2);

    const fetched = service.getSpreadManifest('chap_101', 42);
    expect(fetched).not.toBeNull();
    expect(fetched!.layoutDecision).toBe('split_spread');
    expect(fetched!.segments[0].key).toBe('42-a');
    expect(fetched!.segments[1].key).toBe('42-b');
  });

  it('batch detects and persists an entire chapter inside a transaction', () => {
    const pages = [
      { pageNumber: 1, width: 1200, height: 1800, isCover: true }, // Cover -> single
      { pageNumber: 2, width: 1000, height: 1440 },                // Normal -> single
      { pageNumber: 3, width: 2500, height: 1800 },                // Spread -> split_spread
      { pageNumber: 4, width: 1000, height: 1440 },                // Normal -> single
    ];

    const manifests = service.batchDetectChapter('chap_101', pages, 'rtl');
    expect(manifests).toHaveLength(4);
    expect(manifests[0].layoutDecision).toBe('single');
    expect(manifests[1].layoutDecision).toBe('single');
    expect(manifests[2].layoutDecision).toBe('split_spread');
    expect(manifests[3].layoutDecision).toBe('single');

    const allChapter = service.getChapterSpreadManifests('chap_101');
    expect(allChapter).toHaveLength(4);
  });

  it('buildVirtualPageList expands double spreads into virtual reading sequence', () => {
    // Seed page 3 as split spread
    service.upsertSpreadManifest({
      chapterId: 'chap_101',
      pageNumber: 3,
      width: 2400,
      height: 1800,
      readingDirection: 'rtl',
    });

    const physicalPages = [
      { pageNumber: 1, url: '/storage/p1.webp' },
      { pageNumber: 2, url: '/storage/p2.webp' },
      { pageNumber: 3, url: '/storage/p3.webp' }, // Spread: will expand to 3-a and 3-b
      { pageNumber: 4, url: '/storage/p4.webp' },
    ];

    const virtualList = service.buildVirtualPageList('chap_101', physicalPages, 'rtl');
    expect(virtualList).toHaveLength(5); // 1, 2, 3-a, 3-b, 4

    expect(virtualList[0].virtualKey).toBe('1');
    expect(virtualList[1].virtualKey).toBe('2');
    expect(virtualList[2].virtualKey).toBe('3-a');
    expect(virtualList[2].side).toBe('right');
    expect(virtualList[3].virtualKey).toBe('3-b');
    expect(virtualList[3].side).toBe('left');
    expect(virtualList[4].virtualKey).toBe('4');
  });
});
