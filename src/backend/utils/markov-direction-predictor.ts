/**
 * KuraScroll Markov Direction Predictor & Zero-Allocation Reading Transition Engine
 * Sprint 59 - Intelligent Pre-Flight Cache Warming & Turn-Ahead Prediction
 *
 * Designed for Intel Pentium T4500 (V8 heap <= 512MB, single-threaded execution)
 * and mechanical SATA II 4TB HDD (radial seek mitigation).
 */

export type TurnAction = 'ADVANCE' | 'RETREAT' | 'JUMP';
export type CadenceBucket = 'FAST' | 'NORMAL' | 'SLOW';
export type ReaderMode = 'manga' | 'webtoon' | 'comic';

export interface TransitionProbabilities {
  advance: number;
  retreat: number;
  jump: number;
}

export interface CandidatePrefetch {
  chapterId: string;
  pageNumber: number;
  action: TurnAction;
  probability: number;
  score: number;
  targetWidth?: number;
}

export interface PredictCandidatesOptions {
  currentPage: number;
  totalPages: number;
  currentChapterId: string;
  nextChapterId?: string;
  prevChapterId?: string;
  previousPage?: number;
  cadence?: CadenceBucket;
  readingMode?: ReaderMode;
  isDoubleSpread?: boolean;
  targetWidth?: number;
  depth?: number; // max candidates (default 2)
}

/**
 * Markov Transition Table using static Float32Arrays for zero GC allocation during inference.
 * Index 0: ADVANCE, Index 1: RETREAT, Index 2: JUMP
 */
const DEFAULT_PRIORS: Record<CadenceBucket, Float32Array> = {
  FAST: new Float32Array([0.94, 0.03, 0.03]),
  NORMAL: new Float32Array([0.88, 0.08, 0.04]),
  SLOW: new Float32Array([0.76, 0.18, 0.06]),
};

export class MarkovDirectionPredictor {
  // Static arrays for active model weights
  private weights: Record<CadenceBucket, Float32Array>;
  // Smoothed transition frequency counts
  private counts: Record<CadenceBucket, Float64Array>;
  // Decay factor for history adaptation (0.995 maintains stable confidence without thrashing)
  private readonly decayFactor: number = 0.995;

  constructor(customPriors?: Partial<Record<CadenceBucket, [number, number, number]>>) {
    this.weights = {
      FAST: new Float32Array(customPriors?.FAST ?? DEFAULT_PRIORS.FAST),
      NORMAL: new Float32Array(customPriors?.NORMAL ?? DEFAULT_PRIORS.NORMAL),
      SLOW: new Float32Array(customPriors?.SLOW ?? DEFAULT_PRIORS.SLOW),
    };

    // Initialize counts proportional to priors (base weight 100 observations)
    this.counts = {
      FAST: new Float64Array([this.weights.FAST[0] * 100, this.weights.FAST[1] * 100, this.weights.FAST[2] * 100]),
      NORMAL: new Float64Array([this.weights.NORMAL[0] * 100, this.weights.NORMAL[1] * 100, this.weights.NORMAL[2] * 100]),
      SLOW: new Float64Array([this.weights.SLOW[0] * 100, this.weights.SLOW[1] * 100, this.weights.SLOW[2] * 100]),
    };
  }

  /**
   * Determine cadence bucket based on page dwell time (seconds)
   */
  public static classifyCadence(dwellSeconds: number, readingMode: ReaderMode = 'manga'): CadenceBucket {
    if (dwellSeconds < 3.0) return 'FAST';
    if (readingMode === 'webtoon') {
      if (dwellSeconds < 8.0) return 'FAST';
      if (dwellSeconds > 25.0) return 'SLOW';
      return 'NORMAL';
    }
    // Manga / comic baseline
    if (dwellSeconds > 40.0) return 'SLOW';
    return 'NORMAL';
  }

  /**
   * Fast zero-allocation prediction of action probabilities.
   * If an output Float32Array is provided, values are written directly without creating a new array.
   */
  public predict(cadence: CadenceBucket = 'NORMAL', outBuffer?: Float32Array): Float32Array {
    const table = this.weights[cadence] || this.weights.NORMAL;
    const dest = outBuffer ?? new Float32Array(3);
    dest[0] = table[0];
    dest[1] = table[1];
    dest[2] = table[2];
    return dest;
  }

  /**
   * Convenience object returning named probabilities
   */
  public getProbabilities(cadence: CadenceBucket = 'NORMAL'): TransitionProbabilities {
    const table = this.weights[cadence] || this.weights.NORMAL;
    return {
      advance: table[0],
      retreat: table[1],
      jump: table[2],
    };
  }

  /**
   * Ingest an observed transition, updating Bayesian probability weights with exponential decay
   */
  public recordTransition(action: TurnAction, cadence: CadenceBucket = 'NORMAL'): void {
    const countArr = this.counts[cadence];
    const weightArr = this.weights[cadence];

    // Apply decay to historical counts
    countArr[0] *= this.decayFactor;
    countArr[1] *= this.decayFactor;
    countArr[2] *= this.decayFactor;

    // Increment observed action
    if (action === 'ADVANCE') countArr[0] += 1.0;
    else if (action === 'RETREAT') countArr[1] += 1.0;
    else if (action === 'JUMP') countArr[2] += 1.0;

    // Re-normalize weights
    const total = countArr[0] + countArr[1] + countArr[2];
    if (total > 0) {
      weightArr[0] = Number((countArr[0] / total).toFixed(4));
      weightArr[1] = Number((countArr[1] / total).toFixed(4));
      weightArr[2] = Number((countArr[2] / total).toFixed(4));
    }
  }

  /**
   * Derive turn action from page change delta
   */
  public static inferAction(prevPage: number, currPage: number): TurnAction {
    const delta = currPage - prevPage;
    if (delta === 1 || delta === 2) return 'ADVANCE';
    if (delta === -1 || delta === -2) return 'RETREAT';
    return 'JUMP';
  }

  /**
   * Generate prioritized candidates for speculative cache warming.
   * Handles page increments, double spreads, and chapter boundaries.
   */
  public predictCandidates(options: PredictCandidatesOptions): CandidatePrefetch[] {
    const cadence = options.cadence ?? 'NORMAL';
    const depth = options.depth ?? 2;
    const isSpread = !!options.isDoubleSpread;
    const step = isSpread ? 2 : 1;
    const probabilities = this.weights[cadence] || this.weights.NORMAL;
    const pAdvance = probabilities[0];
    const pRetreat = probabilities[1];

    const candidates: CandidatePrefetch[] = [];

    // 1. Advance Candidates (Forward Turn-Ahead)
    const nextP1 = options.currentPage + step;
    if (nextP1 <= options.totalPages) {
      candidates.push({
        chapterId: options.currentChapterId,
        pageNumber: nextP1,
        action: 'ADVANCE',
        probability: pAdvance,
        score: Math.round(pAdvance * 1000) / 1000,
        targetWidth: options.targetWidth,
      });

      // Depth 2 advance
      if (depth >= 2) {
        const nextP2 = nextP1 + step;
        if (nextP2 <= options.totalPages) {
          const pAdvance2 = pAdvance * pAdvance;
          candidates.push({
            chapterId: options.currentChapterId,
            pageNumber: nextP2,
            action: 'ADVANCE',
            probability: pAdvance2,
            score: Math.round(pAdvance2 * 1000) / 1000,
            targetWidth: options.targetWidth,
          });
        } else if (options.nextChapterId) {
          // Chapter boundary transition warm-up (Next Chapter, Page 1)
          const pBoundary = pAdvance * 0.9;
          candidates.push({
            chapterId: options.nextChapterId,
            pageNumber: 1,
            action: 'ADVANCE',
            probability: pBoundary,
            score: Math.round(pBoundary * 1000) / 1000,
            targetWidth: options.targetWidth,
          });
        }
      }
    } else if (options.nextChapterId) {
      // Immediate chapter boundary transition (Current page is already at chapter end)
      candidates.push({
        chapterId: options.nextChapterId,
        pageNumber: 1,
        action: 'ADVANCE',
        probability: pAdvance,
        score: Math.round(pAdvance * 1000) / 1000,
        targetWidth: options.targetWidth,
      });
      if (depth >= 2 && options.totalPages > 1) {
        candidates.push({
          chapterId: options.nextChapterId,
          pageNumber: 1 + step,
          action: 'ADVANCE',
          probability: pAdvance * pAdvance,
          score: Math.round(pAdvance * pAdvance * 1000) / 1000,
          targetWidth: options.targetWidth,
        });
      }
    }

    // 2. Retreat Candidate (Backtrack Turn-Ahead)
    // Only queue retreat if probability is significant (> 0.05) or slow cadence
    if (pRetreat >= 0.05) {
      const prevP = options.currentPage - step;
      if (prevP >= 1) {
        candidates.push({
          chapterId: options.currentChapterId,
          pageNumber: prevP,
          action: 'RETREAT',
          probability: pRetreat,
          score: Math.round(pRetreat * 1000) / 1000,
          targetWidth: options.targetWidth,
        });
      } else if (options.prevChapterId) {
        // Retreat to previous chapter end
        candidates.push({
          chapterId: options.prevChapterId,
          pageNumber: 1, // Default fallback to page 1 of previous chapter
          action: 'RETREAT',
          probability: pRetreat * 0.5,
          score: Math.round(pRetreat * 0.5 * 1000) / 1000,
          targetWidth: options.targetWidth,
        });
      }
    }

    // Sort by score descending and clamp to max depth
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, depth + 1);
  }
}
