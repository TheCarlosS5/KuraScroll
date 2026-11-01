import AdmZip from 'adm-zip';
import path from 'node:path';
import fs from 'node:fs/promises';
import { naturalSort } from '../utils/natural-sort.js';

const VALID_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif']);

export function isPathSafe(destDir: string, relativeOrTargetPath: string): boolean {
  const resolvedDest = path.resolve(destDir);
  const resolvedTarget = path.resolve(destDir, relativeOrTargetPath);

  const relative = path.relative(resolvedDest, resolvedTarget);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

export async function extractArchive(archivePath: string, destDir: string): Promise<string[]> {
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

  const extractedFilePaths: string[] = [];

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

    const safeName = path.basename(entry.entryName);
    if (!safeName || !isPathSafe(destDir, safeName) || safeName === '.' || safeName === '..') {
      continue;
    }

    const outputPath = path.join(destDir, safeName);
    let content: Buffer;
    try {
      content = entry.getData();
    } catch {
      // Gracefully skip corrupted/unreadable entry within archive
      continue;
    }

    await fs.writeFile(outputPath, content);
    extractedFilePaths.push(outputPath);
  }

  // Sort paths naturally using base file name
  const sortedBaseNames = naturalSort(extractedFilePaths.map((p) => path.basename(p)));
  return sortedBaseNames.map((baseName) => path.join(destDir, baseName));
}
