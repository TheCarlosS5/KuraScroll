import { TachiyomiParsedBackup, TachiyomiManga } from '../adapters/tachiyomi-adapter.js';
import { naturalSort } from '../../utils/natural-sort.js';

export interface LocalizedTitle {
  languageCode: string;
  title: string;
  isPrimary?: boolean;
}

export interface NormalizedChapter {
  chapterNumber: number;
  title: string;
  scanlator: string | null;
  isRead: boolean;
  lastPageRead: number;
  sourceUrl: string | null;
  readAt: Date | null;
}

export interface NormalizedSeries {
  slug: string;
  titlePrimary: string;
  titles: LocalizedTitle[];
  type: 'manga' | 'manhwa' | 'manhua' | 'comic';
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  author: string | null;
  artist: string | null;
  synopsis: string | null;
  genres: string[];
  coverUrl: string | null;
  externalSource: string | null;
  sourceUrl: string | null;
  chapters: NormalizedChapter[];
}

export interface NormalizedBackup {
  format: string;
  version?: number;
  seriesCount: number;
  chapterCount: number;
  series: NormalizedSeries[];
}

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

  return slug || 'series';
}

export function normalizeStatus(rawStatus: number | string): 'ongoing' | 'completed' | 'hiatus' | 'cancelled' {
  if (typeof rawStatus === 'number') {
    switch (rawStatus) {
      case 1: // ONGOING
      case 3: // LICENSED
        return 'ongoing';
      case 2: // COMPLETED
      case 4: // PUBLISHING_FINISHED
        return 'completed';
      case 5: // CANCELLED
        return 'cancelled';
      case 6: // ON_HIATUS
        return 'hiatus';
      default:
        return 'ongoing';
    }
  }

  const str = String(rawStatus).toLowerCase().trim();
  if (str.includes('complete') || str.includes('finish')) return 'completed';
  if (str.includes('cancel')) return 'cancelled';
  if (str.includes('hiatus')) return 'hiatus';
  return 'ongoing';
}

export function deduceSeriesType(genres: string[], source?: string | number): 'manga' | 'manhwa' | 'manhua' | 'comic' {
  const gLower = genres.map((g) => g.toLowerCase());
  const sLower = String(source || '').toLowerCase();

  // Korean manhwa / webtoon indicators
  if (
    gLower.some((g) => g.includes('manhwa') || g.includes('webtoon') || g.includes('korean')) ||
    sLower.includes('manhwa') ||
    sLower.includes('asura') ||
    sLower.includes('reaper') ||
    sLower.includes('flame') ||
    sLower.includes('webtoon') ||
    sLower.includes('naver') ||
    sLower.includes('kakao')
  ) {
    return 'manhwa';
  }

  // Chinese manhua indicators
  if (
    gLower.some((g) => g.includes('manhua') || g.includes('chinese')) ||
    sLower.includes('manhua') ||
    sLower.includes('bilibili') ||
    sLower.includes('kuaikan')
  ) {
    return 'manhua';
  }

  // Western comic indicators
  if (gLower.some((g) => g.includes('comic') || g.includes('western'))) {
    return 'comic';
  }

  return 'manga';
}

export function normalizeSeries(manga: TachiyomiManga): NormalizedSeries {
  const titlePrimary = manga.title.trim();
  const baseSlug = slugify(titlePrimary);

  // Extract alternative titles from brackets or parentheses if present (e.g. "Solo Leveling (나 혼자만 레벨업)")
  const titlesMap = new Map<string, LocalizedTitle>();
  titlesMap.set(titlePrimary.toLowerCase(), {
    languageCode: 'en',
    title: titlePrimary,
    isPrimary: true,
  });

  const altMatches = titlePrimary.match(/[\(\[\{](.+?)[\)\]\}]/g);
  if (altMatches) {
    for (const match of altMatches) {
      const cleanAlt = match.slice(1, -1).trim();
      if (cleanAlt && !titlesMap.has(cleanAlt.toLowerCase())) {
        titlesMap.set(cleanAlt.toLowerCase(), {
          languageCode: 'alt',
          title: cleanAlt,
          isPrimary: false,
        });
      }
    }
  }

  const type = deduceSeriesType(manga.genre, manga.source);
  const status = normalizeStatus(manga.status);

  // Create lookup map for reading history
  const historyByUrl = new Map<string, number>();
  const historyByChapNum = new Map<number, number>();

  for (const h of manga.history) {
    if (h.chapterUrl) {
      historyByUrl.set(h.chapterUrl, h.readAt);
    }
    if (h.chapterNumber !== undefined) {
      historyByChapNum.set(h.chapterNumber, h.readAt);
    }
  }

  // Normalize chapters
  const normalizedChapters: NormalizedChapter[] = manga.chapters.map((c) => {
    let readAtDate: Date | null = null;
    let readAtTimestamp: number | undefined;

    if (c.url && historyByUrl.has(c.url)) {
      readAtTimestamp = historyByUrl.get(c.url);
    } else if (historyByChapNum.has(c.chapterNumber)) {
      readAtTimestamp = historyByChapNum.get(c.chapterNumber);
    }

    if (readAtTimestamp && readAtTimestamp > 0) {
      readAtDate = new Date(readAtTimestamp);
    } else if (c.read) {
      readAtDate = new Date(); // Marked read but no timestamp
    }

    return {
      chapterNumber: c.chapterNumber,
      title: c.name,
      scanlator: c.scanlator,
      isRead: c.read,
      lastPageRead: c.lastPageRead,
      sourceUrl: c.url || null,
      readAt: readAtDate,
    };
  });

  // Sort chapters numerically ascending
  normalizedChapters.sort((a, b) => a.chapterNumber - b.chapterNumber);

  return {
    slug: baseSlug,
    titlePrimary,
    titles: Array.from(titlesMap.values()),
    type,
    status,
    author: manga.author,
    artist: manga.artist,
    synopsis: manga.description,
    genres: manga.genre,
    coverUrl: manga.thumbnailUrl,
    externalSource: String(manga.source),
    sourceUrl: manga.url || null,
    chapters: normalizedChapters,
  };
}

export function normalizeBackup(parsed: TachiyomiParsedBackup): NormalizedBackup {
  const series = parsed.mangas.map(normalizeSeries);
  const chapterCount = series.reduce((sum, s) => sum + s.chapters.length, 0);

  return {
    format: parsed.format,
    version: parsed.version,
    seriesCount: series.length,
    chapterCount,
    series,
  };
}
