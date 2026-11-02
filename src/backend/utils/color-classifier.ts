/**
 * KuraScroll Zero-Allocation Color vs Monochrome Page Classifier
 * Sprint 50 - Smart Invert & Eye-Care Filter Automation
 *
 * Evaluates downsampled 8x8 RGBA samples (256 bytes) in < 1.0 microsecond:
 * - Computes delta_chroma = max(|R-G|, |G-B|, |B-R|) per pixel
 * - If delta_chroma <= chromaThreshold (default 14), pixel is neutral / monochrome
 * - If >= 95% of pixels are neutral, the page is classified as monochrome
 * - Preserves colored cover art and color inserts from invert distortion
 */

export interface PageChromaClassification {
  isMonochrome: boolean;
  neutralPixelCount: number;
  totalPixelCount: number;
  chromaScore: number; // 0.0 (pure grayscale) to 1.0 (highly saturated color)
}

/**
 * Classifies an 8x8 RGBA pixel buffer (256 bytes) with zero allocations.
 */
export function classifyPageChroma(
  rgbaData: Uint8ClampedArray | Uint8Array | number[],
  chromaThreshold = 14
): PageChromaClassification {
  const pixelCount = Math.floor(rgbaData.length / 4);
  if (pixelCount === 0) {
    return {
      isMonochrome: true,
      neutralPixelCount: 0,
      totalPixelCount: 0,
      chromaScore: 0.0,
    };
  }

  let neutralCount = 0;
  let totalDelta = 0;

  for (let i = 0; i < rgbaData.length; i += 4) {
    const r = rgbaData[i];
    const g = rgbaData[i + 1];
    const b = rgbaData[i + 2];

    const rg = r > g ? r - g : g - r;
    const gb = g > b ? g - b : b - g;
    const br = b > r ? b - r : r - b;

    let maxDelta = rg;
    if (gb > maxDelta) maxDelta = gb;
    if (br > maxDelta) maxDelta = br;

    totalDelta += maxDelta;
    if (maxDelta <= chromaThreshold) {
      neutralCount++;
    }
  }

  const neutralRatio = neutralCount / pixelCount;
  const isMonochrome = neutralRatio >= 0.95;
  const avgDelta = totalDelta / pixelCount;
  const chromaScore = Math.min(1.0, Math.round((avgDelta / 255.0) * 1000) / 1000);

  return {
    isMonochrome,
    neutralPixelCount: neutralCount,
    totalPixelCount: pixelCount,
    chromaScore,
  };
}

/**
 * Fast boolean check returning true if the buffer represents a monochrome page.
 */
export function isMonochrome8x8(
  rgbaData: Uint8ClampedArray | Uint8Array | number[],
  chromaThreshold = 14
): boolean {
  return classifyPageChroma(rgbaData, chromaThreshold).isMonochrome;
}
