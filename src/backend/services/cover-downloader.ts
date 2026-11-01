import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';
import { getStorageConfig } from '../config/storage-config.js';

export interface DownloadCoverOptions {
  storageRoot?: string;
  maxWidth?: number; // default 480
  quality?: number; // default 80
  fetcher?: typeof fetch;
  seriesTitle?: string;
  fallbackMode?: 'keep_external' | 'svg';
}

export interface CoverResult {
  success: boolean;
  coverUrl: string;
  localPath: string | null;
  source: 'downloaded' | 'external' | 'svg_fallback';
  width?: number;
  height?: number;
  fileSizeBytes?: number;
}

export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

export function generateMonogramSvg(seriesTitle?: string): string {
  const title = seriesTitle ? seriesTitle.trim() : 'KuraScroll';
  const displayTitle = title.length > 28 ? title.slice(0, 25) + '...' : title;
  const escaped = escapeXml(displayTitle);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 680" width="480" height="680">
  <defs>
    <linearGradient id="ks-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#18181b" />
      <stop offset="50%" stop-color="#111113" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="ks-accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
    <radialGradient id="ks-glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#18181b" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#ks-bg)" rx="12" />
  <rect width="100%" height="100%" fill="url(#ks-glow)" rx="12" />
  <rect x="16" y="16" width="448" height="648" fill="none" stroke="#27272a" stroke-width="2" rx="8" />
  <circle cx="240" cy="270" r="105" fill="none" stroke="url(#ks-accent)" stroke-width="3" stroke-dasharray="10 6" opacity="0.8" />
  <circle cx="240" cy="270" r="88" fill="#1c1917" opacity="0.5" />
  <text x="240" y="302" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="90" font-weight="900" fill="url(#ks-accent)" text-anchor="middle" letter-spacing="4">KS</text>
  <text x="240" y="420" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="700" fill="#a1a1aa" text-anchor="middle" letter-spacing="8">KURASCROLL</text>
  <line x1="160" y1="445" x2="320" y2="445" stroke="#3f3f46" stroke-width="1.5" />
  <text x="240" y="520" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="22" font-weight="600" fill="#e4e4e7" text-anchor="middle">${escaped}</text>
  <text x="240" y="555" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="400" fill="#71717a" text-anchor="middle">OFFLINE COVER PLACEHOLDER</text>
</svg>`;
}

export async function saveMonogramSvg(
  seriesId: string,
  storageRoot: string,
  seriesTitle?: string
): Promise<{ localPath: string; coverUrl: string }> {
  const coversDir = path.join(storageRoot, 'covers');
  await fs.mkdir(coversDir, { recursive: true });

  const safeId = seriesId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const targetSvgPath = path.join(coversDir, `${safeId}.svg`);
  const svg = generateMonogramSvg(seriesTitle || seriesId);

  await fs.writeFile(targetSvgPath, svg, 'utf-8');

  return {
    localPath: targetSvgPath,
    coverUrl: `/storage/covers/${safeId}.svg`,
  };
}

export class CoverDownloader {
  private storageRoot: string;
  private maxWidth: number;
  private quality: number;
  private fetcher: typeof fetch;

  constructor(options: DownloadCoverOptions = {}) {
    this.storageRoot = options.storageRoot || getStorageConfig().storageRoot;
    this.maxWidth = options.maxWidth ?? 480;
    this.quality = options.quality ?? 80;
    this.fetcher = options.fetcher ?? fetch;
  }

  async download(
    seriesId: string,
    coverUrl?: string | null,
    options: Partial<DownloadCoverOptions> = {}
  ): Promise<CoverResult> {
    const storageRoot = options.storageRoot || this.storageRoot;
    const maxWidth = options.maxWidth ?? this.maxWidth;
    const quality = options.quality ?? this.quality;
    const fetcher = options.fetcher ?? this.fetcher;
    const fallbackMode = options.fallbackMode ?? (coverUrl ? 'keep_external' : 'svg');
    const seriesTitle = options.seriesTitle;

    const safeId = seriesId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const coversDir = path.join(storageRoot, 'covers');
    const targetWebpPath = path.join(coversDir, `${safeId}.webp`);

    if (coverUrl && coverUrl.trim().startsWith('http')) {
      try {
        const res = await fetcher(coverUrl.trim(), {
          headers: {
            'User-Agent': 'KuraScroll/1.0.0 (https://github.com/carlos/kura-scroll)',
            Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          },
        });

        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);

          let pipeline = sharp(buffer).rotate();
          const meta = await pipeline.metadata();
          const originalWidth = meta.width ?? maxWidth;

          if (originalWidth > maxWidth) {
            pipeline = pipeline.resize({
              width: maxWidth,
              withoutEnlargement: true,
              fit: 'inside',
            });
          }

          pipeline = pipeline.webp({
            quality,
            effort: 4,
          });

          await fs.mkdir(coversDir, { recursive: true });
          const outputInfo = await pipeline.toFile(targetWebpPath);

          return {
            success: true,
            coverUrl: `/storage/covers/${safeId}.webp`,
            localPath: targetWebpPath,
            source: 'downloaded',
            width: outputInfo.width,
            height: outputInfo.height,
            fileSizeBytes: outputInfo.size,
          };
        }
      } catch {
        // Download failed (e.g. offline, timeout, network error)
      }
    }

    // Handle failure / offline fallback
    if (fallbackMode === 'svg' || !coverUrl || !coverUrl.trim()) {
      const svgFallback = await saveMonogramSvg(safeId, storageRoot, seriesTitle);
      return {
        success: false,
        coverUrl: svgFallback.coverUrl,
        localPath: svgFallback.localPath,
        source: 'svg_fallback',
      };
    }

    // Default keep external URL when offline
    return {
      success: false,
      coverUrl: coverUrl.trim(),
      localPath: null,
      source: 'external',
    };
  }
}

export async function downloadCover(
  seriesId: string,
  coverUrl?: string | null,
  options: DownloadCoverOptions = {}
): Promise<CoverResult> {
  const downloader = new CoverDownloader(options);
  return downloader.download(seriesId, coverUrl, options);
}
