import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { PanelDetectionService } from '../../../src/backend/services/panel-detection-service.js';

describe('Sprint 55: PanelDetectionService Integration Suite', () => {
  let db: DatabaseInstance;
  let service: PanelDetectionService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);

    // Seed test series and chapter
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s1', 's-1', 'Test Series', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('ch1', 's1', 1.0, 'Chapter 1', '/storage/ch1')
    `).run();

    service = new PanelDetectionService(db);
  });

  afterEach(() => {
    db.close();
  });

  it('saves normalized panels and retrieves them ordered by readingOrder', () => {
    const rawPanels = [
      { x: 0.0, y: 0.0, w: 40.0, h: 30.0 },  // Left
      { x: 50.0, y: 0.0, w: 50.0, h: 30.0 }  // Right
    ];

    const saved = service.savePanels('ch1', 1, rawPanels, 'RTL');
    expect(saved).toHaveLength(2);
    // RTL reading order: Right panel first, then left
    expect(saved[0].x).toBe(50.0);
    expect(saved[0].readingOrder).toBe(0);
    expect(saved[1].x).toBe(0.0);
    expect(saved[1].readingOrder).toBe(1);

    const fetched = service.getPanelsForPage('ch1', 1);
    expect(fetched).toHaveLength(2);
    expect(fetched[0].id).toBe(saved[0].id);
  });

  it('generates fallback pseudo-panel when empty array is passed', () => {
    const saved = service.savePanels('ch1', 2, []);
    expect(saved).toHaveLength(1);
    expect(saved[0].x).toBe(0.0);
    expect(saved[0].y).toBe(0.0);
    expect(saved[0].w).toBe(100.0);
    expect(saved[0].h).toBe(100.0);
  });

  it('saves speech bubbles, links to enclosing panels, and indexes into dialogue_fts', () => {
    // 1. Create panel
    service.savePanels('ch1', 1, [{ x: 10.0, y: 10.0, w: 40.0, h: 40.0 }]);
    const panels = service.getPanelsForPage('ch1', 1);
    const panelId = panels[0].id;

    // 2. Save bubble inside panel
    const bubbles = [
      {
        x: 15.0,
        y: 15.0,
        w: 10.0,
        h: 10.0,
        text: 'お前はもう死んでいる (Omae wa mou shindeiru)',
        language: 'ja',
        bubbleType: 'SPEECH' as const
      }
    ];

    const savedBubbles = service.saveBubbles('ch1', 1, bubbles);
    expect(savedBubbles).toHaveLength(1);
    expect(savedBubbles[0].panelId).toBe(panelId);
    expect(savedBubbles[0].text).toContain('お前はもう死んでいる');

    // 3. Search via dialogue FTS5
    const results = service.searchDialogue('死んでいる');
    expect(results).toHaveLength(1);
    expect(results[0].chapterId).toBe('ch1');
    expect(results[0].pageNumber).toBe(1);
    expect(results[0].text).toContain('お前はもう死んでいる');
  });

  it('removes dialogue_fts records when bubbles are deleted or replaced', () => {
    service.saveBubbles('ch1', 1, [{ x: 5, y: 5, w: 10, h: 10, text: 'PalabraClaveUnica' }]);
    expect(service.searchDialogue('PalabraClaveUnica')).toHaveLength(1);

    // Replace with new bubble
    service.saveBubbles('ch1', 1, [{ x: 5, y: 5, w: 10, h: 10, text: 'NuevaFrase' }]);
    expect(service.searchDialogue('PalabraClaveUnica')).toHaveLength(0);
    expect(service.searchDialogue('NuevaFrase')).toHaveLength(1);
  });
});
