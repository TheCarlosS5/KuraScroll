import { DatabaseInstance, Statement } from '../db/database.js';

export interface CharacterStatusItem {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'injured' | 'captured' | 'deceased' | 'unknown';
  affiliation?: string;
  avatarUrl?: string;
  notes?: string;
}

export interface KeyEventItem {
  chapter: number;
  title: string;
  description: string;
  significance: 'pivotal' | 'major' | 'minor';
}

export interface StoryRecapInput {
  seriesId: string;
  throughChapterSeq: number;
  arcTitle: string;
  languageTag?: string;
  recapKind?: 'short' | 'standard' | 'deep';
  summaryText: string;
  characterStatuses?: CharacterStatusItem[];
  keyEvents?: KeyEventItem[];
  cliffhangerWarning?: string | null;
}

export interface StoryRecapRecord {
  id: number;
  seriesId: string;
  throughChapterSeq: number;
  arcTitle: string;
  languageTag: string;
  recapKind: 'short' | 'standard' | 'deep';
  summaryText: string;
  characterStatuses: CharacterStatusItem[];
  keyEvents: KeyEventItem[];
  cliffhangerWarning: string | null;
  createdAt: string;
  updatedAt: string;
}

export class StoryRecapService {
  private stmtUpsert: Statement;
  private stmtGetAntiSpoiler: Statement;
  private stmtGetBySeries: Statement;
  private stmtDelete: Statement;

  constructor(private readonly db: DatabaseInstance) {
    this.stmtUpsert = this.db.prepare(`
      INSERT INTO chapter_story_recaps (
        series_id, through_chapter_seq, arc_title, language_tag, recap_kind,
        summary_text, character_statuses_json, key_events_json, cliffhanger_warning,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(series_id, through_chapter_seq, language_tag, recap_kind) DO UPDATE SET
        arc_title = excluded.arc_title,
        summary_text = excluded.summary_text,
        character_statuses_json = excluded.character_statuses_json,
        key_events_json = excluded.key_events_json,
        cliffhanger_warning = excluded.cliffhanger_warning,
        updated_at = datetime('now')
    `);

    // Strict Anti-Spoiler query: strictly through_chapter_seq <= maxAllowedChapter
    this.stmtGetAntiSpoiler = this.db.prepare(`
      SELECT 
        id, series_id AS seriesId, through_chapter_seq AS throughChapterSeq,
        arc_title AS arcTitle, language_tag AS languageTag, recap_kind AS recapKind,
        summary_text AS summaryText, character_statuses_json AS characterStatusesJson,
        key_events_json AS keyEventsJson, cliffhanger_warning AS cliffhangerWarning,
        created_at AS createdAt, updated_at AS updatedAt
      FROM chapter_story_recaps
      WHERE series_id = ? 
        AND through_chapter_seq <= ?
        AND language_tag = ?
        AND recap_kind = ?
      ORDER BY through_chapter_seq DESC
      LIMIT 1
    `);

    this.stmtGetBySeries = this.db.prepare(`
      SELECT 
        id, series_id AS seriesId, through_chapter_seq AS throughChapterSeq,
        arc_title AS arcTitle, language_tag AS languageTag, recap_kind AS recapKind,
        summary_text AS summaryText, character_statuses_json AS characterStatusesJson,
        key_events_json AS keyEventsJson, cliffhanger_warning AS cliffhangerWarning,
        created_at AS createdAt, updated_at AS updatedAt
      FROM chapter_story_recaps
      WHERE series_id = ? AND language_tag = ?
      ORDER BY through_chapter_seq ASC
    `);

    this.stmtDelete = this.db.prepare(`
      DELETE FROM chapter_story_recaps WHERE id = ?
    `);
  }

  /**
   * Upsert a story recap snapshot for a given series up to a milestone chapter.
   */
  public upsertRecap(input: StoryRecapInput): StoryRecapRecord {
    if (!input.seriesId || typeof input.throughChapterSeq !== 'number' || input.throughChapterSeq < 0) {
      throw new Error('Invalid seriesId or throughChapterSeq');
    }

    const languageTag = input.languageTag || 'es';
    const recapKind = input.recapKind || 'standard';
    const characterStatusesJson = JSON.stringify(input.characterStatuses || []);
    const keyEventsJson = JSON.stringify(input.keyEvents || []);

    const result = this.stmtUpsert.run(
      input.seriesId,
      input.throughChapterSeq,
      input.arcTitle || null,
      languageTag,
      recapKind,
      input.summaryText || '',
      characterStatusesJson,
      keyEventsJson,
      input.cliffhangerWarning || null
    );

    const insertedId = Number(result.lastInsertRowid);
    return {
      id: insertedId,
      seriesId: input.seriesId,
      throughChapterSeq: input.throughChapterSeq,
      arcTitle: input.arcTitle,
      languageTag,
      recapKind,
      summaryText: input.summaryText,
      characterStatuses: input.characterStatuses || [],
      keyEvents: input.keyEvents || [],
      cliffhangerWarning: input.cliffhangerWarning || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Anti-Spoiler Query: Get the nearest preceding recap for a reader opening `currentChapterNumber`.
   * Enforces that no information from chapter >= currentChapterNumber can ever be included.
   * If currentChapterNumber <= 1, returns null as no preceding chapter recap exists.
   */
  public getRecapForChapter(
    seriesId: string,
    currentChapterNumber: number,
    languageTag = 'es',
    recapKind: 'short' | 'standard' | 'deep' = 'standard'
  ): StoryRecapRecord | null {
    if (currentChapterNumber <= 1) {
      return null;
    }

    // Maximum chapter permitted in this recap is strictly prior to currentChapterNumber
    const maxAllowedChapter = currentChapterNumber - 1;

    const row = this.stmtGetAntiSpoiler.get(
      seriesId,
      maxAllowedChapter,
      languageTag,
      recapKind
    ) as any;

    if (!row) {
      return null;
    }

    return this.hydrateRow(row);
  }

  /**
   * Get all recaps available for a series ordered chronologically.
   */
  public getRecapsForSeries(seriesId: string, languageTag = 'es'): StoryRecapRecord[] {
    const rows = this.stmtGetBySeries.all(seriesId, languageTag) as any[];
    return rows.map((row) => this.hydrateRow(row));
  }

  /**
   * Delete a story recap by its ID.
   */
  public deleteRecap(id: number): boolean {
    const result = this.stmtDelete.run(id);
    return Number(result.changes) > 0;
  }

  /**
   * Heuristic to determine if user has paused reading long enough to trigger a proactive catch-up prompt.
   * Default threshold: 14 days (14 * 24 * 60 * 60 * 1000 ms).
   */
  public checkInactivityCatchUp(
    lastReadTimestamp: string | null | undefined,
    inactivityThresholdDays = 14
  ): boolean {
    if (!lastReadTimestamp) {
      return false;
    }
    const lastDate = new Date(lastReadTimestamp).getTime();
    if (isNaN(lastDate)) {
      return false;
    }
    const elapsedMs = Date.now() - lastDate;
    const thresholdMs = inactivityThresholdDays * 24 * 60 * 60 * 1000;
    return elapsedMs >= thresholdMs;
  }

  /**
   * Safely hydrates database rows with resilient JSON parse fallbacks.
   */
  private hydrateRow(row: any): StoryRecapRecord {
    let characterStatuses: CharacterStatusItem[] = [];
    let keyEvents: KeyEventItem[] = [];

    try {
      if (row.characterStatusesJson) {
        characterStatuses = JSON.parse(row.characterStatusesJson);
      }
    } catch {
      characterStatuses = [];
    }

    try {
      if (row.keyEventsJson) {
        keyEvents = JSON.parse(row.keyEventsJson);
      }
    } catch {
      keyEvents = [];
    }

    return {
      id: Number(row.id),
      seriesId: String(row.seriesId),
      throughChapterSeq: Number(row.throughChapterSeq),
      arcTitle: String(row.arcTitle),
      languageTag: String(row.languageTag),
      recapKind: row.recapKind,
      summaryText: String(row.summaryText),
      characterStatuses,
      keyEvents,
      cliffhangerWarning: row.cliffhangerWarning || null,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }
}
