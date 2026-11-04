import AdmZip from 'adm-zip';
import path from 'node:path';
import fs from 'node:fs/promises';
import { naturalSort } from '../utils/natural-sort.js';

const VALID_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);
const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024;
const MAX_ENTRIES = 10_000;
const MAX_ENTRY_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 200;

export async function assertArchiveFileSize(archivePath: string): Promise<void> {
  const archiveStat = await fs.stat(archivePath);
  if (!archiveStat.isFile() || archiveStat.size > MAX_ARCHIVE_BYTES) {
    throw new Error(`Archive exceeds the ${MAX_ARCHIVE_BYTES}-byte input limit`);
  }
}

export function validateArchiveEntries(entries: AdmZip.IZipEntry[]): void {
  if (entries.length > MAX_ENTRIES) throw new Error(`Archive contains too many entries (maximum ${MAX_ENTRIES})`);
  let total = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const size = Number(entry.header.size);
    const compressedSize = Number(entry.header.compressedSize);
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_ENTRY_BYTES) {
      throw new Error(`Archive entry exceeds the ${MAX_ENTRY_BYTES}-byte limit`);
    }
    if (!Number.isSafeInteger(compressedSize) || compressedSize < 0 ||
        (size > 0 && (compressedSize === 0 || size / compressedSize > MAX_COMPRESSION_RATIO))) {
      throw new Error(`Archive entry exceeds the maximum compression ratio of ${MAX_COMPRESSION_RATIO}:1`);
    }
    total += size;
    if (total > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error(`Archive exceeds the ${MAX_TOTAL_UNCOMPRESSED_BYTES}-byte total extraction limit`);
    }
  }
}

export function getValidatedEntryData(entry: AdmZip.IZipEntry): Buffer {
  const declaredSize = Number(entry.header.size);
  if (!Number.isSafeInteger(declaredSize) || declaredSize < 0 || declaredSize > MAX_ENTRY_BYTES) {
    throw new Error(`Archive entry exceeds the ${MAX_ENTRY_BYTES}-byte limit`);
  }
  const data = entry.getData();
  if (data.length !== declaredSize || data.length > MAX_ENTRY_BYTES) {
    throw new Error('Archive entry size does not match its declared size or exceeds the image limit');
  }
  return data;
}

export function isPathSafe(destDir: string, relativeOrTargetPath: string): boolean {
  const resolvedDest = path.resolve(destDir);
  const resolvedTarget = path.resolve(destDir, relativeOrTargetPath);

  const relative = path.relative(resolvedDest, resolvedTarget);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function extractArchive(archivePath: string, destDir: string): Promise<string[]> {
  await assertArchiveFileSize(archivePath);
  await fs.mkdir(destDir, { recursive: true });

  let zip: AdmZip;
  try {
    zip = new AdmZip(archivePath);
  } catch (err: any) {
    throw new Error(`Failed to open archive '${path.basename(archivePath)}': ${err.message}`);
  }

  let entries: AdmZip.IZipEntry[];
  try {
    entries = zip.getEntries();
  } catch (err: any) {
    throw new Error(`Failed to read entries from archive '${path.basename(archivePath)}': ${err.message}`);
  }

  validateArchiveEntries(entries);

  const extractedFilePaths: string[] = [];
  const outputPaths = new Set<string>();
  let totalUncompressedBytes = 0;

  for (const entry of entries) {
    if (entry.isDirectory) {
      continue;
    }

    // Zip Slip defense: prevent traversal entries like ../../evil.png
    if (!isPathSafe(destDir, entry.entryName)) {
      continue;
    }

    const ext = path.extname(entry.entryName).toLowerCase();
    if (!VALID_IMAGE_EXTENSIONS.has(ext)) {
      continue;
    }

    // Normalize ZIP's POSIX separators for the host OS, then retain nested
    // paths so equal basenames from different folders never overwrite each other.
    const relativeName = entry.entryName.replace(/[\\/]+/g, path.sep);
    const outputPath = path.resolve(destDir, relativeName);
    if (!relativeName || !isPathSafe(destDir, relativeName) ||
        !isPathSafe(destDir, outputPath) || path.basename(relativeName) === '.' ||
        path.basename(relativeName) === '..') {
      continue;
    }
    const normalizedOutput = process.platform === 'win32' ? outputPath.toLowerCase() : outputPath;
    if (outputPaths.has(normalizedOutput)) throw new Error(`Archive has duplicate image path: ${path.basename(relativeName)}`);
    totalUncompressedBytes += Number(entry.header.size);
    if (totalUncompressedBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error(`Archive exceeds the ${MAX_TOTAL_UNCOMPRESSED_BYTES}-byte total extraction limit`);
    }
    let content: Buffer;
    try {
      content = getValidatedEntryData(entry);
    } catch {
      // Gracefully skip corrupted/unreadable entry within archive
      continue;
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content);
    outputPaths.add(normalizedOutput);
    extractedFilePaths.push(outputPath);
  }

  return naturalSort(extractedFilePaths);
}
