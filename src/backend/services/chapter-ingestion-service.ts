import path from 'node:path';
import fs from 'node:fs/promises';
import pLimit from 'p-limit';
import { extractArchive } from './archive-extractor.js';
import { optimizeImageToWebP, PageMetadata } from './image-processor.js';
import { naturalSort } from '../utils/natural-sort.js';
import { getHardwareProfile } from '../config/hardware-profile.js';
import { AdaptiveIngestionController } from './adaptive-ingestion-controller.js';

export interface IngestChapterParams {
  storageRoot: string;
  seriesSlug: string;
  volumeNumber?: number;
  chapterNumber: number;
  sourcePath: string;
  isArchive?: boolean;
  maxImageWidth?: number;
  webpQuality?: number;
  concurrency?: number;
  adaptiveController?: AdaptiveIngestionController;
  thermalSaver?: boolean;
}

export interface ChapterIngestResult {
  relativeStorageDir: string;
  absoluteStorageDir: string;
  pageCount: number;
  pages: PageMetadata[];
  totalBytes: number;
}

const VALID_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);
const MAX_PAGE_COUNT = 5_000;
const MAX_PAGE_BYTES = 100 * 1024 * 1024;
const MAX_CHAPTER_INPUT_BYTES = 1024 * 1024 * 1024;

function isContainedBy(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export async function ingestChapter(params: IngestChapterParams): Promise<ChapterIngestResult> {
  const vol = params.volumeNumber ?? 1;
  const chap = params.chapterNumber;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/.test(params.seriesSlug) ||
      params.seriesSlug === '.' || params.seriesSlug === '..' ||
      !Number.isSafeInteger(vol) || vol < 0 || !Number.isSafeInteger(chap) || chap < 0) {
    throw new Error('Invalid series slug, volume number, or chapter number');
  }
  const relDir = path.join('series', params.seriesSlug, `v${vol}`, `c${chap}`);
  const storageRoot = path.resolve(params.storageRoot);
  const targetDir = path.resolve(storageRoot, relDir);
  const targetRelative = path.relative(storageRoot, targetDir);
  if (!targetRelative || targetRelative.startsWith('..') || path.isAbsolute(targetRelative)) {
    throw new Error('Resolved chapter path is outside storage root');
  }
  const tempRoot = path.join(storageRoot, '.tmp');
  await fs.mkdir(tempRoot, { recursive: true });
  const realStorageRoot = await fs.realpath(storageRoot);
  if (!isContainedBy(realStorageRoot, await fs.realpath(tempRoot))) {
    throw new Error('Temporary ingestion directory resolves outside storage root');
  }
  const stagingDir = await fs.mkdtemp(path.join(tempRoot, 'chapter-'));

  const ext = path.extname(params.sourcePath).toLowerCase();
  const isArchive = params.isArchive ?? (ext === '.zip' || ext === '.cbz');

  let imageFiles: string[] = [];
  let published = false;

  try {
    if (isArchive) {
      const tempExtractDir = path.join(stagingDir, 'extract');
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
    if (imageFiles.length > MAX_PAGE_COUNT) {
      throw new Error(`Chapter exceeds the ${MAX_PAGE_COUNT}-page limit`);
    }

    let inputBytes = 0;
    for (const imageFile of imageFiles) {
      const stat = await fs.lstat(imageFile);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_PAGE_BYTES) {
        throw new Error(`Chapter contains an invalid image file or a page larger than ${MAX_PAGE_BYTES} bytes`);
      }
      inputBytes += stat.size;
      if (inputBytes > MAX_CHAPTER_INPUT_BYTES) {
        throw new Error(`Chapter exceeds the ${MAX_CHAPTER_INPUT_BYTES}-byte total input limit`);
      }
    }

    const concurrency = params.concurrency ?? getHardwareProfile().sharpConcurrency;
    const limit = pLimit(concurrency);
    const pages: PageMetadata[] = new Array(imageFiles.length);

    await Promise.all(
      imageFiles.map((inputPath, idx) =>
        limit(async () => {
          if (params.adaptiveController) {
            await params.adaptiveController.acquireYieldSlice();
          }

          const pageNumber = idx + 1;
          const paddedName = `${String(pageNumber).padStart(3, '0')}.webp`;
          const outputPath = path.join(stagingDir, paddedName);

          const meta = await optimizeImageToWebP(inputPath, outputPath, {
            pageNumber,
            maxImageWidth: params.maxImageWidth,
            webpQuality: params.webpQuality,
            thermalSaver: params.thermalSaver,
          });

          pages[idx] = meta;
        })
      )
    );

    // Only publish optimized WebP pages; extracted source files are temporary.
    if (isArchive) {
      await fs.rm(path.join(stagingDir, 'extract'), { recursive: true, force: true });
    }

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

    await fs.writeFile(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    await fs.mkdir(path.dirname(targetDir), { recursive: true });
    if (!isContainedBy(realStorageRoot, await fs.realpath(path.dirname(targetDir)))) {
      throw new Error('Chapter destination resolves outside storage root');
    }
    try {
      await fs.rm(targetDir, { recursive: true, force: true });
    } catch {}
    await fs.rename(stagingDir, targetDir);
    published = true;

    return {
      relativeStorageDir: relDir,
      absoluteStorageDir: targetDir,
      pageCount: pages.length,
      pages,
      totalBytes,
    };
  } finally {
    if (!published) await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

import { ingestVolumeArchive } from './volume-extractor.js';
export { ingestVolumeArchive };

export const ChapterIngestionService = {
  ingestChapter,
  ingestVolumeArchive,
};

