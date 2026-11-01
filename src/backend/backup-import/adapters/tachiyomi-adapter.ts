export interface TachiyomiChapter {
  name: string;
  chapterNumber: number;
  scanlator: string | null;
  read: boolean;
  lastPageRead: number;
  url?: string;
  dateFetch?: number;
  dateUpload?: number;
}

export interface TachiyomiHistory {
  chapterUrl?: string;
  chapterNumber?: number;
  readAt: number;
}

export interface TachiyomiManga {
  title: string;
  author: string | null;
  artist: string | null;
  description: string | null;
  genre: string[];
  status: number | string;
  source: string | number;
  url: string;
  thumbnailUrl: string | null;
  chapters: TachiyomiChapter[];
  history: TachiyomiHistory[];
}

export interface TachiyomiParsedBackup {
  format: 'tachiyomi_legacy_json' | 'mihon_json';
  version?: number;
  mangas: TachiyomiManga[];
}

export function parseGenreList(rawGenre: any): string[] {
  if (!rawGenre) return [];
  if (Array.isArray(rawGenre)) {
    return rawGenre
      .filter((g) => typeof g === 'string')
      .map((g) => g.trim())
      .filter(Boolean);
  }
  if (typeof rawGenre === 'string') {
    return rawGenre
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseChapterNumberFromText(name: string): number | null {
  const match = name.match(/(?:^|[_\s.-])(?:chapter|chap|ch|c)[.\s_-]*([0-9]+(?:\.[0-9]+)?)/i);
  if (match) {
    const num = Number.parseFloat(match[1]);
    if (!Number.isNaN(num)) return num;
  }
  const anyNum = name.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (anyNum) {
    const num = Number.parseFloat(anyNum[1]);
    if (!Number.isNaN(num)) return num;
  }
  return null;
}

export function parseTachiyomiChapter(raw: any, fallbackIndex: number): TachiyomiChapter {
  const name = String(raw?.name || raw?.title || `Chapter ${fallbackIndex}`).trim();

  let chapterNumber: number;
  if (typeof raw?.chapter_number === 'number' && !Number.isNaN(raw.chapter_number)) {
    chapterNumber = raw.chapter_number;
  } else if (typeof raw?.chapterNumber === 'number' && !Number.isNaN(raw.chapterNumber)) {
    chapterNumber = raw.chapterNumber;
  } else if (typeof raw?.number === 'number' && !Number.isNaN(raw.number)) {
    chapterNumber = raw.number;
  } else {
    chapterNumber = parseChapterNumberFromText(name) ?? fallbackIndex;
  }

  const scanlator = raw?.scanlator ? String(raw.scanlator).trim() : (raw?.scanlation_group ? String(raw.scanlation_group).trim() : null);
  const read = Boolean(raw?.read || raw?.is_read);
  const lastPageRead = Math.max(0, Number(raw?.last_page_read ?? raw?.lastPageRead ?? 0) || 0);
  const url = raw?.url ? String(raw.url) : undefined;
  const dateFetch = typeof raw?.date_fetch === 'number' ? raw.date_fetch : raw?.dateFetch;
  const dateUpload = typeof raw?.date_upload === 'number' ? raw.date_upload : raw?.dateUpload;

  return {
    name,
    chapterNumber,
    scanlator: scanlator || null,
    read,
    lastPageRead,
    url,
    dateFetch,
    dateUpload,
  };
}

export function parseTachiyomiHistory(raw: any): TachiyomiHistory {
  const readAt = Number(raw?.read_at ?? raw?.last_read ?? raw?.readAt ?? raw?.time ?? 0) || 0;
  const chapterUrl = raw?.url || raw?.chapter_url || raw?.chapterUrl ? String(raw.url || raw.chapter_url || raw.chapterUrl) : undefined;
  const chapterNumber = typeof raw?.chapter_number === 'number' ? raw.chapter_number : (typeof raw?.chapterNumber === 'number' ? raw.chapterNumber : undefined);

  return {
    chapterUrl,
    chapterNumber,
    readAt,
  };
}

export function parseTachiyomiManga(raw: any): TachiyomiManga {
  const title = String(raw?.title || 'Unknown Series').trim();
  const author = raw?.author ? String(raw.author).trim() : null;
  const artist = raw?.artist ? String(raw.artist).trim() : null;
  const description = raw?.description || raw?.synopsis ? String(raw.description || raw.synopsis).trim() : null;
  const genre = parseGenreList(raw?.genre ?? raw?.genres);
  const status = raw?.status ?? 0;
  const source = raw?.source ?? 'unknown';
  const url = String(raw?.url || '');
  const thumbnailUrl = raw?.thumbnail_url || raw?.thumbnailUrl || raw?.cover ? String(raw.thumbnail_url || raw.thumbnailUrl || raw.cover) : null;

  const rawChapters = Array.isArray(raw?.chapters)
    ? raw.chapters
    : (Array.isArray(raw?.backupChapters) ? raw.backupChapters : []);

  const chapters = rawChapters.map((c: any, idx: number) => parseTachiyomiChapter(c, idx + 1));

  const rawHistory = Array.isArray(raw?.history)
    ? raw.history
    : (Array.isArray(raw?.backupHistory) ? raw.backupHistory : []);

  const history = rawHistory.map(parseTachiyomiHistory);

  return {
    title,
    author: author || null,
    artist: artist || null,
    description: description || null,
    genre,
    status,
    source,
    url,
    thumbnailUrl: thumbnailUrl || null,
    chapters,
    history,
  };
}

export function parseTachiyomiBackup(
  parsedJson: any,
  format: 'tachiyomi_legacy_json' | 'mihon_json' = 'tachiyomi_legacy_json'
): TachiyomiParsedBackup {
  let rawMangas: any[] = [];
  let version: number | undefined;

  if (Array.isArray(parsedJson)) {
    rawMangas = parsedJson;
  } else if (parsedJson && typeof parsedJson === 'object') {
    if (parsedJson.version !== undefined) {
      version = Number(parsedJson.version);
    }

    if (Array.isArray(parsedJson.mangas)) {
      rawMangas = parsedJson.mangas;
    } else if (Array.isArray(parsedJson.backupManga)) {
      rawMangas = parsedJson.backupManga;
    } else if (Array.isArray(parsedJson.data)) {
      rawMangas = parsedJson.data;
    }
  }

  const mangas = rawMangas
    .filter((m) => m && typeof m === 'object' && m.title)
    .map(parseTachiyomiManga);

  return {
    format,
    version,
    mangas,
  };
}
