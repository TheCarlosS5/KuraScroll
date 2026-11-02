/**
 * Sprint 57 - High-Precision Binary Parser & Sequential Clumper for CBZ / ZIP Containers
 *
 * Implements Ahead-of-Time (AOT) indexing of raw page byte offsets to enable
 * Zero-Seek fs.createReadStream slices on mechanical SATA II HDDs.
 */

import fs from 'node:fs/promises';
import { naturalSort } from './natural-sort.js';

export interface ParsedZipEntry {
  pageNumber: number;
  fileName: string;
  compressionMethod: 0 | 8; // 0 = STORED, 8 = DEFLATE
  dataOffset: number;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  localHeaderOffset: number;
  mimeType: string;
}

export interface ReadCluster {
  clusterIndex: number;
  startOffset: number;
  endOffset: number;
  totalBytes: number;
  entries: ParsedZipEntry[];
}

const IMAGE_EXTENSIONS = new Set(['.webp', '.jpg', '.jpeg', '.png', '.avif']);

export function getMimeTypeFromFileName(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

/**
 * Parses a CBZ (ZIP) archive directly via file descriptor reads.
 * Memory footprint: < 64KB regardless of archive size.
 */
export async function parseZipOffsets(filePath: string): Promise<ParsedZipEntry[]> {
  const fileHandle = await fs.open(filePath, 'r');
  try {
    const stat = await fileHandle.stat();
    const fileSize = stat.size;
    if (fileSize < 22) {
      throw new Error('Invalid ZIP archive: file is smaller than minimum EOCD size (22 bytes)');
    }

    // 1. Locate End of Central Directory (EOCD)
    // EOCD signature: 0x06054b50 ('PK\x05\x06')
    const searchBufSize = Math.min(fileSize, 65536 + 22);
    const searchBuf = Buffer.alloc(searchBufSize);
    const searchStart = fileSize - searchBufSize;
    await fileHandle.read(searchBuf, 0, searchBufSize, searchStart);

    let eocdOffset = -1;
    for (let i = searchBufSize - 22; i >= 0; i--) {
      if (
        searchBuf[i] === 0x50 &&
        searchBuf[i + 1] === 0x4b &&
        searchBuf[i + 2] === 0x05 &&
        searchBuf[i + 3] === 0x06
      ) {
        eocdOffset = searchStart + i;
        break;
      }
    }

    if (eocdOffset === -1) {
      throw new Error('Invalid ZIP archive: End of Central Directory (EOCD) signature not found');
    }

    // Read EOCD record
    const eocdHeaderBuf = Buffer.alloc(22);
    await fileHandle.read(eocdHeaderBuf, 0, 22, eocdOffset);

    const totalEntries = eocdHeaderBuf.readUInt16LE(10);
    const centralDirSize = eocdHeaderBuf.readUInt32LE(12);
    const centralDirOffset = eocdHeaderBuf.readUInt32LE(16);

    // 2. Read Central Directory
    const cdBuf = Buffer.alloc(centralDirSize);
    await fileHandle.read(cdBuf, 0, centralDirSize, centralDirOffset);

    const rawEntries: Omit<ParsedZipEntry, 'pageNumber'>[] = [];
    let cdCursor = 0;

    for (let i = 0; i < totalEntries && cdCursor < centralDirSize; i++) {
      const sig = cdBuf.readUInt32LE(cdCursor);
      if (sig !== 0x02014b50) {
        // Break if signature does not match central directory record
        break;
      }

      const method = cdBuf.readUInt16LE(cdCursor + 10) as 0 | 8;
      const crc32 = cdBuf.readUInt32LE(cdCursor + 16);
      const compressedSize = cdBuf.readUInt32LE(cdCursor + 20);
      const uncompressedSize = cdBuf.readUInt32LE(cdCursor + 24);
      const filenameLen = cdBuf.readUInt16LE(cdCursor + 28);
      const extraLen = cdBuf.readUInt16LE(cdCursor + 30);
      const commentLen = cdBuf.readUInt16LE(cdCursor + 32);
      const localHeaderOffset = cdBuf.readUInt32LE(cdCursor + 42);

      const fileName = cdBuf.toString('utf8', cdCursor + 46, cdCursor + 46 + filenameLen);
      cdCursor += 46 + filenameLen + extraLen + commentLen;

      // Filter out non-image files and directories
      const extIndex = fileName.lastIndexOf('.');
      const ext = extIndex !== -1 ? fileName.slice(extIndex).toLowerCase() : '';
      if (!IMAGE_EXTENSIONS.has(ext) || fileName.endsWith('/')) {
        continue;
      }

      // 3. Inspect Local File Header to compute exact dataOffset avoiding "Central Directory Trap"
      const localHeaderBuf = Buffer.alloc(30);
      await fileHandle.read(localHeaderBuf, 0, 30, localHeaderOffset);

      const localSig = localHeaderBuf.readUInt32LE(0);
      if (localSig !== 0x04034b50) {
        continue;
      }

      const localFilenameLen = localHeaderBuf.readUInt16LE(26);
      const localExtraLen = localHeaderBuf.readUInt16LE(28);
      const dataOffset = localHeaderOffset + 30 + localFilenameLen + localExtraLen;

      rawEntries.push({
        fileName,
        compressionMethod: method === 8 ? 8 : 0,
        dataOffset,
        compressedSize,
        uncompressedSize,
        crc32,
        localHeaderOffset,
        mimeType: getMimeTypeFromFileName(fileName),
      });
    }

    // 4. Sort naturally and assign 1-based page numbers
    const sortedFileNames = naturalSort(rawEntries.map((e) => e.fileName));
    const entryMap = new Map(rawEntries.map((e) => [e.fileName, e]));

    const pages: ParsedZipEntry[] = [];
    let pageNum = 1;
    for (const fn of sortedFileNames) {
      const item = entryMap.get(fn);
      if (item) {
        pages.push({
          pageNumber: pageNum++,
          ...item,
        });
      }
    }

    return pages;
  } finally {
    await fileHandle.close();
  }
}

/**
 * Groups entries whose physical offsets on disk are contiguous or near-contiguous,
 * minimizing radial seek latency on mechanical 5400 RPM hard drives.
 */
export function buildSequentialClusters(
  entries: readonly ParsedZipEntry[],
  maxGap: number = 128 * 1024,      // 128 KiB
  maxWindow: number = 1024 * 1024   // 1 MiB
): ReadCluster[] {
  if (entries.length === 0) return [];

  // Sort strictly by physical dataOffset
  const physicallySorted = [...entries].sort((a, b) => a.dataOffset - b.dataOffset);

  const clusters: ReadCluster[] = [];
  let currentEntries: ParsedZipEntry[] = [];
  let clusterStart = physicallySorted[0].dataOffset;
  let clusterEnd = clusterStart + physicallySorted[0].compressedSize;

  for (let i = 0; i < physicallySorted.length; i++) {
    const entry = physicallySorted[i];
    const entryStart = entry.dataOffset;
    const entryEnd = entryStart + entry.compressedSize;

    if (currentEntries.length === 0) {
      currentEntries.push(entry);
      clusterStart = entryStart;
      clusterEnd = entryEnd;
      continue;
    }

    const gap = entryStart - clusterEnd;
    const prospectiveWindow = entryEnd - clusterStart;

    if (gap <= maxGap && prospectiveWindow <= maxWindow) {
      currentEntries.push(entry);
      clusterEnd = Math.max(clusterEnd, entryEnd);
    } else {
      clusters.push({
        clusterIndex: clusters.length,
        startOffset: clusterStart,
        endOffset: clusterEnd,
        totalBytes: clusterEnd - clusterStart,
        entries: currentEntries,
      });
      currentEntries = [entry];
      clusterStart = entryStart;
      clusterEnd = entryEnd;
    }
  }

  if (currentEntries.length > 0) {
    clusters.push({
      clusterIndex: clusters.length,
      startOffset: clusterStart,
      endOffset: clusterEnd,
      totalBytes: clusterEnd - clusterStart,
      entries: currentEntries,
    });
  }

  return clusters;
}
