export type MangaFormat = 'manga' | 'manhwa' | 'manhua' | 'comic';

export const PRIMARY_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror',
  'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life',
  'Sports', 'Supernatural', 'Thriller', 'Historical', 'Mecha',
] as const;

export const THEMES = [
  'Isekai', 'Reincarnation', 'Time Travel', 'Martial Arts', 'Murim',
  'Dungeon', 'System', 'Leveling', 'Magic', 'Monsters',
  'Revenge', 'Villainess', 'Otome Game', 'School Life', 'Cultivation',
  'Virtual Reality', 'Survival', 'Post-Apocalyptic', 'Military', 'Demons',
  'Vampires', 'Zombies', 'Super Power', 'Gore', 'Crime',
  'Police', 'Cooking', 'Music', 'Medical', 'Mythology',
  'Dark Fantasy', 'Cyberpunk',
] as const;

export const GENRE_BIT_INDEX = new Map<string, number>(
  PRIMARY_GENRES.map((g, i) => [g.toLowerCase(), i])
);

export const THEME_BIT_INDEX = new Map<string, number>(
  THEMES.map((t, i) => [t.toLowerCase(), i])
);

export interface SeriesFeatureVector {
  id: string;
  type: MangaFormat;
  author: string | null;
  artist: string | null;
  genreMask: number;
  themeMask: number;
  totalGenreWeight: number;
  totalThemeWeight: number;
}

export interface RecommendationResult {
  id: string;
  score: number; // 0 - 100
}

/**
 * Calculates smoothed Inverse Document Frequency (IDF) weights for genres and themes.
 */
export function calculateIdfWeights(frequencies: Uint32Array, totalDocs: number): Float32Array {
  const weights = new Float32Array(frequencies.length);
  const n = Math.max(1, totalDocs);
  for (let i = 0; i < frequencies.length; i++) {
    const freq = Math.max(1, frequencies[i]);
    weights[i] = Math.log(1 + n / freq);
  }
  return weights;
}

/**
 * Ultra-fast Weighted Jaccard over integer bitmasks using Brian Kernighan bit loop.
 */
export function fastWeightedJaccard(
  maskA: number,
  totalWeightA: number,
  maskB: number,
  totalWeightB: number,
  weights: Float32Array
): number {
  let common = maskA & maskB;
  if (common === 0) return 0;
  if (maskA === maskB) return 1.0;

  let interWeight = 0;
  while (common !== 0) {
    const bit = 31 - Math.clz32(common & -common);
    interWeight += weights[bit];
    common &= common - 1; // Clear lowest set bit
  }

  const unionWeight = totalWeightA + totalWeightB - interWeight;
  return unionWeight > 0 ? interWeight / unionWeight : 0;
}

/**
 * Format and Reading Layout Compatibility Score (0.2 to 1.0).
 */
export function formatCompatibilityScore(typeA: MangaFormat, typeB: MangaFormat): number {
  if (typeA === typeB) return 1.0;
  if ((typeA === 'manhwa' && typeB === 'manhua') || (typeA === 'manhua' && typeB === 'manhwa')) {
    return 0.5; // Webtoon cousins (both color vertical scroll)
  }
  return 0.2; // Cross-medium penalty
}

/**
 * Creator Signature Score (Author / Artist matches).
 */
export function creatorSignatureScore(
  target: { author: string | null; artist: string | null },
  candidate: { author: string | null; artist: string | null }
): number {
  if (!target.author && !target.artist) return 0;
  let score = 0;
  if (target.author && target.author.toLowerCase() !== 'unknown' && target.author === candidate.author) {
    score += 0.7;
  }
  if (target.artist && target.artist.toLowerCase() !== 'unknown' && target.artist === candidate.artist) {
    score += 0.5;
  }
  return Math.min(1.0, score);
}

/**
 * Computes the normalized 0-100% Content-Based Affinity Score between two series.
 */
export function calculateAffinityScore(
  target: SeriesFeatureVector,
  candidate: SeriesFeatureVector,
  genreWeights: Float32Array,
  themeWeights: Float32Array
): number {
  if (target.id === candidate.id) return 100;

  const simTheme = fastWeightedJaccard(
    target.themeMask,
    target.totalThemeWeight,
    candidate.themeMask,
    candidate.totalThemeWeight,
    themeWeights
  );

  const simGenre = fastWeightedJaccard(
    target.genreMask,
    target.totalGenreWeight,
    candidate.genreMask,
    candidate.totalGenreWeight,
    genreWeights
  );

  const simFormat = formatCompatibilityScore(target.type, candidate.type);
  const simCreator = creatorSignatureScore(target, candidate);

  let rawScore: number;
  if (simCreator > 0) {
    rawScore = 0.35 * simTheme + 0.25 * simGenre + 0.25 * simCreator + 0.15 * simFormat;
  } else {
    // Dynamic re-normalization without creator match: capped at 90%
    const contentSum = 0.35 * simTheme + 0.25 * simGenre + 0.15 * simFormat;
    rawScore = (contentSum / 0.75) * 0.9;
  }

  return Math.min(100, Math.round(rawScore * 100));
}

export class RecommendationEngine {
  private catalog: SeriesFeatureVector[] = [];
  private catalogMap = new Map<string, SeriesFeatureVector>();
  private genreWeights = new Float32Array(PRIMARY_GENRES.length);
  private themeWeights = new Float32Array(THEMES.length);
  private genreInvertedIndex: number[][] = Array.from({ length: PRIMARY_GENRES.length }, () => []);
  private themeInvertedIndex: number[][] = Array.from({ length: THEMES.length }, () => []);
  private candidateMaskBuffer = new Uint8Array(0);

  /**
   * Indexes a full catalog of series into bitmask vectors and inverted posting lists.
   */
  indexCatalog(
    seriesList: Array<{
      id: string;
      type: MangaFormat;
      author?: string | null;
      artist?: string | null;
      genres: string[];
    }>
  ): void {
    const totalDocs = seriesList.length;
    this.catalog = [];
    this.catalogMap.clear();
    this.genreInvertedIndex = Array.from({ length: PRIMARY_GENRES.length }, () => []);
    this.themeInvertedIndex = Array.from({ length: THEMES.length }, () => []);
    this.candidateMaskBuffer = new Uint8Array(totalDocs);

    const genreFreq = new Uint32Array(PRIMARY_GENRES.length);
    const themeFreq = new Uint32Array(THEMES.length);

    // Pass 1: Build bitmasks and calculate tag frequencies
    const rawVectors: Array<{
      id: string;
      type: MangaFormat;
      author: string | null;
      artist: string | null;
      genreMask: number;
      themeMask: number;
    }> = [];

    for (let i = 0; i < totalDocs; i++) {
      const s = seriesList[i];
      let gMask = 0;
      let tMask = 0;

      for (const g of s.genres) {
        const key = g.trim().toLowerCase();
        const gBit = GENRE_BIT_INDEX.get(key);
        if (gBit !== undefined) {
          gMask |= 1 << gBit;
        }
        const tBit = THEME_BIT_INDEX.get(key);
        if (tBit !== undefined) {
          tMask |= 1 << tBit;
        }
      }

      for (let b = 0; b < PRIMARY_GENRES.length; b++) {
        if ((gMask & (1 << b)) !== 0) {
          genreFreq[b]++;
          this.genreInvertedIndex[b].push(i);
        }
      }

      for (let b = 0; b < THEMES.length; b++) {
        if ((tMask & (1 << b)) !== 0) {
          themeFreq[b]++;
          this.themeInvertedIndex[b].push(i);
        }
      }

      rawVectors.push({
        id: s.id,
        type: s.type,
        author: s.author ?? null,
        artist: s.artist ?? null,
        genreMask: gMask,
        themeMask: tMask,
      });
    }

    // Pass 2: Calculate IDF weights
    this.genreWeights = calculateIdfWeights(genreFreq, totalDocs) as any;
    this.themeWeights = calculateIdfWeights(themeFreq, totalDocs) as any;

    // Pass 3: Precompute total weights per series
    for (const raw of rawVectors) {
      let gw = 0;
      for (let b = 0; b < PRIMARY_GENRES.length; b++) {
        if ((raw.genreMask & (1 << b)) !== 0) gw += this.genreWeights[b];
      }
      let tw = 0;
      for (let b = 0; b < THEMES.length; b++) {
        if ((raw.themeMask & (1 << b)) !== 0) tw += this.themeWeights[b];
      }

      const vec: SeriesFeatureVector = {
        ...raw,
        totalGenreWeight: gw,
        totalThemeWeight: tw,
      };

      this.catalog.push(vec);
      this.catalogMap.set(vec.id, vec);
    }
  }

  /**
   * Retrieves the top K similar series for a given target series id.
   */
  getSimilarSeries(targetSeriesId: string, topK = 10): RecommendationResult[] {
    const target = this.catalogMap.get(targetSeriesId);
    if (!target) return [];

    this.candidateMaskBuffer.fill(0);

    // Inverted index candidate pre-filtering
    let mask = target.themeMask;
    while (mask !== 0) {
      const bit = 31 - Math.clz32(mask & -mask);
      const list = this.themeInvertedIndex[bit];
      for (let j = 0; j < list.length; j++) this.candidateMaskBuffer[list[j]] = 1;
      mask &= mask - 1;
    }

    mask = target.genreMask;
    while (mask !== 0) {
      const bit = 31 - Math.clz32(mask & -mask);
      const list = this.genreInvertedIndex[bit];
      for (let j = 0; j < list.length; j++) this.candidateMaskBuffer[list[j]] = 1;
      mask &= mask - 1;
    }

    const scored: RecommendationResult[] = [];
    for (let i = 0; i < this.catalog.length; i++) {
      if (this.candidateMaskBuffer[i] === 0 || this.catalog[i].id === target.id) continue;
      const score = calculateAffinityScore(target, this.catalog[i], this.genreWeights, this.themeWeights);
      if (score >= 15) {
        scored.push({ id: this.catalog[i].id, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}
