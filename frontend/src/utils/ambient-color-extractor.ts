export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface AmbientExtractionResult {
  rgb: RGBColor;
  hex: string;
  rgbaString: (alpha: number) => string;
  isMonochrome: boolean;
  deltaE?: number;
}

export const DEFAULT_AMBIENT_RGB: RGBColor = { r: 8, g: 12, b: 20 }; // #080c14 Deep Void
export const HYSTERESIS_THRESHOLD_DELTA_E = 18;

/**
 * Calculates Euclidean chromatic distance (Delta-E approx in RGB space)
 */
export function calculateDeltaE(c1: RGBColor, c2: RGBColor): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Converts RGB tuple to 6-char hex string (#RRGGBB)
 */
export function rgbToHex(rgb: RGBColor): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * Determines if ambient calculations should be bypassed to protect CPU/GPU
 * on low-resource hardware like Intel Pentium T4500 and Intel GMA 4500MHD.
 */
export function shouldBypassAmbilight(
  thermalSaverEnabled = false,
  batterySaverEnabled = false,
  isSaveData = false
): boolean {
  return thermalSaverEnabled || batterySaverEnabled || isSaveData;
}

// Reusable canvas to prevent GC pressure in V8 (Intel Pentium T4500 optimization)
let reusableCanvas: HTMLCanvasElement | null = null;
let reusableCtx: CanvasRenderingContext2D | null = null;

export function _setSamplingContextForTest(ctx: CanvasRenderingContext2D | null): void {
  reusableCtx = ctx;
}

function getSamplingContext(): CanvasRenderingContext2D | null {
  if (reusableCtx) return reusableCtx;
  if (typeof document === 'undefined') return null;
  if (!reusableCanvas) {
    reusableCanvas = document.createElement('canvas');
    reusableCanvas.width = 16;
    reusableCanvas.height = 16;
    reusableCtx = reusableCanvas.getContext('2d', { willReadFrequently: true });
    if (reusableCtx) {
      reusableCtx.imageSmoothingEnabled = false;
    }
  }
  return reusableCtx;
}

/**
 * Extracts the dominant perimeter ambient glow color from a page image.
 * Designed specifically for Intel GMA 4500MHD:
 * - 16x16 nearest-neighbor downsampling (< 0.4ms)
 * - Perimeter border pixel averaging (ignores center artwork)
 * - White/Black gutter filtering
 * - Chromatic hysteresis (Delta-E < 18 reuses previous color)
 */
export function extractAmbientColor(
  source: HTMLImageElement | HTMLCanvasElement,
  previousColor: RGBColor | null = null
): AmbientExtractionResult {
  const defaultResult: AmbientExtractionResult = {
    rgb: DEFAULT_AMBIENT_RGB,
    hex: rgbToHex(DEFAULT_AMBIENT_RGB),
    rgbaString: (alpha: number) => `rgba(${DEFAULT_AMBIENT_RGB.r}, ${DEFAULT_AMBIENT_RGB.g}, ${DEFAULT_AMBIENT_RGB.b}, ${alpha})`,
    isMonochrome: true,
  };

  const ctx = getSamplingContext();
  if (!ctx) return defaultResult;

  try {
    const width = (source as any).naturalWidth || source.width || 0;
    const height = (source as any).naturalHeight || source.height || 0;
    if (width === 0 || height === 0) return defaultResult;

    // Draw scaled 16x16 thumbnail
    ctx.clearRect(0, 0, 16, 16);
    ctx.drawImage(source, 0, 0, 16, 16);

    const imgData = ctx.getImageData(0, 0, 16, 16).data;
    if (!imgData || imgData.length === 0) return defaultResult;

    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let validSampleCount = 0;

    let monochromeExtremeCount = 0;
    let totalPerimeterPixels = 0;

    // Sample perimeter: Top (y=0), Bottom (y=15), Left (x=0), Right (x=15)
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const isPerimeter = y === 0 || y === 15 || x === 0 || x === 15;
        if (!isPerimeter) continue;

        totalPerimeterPixels++;
        const idx = (y * 16 + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const a = imgData[idx + 3];

        if (a < 128) continue; // Skip transparent borders

        // Detect manga white gutter (>240) or black frame (<15)
        const isExtremeWhite = r > 240 && g > 240 && b > 240;
        const isExtremeBlack = r < 15 && g < 15 && b < 15;

        if (isExtremeWhite || isExtremeBlack) {
          monochromeExtremeCount++;
          continue; // Filter gutter border to extract actual ambient tone
        }

        sumR += r;
        sumG += g;
        sumB += b;
        validSampleCount++;
      }
    }

    // If page is mostly black/white (e.g. text/credits page), fall back to soft deep ambient
    const isMostlyMonochrome = monochromeExtremeCount > totalPerimeterPixels * 0.75;
    if (validSampleCount === 0 || isMostlyMonochrome) {
      return defaultResult;
    }

    const rawR = Math.round(sumR / validSampleCount);
    const rawG = Math.round(sumG / validSampleCount);
    const rawB = Math.round(sumB / validSampleCount);

    // Clamp saturation/brightness so it doesn't wash out or blind the reader
    const avg = (rawR + rawG + rawB) / 3;
    const clampedR = Math.round(Math.min(210, Math.max(16, rawR * 0.85 + avg * 0.15)));
    const clampedG = Math.round(Math.min(210, Math.max(16, rawG * 0.85 + avg * 0.15)));
    const clampedB = Math.round(Math.min(210, Math.max(16, rawB * 0.85 + avg * 0.15)));

    const candidateRGB: RGBColor = { r: clampedR, g: clampedG, b: clampedB };

    // Apply Chromatic Hysteresis
    if (previousColor) {
      const deltaE = calculateDeltaE(candidateRGB, previousColor);
      if (deltaE < HYSTERESIS_THRESHOLD_DELTA_E) {
        return {
          rgb: previousColor,
          hex: rgbToHex(previousColor),
          rgbaString: (alpha: number) => `rgba(${previousColor.r}, ${previousColor.g}, ${previousColor.b}, ${alpha})`,
          isMonochrome: false,
          deltaE,
        };
      }
    }

    return {
      rgb: candidateRGB,
      hex: rgbToHex(candidateRGB),
      rgbaString: (alpha: number) => `rgba(${candidateRGB.r}, ${candidateRGB.g}, ${candidateRGB.b}, ${alpha})`,
      isMonochrome: false,
    };
  } catch {
    // If canvas is tainted or any error occurs, fall back cleanly
    return defaultResult;
  }
}
