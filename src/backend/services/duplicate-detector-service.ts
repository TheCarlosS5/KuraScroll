/**
 * KuraScroll Series Duplicate Detector & Reconciler Service
 * Implements FTS5-backed candidate blocking and Jaro-Winkler fuzzy evaluation
 * Ensures transactional integrity during cross-scanlation merges
 * Low-resource optimized for Intel Pentium T4500 (Penryn 2C/2T) & SQLite WAL
 */

import crypto from 'node:crypto';
import { DatabaseInstance } from '../db/database.js';
import {
  normalizeTitle,
  normalizeChapterNumber,
  compositeSimilarity
} from '../utils/fuzzy-matcher.js';

export interface SeriesSummary {
  id: string;
  slug: string;
  titlePrimary: string;
  type: string;
  status: string;
  coverImage?: string;
  chapterCount: number;
}

export interface DuplicateCandidatePair {
  id: string; // generated pair hash
  source: SeriesSummary;
  target: SeriesSummary;
  similarityScore: number;
  jaroWinklerScore: number;
  tokenDiceScore: number;
  recommendation: 'AUTO_MERGE' | 'NEEDS_CONFIRMATION' | 'LOW_CONFIDENCE';
}

export interface MergeResult {
  success: boolean;
  mergeId: string;
  sourceSeriesId: string;
  targetSeriesId: string;
  chaptersMoved: number;
  chaptersOverwritten: number;
  mergedAt: string;
}

export interface MergeHistoryRecord {
  id: string;
  sourceSeriesId: string;
  targetSeriesId: string;
  sourceTitle: string;
  targetTitle: string;
  similarityScore: number;
  chaptersMoved: number;
  chaptersOverwritten: number;
  mergedAt: string;
}

export class DuplicateDetectorService {
  constructor(private readonly db: DatabaseInstance) {}

  /**
   * Scans series catalog using FTS5 candidate blocking and fuzzy scoring.
   * Time complexity: O(N * K) where K <= 20, completely avoiding O(N^2).
   */
  public findDuplicateCandidates(threshold = 0.82): DuplicateCandidatePair[] {
    const allSeries = this.db
      .prepare(`
        SELECT s.id, s.slug, s.title_primary, s.type, s.status, s.cover_image,
               COUNT(c.id) as chapter_count
        FROM series s
        LEFT JOIN chapters c ON s.id = c.series_id
        GROUP BY s.id
        ORDER BY s.title_primary ASC
      `)
      .all() as Array<{
        id: string;
        slug: string;
        title_primary: string;
        type: string;
        status: string;
        cover_image: string | null;
        chapter_count: number;
      }>;

    if (allSeries.length < 2) return [];

    const candidates: DuplicateCandidatePair[] = [];
    const seenPairs = new Set<string>();

    for (let i = 0; i < allSeries.length; i++) {
      const current = allSeries[i];
      const normCurrent = normalizeTitle(current.title_primary);
      const tokens = normCurrent.split(' ').filter((t) => t.length >= 3);

      // Build FTS5 search query from first 3 tokens
      let ftsQuery = '';
      if (tokens.length > 0) {
        ftsQuery = tokens.slice(0, 3).map((t) => `"${t}"*`).join(' OR ');
      }

      let candidateRows: Array<{ id: string; title_primary: string }> = [];

      if (ftsQuery) {
        try {
          candidateRows = this.db
            .prepare(`
              SELECT DISTINCT s.id, s.title_primary
              FROM series_search_fts fts
              JOIN series s ON fts.series_id = s.id
              WHERE series_search_fts MATCH ? AND s.id != ?
              LIMIT 20
            `)
            .all(ftsQuery, current.id) as Array<{ id: string; title_primary: string }>;
        } catch {
          // If FTS query fails or produces syntax error, fallback to small window
          candidateRows = [];
        }
      }

      // If FTS returned fewer than 5, also check immediate alphabetical neighbors
      if (candidateRows.length < 5) {
        const start = Math.max(0, i - 5);
        const end = Math.min(allSeries.length, i + 6);
        for (let j = start; j < end; j++) {
          if (j !== i && !candidateRows.some((c) => c.id === allSeries[j].id)) {
            candidateRows.push({
              id: allSeries[j].id,
              title_primary: allSeries[j].title_primary
            });
          }
        }
      }

      for (const cand of candidateRows) {
        const pairKey = [current.id, cand.id].sort().join(':::');
        if (seenPairs.has(pairKey)) continue;
        seenPairs.add(pairKey);

        const other = allSeries.find((s) => s.id === cand.id);
        if (!other) continue;

        const { score, jaroWinkler, tokenDice } = compositeSimilarity(
          current.title_primary,
          other.title_primary
        );

        if (score >= threshold) {
          // Determine canonical target (series with more chapters or earlier created)
          const isCurrentTarget = current.chapter_count >= other.chapter_count;
          const target = isCurrentTarget ? current : other;
          const source = isCurrentTarget ? other : current;

          let recommendation: 'AUTO_MERGE' | 'NEEDS_CONFIRMATION' | 'LOW_CONFIDENCE' = 'NEEDS_CONFIRMATION';
          if (score >= 0.95 && jaroWinkler >= 0.96) {
            recommendation = 'AUTO_MERGE';
          } else if (score < 0.88) {
            recommendation = 'LOW_CONFIDENCE';
          }

          candidates.push({
            id: crypto.createHash('md5').update(pairKey).digest('hex').substring(0, 16),
            source: {
              id: source.id,
              slug: source.slug,
              titlePrimary: source.title_primary,
              type: source.type,
              status: source.status,
              coverImage: source.cover_image || undefined,
              chapterCount: source.chapter_count
            },
            target: {
              id: target.id,
              slug: target.slug,
              titlePrimary: target.title_primary,
              type: target.type,
              status: target.status,
              coverImage: target.cover_image || undefined,
              chapterCount: target.chapter_count
            },
            similarityScore: score,
            jaroWinklerScore: jaroWinkler,
            tokenDiceScore: tokenDice,
            recommendation
          });
        }
      }
    }

    return candidates.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * Performs an atomic transactional merge of source series into target series.
   * Re-links chapters, preserves reading progress, reconciles chapter collisions,
   * re-links bookmarks, logs to duplicate_merge_history, and removes the source series.
   */
  public mergeSeries(
    sourceSeriesId: string,
    targetSeriesId: string,
    strategy: 'KEEP_HIGHER_PAGE_COUNT' | 'KEEP_TARGET' = 'KEEP_HIGHER_PAGE_COUNT'
  ): MergeResult {
    if (sourceSeriesId === targetSeriesId) {
      throw new Error('Cannot merge a series into itself');
    }

    const source = this.db
      .prepare('SELECT id, title_primary FROM series WHERE id = ?')
      .get(sourceSeriesId) as { id: string; title_primary: string } | undefined;
    const target = this.db
      .prepare('SELECT id, title_primary FROM series WHERE id = ?')
      .get(targetSeriesId) as { id: string; title_primary: string } | undefined;

    if (!source || !target) {
      throw new Error('Source or target series not found in database');
    }

    const mergeId = crypto.randomUUID();
    let chaptersMoved = 0;
    let chaptersOverwritten = 0;

    this.db.exec('BEGIN IMMEDIATE;');

    try {
      // 1. Fetch chapters for both series
      const sourceChapters = this.db
        .prepare('SELECT id, chapter_number, page_count, title, scanlation_group FROM chapters WHERE series_id = ?')
        .all(sourceSeriesId) as Array<{
          id: string;
          chapter_number: number;
          page_count: number;
          title: string | null;
          scanlation_group: string | null;
        }>;

      const targetChapters = this.db
        .prepare('SELECT id, chapter_number, page_count, title, scanlation_group FROM chapters WHERE series_id = ?')
        .all(targetSeriesId) as Array<{
          id: string;
          chapter_number: number;
          page_count: number;
          title: string | null;
          scanlation_group: string | null;
        }>;

      const targetChapterMap = new Map<number, { id: string; page_count: number }>();
      for (const tc of targetChapters) {
        targetChapterMap.set(tc.chapter_number, { id: tc.id, page_count: tc.page_count });
      }

      // 2. Reconcile chapters and resolve unique constraint collisions
      for (const sc of sourceChapters) {
        const collision = targetChapterMap.get(sc.chapter_number);
        if (!collision) {
          // No collision: move chapter to target series
          this.db
            .prepare('UPDATE chapters SET series_id = ? WHERE id = ?')
            .run(targetSeriesId, sc.id);
          chaptersMoved++;
        } else {
          // Collision on same chapter_number
          const preferSource =
            strategy === 'KEEP_HIGHER_PAGE_COUNT' && sc.page_count > collision.page_count;

          if (preferSource) {
            // Re-point any progress or bookmarks from target chapter to source chapter
            this.db
              .prepare('UPDATE user_progress SET chapter_id = ? WHERE chapter_id = ?')
              .run(sc.id, collision.id);
            this.db
              .prepare('UPDATE user_bookmarks SET chapter_id = ? WHERE chapter_id = ?')
              .run(sc.id, collision.id);

            // Delete target chapter and re-point source chapter to target series
            this.db.prepare('DELETE FROM chapters WHERE id = ?').run(collision.id);
            this.db
              .prepare('UPDATE chapters SET series_id = ? WHERE id = ?')
              .run(targetSeriesId, sc.id);
            chaptersOverwritten++;
          } else {
            // Keep target chapter, re-point any progress on source chapter to target chapter
            this.db
              .prepare('UPDATE user_progress SET chapter_id = ? WHERE chapter_id = ?')
              .run(collision.id, sc.id);
            this.db
              .prepare('UPDATE user_bookmarks SET chapter_id = ? WHERE chapter_id = ?')
              .run(collision.id, sc.id);

            // Delete inferior source chapter
            this.db.prepare('DELETE FROM chapters WHERE id = ?').run(sc.id);
            chaptersOverwritten++;
          }
        }
      }

      // 3. Reconcile user_progress between source and target series
      const sourceProgress = this.db
        .prepare('SELECT user_id, chapter_id, page_number, scroll_offset_y, is_completed, updated_at FROM user_progress WHERE series_id = ?')
        .all(sourceSeriesId) as Array<{
          user_id: string;
          chapter_id: string;
          page_number: number;
          scroll_offset_y: number;
          is_completed: number;
          updated_at: string;
        }>;

      for (const sp of sourceProgress) {
        const targetProgress = this.db
          .prepare('SELECT id, page_number, is_completed, updated_at FROM user_progress WHERE user_id = ? AND series_id = ?')
          .get(sp.user_id, targetSeriesId) as {
            id: number;
            page_number: number;
            is_completed: number;
            updated_at: string;
          } | undefined;

        if (!targetProgress) {
          // Target had no progress, re-assign source progress to target series
          this.db
            .prepare('UPDATE user_progress SET series_id = ? WHERE user_id = ? AND series_id = ?')
            .run(targetSeriesId, sp.user_id, sourceSeriesId);
        } else {
          // Target already has progress; take highest page or completed status
          const shouldUpdate =
            sp.is_completed > targetProgress.is_completed ||
            sp.page_number > targetProgress.page_number;

          if (shouldUpdate) {
            this.db
              .prepare(`
                UPDATE user_progress
                SET chapter_id = ?, page_number = ?, scroll_offset_y = ?, is_completed = ?, updated_at = ?
                WHERE id = ?
              `)
              .run(
                sp.chapter_id,
                sp.page_number,
                sp.scroll_offset_y,
                sp.is_completed,
                sp.updated_at,
                targetProgress.id
              );
          }
          // Remove source progress record
          this.db
            .prepare('DELETE FROM user_progress WHERE user_id = ? AND series_id = ?')
            .run(sp.user_id, sourceSeriesId);
        }
      }

      // 4. Reconcile user bookmarks
      this.db
        .prepare('UPDATE user_bookmarks SET series_id = ? WHERE series_id = ?')
        .run(targetSeriesId, sourceSeriesId);

      // 5. Compute similarity for history log
      const { score } = compositeSimilarity(source.title_primary, target.title_primary);

      // 6. Record merge in duplicate_merge_history
      this.db
        .prepare(`
          INSERT INTO duplicate_merge_history (
            id, source_series_id, target_series_id, source_title, target_title,
            similarity_score, chapters_moved, chapters_overwritten, merged_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
        .run(
          mergeId,
          sourceSeriesId,
          targetSeriesId,
          source.title_primary,
          target.title_primary,
          score,
          chaptersMoved,
          chaptersOverwritten
        );

      // 7. Delete source series
      this.db.prepare('DELETE FROM series WHERE id = ?').run(sourceSeriesId);

      this.db.exec('COMMIT;');

      return {
        success: true,
        mergeId,
        sourceSeriesId,
        targetSeriesId,
        chaptersMoved,
        chaptersOverwritten,
        mergedAt: new Date().toISOString()
      };
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Retrieves past merge history for audit and rollback tracking.
   */
  public getMergeHistory(): MergeHistoryRecord[] {
    const rows = this.db
      .prepare(`
        SELECT id, source_series_id, target_series_id, source_title, target_title,
               similarity_score, chapters_moved, chapters_overwritten, merged_at
        FROM duplicate_merge_history
        ORDER BY merged_at DESC
        LIMIT 50
      `)
      .all() as Array<{
        id: string;
        source_series_id: string;
        target_series_id: string;
        source_title: string;
        target_title: string;
        similarity_score: number;
        chapters_moved: number;
        chapters_overwritten: number;
        merged_at: string;
      }>;

    return rows.map((r) => ({
      id: r.id,
      sourceSeriesId: r.source_series_id,
      targetSeriesId: r.target_series_id,
      sourceTitle: r.source_title,
      targetTitle: r.target_title,
      similarityScore: r.similarity_score,
      chaptersMoved: r.chapters_moved,
      chaptersOverwritten: r.chapters_overwritten,
      mergedAt: r.merged_at
    }));
  }
}
