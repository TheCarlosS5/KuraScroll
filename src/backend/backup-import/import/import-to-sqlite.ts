import { DatabaseInstance } from '../../db/database.js';
import {
  NormalizedBackup,
  NormalizedSeries,
  NormalizedChapter,
  slugify,
} from '../normalization/normalize-backup.js';
import { importBackup } from '../index.js';
import { performance } from 'node:perf_hooks';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ImportToSqliteOptions {
  db: DatabaseInstance;
  backup: NormalizedBackup | Buffer | string | any;
  chunkSize?: number; // default: 50
  strict?: boolean;   // default: false
  userId?: string;    // default: 'local_user'
}

export interface ImportErrorDetail {
  seriesSlug?: string;
  title?: string;
  error: string;
}

export interface ImportReport {
  success: boolean;
  seriesImported: number;
  seriesUpdated: number;
  chaptersCreated: number;
  progressRecordsCreated: number;
  titlesInserted: number;
  genresInserted: number;
  durationMs: number;
  errors: ImportErrorDetail[];
}

// ============================================================================
// Single Series Transactional Importer
// ============================================================================

function importSingleSeries(
  series: NormalizedSeries,
  db: DatabaseInstance,
  userId: string,
  counters: {
    seriesImported: number;
    seriesUpdated: number;
    chaptersCreated: number;
    progressRecordsCreated: number;
    titlesInserted: number;
    genresInserted: number;
  }
): void {
  const slug = series.slug || slugify(series.titlePrimary);
  const existingSeries = db.prepare('SELECT id FROM series WHERE slug = ?').get(slug) as { id: string } | undefined;

  let seriesId: string;
  const isUpdate = !!existingSeries;

  if (existingSeries) {
    seriesId = existingSeries.id;
    counters.seriesUpdated++;
  } else {
    seriesId = `series_${slug}`;
    counters.seriesImported++;
  }

  // 1. Insert or Upsert into series
  const upsertSeriesStmt = db.prepare(`
    INSERT INTO series (
      id, slug, title_primary, type, status, synopsis, cover_image, author, artist, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      title_primary = excluded.title_primary,
      type = excluded.type,
      status = excluded.status,
      synopsis = coalesce(excluded.synopsis, series.synopsis),
      cover_image = coalesce(excluded.cover_image, series.cover_image),
      author = coalesce(excluded.author, series.author),
      artist = coalesce(excluded.artist, series.artist),
      updated_at = datetime('now');
  `);

  upsertSeriesStmt.run(
    seriesId,
    slug,
    series.titlePrimary,
    series.type || 'manga',
    series.status || 'ongoing',
    series.synopsis ?? null,
    series.coverUrl ?? null,
    series.author ?? null,
    series.artist ?? null
  );

  // 2. Insert titles into series_titles (Triggers will automatically sync series_search_fts!)
  const selectTitleStmt = db.prepare('SELECT id FROM series_titles WHERE series_id = ? AND title = ?');
  const insertTitleStmt = db.prepare(`
    INSERT INTO series_titles (series_id, language_code, title, is_primary)
    VALUES (?, ?, ?, ?)
  `);

  // Ensure primary title is inserted
  const primaryTitleRow = selectTitleStmt.get(seriesId, series.titlePrimary);
  if (!primaryTitleRow) {
    insertTitleStmt.run(seriesId, 'en', series.titlePrimary, 1);
    counters.titlesInserted++;
  }

  // Insert alternative / localized titles
  if (Array.isArray(series.titles)) {
    for (const alt of series.titles) {
      if (!alt.title || alt.title === series.titlePrimary) continue;
      const existingAlt = selectTitleStmt.get(seriesId, alt.title);
      if (!existingAlt) {
        insertTitleStmt.run(seriesId, alt.languageCode || 'unknown', alt.title, alt.isPrimary ? 1 : 0);
        counters.titlesInserted++;
      }
    }
  }

  // 3. Genres taxonomy
  if (Array.isArray(series.genres)) {
    const insertGenreStmt = db.prepare(`
      INSERT INTO genres (name, slug) VALUES (?, ?)
      ON CONFLICT(slug) DO NOTHING;
    `);
    const selectGenreStmt = db.prepare('SELECT id FROM genres WHERE slug = ?');
    const insertSeriesGenreStmt = db.prepare(`
      INSERT INTO series_genres (series_id, genre_id) VALUES (?, ?)
      ON CONFLICT(series_id, genre_id) DO NOTHING;
    `);

    for (const genreName of series.genres) {
      if (!genreName || typeof genreName !== 'string') continue;
      const genreSlug = slugify(genreName);
      insertGenreStmt.run(genreName, genreSlug);
      const genreRow = selectGenreStmt.get(genreSlug) as { id: number } | undefined;
      if (genreRow) {
        const res = insertSeriesGenreStmt.run(seriesId, genreRow.id);
        if (res.changes > 0) counters.genresInserted++;
      }
    }
  }

  // 4. Chapters
  const insertChapterStmt = db.prepare(`
    INSERT INTO chapters (
      id, series_id, chapter_number, title, scanlation_group, storage_path
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(series_id, chapter_number) DO UPDATE SET
      title = coalesce(excluded.title, chapters.title),
      scanlation_group = coalesce(excluded.scanlation_group, chapters.scanlation_group);
  `);

  let latestReadChapter: { chapterId: string; pageNumber: number; isCompleted: number } | null = null;

  if (Array.isArray(series.chapters)) {
    for (const ch of series.chapters) {
      const chNum = typeof ch.chapterNumber === 'number' ? ch.chapterNumber : 1;
      const chapterId = `chap_${slug}_${chNum}`;
      const chTitle = ch.title || `Chapter ${chNum}`;
      const scanlator = ch.scanlator ?? null;
      const storagePath = `/storage/series/${slug}/c${String(Math.floor(chNum)).padStart(3, '0')}`;

      insertChapterStmt.run(chapterId, seriesId, chNum, chTitle, scanlator, storagePath);
      counters.chaptersCreated++;

      // Track reading progress if chapter was read
      if (ch.isRead || (ch.lastPageRead && ch.lastPageRead > 0)) {
        if (!latestReadChapter || chNum >= (latestReadChapter as any)._num) {
          latestReadChapter = {
            chapterId,
            pageNumber: ch.lastPageRead > 0 ? ch.lastPageRead : 1,
            isCompleted: ch.isRead ? 1 : 0,
            _num: chNum,
          } as any;
        }
      }
    }
  }

  // 5. Reading Progress (user_progress)
  if (latestReadChapter) {
    const upsertProgressStmt = db.prepare(`
      INSERT INTO user_progress (
        user_id, series_id, chapter_id, page_number, is_completed, updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, series_id) DO UPDATE SET
        chapter_id = excluded.chapter_id,
        page_number = excluded.page_number,
        is_completed = excluded.is_completed,
        updated_at = excluded.updated_at;
    `);

    upsertProgressStmt.run(
      userId,
      seriesId,
      latestReadChapter.chapterId,
      latestReadChapter.pageNumber,
      latestReadChapter.isCompleted
    );
    counters.progressRecordsCreated++;
  }
}

// ============================================================================
// Transactional Batch Importer with WAL Chunking
// ============================================================================

export async function importToSqlite(options: ImportToSqliteOptions): Promise<ImportReport> {
  const startTime = performance.now();
  const db = options.db;
  const chunkSize = options.chunkSize ?? 50;
  const strict = options.strict ?? false;
  const userId = options.userId ?? 'local_user';

  // Normalize input if buffer, string, or raw JSON
  let normalized: NormalizedBackup;
  if (
    options.backup &&
    typeof options.backup === 'object' &&
    Array.isArray(options.backup.series) &&
    typeof options.backup.seriesCount === 'number'
  ) {
    normalized = options.backup as NormalizedBackup;
  } else if (Buffer.isBuffer(options.backup) || typeof options.backup === 'string') {
    normalized = importBackup(options.backup);
  } else if (options.backup && typeof options.backup === 'object') {
    // If wrapped object e.g. { appName: 'KuraScroll', series: [...] }
    if (Array.isArray(options.backup.series)) {
      normalized = {
        format: options.backup.appName || 'kurascroll_json',
        version: options.backup.version || 1,
        seriesCount: options.backup.series.length,
        chapterCount: options.backup.series.reduce((acc: number, s: any) => acc + (s.chapters?.length || 0), 0),
        series: options.backup.series.map((s: any) => ({
          slug: s.slug || slugify(s.titlePrimary || s.title || 'series'),
          titlePrimary: s.titlePrimary || s.title || 'Untitled',
          titles: s.titles || [],
          type: s.type || 'manga',
          status: s.status || 'ongoing',
          author: s.author ?? null,
          artist: s.artist ?? null,
          synopsis: s.synopsis ?? null,
          genres: s.genres || [],
          coverUrl: s.coverUrl || s.coverImage || null,
          externalSource: s.externalSource ?? null,
          sourceUrl: s.sourceUrl ?? null,
          chapters: (s.chapters || []).map((ch: any) => ({
            chapterNumber: ch.chapterNumber ?? ch.chapter_number ?? 1,
            title: ch.title || `Chapter ${ch.chapterNumber || 1}`,
            scanlator: ch.scanlator || ch.scanlationGroup || null,
            isRead: !!(ch.isRead || ch.read),
            lastPageRead: ch.lastPageRead ?? ch.last_page_read ?? 0,
            sourceUrl: ch.sourceUrl ?? ch.url ?? null,
            readAt: ch.readAt ? new Date(ch.readAt) : null,
          })),
        })),
      };
    } else {
      // Pass through importBackup with JSON stringification
      normalized = importBackup(JSON.stringify(options.backup));
    }
  } else {
    throw new Error('Invalid backup payload provided to importToSqlite');
  }

  const counters = {
    seriesImported: 0,
    seriesUpdated: 0,
    chaptersCreated: 0,
    progressRecordsCreated: 0,
    titlesInserted: 0,
    genresInserted: 0,
  };
  const errors: ImportErrorDetail[] = [];

  const seriesList = normalized.series;

  // Process in batches of chunkSize to prevent long WAL writer locks
  for (let i = 0; i < seriesList.length; i += chunkSize) {
    const chunk = seriesList.slice(i, i + chunkSize);

    try {
      db.exec('BEGIN IMMEDIATE;');
      const chunkCounters = { ...counters };
      for (const series of chunk) {
        importSingleSeries(series, db, userId, chunkCounters);
      }
      db.exec('COMMIT;');
      Object.assign(counters, chunkCounters);
    } catch (chunkError: any) {
      db.exec('ROLLBACK;');
      if (strict) {
        throw new Error(`Import transaction failed in batch [${i}..${i + chunk.length}]: ${chunkError.message}`);
      }

      // In non-strict mode, isolate failing series within the chunk
      for (const series of chunk) {
        try {
          db.exec('BEGIN IMMEDIATE;');
          const itemCounters = { ...counters };
          importSingleSeries(series, db, userId, itemCounters);
          db.exec('COMMIT;');
          Object.assign(counters, itemCounters);
        } catch (itemError: any) {
          db.exec('ROLLBACK;');
          errors.push({
            seriesSlug: series.slug,
            title: series.titlePrimary,
            error: itemError.message,
          });
        }
      }
    }
  }

  const durationMs = +(performance.now() - startTime).toFixed(2);

  return {
    success: errors.length === 0,
    ...counters,
    durationMs,
    errors,
  };
}

// ============================================================================
// Full Library Exporter (JSON Snapshot)
// ============================================================================

export function exportFromSqlite(db: DatabaseInstance, userId = 'local_user') {
  const seriesRows = db.prepare(`SELECT * FROM series ORDER BY title_primary ASC`).all() as any[];
  const allTitles = db.prepare(`SELECT * FROM series_titles`).all() as any[];
  const allGenres = db.prepare(`
    SELECT sg.series_id, g.name, g.slug
    FROM series_genres sg
    JOIN genres g ON g.id = sg.genre_id
  `).all() as any[];
  const allChapters = db.prepare(`SELECT * FROM chapters ORDER BY chapter_number ASC`).all() as any[];
  const allProgress = db.prepare(`SELECT * FROM user_progress WHERE user_id = ?`).all(userId) as any[];

  // Group relations by series_id
  const titlesBySeries = new Map<string, any[]>();
  for (const t of allTitles) {
    const arr = titlesBySeries.get(t.series_id) || [];
    arr.push({ languageCode: t.language_code, title: t.title, isPrimary: Boolean(t.is_primary) });
    titlesBySeries.set(t.series_id, arr);
  }

  const genresBySeries = new Map<string, string[]>();
  for (const g of allGenres) {
    const arr = genresBySeries.get(g.series_id) || [];
    arr.push(g.name);
    genresBySeries.set(g.series_id, arr);
  }

  const chaptersBySeries = new Map<string, any[]>();
  for (const c of allChapters) {
    const arr = chaptersBySeries.get(c.series_id) || [];
    arr.push({
      id: c.id,
      chapterNumber: c.chapter_number,
      title: c.title,
      scanlationGroup: c.scanlation_group,
      pageCount: c.page_count,
      storagePath: c.storage_path,
    });
    chaptersBySeries.set(c.series_id, arr);
  }

  const progressBySeries = new Map<string, any>();
  for (const p of allProgress) {
    progressBySeries.set(p.series_id, {
      chapterId: p.chapter_id,
      pageNumber: p.page_number,
      isCompleted: Boolean(p.is_completed),
      updatedAt: p.updated_at,
    });
  }

  const series = seriesRows.map((s) => ({
    id: s.id,
    slug: s.slug,
    titlePrimary: s.title_primary,
    type: s.type,
    status: s.status,
    demographic: s.demographic,
    synopsis: s.synopsis,
    coverImage: s.cover_image,
    bannerImage: s.banner_image,
    author: s.author,
    artist: s.artist,
    releaseYear: s.release_year,
    anilistId: s.anilist_id,
    mangadexId: s.mangadex_id,
    titles: titlesBySeries.get(s.id) || [],
    genres: genresBySeries.get(s.id) || [],
    chapters: chaptersBySeries.get(s.id) || [],
    progress: progressBySeries.get(s.id) || null,
  }));

  return {
    appName: 'KuraScroll',
    version: 1,
    exportedAt: new Date().toISOString(),
    seriesCount: series.length,
    chapterCount: allChapters.length,
    series,
  };
}
