import AdmZip from 'adm-zip';
import path from 'node:path';
import fs from 'node:fs/promises';
import pLimit from 'p-limit';
import sharp from 'sharp';
import { optimizeImageToWebP, PageMetadata } from './image-processor.js';
import { naturalSort } from '../utils/natural-sort.js';
import { isPathSafe } from './archive-extractor.js';
import { DatabaseInstance } from '../db/database.js';
import { ChapterRepository } from '../repositories/chapter-repository.js';
import { AdaptiveIngestionController } from './adaptive-ingestion-controller.js';

// Disable Sharp cache on Windows to prevent file locking
sharp.cache(false);

const VALID_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);

export interface IngestVolumeParams {
  storageRoot: string;
  seriesSlug: string;
  volumeNumber?: number;
  sourcePath: string;
  maxImageWidth?: number;
  webpQuality?: number;
  db?: DatabaseInstance;
  adaptiveController?: AdaptiveIngestionController;
  thermalSaver?: boolean;
}

export interface VolumeChapterResult {
  chapterNumber: number;
  title: string;
  pageCount: number;
  skippedPagesCount: number;
  storagePath: string;
  pages: PageMetadata[];
  warnings: string[];
}

export interface VolumeIngestResult {
  seriesSlug: string;
  volumeNumber: number;
  totalChapters: number;
  totalValidPages: number;
  totalSkippedPages: number;
  chapters: VolumeChapterResult[];
  warnings: string[];
}

/**
 * Normalizes a chapter folder name or prefix into a numeric chapter number.
 * Supports:
 * - "CHAPTER 1", "chapter 02", "Ch.03", "Capitulo 4", "c05", "Vol. 1 - Ch. 6"
 */
export function normalizeChapterNumber(folderOrName: string): number | null {
  const clean = folderOrName.trim();

  // Explicit chapter match
  const match = clean.match(/(?:chapter|chap|ch|capitulo|c)[.\s_-]*([0-9]+(?:\.[0-9]+)?)/i);
  if (match) {
    const num = Number.parseFloat(match[1]);
    if (!Number.isNaN(num)) return num;
  }

  // Standalone number match (e.g. "01", "2")
  const numMatch = clean.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (numMatch) {
    const num = Number.parseFloat(numMatch[1]);
    if (!Number.isNaN(num)) return num;
  }

  // Any number inside folder name
  const allNums = Array.from(clean.matchAll(/([0-9]+(?:\.[0-9]+)?)/g));
  if (allNums.length > 0) {
    const lastNum = Number.parseFloat(allNums[allNums.length - 1][1]);
    if (!Number.isNaN(lastNum)) return lastNum;
  }

  return null;
}

/**
 * Checks if a zip entry is system noise or junk that should be ignored.
 */
export function isSystemJunkOrNoise(entryName: string): boolean {
  const normalized = entryName.replace(/\\/g, '/');

  // macOS system resource forks & metadata
  if (normalized.includes('__MACOSX/') || path.basename(normalized).startsWith('._')) {
    return true;
  }

  // OS desktop metadata
  const baseName = path.basename(normalized).toLowerCase();
  if (baseName === '.ds_store' || baseName === 'thumbs.db' || baseName === 'desktop.ini') {
    return true;
  }

  return false;
}

interface ChapterGroup {
  chapterNumber: number;
  folderName: string;
  entries: AdmZip.IZipEntry[];
}

/**
 * Detects chapters within a volume archive and groups entries by chapter.
 */
export function detectVolumeChapters(zip: AdmZip, destDir: string): { groups: ChapterGroup[]; warnings: string[] } {
  const entries = zip.getEntries();
  const warnings: string[] = [];
  const groupsMap = new Map<number, ChapterGroup>();

  for (const entry of entries) {
    if (entry.isDirectory) {
      continue;
    }

    const rawName = entry.entryName;

    // 1. Zip Slip Defense: reject any entry attempting traversal
    if (rawName.includes('..') || !isPathSafe(destDir, rawName)) {
      warnings.push(`Zip Slip attempt detected and blocked: "${rawName}"`);
      continue;
    }

    // 2. Filter system noise
    if (isSystemJunkOrNoise(rawName)) {
      continue;
    }

    // 3. Filter valid image extensions
    const ext = path.extname(rawName).toLowerCase();
    if (!VALID_IMAGE_EXTENSIONS.has(ext)) {
      continue;
    }

    // 4. Determine chapter group by subfolder or prefix
    const normalizedPath = rawName.replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(Boolean);

    let chapterNum: number | null = null;
    let folderLabel = 'Chapter';

    if (parts.length > 1) {
      // Subfolder organization: look at immediate parent or intermediate folders
      for (let i = 0; i < parts.length - 1; i++) {
        const parsed = normalizeChapterNumber(parts[i]);
        if (parsed !== null) {
          chapterNum = parsed;
          folderLabel = parts[i];
          break;
        }
      }
    }

    // Fallback: check filename prefix (e.g. c01_001.jpg)
    if (chapterNum === null) {
      const baseName = path.basename(normalizedPath);
      const prefixMatch = baseName.match(/^(?:c|ch|chapter)[._\s-]*([0-9]+(?:\.[0-9]+)?)/i);
      if (prefixMatch) {
        chapterNum = Number.parseFloat(prefixMatch[1]);
        folderLabel = `Chapter ${chapterNum}`;
      }
    }

    // Default fallback: single continuous chapter 1
    if (chapterNum === null) {
      chapterNum = 1;
      folderLabel = 'Chapter 1';
    }

    if (!groupsMap.has(chapterNum)) {
      groupsMap.set(chapterNum, {
        chapterNumber: chapterNum,
        folderName: folderLabel,
        entries: [],
      });
    }

    groupsMap.get(chapterNum)!.entries.push(entry);
  }

  // Sort chapters numerically in natural order
  const sortedChapterNumbers = Array.from(groupsMap.keys()).sort((a, b) => a - b);
  const groups: ChapterGroup[] = [];

  for (const num of sortedChapterNumbers) {
    const group = groupsMap.get(num)!;
    // Sort image entries naturally by base filename
    group.entries.sort((a, b) => {
      const nameA = path.basename(a.entryName);
      const nameB = path.basename(b.entryName);
      return naturalSort([nameA, nameB])[0] === nameA ? -1 : 1;
    });
    groups.push(group);
  }

  return { groups, warnings };
}

/**
 * Ingests a multi-chapter volume archive with fault tolerance and idempotence.
 */
export async function ingestVolumeArchive(params: IngestVolumeParams): Promise<VolumeIngestResult> {
  const vol = params.volumeNumber ?? 1;
  const tempExtractBase = path.resolve(
    params.storageRoot,
    '.tmp',
    `vol-extract-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  let zip: AdmZip;
  try {
    zip = new AdmZip(params.sourcePath);
  } catch (err: any) {
    throw new Error(`Failed to open volume archive '${path.basename(params.sourcePath)}': ${err.message}`);
  }

  const { groups, warnings: detectionWarnings } = detectVolumeChapters(zip, tempExtractBase);
  const allWarnings: string[] = [...detectionWarnings];

  if (groups.length === 0) {
    throw new Error(`No valid chapter images found in volume archive '${path.basename(params.sourcePath)}'`);
  }

  const chapterResults: VolumeChapterResult[] = [];
  const limit = pLimit(4);
  const chapterRepo = params.db ? new ChapterRepository(params.db) : null;

  for (const group of groups) {
    const chapNum = group.chapterNumber;
    const relDir = path.join('series', params.seriesSlug, `v${vol}`, `c${chapNum}`);
    const targetDir = path.resolve(params.storageRoot, relDir);

    await fs.mkdir(targetDir, { recursive: true });

    const validPages: PageMetadata[] = [];
    const chapterWarnings: string[] = [];
    let skippedCount = 0;

    // Process pages sequentially or with controlled concurrency
    for (let idx = 0; idx < group.entries.length; idx++) {
      const entry = group.entries[idx];
      let entryBuffer: Buffer;

      try {
        entryBuffer = entry.getData();
      } catch (err: any) {
        chapterWarnings.push(`Corrupt entry bytes in "${entry.entryName}": ${err.message}`);
        skippedCount++;
        continue;
      }

      // Check minimum buffer size for image headers
      if (!entryBuffer || entryBuffer.length < 16) {
        chapterWarnings.push(`Corrupt or empty image buffer in "${entry.entryName}"`);
        skippedCount++;
        continue;
      }

      const tentativePageNumber = validPages.length + 1;
      const paddedName = `${String(tentativePageNumber).padStart(3, '0')}.webp`;
      const outputPath = path.join(targetDir, paddedName);

      if (params.adaptiveController) {
        await params.adaptiveController.acquireYieldSlice();
      }

      try {
        const meta = await optimizeImageToWebP(entryBuffer, outputPath, {
          pageNumber: tentativePageNumber,
          maxImageWidth: params.maxImageWidth,
          webpQuality: params.webpQuality,
          thermalSaver: params.thermalSaver,
        });
        validPages.push(meta);
      } catch (err: any) {
        // Partial Corruption Handling: skip damaged image without failing the whole volume
        chapterWarnings.push(`Corrupt image data in "${entry.entryName}": ${err.message}`);
        skippedCount++;
      }
    }

    if (validPages.length === 0) {
      allWarnings.push(`Chapter ${chapNum} contained 0 valid decodable images; skipped`);
      continue;
    }

    // Write manifest for this chapter
    const totalBytes = validPages.reduce((sum, p) => sum + p.fileSizeBytes, 0);
    const manifest = {
      seriesSlug: params.seriesSlug,
      volumeNumber: vol,
      chapterNumber: chapNum,
      pageCount: validPages.length,
      skippedPages: skippedCount,
      totalBytes,
      pages: validPages,
      createdAt: new Date().toISOString(),
    };

    await fs.writeFile(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    // Idempotent Database Registration
    if (params.db && chapterRepo) {
      let seriesId = params.seriesSlug;
      const seriesRow = params.db
        .prepare('SELECT id FROM series WHERE slug = ? OR id = ?')
        .get(params.seriesSlug, params.seriesSlug) as { id: string } | undefined;
      if (seriesRow) {
        seriesId = seriesRow.id;
      }

      const chapterId = `${params.seriesSlug}-c${chapNum}`;

      // Clean up previous chapter and pages if re-ingesting (prevents UNIQUE constraint violation)
      params.db.prepare('DELETE FROM chapters WHERE id = ? OR (series_id = ? AND chapter_number = ?)').run(chapterId, seriesId, chapNum);

      chapterRepo.createChapter({
        id: chapterId,
        seriesId,
        volumeId: null,
        chapterNumber: chapNum,
        title: `Chapter ${chapNum}`,
        pageCount: validPages.length,
        storagePath: relDir,
      });

      chapterRepo.addPages(chapterId, validPages);
    }

    chapterResults.push({
      chapterNumber: chapNum,
      title: `Chapter ${chapNum}`,
      pageCount: validPages.length,
      skippedPagesCount: skippedCount,
      storagePath: relDir,
      pages: validPages,
      warnings: chapterWarnings,
    });

    allWarnings.push(...chapterWarnings);
  }

  const totalValidPages = chapterResults.reduce((sum, c) => sum + c.pageCount, 0);
  const totalSkippedPages = chapterResults.reduce((sum, c) => sum + c.skippedPagesCount, 0);

  return {
    seriesSlug: params.seriesSlug,
    volumeNumber: vol,
    totalChapters: chapterResults.length,
    totalValidPages,
    totalSkippedPages,
    chapters: chapterResults,
    warnings: allWarnings,
  };
}

export const VolumeIngestionService = {
  normalizeChapterNumber,
  isSystemJunkOrNoise,
  detectVolumeChapters,
  ingestVolumeArchive,
};
