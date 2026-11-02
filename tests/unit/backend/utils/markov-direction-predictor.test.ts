import { describe, it, expect } from 'vitest';
import {
  MarkovDirectionPredictor,
  TurnAction,
  CadenceBucket,
} from '../../../../src/backend/utils/markov-direction-predictor.js';

describe('MarkovDirectionPredictor (Sprint 59)', () => {
  it('classifies cadence buckets accurately based on dwell time and mode', () => {
    // Manga mode
    expect(MarkovDirectionPredictor.classifyCadence(1.5, 'manga')).toBe('FAST');
    expect(MarkovDirectionPredictor.classifyCadence(15.0, 'manga')).toBe('NORMAL');
    expect(MarkovDirectionPredictor.classifyCadence(45.0, 'manga')).toBe('SLOW');

    // Webtoon mode (faster pacing threshold)
    expect(MarkovDirectionPredictor.classifyCadence(6.0, 'webtoon')).toBe('FAST');
    expect(MarkovDirectionPredictor.classifyCadence(18.0, 'webtoon')).toBe('NORMAL');
    expect(MarkovDirectionPredictor.classifyCadence(30.0, 'webtoon')).toBe('SLOW');
  });

  it('infers actions from page deltas correctly', () => {
    expect(MarkovDirectionPredictor.inferAction(1, 2)).toBe('ADVANCE');
    expect(MarkovDirectionPredictor.inferAction(1, 3)).toBe('ADVANCE'); // Double spread advance
    expect(MarkovDirectionPredictor.inferAction(4, 3)).toBe('RETREAT');
    expect(MarkovDirectionPredictor.inferAction(4, 2)).toBe('RETREAT'); // Double spread retreat
    expect(MarkovDirectionPredictor.inferAction(1, 10)).toBe('JUMP');
    expect(MarkovDirectionPredictor.inferAction(10, 1)).toBe('JUMP');
  });

  it('performs zero-allocation probability prediction using provided Float32Array', () => {
    const predictor = new MarkovDirectionPredictor();
    const buffer = new Float32Array(3);

    const out = predictor.predict('NORMAL', buffer);
    expect(out).toBe(buffer); // Confirms in-place write
    expect(out[0]).toBeCloseTo(0.88, 2); // Advance
    expect(out[1]).toBeCloseTo(0.08, 2); // Retreat
    expect(out[2]).toBeCloseTo(0.04, 2); // Jump

    // Fast cadence priors
    const outFast = predictor.predict('FAST');
    expect(outFast[0]).toBeCloseTo(0.94, 2);
    expect(outFast[1]).toBeCloseTo(0.03, 2);
  });

  it('adapts Bayesian probability weights when transitions are recorded', () => {
    const predictor = new MarkovDirectionPredictor();
    const initialProb = predictor.getProbabilities('NORMAL');
    expect(initialProb.advance).toBeCloseTo(0.88, 2);

    // Simulate reader making multiple retreat actions
    for (let i = 0; i < 50; i++) {
      predictor.recordTransition('RETREAT', 'NORMAL');
    }

    const updatedProb = predictor.getProbabilities('NORMAL');
    expect(updatedProb.retreat).toBeGreaterThan(initialProb.retreat);
    expect(updatedProb.advance).toBeLessThan(initialProb.advance);
  });

  it('generates prioritized candidates within a single chapter', () => {
    const predictor = new MarkovDirectionPredictor();
    const candidates = predictor.predictCandidates({
      currentPage: 5,
      totalPages: 20,
      currentChapterId: 'chap-1',
      cadence: 'NORMAL',
      depth: 2,
    });

    expect(candidates.length).toBeGreaterThanOrEqual(2);
    // First candidate should be page 6 with ADVANCE
    expect(candidates[0].pageNumber).toBe(6);
    expect(candidates[0].action).toBe('ADVANCE');
    expect(candidates[0].chapterId).toBe('chap-1');

    // Second candidate should be page 7 with ADVANCE
    expect(candidates[1].pageNumber).toBe(7);
    expect(candidates[1].action).toBe('ADVANCE');
  });

  it('handles double-spread stepping', () => {
    const predictor = new MarkovDirectionPredictor();
    const candidates = predictor.predictCandidates({
      currentPage: 5,
      totalPages: 20,
      currentChapterId: 'chap-1',
      isDoubleSpread: true,
      cadence: 'NORMAL',
      depth: 2,
    });

    expect(candidates[0].pageNumber).toBe(7); // Jump by 2
  });

  it('predicts chapter boundary transition when nearing end of chapter', () => {
    const predictor = new MarkovDirectionPredictor();
    const candidates = predictor.predictCandidates({
      currentPage: 20,
      totalPages: 20,
      currentChapterId: 'chap-1',
      nextChapterId: 'chap-2',
      cadence: 'NORMAL',
      depth: 2,
    });

    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0].chapterId).toBe('chap-2');
    expect(candidates[0].pageNumber).toBe(1);
    expect(candidates[0].action).toBe('ADVANCE');
  });

  it('predicts retreat candidate when at non-first page', () => {
    const predictor = new MarkovDirectionPredictor();
    const candidates = predictor.predictCandidates({
      currentPage: 10,
      totalPages: 20,
      currentChapterId: 'chap-1',
      cadence: 'SLOW', // Slow cadence has retreat > 0.15
      depth: 3,
    });

    const retreatCandidate = candidates.find((c) => c.action === 'RETREAT');
    expect(retreatCandidate).toBeDefined();
    expect(retreatCandidate?.pageNumber).toBe(9);
  });
});
