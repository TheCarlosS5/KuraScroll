import fs from 'node:fs';
import path from 'node:path';
import { DatabaseInstance } from '../db/database.js';
import { imageCache, manifestCache } from '../cache/media-cache.js';

export interface StorageCategoryBreakdown {
  type: string;
  seriesCount: number;
  chapterCount: number;
  estimatedBytes: number;
}

export interface StorageTelemetryReport {
  storageRoot: string;
  totalWebpSizeBytes: number;
  estimatedRawScanSizeBytes: number;
  savedBytes: number;
  savingsPercentage: number;
  totalSeries: number;
  totalChapters: number;
  totalPages: number;
  avgBytesPerChapter: number;
  avgPagesPerChapter: number;
  projected4TBCapacityChapters: number;
  hdd4TBUsedPercentage: number;
  categories: StorageCategoryBreakdown[];
  memoryCache: {
    imagesUsedBytes: number;
    imagesMaxBytes: number;
    manifestsUsedBytes: number;
    manifestsMaxBytes: number;
  };
  generatedAt: string;
}

/**
 * Calculates disk usage and compression efficiency across the KuraScroll 4TB HDD repository.
 */
export async function calculateStorageTelemetry(
  db: DatabaseInstance,
  storageRoot: string
): Promise<StorageTelemetryReport> {
  const resolvedRoot = path.resolve(storageRoot);
  const seriesDir = path.join(resolvedRoot, 'series');

  // Query aggregated metrics from SQLite
  const seriesRows = db.prepare('SELECT id, type FROM series;').all() as Array<{ id: string; type: string }>;
  const chapterRow = db.prepare('SELECT COUNT(*) as count FROM chapters;').get() as { count: number } | undefined;
  const pageRow = db.prepare('SELECT COUNT(*) as count FROM chapter_pages;').get() as { count: number } | undefined;

  const totalSeries = seriesRows.length;
  const totalChapters = chapterRow?.count ?? 0;
  const totalPages = pageRow?.count ?? 0;

  // Walk series directory to compute physical disk usage
  let totalWebpSizeBytes = 0;
  if (fs.existsSync(seriesDir)) {
    try {
      const walkDir = async (dir: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.webp') || entry.name.endsWith('.json'))) {
            try {
              const stat = await fs.promises.stat(fullPath);
              totalWebpSizeBytes += stat.size;
            } catch {}
          }
        }
      };
      await walkDir(seriesDir);
    } catch {}
  }

  // Fallback estimation if directory is empty (e.g. in test fixtures or fresh installation)
  if (totalWebpSizeBytes === 0 && totalPages > 0) {
    // Average 1440px WebP page is ~180KB
    totalWebpSizeBytes = totalPages * 180 * 1024;
  }

  // Savings calculation: WebP q=82 is ~15% of original uncompressed PNG/high-res JPEG scans
  const estimatedRawScanSizeBytes = totalWebpSizeBytes > 0 ? Math.round(totalWebpSizeBytes / 0.15) : 0;
  const savedBytes = Math.max(0, estimatedRawScanSizeBytes - totalWebpSizeBytes);
  const savingsPercentage = estimatedRawScanSizeBytes > 0 ? (savedBytes / estimatedRawScanSizeBytes) * 100 : 85.0;

  // Averages
  const avgBytesPerChapter = totalChapters > 0 ? Math.round(totalWebpSizeBytes / totalChapters) : 0;
  const avgPagesPerChapter = totalChapters > 0 ? Math.round(totalPages / totalChapters) : 0;

  // 4TB HDD physics projection (4,000,000,000,000 bytes = 4TB)
  const HDD_4TB_BYTES = 4_000_000_000_000;
  const projected4TBCapacityChapters = avgBytesPerChapter > 0 ? Math.floor(HDD_4TB_BYTES / avgBytesPerChapter) : 220000;
  const hdd4TBUsedPercentage = (totalWebpSizeBytes / HDD_4TB_BYTES) * 100;

  // Category breakdown
  const categoryCounts = new Map<string, { series: number; chapters: number }>();
  for (const s of seriesRows) {
    const type = s.type || 'manga';
    const existing = categoryCounts.get(type) || { series: 0, chapters: 0 };
    existing.series++;
    categoryCounts.set(type, existing);
  }

  const chapterTypeRows = db.prepare(`
    SELECT s.type, COUNT(c.id) as chapterCount
    FROM chapters c
    JOIN series s ON c.series_id = s.id
    GROUP BY s.type;
  `).all() as Array<{ type: string; chapterCount: number }>;

  for (const row of chapterTypeRows) {
    const existing = categoryCounts.get(row.type) || { series: 0, chapters: 0 };
    existing.chapters = row.chapterCount;
    categoryCounts.set(row.type, existing);
  }

  const categories: StorageCategoryBreakdown[] = Array.from(categoryCounts.entries()).map(([type, counts]) => ({
    type,
    seriesCount: counts.series,
    chapterCount: counts.chapters,
    estimatedBytes: totalChapters > 0 ? Math.round((counts.chapters / totalChapters) * totalWebpSizeBytes) : 0,
  }));

  return {
    storageRoot: resolvedRoot,
    totalWebpSizeBytes,
    estimatedRawScanSizeBytes,
    savedBytes,
    savingsPercentage: Number(savingsPercentage.toFixed(1)),
    totalSeries,
    totalChapters,
    totalPages,
    avgBytesPerChapter,
    avgPagesPerChapter,
    projected4TBCapacityChapters,
    hdd4TBUsedPercentage: Number(hdd4TBUsedPercentage.toFixed(4)),
    categories,
    memoryCache: {
      imagesUsedBytes: imageCache.size,
      imagesMaxBytes: 256 * 1024 * 1024,
      manifestsUsedBytes: manifestCache.size,
      manifestsMaxBytes: 32 * 1024 * 1024,
    },
    generatedAt: new Date().toISOString(),
  };
}
