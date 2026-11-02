import { DatabaseInstance } from '../db/database.js';

export interface RecommendationItem {
  id: string;
  slug: string;
  titlePrimary: string;
  type: string;
  coverImage: string | null;
  genres: string[];
  affinityScore: number; // 0 to 100 percentage
  reasonBadge: string;   // e.g. "Porque leíste Solo Leveling", "Salto de Dimensión", "Popular en KuraScroll"
  reasonType: 'similarity' | 'genre' | 'author' | 'serendipity' | 'popular';
  estimatedChapterMinutes: number;
}

export interface RecommendationCacheEntry {
  timestamp: number;
  data: RecommendationItem[];
}

export class RecommendationService {
  private static readonly CACHE_TTL_MS = 60_000; // 60 seconds TTL in RAM
  private recommendationCache = new Map<string, RecommendationCacheEntry>();

  // In-memory inverted indexes to avoid disk seeks on 4TB HDD
  private seriesCatalog: Map<string, {
    id: string;
    slug: string;
    titlePrimary: string;
    type: string;
    coverImage: string | null;
    genres: string[];
    author: string | null;
    chapterCount: number;
  }> = new Map();

  private genreIndex = new Map<string, Set<string>>();
  private typeIndex = new Map<string, Set<string>>();

  constructor(private db: DatabaseInstance) {
    this.refreshCatalogIndex();
  }

  /**
   * Refreshes the in-memory inverted tag catalog.
   * Can be invoked at startup or after new series ingestion.
   */
  public refreshCatalogIndex(): void {
    this.seriesCatalog.clear();
    this.genreIndex.clear();
    this.typeIndex.clear();

    const rows = this.db.prepare(`
      SELECT 
        s.id, 
        s.slug, 
        s.title_primary, 
        s.type, 
        s.cover_image,
        COALESCE(
          (SELECT json_group_array(name) FROM genres g JOIN series_genres sg ON g.id = sg.genre_id WHERE sg.series_id = s.id),
          '[]'
        ) as genres_json,
        (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) as chapter_count
      FROM series s
    `).all() as any[];

    for (const row of rows) {
      let genres: string[] = [];
      try {
        genres = JSON.parse(row.genres_json || '[]');
      } catch {
        genres = [];
      }

      const item = {
        id: row.id,
        slug: row.slug,
        titlePrimary: row.title_primary || 'Untitled',
        type: row.type || 'manga',
        coverImage: row.cover_image,
        genres,
        author: null,
        chapterCount: Number(row.chapter_count || 0),
      };

      this.seriesCatalog.set(item.id, item);

      // Index type
      if (!this.typeIndex.has(item.type)) {
        this.typeIndex.set(item.type, new Set());
      }
      this.typeIndex.get(item.type)!.add(item.id);

      // Index genres
      for (const g of genres) {
        const lower = g.toLowerCase();
        if (!this.genreIndex.has(lower)) {
          this.genreIndex.set(lower, new Set());
        }
        this.genreIndex.get(lower)!.add(item.id);
      }
    }
  }

  /**
   * Generates personalized recommendations for a user.
   * Uses in-memory inverted index, user reading history, and serendipity injection.
   */
  public getRecommendations(userId: string, limit = 8): RecommendationItem[] {
    const now = Date.now();
    const cached = this.recommendationCache.get(userId);
    if (cached && (now - cached.timestamp < RecommendationService.CACHE_TTL_MS)) {
      return cached.data;
    }

    // 1. Fetch user reading history (series read + recency)
    const historyRows = this.db.prepare(`
      SELECT 
        up.series_id,
        s.title_primary,
        s.type,
        up.updated_at as last_read_at,
        1 as chapters_read
      FROM user_progress up
      JOIN series s ON up.series_id = s.id
      WHERE up.user_id = ?
      ORDER BY up.updated_at DESC
      LIMIT 20
    `).all(userId) as any[];

    // 2. Cold Start Fallback: If user has 0 reading history, return popular/trending
    if (!historyRows || historyRows.length === 0) {
      const fallback = this.getPopularFallback(limit);
      this.recommendationCache.set(userId, { timestamp: now, data: fallback });
      return fallback;
    }

    // 3. Build user preference profile (genre weights + format affinity)
    const readSeriesIds = new Set<string>(historyRows.map((h) => h.series_id));
    const genreWeights = new Map<string, number>();
    const typeWeights = new Map<string, number>();
    const mostRecentSeries = historyRows[0]?.title_primary || 'tus lecturas';

    for (const row of historyRows) {
      const seriesInfo = this.seriesCatalog.get(row.series_id);
      if (!seriesInfo) continue;

      // Recency factor: 2^(-days / 30)
      const lastReadDate = new Date(row.last_read_at || Date.now()).getTime();
      const daysAgo = Math.max(0, (now - lastReadDate) / (1000 * 60 * 60 * 24));
      const recencyWeight = Math.pow(2, -daysAgo / 30.0);
      const intensity = Math.min(5, Number(row.chapters_read || 1));

      // Weight reading format
      const t = seriesInfo.type.toLowerCase();
      typeWeights.set(t, (typeWeights.get(t) || 0) + (intensity * recencyWeight));

      // Weight genres
      for (const g of seriesInfo.genres) {
        const lower = g.toLowerCase();
        genreWeights.set(lower, (genreWeights.get(lower) || 0) + (intensity * recencyWeight));
      }
    }

    // Normalize preferred format and top genre
    let topGenre = 'Acción';
    let maxGenreWeight = 0;
    for (const [g, w] of genreWeights.entries()) {
      if (w > maxGenreWeight) {
        maxGenreWeight = w;
        topGenre = g;
      }
    }

    // Find preferred reading format
    let preferredFormat = 'manga';
    let maxFormatWeight = 0;
    for (const [fmt, w] of typeWeights.entries()) {
      if (w > maxFormatWeight) {
        maxFormatWeight = w;
        preferredFormat = fmt;
      }
    }

    // 4. Candidate Scoring
    const scoredCandidates: RecommendationItem[] = [];

    for (const [candidateId, candidate] of this.seriesCatalog.entries()) {
      // Exclude already completed / extensively read series
      if (readSeriesIds.has(candidateId)) continue;

      let score = 0;

      // 1. Format compatibility: up to 20 pts
      const candType = candidate.type.toLowerCase();
      if (candType === preferredFormat) {
        score += 20;
      } else if (
        (candType === 'manhwa' && preferredFormat === 'manhua') ||
        (candType === 'manhua' && preferredFormat === 'manhwa')
      ) {
        score += 10;
      }

      // 2. Genre Weighted Jaccard overlap: up to 60 pts
      const candidateGenres = new Set(candidate.genres.map((g) => g.toLowerCase()));
      let intersectionWeight = 0;
      for (const g of candidateGenres) {
        const w = genreWeights.get(g);
        if (w !== undefined) {
          intersectionWeight += w;
        }
      }

      let totalUnionWeight = 0;
      const allUniqueGenres = new Set([...candidateGenres, ...genreWeights.keys()]);
      for (const g of allUniqueGenres) {
        totalUnionWeight += genreWeights.get(g) || 1.0;
      }

      const jaccard = totalUnionWeight > 0 ? (intersectionWeight / totalUnionWeight) : 0;
      score += Math.round(jaccard * 60);

      // 3. Catalog maturity bonus: up to 20 pts
      const maturity = Math.min(20, candidate.chapterCount * 4);
      score += maturity;

      const normalizedScore = Math.min(99, Math.max(15, Math.round(score)));

      let reasonBadge = `Porque leíste ${mostRecentSeries}`;
      let reasonType: RecommendationItem['reasonType'] = 'similarity';

      if (jaccard < 0.4 && candidate.genres.map(g => g.toLowerCase()).includes(topGenre.toLowerCase())) {
        reasonBadge = `Top en ${topGenre.charAt(0).toUpperCase() + topGenre.slice(1)}`;
        reasonType = 'genre';
      }

      scoredCandidates.push({
        id: candidate.id,
        slug: candidate.slug,
        titlePrimary: candidate.titlePrimary,
        type: candidate.type,
        coverImage: candidate.coverImage,
        genres: candidate.genres,
        affinityScore: normalizedScore,
        reasonBadge,
        reasonType,
        estimatedChapterMinutes: 4, // Default baseline estimate
      });
    }

    // Sort by affinity descending
    scoredCandidates.sort((a, b) => b.affinityScore - a.affinityScore);

    // 5. Serendipity Injection (15% discovery slot to burst filter bubble)
    const result: RecommendationItem[] = [];
    const mainAffinitySlice = scoredCandidates.slice(0, limit);

    // Find a serendipity discovery item from a genre the user hasn't heavily consumed
    const serendipityCandidate = Array.from(this.seriesCatalog.values()).find(
      (c) => !readSeriesIds.has(c.id) && !c.genres.map(g => g.toLowerCase()).includes(topGenre.toLowerCase())
    );

    for (let i = 0; i < mainAffinitySlice.length; i++) {
      // Inject serendipity item at index 4 (5th card) if available
      if (i === 4 && serendipityCandidate) {
        result.push({
          id: serendipityCandidate.id,
          slug: serendipityCandidate.slug,
          titlePrimary: serendipityCandidate.titlePrimary,
          type: serendipityCandidate.type,
          coverImage: serendipityCandidate.coverImage,
          genres: serendipityCandidate.genres,
          affinityScore: 78,
          reasonBadge: 'Salto de Dimensión (Descubrimiento)',
          reasonType: 'serendipity',
          estimatedChapterMinutes: 4,
        });
      } else {
        result.push(mainAffinitySlice[i]);
      }
    }

    const finalResult = result.slice(0, limit);
    this.recommendationCache.set(userId, { timestamp: now, data: finalResult });
    return finalResult;
  }

  private getPopularFallback(limit: number): RecommendationItem[] {
    const list = Array.from(this.seriesCatalog.values())
      .sort((a, b) => b.chapterCount - a.chapterCount)
      .slice(0, limit);

    return list.map((item) => ({
      id: item.id,
      slug: item.slug,
      titlePrimary: item.titlePrimary,
      type: item.type,
      coverImage: item.coverImage,
      genres: item.genres,
      affinityScore: 0,
      reasonBadge: 'Popular en KuraScroll',
      reasonType: 'popular',
      estimatedChapterMinutes: 4,
    }));
  }

  public clearCache(): void {
    this.recommendationCache.clear();
  }
}
