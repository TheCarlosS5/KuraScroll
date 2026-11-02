import { describe, it, expect } from 'vitest';
import {
  quantizeFloat32ToInt8,
  dequantizeInt8ToFloat32,
  dotProductInt8,
  cosineSimilarityQuantized,
  reciprocalRankFusion
} from '../../../src/backend/utils/vector-quantizer.js';

describe('Vector Quantizer & Fast Int8 Similarity Utilities (Sprint 47)', () => {
  it('quantizes Float32Array to Int8Array with high fidelity (> 0.998 cosine similarity)', () => {
    const original = new Float32Array(384);
    for (let i = 0; i < 384; i++) {
      original[i] = Math.sin(i * 0.1) * (i % 5 === 0 ? 2.5 : 0.8);
    }

    const { int8Array, scaleFactor, magnitude } = quantizeFloat32ToInt8(original);

    expect(int8Array.length).toBe(384);
    expect(scaleFactor).toBeGreaterThan(0);
    expect(magnitude).toBeGreaterThan(0);

    const reconstructed = dequantizeInt8ToFloat32(int8Array, scaleFactor);

    // Compute float32 cosine between original and reconstructed
    let dot = 0;
    let magRec = 0;
    let magOrig = 0;
    for (let i = 0; i < 384; i++) {
      dot += original[i] * reconstructed[i];
      magOrig += original[i] * original[i];
      magRec += reconstructed[i] * reconstructed[i];
    }
    const cosine = dot / (Math.sqrt(magOrig) * Math.sqrt(magRec));

    expect(cosine).toBeGreaterThan(0.998); // High fidelity retention
  });

  it('rejects vector dimension mismatch and NaN inputs', () => {
    const wrongDim = new Float32Array(128);
    expect(() => quantizeFloat32ToInt8(wrongDim)).toThrow('Vector dimension mismatch');

    const nanVec = new Float32Array(384);
    nanVec[10] = NaN;
    expect(() => quantizeFloat32ToInt8(nanVec)).toThrow('invalid element');
  });

  it('computes exact integer dot product with 8x unrolling', () => {
    const a = new Int8Array(384);
    const b = new Int8Array(384);

    for (let i = 0; i < 384; i++) {
      a[i] = (i % 20) - 10;
      b[i] = 2;
    }

    let expected = 0;
    for (let i = 0; i < 384; i++) {
      expected += a[i] * b[i];
    }

    const actual = dotProductInt8(a, b);
    expect(actual).toBe(expected);
  });

  it('calculates quantized cosine similarity accurately', () => {
    const vecA = new Float32Array(384);
    const vecB = new Float32Array(384);
    const vecOrthogonal = new Float32Array(384);

    for (let i = 0; i < 384; i++) {
      vecA[i] = Math.cos(i);
      vecB[i] = Math.cos(i); // Identical
      vecOrthogonal[i] = i % 2 === 0 ? 1 : -1;
    }

    const qA = quantizeFloat32ToInt8(vecA);
    const qB = quantizeFloat32ToInt8(vecB);
    const qOrth = quantizeFloat32ToInt8(vecOrthogonal);

    const simSelf = cosineSimilarityQuantized(
      qA.int8Array, qA.magnitude, qA.scaleFactor,
      qB.int8Array, qB.magnitude, qB.scaleFactor
    );
    expect(simSelf).toBeCloseTo(1.0, 2);

    const simOrth = cosineSimilarityQuantized(
      qA.int8Array, qA.magnitude, qA.scaleFactor,
      qOrth.int8Array, qOrth.magnitude, qOrth.scaleFactor
    );
    expect(Math.abs(simOrth)).toBeLessThan(0.1);
  });

  it('executes Reciprocal Rank Fusion (RRF, k=60) with double-ranking boost', () => {
    const lexical = ['series-a', 'series-b', 'series-c'];
    const semantic = [
      { id: 'series-b', similarity: 0.94 },
      { id: 'series-a', similarity: 0.88 },
      { id: 'series-d', similarity: 0.85 }
    ];

    const fused = reciprocalRankFusion(lexical, semantic, { k: 60 });

    // series-a is #1 in lexical, #2 in semantic
    // series-b is #2 in lexical, #1 in semantic
    // Both have dual hits and should be on top
    expect(fused.length).toBe(4);

    const itemA = fused.find((i) => i.id === 'series-a')!;
    const itemB = fused.find((i) => i.id === 'series-b')!;
    const itemC = fused.find((i) => i.id === 'series-c')!;
    const itemD = fused.find((i) => i.id === 'series-d')!;

    // Score for item A: 1/(60+1) + 1/(60+2) = 1/61 + 1/62 = 0.016393 + 0.016129 = ~0.032522
    expect(itemA.rrfScore).toBeCloseTo(0.032522, 5);
    expect(itemA.lexicalRank).toBe(1);
    expect(itemA.semanticRank).toBe(2);

    // Single hit item C: 1/(60+3) = 1/63 = ~0.015873
    expect(itemC.rrfScore).toBeCloseTo(0.015873, 5);
    expect(itemC.lexicalRank).toBe(3);
    expect(itemC.semanticRank).toBeUndefined();

    // Dual hit items rank above single hit items
    expect(fused[0].id).toBe('series-a');
    expect(fused[1].id).toBe('series-b');
  });
});
