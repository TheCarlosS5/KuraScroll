import AdmZip from 'adm-zip';
import path from 'node:path';
import fs from 'node:fs/promises';
import pLimit from 'p-limit';
import { naturalSort } from '../utils/natural-sort.js';
import { optimizeImageToWebP, PageMetadata } from './image-processor.js';
import { DatabaseInstance } from '../db/database.js';
import { SeriesRepository } from '../repositories/series-repository.js';
import { ChapterRepository } from '../repositories/chapter-repository.js';
import { assertArchiveFileSize, getValidatedEntryData, validateArchiveEntries } from './archive-extractor.js';

export interface DetectedChapter {
  chapterNumber: number;
  title?: string;
  entryNames: string[];
}

export interface ArchiveStructure {
  isVolume: boolean;
  chapters: DetectedChapter[];
}

export interface IngestVolumeArchiveParams {
  storageRoot: string;
  seriesSlug: string;
  volumeNumber?: number;
  sourceArchive: string;
  db?: DatabaseInstance;
  maxImageWidth?: number;
  webpQuality?: number;
}

export interface IngestVolumeArchiveResult {
  isVolume: boolean;
  totalChapters: number;
  chapters: Array<{
    chapterNumber: number;
    chapterId: string;
    title: string;
    pageCount: number;
    relativeStorageDir: string;
    totalBytes: number;
    pages: PageMetadata[];
  }>;
}

const JUNK_BASENAMES = new Set([
  '.ds_store',
  'thumbs.db',
  'desktop.ini',
  'ehthumbs.db',
]);

const VALID_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);
const VALID_ARCHIVE_EXTENSIONS = new Set(['.cbz', '.zip']);
const MAX_CHAPTER_PAGE_COUNT = 5_000;
const MAX_CHAPTER_INPUT_BYTES = 256 * 1024 * 1024;

export function isJunkEntry(entryName: string): boolean {
  const normalized = entryName.replace(/\\/g, '/');
  if (normalized.includes('__MACOSX/')) {
    return true;
  }
  const base = path.basename(normalized).toLowerCase();
  if (base.startsWith('._') || JUNK_BASENAMES.has(base)) {
    return true;
  }
  return false;
}

export function isValidEntry(entryName: string): boolean {
  if (isJunkEntry(entryName)) return false;
  if (entryName.endsWith('/') || entryName.endsWith('\\')) return false;

  const ext = path.extname(entryName).toLowerCase();
  return VALID_IMAGE_EXTENSIONS.has(ext) || VALID_ARCHIVE_EXTENSIONS.has(ext);
}

export function parseChapterNumber(text: string): number | null {
  // 1. Explicit chapter label: chapter, chap, capitulo, cap, ch, c followed by number
  const chapMatch = text.match(/(?:^|[_\s.-])(?:chapter|chap|capitulo|cap|ch|c)[.\s_-]*([0-9]+(?:\.[0-9]+)?)(?:[_\s.-]|$)/i);
  if (chapMatch) {
    const num = Number.parseFloat(chapMatch[1]);
    if (!Number.isNaN(num)) return num;
  }

  // 2. Pure number folder or segment, e.g. "01", "02", "1", "10"
  const pureNumMatch = text.trim().match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (pureNumMatch) {
    const num = Number.parseFloat(pureNumMatch[1]);
    if (!Number.isNaN(num)) return num;
  }

  // 3. Fallback: match any standalone number
  const numMatch = text.match(/(?:^|[_\s.-])([0-9]+(?:\.[0-9]+)?)(?:[_\s.-]|$)/);
  if (numMatch) {
    const num = Number.parseFloat(numMatch[1]);
    if (!Number.isNaN(num)) return num;
  }

  return null;
}

export function detectArchiveStructure(entries: string[]): ArchiveStructure {
  // 1. Filter out system junk and non-image/archive entries
  const validEntries = entries
    .map((e) => e.replace(/\\/g, '/').trim())
    .filter((e) => isValidEntry(e));

  if (validEntries.length === 0) {
    return {
      isVolume: false,
      chapters: [],
    };
  }

  // 2. Strategy A: Check for nested archives (.cbz / .zip)
  const nestedArchives = validEntries.filter((e) => {
    const ext = path.extname(e).toLowerCase();
    return VALID_ARCHIVE_EXTENSIONS.has(ext);
  });

  if (nestedArchives.length >= 2) {
    const chapters: DetectedChapter[] = [];
    const sortedArchives = naturalSort(nestedArchives);

    for (let i = 0; i < sortedArchives.length; i++) {
      const archivePath = sortedArchives[i];
      const baseName = path.parse(archivePath).name;
      const num = parseChapterNumber(baseName) ?? (i + 1);
      chapters.push({
        chapterNumber: num,
        title: `Chapter ${num}`,
        entryNames: [archivePath],
      });
    }

    chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    return {
      isVolume: true,
      chapters,
    };
  }

  // Only keep valid image entries for directory and prefix strategies
  const imageEntries = validEntries.filter((e) => {
    const ext = path.extname(e).toLowerCase();
    return VALID_IMAGE_EXTENSIONS.has(ext);
  });

  if (imageEntries.length === 0) {
    return { isVolume: false, chapters: [] };
  }

  // 3. Strategy B: Subdirectory grouping
  // Strip common top-level root folders if all entries share the exact same top-level directory
  let normalizedImageEntries = [...imageEntries];

  while (true) {
    const splitPaths = normalizedImageEntries.map((e) => e.split('/'));
    if (splitPaths.every((parts) => parts.length > 1 && parts[0] === splitPaths[0][0])) {
      const common = splitPaths[0][0];
      normalizedImageEntries = normalizedImageEntries.map((e) => e.slice(common.length + 1));
    } else {
      break;
    }
  }

  // Group entries by immediate subfolder
  const folderGroups = new Map<string, string[]>();
  for (let i = 0; i < normalizedImageEntries.length; i++) {
    const relPath = normalizedImageEntries[i];
    const originalEntry = imageEntries[i];
    const parts = relPath.split('/');
    if (parts.length > 1) {
      const folder = parts[0];
      if (!folderGroups.has(folder)) {
        folderGroups.set(folder, []);
      }
      folderGroups.get(folder)!.push(originalEntry);
    }
  }

  if (folderGroups.size >= 2) {
    const chapters: DetectedChapter[] = [];
    let defaultChapIdx = 1;

    for (const [folder, groupEntries] of folderGroups.entries()) {
      const chapNum = parseChapterNumber(folder) ?? defaultChapIdx++;
      chapters.push({
        chapterNumber: chapNum,
        title: `Chapter ${chapNum}`,
        entryNames: naturalSort(groupEntries),
      });
    }

    chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    return {
      isVolume: true,
      chapters,
    };
  }

  // 4. Strategy C: Prefix-based grouping in flat directory
  // Look for patterns like c01_001.jpg, ch02_001.jpg, or Chapter 1 - 001.jpg
  const prefixGroups = new Map<number, string[]>();

  for (const entry of imageEntries) {
    const base = path.parse(entry).name;

    // Pattern 1: c01_, ch1_, chap1_, chapter1_, capitulo01_
    const labelMatch = base.match(/^(?:chapter|chap|capitulo|cap|ch|c)[.\s_-]*([0-9]+(?:\.[0-9]+)?)[._\s-]/i);
    if (labelMatch) {
      const num = Number.parseFloat(labelMatch[1]);
      if (!Number.isNaN(num)) {
        if (!prefixGroups.has(num)) {
          prefixGroups.set(num, []);
        }
        prefixGroups.get(num)!.push(entry);
        continue;
      }
    }

    // Pattern 2: Two numbers separated by underscore/dash: 01_001, 1-001
    const twoNumMatch = base.match(/^([0-9]{1,4})[._\s-]+([0-9]{1,4})$/);
    if (twoNumMatch) {
      const num = Number.parseFloat(twoNumMatch[1]);
      if (!Number.isNaN(num)) {
        if (!prefixGroups.has(num)) {
          prefixGroups.set(num, []);
        }
        prefixGroups.get(num)!.push(entry);
        continue;
      }
    }
  }

  if (prefixGroups.size >= 2) {
    const chapters: DetectedChapter[] = [];
    for (const [num, groupEntries] of prefixGroups.entries()) {
      chapters.push({
        chapterNumber: num,
        title: `Chapter ${num}`,
        entryNames: naturalSort(groupEntries),
      });
    }

    chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
    return {
      isVolume: true,
      chapters,
    };
  }

  // 5. Strategy D: Single Chapter Fallback
  return {
    isVolume: false,
    chapters: [
      {
        chapterNumber: 1,
        title: 'Chapter 1',
        entryNames: naturalSort(imageEntries),
      },
    ],
  };
}

export async function ingestVolumeArchive(params: IngestVolumeArchiveParams): Promise<IngestVolumeArchiveResult> {
  const vol = params.volumeNumber ?? 1;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,150}$/.test(params.seriesSlug) ||
      params.seriesSlug === '.' || params.seriesSlug === '..' ||
      !Number.isSafeInteger(vol) || vol < 0) {
    throw new Error('Invalid series slug or volume number');
  }
  await assertArchiveFileSize(params.sourceArchive);
  const maxImageWidth = params.maxImageWidth ?? 1440;
  const webpQuality = params.webpQuality ?? 82;

  let zip: AdmZip;
  try {
    zip = new AdmZip(params.sourceArchive);
  } catch (err: any) {
    throw new Error(`Failed to open volume archive '${path.basename(params.sourceArchive)}': ${err.message}`);
  }

  const entries = zip.getEntries();
  validateArchiveEntries(entries);
  const entryNames = entries.map((e) => e.entryName);
  const structure = detectArchiveStructure(entryNames);

  let seriesRepo: SeriesRepository | null = null;
  let chapterRepo: ChapterRepository | null = null;

  if (params.db) {
    seriesRepo = new SeriesRepository(params.db);
    chapterRepo = new ChapterRepository(params.db);

    // Ensure series exists
    let series = seriesRepo.getSeriesBySlug(params.seriesSlug);
    if (!series) {
      const titlePrimary = params.seriesSlug
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      seriesRepo.createSeries({
        id: params.seriesSlug,
        slug: params.seriesSlug,
        titlePrimary,
        type: 'manga',
        status: 'ongoing',
      });
      seriesRepo.addSeriesTitles(params.seriesSlug, [
        { languageCode: 'en', title: titlePrimary, isPrimary: true },
      ]);
    }
  }

  const limit = pLimit(4);
  const chapterResults: IngestVolumeArchiveResult['chapters'] = [];

  for (const detected of structure.chapters) {
    const chapNum = detected.chapterNumber;
    const title = detected.title || `Chapter ${chapNum}`;
    const chapterId = `${params.seriesSlug}-c${chapNum}`;
    const relDir = path.join('series', params.seriesSlug, `v${vol}`, `c${chapNum}`);
    const targetDir = path.resolve(params.storageRoot, relDir);

    await fs.mkdir(targetDir, { recursive: true });

    // Collect image buffers to optimize
    const imagePayloads: Array<{ buffer: Buffer; name: string }> = [];
    let chapterInputBytes = 0;

    const addPayload = (buffer: Buffer, name: string): void => {
      chapterInputBytes += buffer.length;
      if (imagePayloads.length >= MAX_CHAPTER_PAGE_COUNT || chapterInputBytes > MAX_CHAPTER_INPUT_BYTES) {
        throw new Error(`Chapter ${chapNum} exceeds its page or input-size limit`);
      }
      imagePayloads.push({ buffer, name });
    };

    for (const entryName of detected.entryNames) {
      const ext = path.extname(entryName).toLowerCase();

      if (VALID_ARCHIVE_EXTENSIONS.has(ext)) {
        // Nested archive: extract images inside nested zip
        const zipEntry = zip.getEntry(entryName);
        if (zipEntry) {
          const nestedZipBuffer = getValidatedEntryData(zipEntry);
          const nestedZip = new AdmZip(nestedZipBuffer);
          const nestedEntries = nestedZip.getEntries();
          validateArchiveEntries(nestedEntries);
          const innerEntries = nestedEntries.filter((e) => {
            if (e.isDirectory) return false;
            if (isJunkEntry(e.entryName)) return false;
            return VALID_IMAGE_EXTENSIONS.has(path.extname(e.entryName).toLowerCase());
          });

          const sortedInner = naturalSort(innerEntries.map((e) => e.entryName));
          for (const innerName of sortedInner) {
            const innerEntry = nestedZip.getEntry(innerName);
            if (innerEntry) {
              addPayload(getValidatedEntryData(innerEntry), path.basename(innerName));
            }
          }
        }
      } else {
        const zipEntry = zip.getEntry(entryName);
        if (zipEntry) {
          addPayload(getValidatedEntryData(zipEntry), path.basename(entryName));
        }
      }
    }

    if (imagePayloads.length === 0) {
      continue;
    }

    const pages: PageMetadata[] = new Array(imagePayloads.length);

    await Promise.all(
      imagePayloads.map((payload, idx) =>
        limit(async () => {
          const pageNumber = idx + 1;
          const paddedName = `${String(pageNumber).padStart(3, '0')}.webp`;
          const outputPath = path.join(targetDir, paddedName);

          const meta = await optimizeImageToWebP(payload.buffer, outputPath, {
            pageNumber,
            maxImageWidth,
            webpQuality,
          });

          pages[idx] = meta;
        })
      )
    );

    const totalBytes = pages.reduce((sum, p) => sum + p.fileSizeBytes, 0);

    const manifest = {
      seriesSlug: params.seriesSlug,
      volumeNumber: vol,
      chapterNumber: chapNum,
      title,
      pageCount: pages.length,
      totalBytes,
      pages,
      createdAt: new Date().toISOString(),
    };

    await fs.writeFile(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');

    // Register in Database if db is provided
    if (chapterRepo && params.db) {
      // Remove previous chapter instance if exists
      const existing = chapterRepo.getChapterWithPages(chapterId);
      if (existing) {
        params.db.prepare('DELETE FROM chapters WHERE id = ?').run(chapterId);
      }

      chapterRepo.createChapter({
        id: chapterId,
        seriesId: params.seriesSlug,
        volumeId: null,
        chapterNumber: chapNum,
        title,
        pageCount: pages.length,
        storagePath: relDir,
      });

      chapterRepo.addPages(chapterId, pages);
    }

    chapterResults.push({
      chapterNumber: chapNum,
      chapterId,
      title,
      pageCount: pages.length,
      relativeStorageDir: relDir,
      totalBytes,
      pages,
    });
  }

  return {
    isVolume: structure.isVolume,
    totalChapters: chapterResults.length,
    chapters: chapterResults,
  };
}
