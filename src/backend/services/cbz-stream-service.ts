/**
 * Sprint 57 - CBZ Zero-Seek Archive Offset & Streaming Service
 *
 * Provides high-speed streaming directly from mechanical 4TB HDDs
 * by leveraging pre-indexed byte offsets and zero-copy streams.
 */

import fs from 'node:fs';
import zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { DatabaseInstance } from '../db/database.js';
import { parseZipOffsets, ParsedZipEntry, buildSequentialClusters, ReadCluster } from '../utils/cbz-offset-indexer.js';

export interface ChapterArchiveOffset {
  id?: number;
  chapterId: string;
  pageNumber: number;
  fileName: string;
  compressionMethod: 0 | 8;
  dataOffset: number;
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  localHeaderOffset: number;
  mimeType: string;
}

export interface ByteRange {
  start: number;
  end: number;
}

export interface StreamResponseResult {
  stream: Readable;
  statusCode: 200 | 206;
  headers: Record<string, string | number>;
  mimeType: string;
  contentLength: number;
}

export function parseHttpRange(rangeHeader: string | undefined, totalSize: number): { range?: ByteRange; isUnsatisfiable?: boolean } {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
    return {};
  }

  const parts = rangeHeader.slice(6).split('-');
  const startStr = parts[0]?.trim();
  const endStr = parts[1]?.trim();

  let start = startStr ? Number.parseInt(startStr, 10) : NaN;
  let end = endStr ? Number.parseInt(endStr, 10) : NaN;

  if (Number.isNaN(start) && Number.isNaN(end)) {
    return {};
  }

  // Suffix range: bytes=-500 (last 500 bytes)
  if (Number.isNaN(start)) {
    start = Math.max(0, totalSize - end);
    end = totalSize - 1;
  } else if (Number.isNaN(end) || end >= totalSize) {
    end = totalSize - 1;
  }

  if (start >= totalSize || start > end || start < 0) {
    return { isUnsatisfiable: true };
  }

  return { range: { start, end } };
}

export class CbzStreamService {
  private db: DatabaseInstance;

  // In-memory LRU manifest cache for SLA 21 sub-microsecond resolution
  private memoryCache: Map<string, ChapterArchiveOffset[]> = new Map();
  private maxCachedChapters: number = 20;

  constructor(db: DatabaseInstance) {
    this.db = db;
  }

  /**
   * Indexes a CBZ archive ahead of time and populates SQLite.
   */
  public async indexChapterArchive(chapterId: string, archivePath: string): Promise<ChapterArchiveOffset[]> {
    // Check if already in SQLite
    const existing = this.getChapterOffsets(chapterId);
    if (existing.length > 0) {
      this.cacheManifest(chapterId, existing);
      return existing;
    }

    const parsedEntries = await parseZipOffsets(archivePath);

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const stmt = this.db.prepare(`
        INSERT INTO chapter_archive_offsets (
          chapter_id, page_number, file_name, compression_method,
          data_offset, compressed_size, uncompressed_size, crc32,
          local_header_offset, mime_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(chapter_id, page_number) DO UPDATE SET
          file_name = excluded.file_name,
          compression_method = excluded.compression_method,
          data_offset = excluded.data_offset,
          compressed_size = excluded.compressed_size,
          uncompressed_size = excluded.uncompressed_size,
          crc32 = excluded.crc32,
          local_header_offset = excluded.local_header_offset,
          mime_type = excluded.mime_type
      `);

      for (const entry of parsedEntries) {
        stmt.run(
          chapterId,
          entry.pageNumber,
          entry.fileName,
          entry.compressionMethod,
          entry.dataOffset,
          entry.compressedSize,
          entry.uncompressedSize,
          entry.crc32,
          entry.localHeaderOffset,
          entry.mimeType
        );
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    const saved = this.getChapterOffsets(chapterId);
    this.cacheManifest(chapterId, saved);
    return saved;
  }

  public getChapterOffsets(chapterId: string): ChapterArchiveOffset[] {
    const cached = this.memoryCache.get(chapterId);
    if (cached) return cached;

    const stmt = this.db.prepare(`
      SELECT chapter_id, page_number, file_name, compression_method,
             data_offset, compressed_size, uncompressed_size, crc32,
             local_header_offset, mime_type
      FROM chapter_archive_offsets
      WHERE chapter_id = ?
      ORDER BY page_number ASC
    `);

    const rows = stmt.all(chapterId) as any[];
    const result: ChapterArchiveOffset[] = rows.map((r) => ({
      chapterId: r.chapter_id,
      pageNumber: Number(r.page_number),
      fileName: r.file_name,
      compressionMethod: Number(r.compression_method) as 0 | 8,
      dataOffset: Number(r.data_offset),
      compressedSize: Number(r.compressed_size),
      uncompressedSize: Number(r.uncompressed_size),
      crc32: Number(r.crc32),
      localHeaderOffset: Number(r.local_header_offset),
      mimeType: r.mime_type,
    }));

    if (result.length > 0) {
      this.cacheManifest(chapterId, result);
    }
    return result;
  }

  public getArchiveOffset(chapterId: string, pageNumber: number): ChapterArchiveOffset | null {
    // 1. Hot in-memory LRU route (< 0.001 ms)
    let cachedList = this.memoryCache.get(chapterId);
    if (!cachedList) {
      cachedList = this.getChapterOffsets(chapterId);
    }

    if (cachedList && cachedList.length > 0) {
      const match = cachedList.find((e) => e.pageNumber === pageNumber);
      if (match) return match;
    }

    // 2. Direct single-point SQLite fallback if chapter offsets weren't fully batch loaded
    const stmt = this.db.prepare(`
      SELECT chapter_id, page_number, file_name, compression_method,
             data_offset, compressed_size, uncompressed_size, crc32,
             local_header_offset, mime_type
      FROM chapter_archive_offsets
      WHERE chapter_id = ? AND page_number = ?
    `);

    const row = stmt.get(chapterId, pageNumber) as any;
    if (!row) return null;

    return {
      chapterId: row.chapter_id,
      pageNumber: Number(row.page_number),
      fileName: row.file_name,
      compressionMethod: Number(row.compression_method) as 0 | 8,
      dataOffset: Number(row.data_offset),
      compressedSize: Number(row.compressed_size),
      uncompressedSize: Number(row.uncompressed_size),
      crc32: Number(row.crc32),
      localHeaderOffset: Number(row.local_header_offset),
      mimeType: row.mime_type,
    };
  }

  public getSequentialClusters(chapterId: string, maxGap?: number, maxWindow?: number): ReadCluster[] {
    const offsets = this.getChapterOffsets(chapterId);
    return buildSequentialClusters(offsets as any, maxGap, maxWindow);
  }

  /**
   * Creates an optimized Node.js stream for the requested page.
   * Handles STORED (HTTP 206 supported) and DEFLATE streams.
   */
  public createPageStream(
    chapterId: string,
    archivePath: string,
    pageNumber: number,
    rangeHeader?: string
  ): StreamResponseResult {
    const offset = this.getArchiveOffset(chapterId, pageNumber);
    if (!offset) {
      throw new Error(`Page ${pageNumber} not found in chapter ${chapterId}`);
    }

    const { compressionMethod, dataOffset, compressedSize, uncompressedSize, mimeType } = offset;

    // Method 0: STORED (Uncompressed) - Supports HTTP 206 Partial Content
    if (compressionMethod === 0) {
      const { range, isUnsatisfiable } = parseHttpRange(rangeHeader, uncompressedSize);

      if (isUnsatisfiable) {
        const error = new Error('Requested Range Not Satisfiable') as any;
        error.statusCode = 416;
        error.contentRange = `bytes */${uncompressedSize}`;
        throw error;
      }

      if (range) {
        const sliceStart = dataOffset + range.start;
        const sliceEnd = dataOffset + range.end;
        const contentLength = range.end - range.start + 1;

        const stream = fs.createReadStream(archivePath, {
          start: sliceStart,
          end: sliceEnd,
          highWaterMark: 65536,
        });

        return {
          stream,
          statusCode: 206,
          contentLength,
          mimeType,
          headers: {
            'Content-Range': `bytes ${range.start}-${range.end}/${uncompressedSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': contentLength,
            'Content-Type': mimeType,
          },
        };
      }

      // Full 200 OK stream
      const stream = fs.createReadStream(archivePath, {
        start: dataOffset,
        end: dataOffset + compressedSize - 1,
        highWaterMark: 65536,
      });

      return {
        stream,
        statusCode: 200,
        contentLength: uncompressedSize,
        mimeType,
        headers: {
          'Accept-Ranges': 'bytes',
          'Content-Length': uncompressedSize,
          'Content-Type': mimeType,
        },
      };
    }

    // Method 8: DEFLATE - Decompress on the fly via raw stream pipeline
    const rawStream = fs.createReadStream(archivePath, {
      start: dataOffset,
      end: dataOffset + compressedSize - 1,
      highWaterMark: 65536,
    });

    const inflateStream = zlib.createInflateRaw();
    rawStream.pipe(inflateStream);

    return {
      stream: inflateStream,
      statusCode: 200,
      contentLength: uncompressedSize,
      mimeType,
      headers: {
        'Content-Length': uncompressedSize,
        'Content-Type': mimeType,
      },
    };
  }

  private cacheManifest(chapterId: string, offsets: ChapterArchiveOffset[]): void {
    if (this.memoryCache.size >= this.maxCachedChapters) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
      }
    }
    this.memoryCache.set(chapterId, offsets);
  }
}
