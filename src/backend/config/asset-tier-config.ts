import { IOPriority } from '../storage/io/io-priority.js';

export type AssetTier = 'low' | 'balanced' | 'high';

export interface AssetTierSettings {
  tier: AssetTier;
  quality: number;
  maxWidth: number;
  cacheControl: string;
}

export const ASSET_TIER_CONFIG: Record<AssetTier, AssetTierSettings> = {
  low: {
    tier: 'low',
    quality: 68,
    maxWidth: 1080,
    cacheControl: 'public, max-age=31536000, immutable',
  },
  balanced: {
    tier: 'balanced',
    quality: 75,
    maxWidth: 1280,
    cacheControl: 'public, max-age=31536000, immutable',
  },
  high: {
    tier: 'high',
    quality: 82,
    maxWidth: 1440,
    cacheControl: 'public, max-age=31536000, immutable',
  },
};

/**
 * Resolves the appropriate asset tier based on request headers and query parameters.
 * Respects Save-Data: on, ?tier=low|balanced|high, and viewport hints.
 */
export function resolveAssetTier(
  headers: Record<string, string | string[] | undefined>,
  query?: Record<string, any>
): AssetTier {
  if (query?.tier && (query.tier === 'low' || query.tier === 'balanced' || query.tier === 'high')) {
    return query.tier as AssetTier;
  }

  const saveDataHeader = headers['save-data'];
  const isSaveData =
    saveDataHeader === 'on' ||
    query?.saveData === '1' ||
    query?.saveData === 'true';

  if (isSaveData) {
    return 'low';
  }

  const viewportWidth = headers['sec-ch-viewport-width'];
  if (viewportWidth) {
    const parsedWidth = typeof viewportWidth === 'string' ? parseInt(viewportWidth, 10) : NaN;
    if (!isNaN(parsedWidth)) {
      if (parsedWidth <= 768) return 'low';
      if (parsedWidth <= 1280) return 'balanced';
    }
  }

  return 'high';
}

/**
 * Resolves the I/O Priority for disk operations.
 * Speculative prefetch requests run as NORMAL priority (yielding to CRITICAL interactive reads via PauseGate).
 */
export function resolveIOPriority(
  headers: Record<string, string | string[] | undefined>,
  query?: Record<string, any>
): IOPriority {
  const purposeHeader = headers['x-purpose'] || headers['purpose'];
  const isPrefetch =
    purposeHeader === 'prefetch' ||
    purposeHeader === 'preview' ||
    query?.prefetch === '1' ||
    query?.prefetch === 'true';

  return isPrefetch ? IOPriority.NORMAL : IOPriority.CRITICAL;
}
