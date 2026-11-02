import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { PageAnnotationService } from '../../../src/backend/services/page-annotation-service.js';

describe('Sprint 52: PageAnnotationService', () => {
  let db: DatabaseInstance;
  let service: PageAnnotationService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Seed dummy series and chapter
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('ser_notes', 'ser-notes', 'Notes Series', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('chap_ann', 'ser_notes', 1, 'Chapter 1', '/storage/ann1')
    `).run();

    service = new PageAnnotationService(db);
  });

  it('creates and retrieves annotations for a specific page', () => {
    const created = service.createAnnotation({
      chapterId: 'chap_ann',
      pageNumber: 5,
      userId: 'user_1',
      anchorX: 45.5,
      anchorY: 72.0,
      annotationType: 'sticky_note',
      contentText: 'Epic foreshadowing in this speech bubble!',
      colorPreset: 'yellow',
      isSpoiler: false,
    });

    expect(created.id).toBeGreaterThan(0);
    expect(created.chapterId).toBe('chap_ann');
    expect(created.pageNumber).toBe(5);
    expect(created.anchorX).toBe(45.5);
    expect(created.anchorY).toBe(72.0);
    expect(created.contentText).toBe('Epic foreshadowing in this speech bubble!');
    expect(created.isSpoiler).toBe(false);

    // Query page
    const pageAnnotations = service.getAnnotationsForPage('chap_ann', 5);
    expect(pageAnnotations).toHaveLength(1);
    expect(pageAnnotations[0].id).toBe(created.id);
  });

  it('retrieves all annotations for an entire chapter ordered by page and id', () => {
    service.createAnnotation({
      chapterId: 'chap_ann',
      pageNumber: 10,
      userId: 'user_1',
      anchorX: 10,
      anchorY: 10,
      contentText: 'End note',
    });
    service.createAnnotation({
      chapterId: 'chap_ann',
      pageNumber: 2,
      userId: 'user_2',
      anchorX: 20,
      anchorY: 20,
      contentText: 'Early note',
    });
    service.createAnnotation({
      chapterId: 'chap_ann',
      pageNumber: 2,
      userId: 'user_1',
      anchorX: 30,
      anchorY: 30,
      contentText: 'Second early note',
    });

    const chapterList = service.getAnnotationsForChapter('chap_ann');
    expect(chapterList).toHaveLength(3);
    expect(chapterList[0].pageNumber).toBe(2);
    expect(chapterList[1].pageNumber).toBe(2);
    expect(chapterList[2].pageNumber).toBe(10);
  });

  it('rejects invalid coordinates and empty text', () => {
    expect(() => {
      service.createAnnotation({
        chapterId: 'chap_ann',
        pageNumber: 1,
        userId: 'u1',
        anchorX: -5,
        anchorY: 50,
        contentText: 'Test',
      });
    }).toThrow(/Invalid anchorX/);

    expect(() => {
      service.createAnnotation({
        chapterId: 'chap_ann',
        pageNumber: 1,
        userId: 'u1',
        anchorX: 50,
        anchorY: 105,
        contentText: 'Test',
      });
    }).toThrow(/Invalid anchorY/);

    expect(() => {
      service.createAnnotation({
        chapterId: 'chap_ann',
        pageNumber: 0,
        userId: 'u1',
        anchorX: 50,
        anchorY: 50,
        contentText: 'Test',
      });
    }).toThrow(/Invalid pageNumber/);

    expect(() => {
      service.createAnnotation({
        chapterId: 'chap_ann',
        pageNumber: 1,
        userId: 'u1',
        anchorX: 50,
        anchorY: 50,
        contentText: '   ',
      });
    }).toThrow(/Content text cannot be empty/);
  });

  it('toggles spoiler flag on an existing annotation', () => {
    const ann = service.createAnnotation({
      chapterId: 'chap_ann',
      pageNumber: 3,
      userId: 'user_1',
      anchorX: 50,
      anchorY: 50,
      contentText: 'Plot twist reveal',
      isSpoiler: false,
    });

    const updated = service.toggleSpoiler(ann.id, true);
    expect(updated).not.toBeNull();
    expect(updated!.isSpoiler).toBe(true);

    const reFetched = service.getAnnotationById(ann.id);
    expect(reFetched!.isSpoiler).toBe(true);
  });

  it('updates content, color, and coordinates', () => {
    const ann = service.createAnnotation({
      chapterId: 'chap_ann',
      pageNumber: 4,
      userId: 'author_1',
      anchorX: 10,
      anchorY: 10,
      contentText: 'Initial note',
      colorPreset: 'yellow',
    });

    const updated = service.updateAnnotation(
      ann.id,
      {
        contentText: 'Revised note with detail',
        colorPreset: 'purple',
        anchorX: 25,
      },
      'author_1'
    );

    expect(updated).not.toBeNull();
    expect(updated!.contentText).toBe('Revised note with detail');
    expect(updated!.colorPreset).toBe('purple');
    expect(updated!.anchorX).toBe(25);
    expect(updated!.anchorY).toBe(10); // Preserved
  });

  it('enforces user authorization on delete', () => {
    const ann = service.createAnnotation({
      chapterId: 'chap_ann',
      pageNumber: 1,
      userId: 'alice',
      anchorX: 10,
      anchorY: 10,
      contentText: 'Alice note',
    });

    // Bob tries to delete Alice's note
    expect(() => {
      service.deleteAnnotation(ann.id, 'bob');
    }).toThrow(/Permission denied/);

    // Alice deletes her own note
    const deleted = service.deleteAnnotation(ann.id, 'alice');
    expect(deleted).toBe(true);
    expect(service.getAnnotationById(ann.id)).toBeNull();
  });

  it('utilizes LRU cache and invalidates correctly upon creation and deletion', () => {
    service.createAnnotation({
      chapterId: 'chap_ann',
      pageNumber: 8,
      userId: 'u1',
      anchorX: 50,
      anchorY: 50,
      contentText: 'Cached note 1',
    });

    // First lookup (loads cache)
    const res1 = service.getAnnotationsForPage('chap_ann', 8);
    expect(res1).toHaveLength(1);

    // Second lookup (from LRU cache)
    const res2 = service.getAnnotationsForPage('chap_ann', 8);
    expect(res2).toBe(res1); // Same reference

    // Add another note to page 8 -> cache must be invalidated
    service.createAnnotation({
      chapterId: 'chap_ann',
      pageNumber: 8,
      userId: 'u2',
      anchorX: 60,
      anchorY: 60,
      contentText: 'Cached note 2',
    });

    const res3 = service.getAnnotationsForPage('chap_ann', 8);
    expect(res3).toHaveLength(2);
  });
});
