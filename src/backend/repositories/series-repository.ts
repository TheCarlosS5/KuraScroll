import { DatabaseInstance } from '../db/database.js';
import { sanitizeFtsQuery } from '../utils/fts-sanitizer.js';

export interface InsertSeriesInput {
  id: string;
  slug: string;
  titlePrimary: string;
  type: 'manga' | 'manhwa' | 'manhua' | 'comic';
  status: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
  demographic?: 'shounen' | 'seinen' | 'shoujo' | 'josei' | 'none';
  synopsis?: string;
  coverImage?: string;
  bannerImage?: string;
  author?: string;
  artist?: string;
  releaseYear?: number;
  anilistId?: number;
  mangadexId?: string;
}

export interface SeriesTitleInput {
  languageCode: string;
  title: string;
  isPrimary?: boolean;
}

export interface Series {
  id: string;
  slug: string;
  titlePrimary: string;
  type: string;
  status: string;
  demographic: string | null;
  synopsis: string | null;
  coverImage: string | null;
  bannerImage: string | null;
  author: string | null;
  artist: string | null;
  releaseYear: number | null;
  anilistId: number | null;
  mangadexId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeriesDetail extends Series {
  titles: Array<{ languageCode: string; title: string; isPrimary: boolean }>;
}

export class SeriesRepository {
  constructor(private db: DatabaseInstance) {}

  createSeries(input: InsertSeriesInput): void {
    const stmt = this.db.prepare(`
      INSERT INTO series (
        id, slug, title_primary, type, status, demographic, synopsis,
        cover_image, banner_image, author, artist, release_year, anilist_id, mangadex_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      input.id,
      input.slug,
      input.titlePrimary,
      input.type,
      input.status,
      input.demographic ?? null,
      input.synopsis ?? null,
      input.coverImage ?? null,
      input.bannerImage ?? null,
      input.author ?? null,
      input.artist ?? null,
      input.releaseYear ?? null,
      input.anilistId ?? null,
      input.mangadexId ?? null
    );
  }

  addSeriesTitles(seriesId: string, titles: SeriesTitleInput[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO series_titles (series_id, language_code, title, is_primary)
      VALUES (?, ?, ?, ?)
    `);

    for (const t of titles) {
      stmt.run(seriesId, t.languageCode, t.title, t.isPrimary ? 1 : 0);
    }
  }

  getSeriesBySlug(slug: string): SeriesDetail | null {
    const stmt = this.db.prepare('SELECT * FROM series WHERE slug = ?');
    const row = stmt.get(slug) as any;
    if (!row) return null;

    const titlesStmt = this.db.prepare('SELECT language_code, title, is_primary FROM series_titles WHERE series_id = ?');
    const titleRows = titlesStmt.all(row.id) as any[];

    return {
      id: row.id,
      slug: row.slug,
      titlePrimary: row.title_primary,
      type: row.type,
      status: row.status,
      demographic: row.demographic,
      synopsis: row.synopsis,
      coverImage: row.cover_image,
      bannerImage: row.banner_image,
      author: row.author,
      artist: row.artist,
      releaseYear: row.release_year,
      anilistId: row.anilist_id,
      mangadexId: row.mangadex_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      titles: titleRows.map((t) => ({
        languageCode: t.language_code,
        title: t.title,
        isPrimary: Boolean(t.is_primary),
      })),
    };
  }

  searchSeries(query: string, limit = 20): Series[] {
    const fts = sanitizeFtsQuery(query);
    if (!fts) {
      return this.listSeries({ limit }).items;
    }

    const stmt = this.db.prepare(`
      SELECT DISTINCT s.*
      FROM series_search_fts fts
      JOIN series s ON s.id = fts.series_id
      WHERE series_search_fts MATCH ?
      LIMIT ?
    `);

    const rows = stmt.all(fts, limit) as any[];
    return rows.map(this.mapSeriesRow);
  }

  listSeries(options: { type?: string; status?: string; page?: number; limit?: number } = {}): { items: Series[]; total: number } {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];

    if (options.type) {
      conditions.push('type = ?');
      params.push(options.type);
    }
    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM series ${where}`);
    const total = (countStmt.get(...params) as any).count as number;

    const queryStmt = this.db.prepare(`
      SELECT * FROM series
      ${where}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = queryStmt.all(...params, limit, offset) as any[];
    return {
      items: rows.map(this.mapSeriesRow),
      total,
    };
  }

  private mapSeriesRow(row: any): Series {
    return {
      id: row.id,
      slug: row.slug,
      titlePrimary: row.title_primary,
      type: row.type,
      status: row.status,
      demographic: row.demographic,
      synopsis: row.synopsis,
      coverImage: row.cover_image,
      bannerImage: row.banner_image,
      author: row.author,
      artist: row.artist,
      releaseYear: row.release_year,
      anilistId: row.anilist_id,
      mangadexId: row.mangadex_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
