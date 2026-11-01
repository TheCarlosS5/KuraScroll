import path from 'node:path';
import fs from 'node:fs/promises';
import pLimit from 'p-limit';
import { extractArchive } from './archive-extractor.js';
import { optimizeImageToWebP, PageMetadata } from './image-processor.js';
import { naturalSort } from '../utils/natural-sort.js';

export interface IngestChapterParams {
  storageRoot: string;
  seriesSlug: string;
  volumeNumber?: number;
  chapterNumber: number;
  sourcePath: string;
  isArchive?: boolean;
  maxImageWidth?: number;
  webpQuality?: number;
}

export interface ChapterIngestResult {
  relativeStorageDir: string;
  absoluteStorageDir: string;
  pageCount: number;
  pages: PageMetadata[];
  totalBytes: number;
}

const VALID_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);

export async function ingestChapter(params: IngestChapterParams): Promise<ChapterIngestResult> {
  const vol = params.volumeNumber ?? 1;
  const chap = params.chapterNumber;
  const relDir = path.join('series', params.seriesSlug, `v${vol}`, `c${chap}`);
  const targetDir = path.resolve(params.storageRoot, relDir);

  await fs.mkdir(targetDir, { recursive: true });

  const ext = path.extname(params.sourcePath).toLowerCase();
  const isArchive = params.isArchive ?? (ext === '.zip' || ext === '.cbz');

  let imageFiles: string[] = [];
  let cleanupTempDir: string | null = null;

  try {
    if (isArchive) {
      const tempExtractDir = path.resolve(params.storageRoot, '.tmp', `extract-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      cleanupTempDir = tempExtractDir;
      imageFiles = await extractArchive(params.sourcePath, tempExtractDir);
    } else {
      const dirEntries = await fs.readdir(params.sourcePath);
      const validNames = dirEntries.filter((file) => VALID_IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()));
      const sorted = naturalSort(validNames);
      imageFiles = sorted.map((name) => path.join(params.sourcePath, name));
    }

    if (imageFiles.length === 0) {
      throw new Error(`No valid images found in chapter source: ${params.sourcePath}`);
    }

    const limit = pLimit(4);
    const pages: PageMetadata[] = new Array(imageFiles.length);

    await Promise.all(
      imageFiles.map((inputPath, idx) =>
        limit(async () => {
          const pageNumber = idx + 1;
          const paddedName = `${String(pageNumber).padStart(3, '0')}.webp`;
          const outputPath = path.join(targetDir, paddedName);

          const meta = await optimizeImageToWebP(inputPath, outputPath, {
            pageNumber,
            maxImageWidth: params.maxImageWidth,
            webpQuality: params.webpQuality,
          });

          pages[idx] = meta;
        })
      )
    );

    const totalBytes = pages.reduce((sum, p) => sum + p.fileSizeBytes, 0);

    const manifest = {
      seriesSlug: params.seriesSlug,
      volumeNumber: vol,
      chapterNumber: chap,
      pageCount: pages.length,
      totalBytes,
      pages,
      createdAt: new Date().toISOString(),
    };

    await fs.writeFile(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    return {
      relativeStorageDir: relDir,
      absoluteStorageDir: targetDir,
      pageCount: pages.length,
      pages,
      totalBytes,
    };
  } finally {
    if (cleanupTempDir) {
      try {
        await fs.rm(cleanupTempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup error
      }
    }
  }
}

import { ingestVolumeArchive } from './volume-extractor.js';
export { ingestVolumeArchive };

export const ChapterIngestionService = {
  ingestChapter,
  ingestVolumeArchive,
};

