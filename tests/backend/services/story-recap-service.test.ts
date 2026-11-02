import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { StoryRecapService } from '../../../src/backend/services/story-recap-service.js';

describe('StoryRecapService (Sprint 48)', () => {
  let db: DatabaseInstance;
  let service: StoryRecapService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new StoryRecapService(db);

    // Seed dummy series
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('series-one-piece', 'one-piece', 'One Piece', 'manga', 'ongoing')
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('upserts and retrieves story recap snapshots cleanly', () => {
    const recap = service.upsertRecap({
      seriesId: 'series-one-piece',
      throughChapterSeq: 100,
      arcTitle: 'East Blue Saga',
      summaryText: 'Luffy gathers his initial crew in East Blue.',
      characterStatuses: [
        { id: 'luffy', name: 'Monkey D. Luffy', role: 'Captain', status: 'active' },
        { id: 'zoro', name: 'Roronoa Zoro', role: 'Swordsman', status: 'active' },
      ],
      keyEvents: [
        { chapter: 96, title: 'Loguetown', description: 'Execution platform escape', significance: 'pivotal' },
      ],
      cliffhangerWarning: 'Entering the Grand Line via Reverse Mountain.',
    });

    expect(recap.id).toBeGreaterThan(0);
    expect(recap.arcTitle).toBe('East Blue Saga');
    expect(recap.characterStatuses).toHaveLength(2);
    expect(recap.keyEvents).toHaveLength(1);
  });

  it('enforces strict anti-spoiler invariant: Chapter 1 returns null', () => {
    service.upsertRecap({
      seriesId: 'series-one-piece',
      throughChapterSeq: 100,
      arcTitle: 'East Blue',
      summaryText: 'Summary',
    });

    const result = service.getRecapForChapter('series-one-piece', 1);
    expect(result).toBeNull();
  });

  it('enforces strict anti-spoiler invariant: Chapter N only receives recaps with throughChapterSeq <= N - 1', () => {
    // Seed milestone recaps
    service.upsertRecap({
      seriesId: 'series-one-piece',
      throughChapterSeq: 100,
      arcTitle: 'East Blue',
      summaryText: 'East Blue recap',
    });
    service.upsertRecap({
      seriesId: 'series-one-piece',
      throughChapterSeq: 217,
      arcTitle: 'Alabasta Arc',
      summaryText: 'Alabasta battle recap',
    });
    service.upsertRecap({
      seriesId: 'series-one-piece',
      throughChapterSeq: 302,
      arcTitle: 'Skypiea Arc',
      summaryText: 'Skypiea recap',
    });

    // Reader opening chapter 150 (during Alabasta) should get East Blue (throughChapterSeq: 100)
    const recapAt150 = service.getRecapForChapter('series-one-piece', 150);
    expect(recapAt150).not.toBeNull();
    expect(recapAt150?.throughChapterSeq).toBe(100);
    expect(recapAt150?.arcTitle).toBe('East Blue');

    // Reader opening chapter 218 should get Alabasta (throughChapterSeq: 217)
    const recapAt218 = service.getRecapForChapter('series-one-piece', 218);
    expect(recapAt218?.throughChapterSeq).toBe(217);
    expect(recapAt218?.arcTitle).toBe('Alabasta Arc');

    // Reader opening chapter 217 should NOT get Alabasta yet (Anti-spoiler strictly < 217) -> gets East Blue
    const recapAt217 = service.getRecapForChapter('series-one-piece', 217);
    expect(recapAt217?.throughChapterSeq).toBe(100);
  });

  it('handles JSON parsing errors gracefully with empty fallback arrays', () => {
    // Insert corrupted raw JSON directly into DB
    db.prepare(`
      INSERT INTO chapter_story_recaps (
        series_id, through_chapter_seq, arc_title, summary_text,
        character_statuses_json, key_events_json
      ) VALUES (
        'series-one-piece', 50, 'Corrupt Arc', 'Some summary',
        'NOT_VALID_JSON{[[', '{CORRUPT_JSON}'
      )
    `).run();

    const recap = service.getRecapForChapter('series-one-piece', 55);
    expect(recap).not.toBeNull();
    expect(recap?.characterStatuses).toEqual([]);
    expect(recap?.keyEvents).toEqual([]);
  });

  it('retrieves chronological recaps list and allows deletion', () => {
    service.upsertRecap({
      seriesId: 'series-one-piece',
      throughChapterSeq: 100,
      arcTitle: 'Arc 1',
      summaryText: 'Summary 1',
    });
    service.upsertRecap({
      seriesId: 'series-one-piece',
      throughChapterSeq: 200,
      arcTitle: 'Arc 2',
      summaryText: 'Summary 2',
    });

    const list = service.getRecapsForSeries('series-one-piece');
    expect(list).toHaveLength(2);
    expect(list[0].throughChapterSeq).toBe(100);
    expect(list[1].throughChapterSeq).toBe(200);

    const deleted = service.deleteRecap(list[0].id);
    expect(deleted).toBe(true);
    expect(service.getRecapsForSeries('series-one-piece')).toHaveLength(1);
  });

  it('evaluates inactivity threshold correctly (>14 days)', () => {
    expect(service.checkInactivityCatchUp(null)).toBe(false);
    expect(service.checkInactivityCatchUp(undefined)).toBe(false);
    expect(service.checkInactivityCatchUp('invalid-date')).toBe(false);

    const now = Date.now();
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    const fifteenDaysAgo = new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString();

    expect(service.checkInactivityCatchUp(tenDaysAgo, 14)).toBe(false);
    expect(service.checkInactivityCatchUp(fifteenDaysAgo, 14)).toBe(true);
  });
});
