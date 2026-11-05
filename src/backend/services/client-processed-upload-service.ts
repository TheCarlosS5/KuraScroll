import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';
import { DatabaseInstance } from '../db/database.js';
import { getStorageConfig } from '../config/storage-config.js';
import { slugify } from './metadata-resolver-service.js';

export const MAX_SOURCE_FILE_BYTES = 250 * 1024 * 1024; // 250 MiB
export const MAX_ZIP_ENTRIES = 10_000;
export const MAX_COMPRESSION_RATIO = 200;
export const MAX_EXPANDED_BYTES = 1024 * 1024 * 1024; // 1 GiB
export const MAX_PAGE_BYTES = 50 * 1024 * 1024; // 50 MiB
export const MAX_CHAPTER_PAGES = 5_000;
export const MAX_USER_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GiB
export const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export class UploadServiceError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'UploadServiceError';
  }
}

export interface CreateUploadInput {
  seriesId?: string;
  newSeriesTitle?: string;
  newSeriesType?: 'manga' | 'manhwa' | 'manhua' | 'comic';
  volumeNumber?: number;
  chapterNumber: number;
  chapterTitle?: string;
}

export interface UploadSessionRecord {
  id: string;
  user_id: string;
  series_id: string | null;
  new_series_title: string | null;
  new_series_type: string | null;
  volume_number: number | null;
  chapter_number: number;
  chapter_title: string | null;
  status: 'open' | 'publishing' | 'complete' | 'failed';
  manifest_json: string | null;
  expires_at: string;
  created_at: string;
}

export interface UploadSessionPageRecord {
  upload_id: string;
  page_number: number;
  file_name: string;
  width: number;
  height: number;
  byte_length: number;
  mime_type: string;
  sha256: string;
  confirmed_at: string;
}

export interface UploadPageMetadata {
  pageNumber: number;
  fileName: string;
  width: number;
  height: number;
  aspectRatio?: number;
  byteLength: number;
  mimeType: 'image/webp';
  sha256: string;
}

export interface ChapterManifest {
  seriesSlug?: string;
  volumeNumber?: number;
  chapterNumber: number;
  chapterTitle?: string;
  pageCount: number;
  totalBytes: number;
  pages: UploadPageMetadata[];
  createdAt?: string;
}

export interface UploadSessionStatus {
  id: string;
  userId: string;
  seriesId: string | null;
  newSeriesTitle: string | null;
  newSeriesType: string | null;
  volumeNumber: number | null;
  chapterNumber: number;
  chapterTitle: string | null;
  status: 'open' | 'publishing' | 'complete' | 'failed';
  expiresAt: string;
  createdAt: string;
  confirmedPages: number[];
  pages: UploadPageMetadata[];
}

export interface FinalizeUploadResult {
  chapterId: string;
  seriesSlug: string;
  pageCount: number;
}

function isContainedBy(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export class ClientProcessedUploadService {
  private storageRoot: string;
  private stagingBaseDir: string;

  constructor(
    private db: DatabaseInstance,
    storageRoot?: string
  ) {
    this.storageRoot = path.resolve(storageRoot || getStorageConfig().storageRoot);
    this.stagingBaseDir = path.join(this.storageRoot, '.tmp', 'client-uploads');
    fs.mkdirSync(this.stagingBaseDir, { recursive: true });
  }

  /**
   * Calculates total storage bytes actively used by chapters uploaded by this user.
   */
  getUserStorageQuota(userId: string): number {
    const stmt = this.db.prepare(`
      SELECT coalesce(sum(storage_bytes), 0) as total_bytes
      FROM chapters
      WHERE uploaded_by = ? AND visibility_status != 'removed'
    `);
    const row = stmt.get(userId) as { total_bytes: number } | undefined;
    return row ? Number(row.total_bytes) : 0;
  }

  /**
   * Creates a new client-processed upload session.
   * Limits to 1 active open upload per user and enforces 10 GiB user quota.
   */
  async createUpload(userId: string, input: CreateUploadInput): Promise<UploadSessionStatus> {
    if (typeof input.chapterNumber !== 'number' || !Number.isFinite(input.chapterNumber) || input.chapterNumber < 0) {
      throw new UploadServiceError(400, 'Invalid chapter number');
    }

    if (input.volumeNumber !== undefined && (typeof input.volumeNumber !== 'number' || !Number.isFinite(input.volumeNumber) || input.volumeNumber < 0)) {
      throw new UploadServiceError(400, 'Invalid volume number');
    }

    let seriesId: string | null = null;
    let newSeriesTitle: string | null = null;
    let newSeriesType: string | null = null;

    if (input.seriesId) {
      const seriesRow = this.db.prepare('SELECT id FROM series WHERE id = ?').get(input.seriesId) as { id: string } | undefined;
      if (!seriesRow) {
        throw new UploadServiceError(404, `Series '${input.seriesId}' not found`);
      }
      seriesId = seriesRow.id;
    } else if (input.newSeriesTitle) {
      const title = input.newSeriesTitle.trim();
      if (!title || title.length > 200) {
        throw new UploadServiceError(400, 'Series title must be between 1 and 200 characters');
      }
      newSeriesTitle = title;
      const type = input.newSeriesType || 'manga';
      if (!['manga', 'manhwa', 'manhua', 'comic'].includes(type)) {
        throw new UploadServiceError(400, "Invalid series type. Must be 'manga', 'manhwa', 'manhua', or 'comic'");
      }
      newSeriesType = type;
    } else {
      throw new UploadServiceError(400, 'Either seriesId or newSeriesTitle must be provided');
    }

    // Check user quota
    const usedBytes = this.getUserStorageQuota(userId);
    if (usedBytes >= MAX_USER_QUOTA_BYTES) {
      throw new UploadServiceError(413, 'User storage quota exceeded (10 GiB limit)');
    }

    // Limit to 1 active open upload session per user
    const activeStmt = this.db.prepare(`
      SELECT id FROM upload_sessions
      WHERE user_id = ? AND status = 'open' AND expires_at > datetime('now')
      LIMIT 1
    `);
    const active = activeStmt.get(userId) as { id: string } | undefined;
    if (active) {
      throw new UploadServiceError(429, 'An active upload session is already in progress. Please complete or cancel it first.');
    }

    const uploadId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS).toISOString();

    const insertStmt = this.db.prepare(`
      INSERT INTO upload_sessions (
        id, user_id, series_id, new_series_title, new_series_type,
        volume_number, chapter_number, chapter_title, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `);

    insertStmt.run(
      uploadId,
      userId,
      seriesId,
      newSeriesTitle,
      newSeriesType,
      input.volumeNumber ?? null,
      input.chapterNumber,
      input.chapterTitle ? input.chapterTitle.trim() : null,
      expiresAt
    );

    const stagingDir = path.join(this.stagingBaseDir, uploadId);
    await fsPromises.mkdir(stagingDir, { recursive: true });

    return {
      id: uploadId,
      userId,
      seriesId,
      newSeriesTitle,
      newSeriesType,
      volumeNumber: input.volumeNumber ?? null,
      chapterNumber: input.chapterNumber,
      chapterTitle: input.chapterTitle ? input.chapterTitle.trim() : null,
      status: 'open',
      expiresAt,
      createdAt: new Date().toISOString(),
      confirmedPages: [],
      pages: [],
    };
  }

  /**
   * Retrieves upload session status and confirmed page list.
   */
  async getUploadStatus(uploadId: string, userId: string, isAdmin = false): Promise<UploadSessionStatus> {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(uploadId)) {
      throw new UploadServiceError(400, 'Invalid upload ID format');
    }

    const sessionStmt = this.db.prepare('SELECT * FROM upload_sessions WHERE id = ?');
    const session = sessionStmt.get(uploadId) as UploadSessionRecord | undefined;
    if (!session) {
      throw new UploadServiceError(404, 'Upload session not found');
    }

    if (!isAdmin && session.user_id !== userId) {
      throw new UploadServiceError(403, 'Forbidden: upload session belongs to another user');
    }

    const pagesStmt = this.db.prepare(`
      SELECT page_number, file_name, width, height, byte_length, mime_type, sha256
      FROM upload_session_pages
      WHERE upload_id = ?
      ORDER BY page_number ASC
    `);
    const pageRows = pagesStmt.all(uploadId) as unknown as Array<{
      page_number: number;
      file_name: string;
      width: number;
      height: number;
      byte_length: number;
      mime_type: string;
      sha256: string;
    }>;

    const pages: UploadPageMetadata[] = pageRows.map((r) => ({
      pageNumber: r.page_number,
      fileName: r.file_name,
      width: r.width,
      height: r.height,
      aspectRatio: r.width > 0 && r.height > 0 ? Number((r.width / r.height).toFixed(4)) : 1,
      byteLength: r.byte_length,
      mimeType: 'image/webp',
      sha256: r.sha256,
    }));

    return {
      id: session.id,
      userId: session.user_id,
      seriesId: session.series_id,
      newSeriesTitle: session.new_series_title,
      newSeriesType: session.new_series_type,
      volumeNumber: session.volume_number,
      chapterNumber: session.chapter_number,
      chapterTitle: session.chapter_title,
      status: session.status,
      expiresAt: session.expires_at,
      createdAt: session.created_at,
      confirmedPages: pageRows.map((r) => r.page_number),
      pages,
    };
  }

  /**
   * Stores a streamed WebP page in the upload staging folder.
   * Validates WebP signature, enforces 50 MiB page limit, verifies SHA-256 and idempotency.
   */
  async storePageStream(
    uploadId: string,
    userId: string,
    pageNumber: number,
    metadata: UploadPageMetadata,
    stream: NodeJS.ReadableStream
  ): Promise<UploadPageMetadata> {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(uploadId)) {
      throw new UploadServiceError(400, 'Invalid upload ID format');
    }

    if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > MAX_CHAPTER_PAGES) {
      throw new UploadServiceError(400, `Page number must be an integer between 1 and ${MAX_CHAPTER_PAGES}`);
    }

    const sessionStmt = this.db.prepare('SELECT * FROM upload_sessions WHERE id = ?');
    const session = sessionStmt.get(uploadId) as UploadSessionRecord | undefined;
    if (!session) {
      throw new UploadServiceError(404, 'Upload session not found');
    }

    if (session.user_id !== userId) {
      throw new UploadServiceError(403, 'Forbidden: upload session belongs to another user');
    }

    if (session.status !== 'open') {
      throw new UploadServiceError(400, `Upload session is in status '${session.status}', cannot accept pages`);
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      this.db.prepare("UPDATE upload_sessions SET status = 'failed' WHERE id = ?").run(uploadId);
      throw new UploadServiceError(410, 'Upload session has expired');
    }

    if (metadata.byteLength > MAX_PAGE_BYTES) {
      throw new UploadServiceError(413, 'Page exceeds maximum size of 50 MiB');
    }

    if (metadata.mimeType !== 'image/webp') {
      throw new UploadServiceError(415, "Invalid MIME type: expected 'image/webp'");
    }

    const stagingDir = path.join(this.stagingBaseDir, uploadId);
    if (!fs.existsSync(stagingDir)) {
      await fsPromises.mkdir(stagingDir, { recursive: true });
    }

    const tempFileName = `${uploadId}_p${pageNumber}_${Date.now()}.tmp`;
    const tempFilePath = path.join(stagingDir, tempFileName);
    const finalFileName = `${String(pageNumber).padStart(4, '0')}.webp`;
    const finalFilePath = path.join(stagingDir, finalFileName);

    let bytesWritten = 0;
    const hash = crypto.createHash('sha256');
    let headerBuffer = Buffer.alloc(0);
    let isWebPVerified = false;

    try {
      const fileOut = fs.createWriteStream(tempFilePath);

      const sink = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          bytesWritten += chunk.length;
          if (bytesWritten > MAX_PAGE_BYTES) {
            callback(new UploadServiceError(413, 'Page exceeds maximum size of 50 MiB'));
            return;
          }

          hash.update(chunk);

          if (!isWebPVerified) {
            headerBuffer = Buffer.concat([headerBuffer, chunk]);
            if (headerBuffer.length >= 12) {
              const riff = headerBuffer.subarray(0, 4).toString('ascii');
              const webp = headerBuffer.subarray(8, 12).toString('ascii');
              if (riff !== 'RIFF' || webp !== 'WEBP') {
                callback(new UploadServiceError(415, 'Invalid file format: missing WebP RIFF/WEBP magic header'));
                return;
              }
              isWebPVerified = true;
            }
          }

          fileOut.write(chunk, callback);
        },
        final(callback) {
          if (!isWebPVerified && headerBuffer.length < 12) {
            callback(new UploadServiceError(415, 'File too small to be a valid WebP image'));
            return;
          }
          fileOut.end(callback);
        },
      });

      await pipeline(stream, sink);
    } catch (err) {
      try {
        await fsPromises.unlink(tempFilePath);
      } catch {}
      throw err;
    }

    const computedSha256 = hash.digest('hex');

    if (metadata.sha256 && computedSha256.toLowerCase() !== metadata.sha256.toLowerCase()) {
      try {
        await fsPromises.unlink(tempFilePath);
      } catch {}
      throw new UploadServiceError(400, 'SHA-256 checksum mismatch');
    }

    if (metadata.byteLength && bytesWritten !== metadata.byteLength) {
      try {
        await fsPromises.unlink(tempFilePath);
      } catch {}
      throw new UploadServiceError(400, 'Byte length mismatch');
    }

    // Idempotency check: does this page already exist in DB?
    const existingPageStmt = this.db.prepare(`
      SELECT page_number, file_name, width, height, byte_length, sha256
      FROM upload_session_pages
      WHERE upload_id = ? AND page_number = ?
    `);
    const existing = existingPageStmt.get(uploadId, pageNumber) as UploadSessionPageRecord | undefined;

    if (existing) {
      if (existing.sha256.toLowerCase() === computedSha256.toLowerCase()) {
        // Idempotent duplicate: same content already confirmed
        try {
          await fsPromises.unlink(tempFilePath);
        } catch {}
        return {
          pageNumber,
          fileName: finalFileName,
          width: existing.width,
          height: existing.height,
          aspectRatio: existing.width > 0 && existing.height > 0 ? Number((existing.width / existing.height).toFixed(4)) : 1,
          byteLength: existing.byte_length,
          mimeType: 'image/webp',
          sha256: existing.sha256,
        };
      } else {
        try {
          await fsPromises.unlink(tempFilePath);
        } catch {}
        throw new UploadServiceError(409, `Page ${pageNumber} was already confirmed with different content`);
      }
    }

    // Atomic move to final page file
    await fsPromises.rename(tempFilePath, finalFilePath);

    const insertPageStmt = this.db.prepare(`
      INSERT INTO upload_session_pages (
        upload_id, page_number, file_name, width, height, byte_length, mime_type, sha256
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPageStmt.run(
      uploadId,
      pageNumber,
      finalFileName,
      metadata.width,
      metadata.height,
      bytesWritten,
      'image/webp',
      computedSha256
    );

    return {
      pageNumber,
      fileName: finalFileName,
      width: metadata.width,
      height: metadata.height,
      aspectRatio: metadata.width > 0 && metadata.height > 0 ? Number((metadata.width / metadata.height).toFixed(4)) : 1,
      byteLength: bytesWritten,
      mimeType: 'image/webp',
      sha256: computedSha256,
    };
  }

  /**
   * Finalizes the upload session: validates manifest against DB pages, enforces quotas,
   * atomically moves staged files to final storage destination, and commits SQLite rows.
   * If re-finalizing an already completed session, returns the existing chapterId idempotently.
   */
  async finalizeUpload(uploadId: string, userId: string, manifest: ChapterManifest): Promise<FinalizeUploadResult> {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(uploadId)) {
      throw new UploadServiceError(400, 'Invalid upload ID format');
    }

    const sessionStmt = this.db.prepare('SELECT * FROM upload_sessions WHERE id = ?');
    const session = sessionStmt.get(uploadId) as UploadSessionRecord | undefined;
    if (!session) {
      throw new UploadServiceError(404, 'Upload session not found');
    }

    if (session.user_id !== userId) {
      throw new UploadServiceError(403, 'Forbidden: upload session belongs to another user');
    }

    // Idempotent re-finalization check
    if (session.status === 'complete') {
      if (session.manifest_json) {
        try {
          const parsed = JSON.parse(session.manifest_json);
          if (parsed.chapterId && parsed.seriesSlug) {
            return {
              chapterId: parsed.chapterId,
              seriesSlug: parsed.seriesSlug,
              pageCount: parsed.pageCount || manifest.pages.length,
            };
          }
        } catch {}
      }
      // Fallback query from chapters table
      const chStmt = this.db.prepare('SELECT id, page_count FROM chapters WHERE uploaded_by = ? AND chapter_number = ? ORDER BY created_at DESC LIMIT 1');
      const ch = chStmt.get(userId, session.chapter_number) as { id: string; page_count: number } | undefined;
      if (ch) {
        return {
          chapterId: ch.id,
          seriesSlug: manifest.seriesSlug || 'series',
          pageCount: ch.page_count,
        };
      }
    }

    if (session.status !== 'open') {
      throw new UploadServiceError(400, `Cannot finalize upload in status '${session.status}'`);
    }

    if (new Date(session.expires_at).getTime() < Date.now()) {
      this.db.prepare("UPDATE upload_sessions SET status = 'failed' WHERE id = ?").run(uploadId);
      throw new UploadServiceError(410, 'Upload session has expired');
    }

    // Manifest validation
    if (!manifest || !Array.isArray(manifest.pages) || manifest.pages.length === 0) {
      throw new UploadServiceError(400, 'Manifest must contain a non-empty array of pages');
    }

    if (manifest.pages.length > MAX_CHAPTER_PAGES) {
      throw new UploadServiceError(400, `Chapter exceeds maximum limit of ${MAX_CHAPTER_PAGES} pages`);
    }

    const totalBytes = manifest.pages.reduce((acc, p) => acc + (p.byteLength || 0), 0);
    if (totalBytes > MAX_EXPANDED_BYTES) {
      throw new UploadServiceError(413, 'Total chapter size exceeds 1 GiB limit');
    }

    // Check user quota with the new chapter added
    const currentUsage = this.getUserStorageQuota(userId);
    if (currentUsage + totalBytes > MAX_USER_QUOTA_BYTES) {
      throw new UploadServiceError(413, 'Publishing this chapter would exceed your 10 GiB storage quota');
    }

    // Validate DB records against manifest
    const dbPagesStmt = this.db.prepare(`
      SELECT page_number, file_name, width, height, byte_length, mime_type, sha256
      FROM upload_session_pages
      WHERE upload_id = ?
      ORDER BY page_number ASC
    `);
    const dbPages = dbPagesStmt.all(uploadId) as unknown as UploadSessionPageRecord[];

    if (dbPages.length !== manifest.pages.length) {
      throw new UploadServiceError(
        400,
        `Mismatch: ${dbPages.length} pages confirmed on server, but manifest specifies ${manifest.pages.length} pages`
      );
    }

    const stagingDir = path.join(this.stagingBaseDir, uploadId);

    for (let i = 0; i < manifest.pages.length; i++) {
      const expectedPageNumber = i + 1;
      const mPage = manifest.pages[i];
      const dPage = dbPages[i];

      if (mPage.pageNumber !== expectedPageNumber || dPage.page_number !== expectedPageNumber) {
        throw new UploadServiceError(400, `Non-contiguous or missing page: expected page ${expectedPageNumber}`);
      }

      if (mPage.sha256.toLowerCase() !== dPage.sha256.toLowerCase()) {
        throw new UploadServiceError(400, `SHA-256 checksum mismatch on page ${expectedPageNumber}`);
      }

      if (mPage.byteLength !== dPage.byte_length) {
        throw new UploadServiceError(400, `Byte length mismatch on page ${expectedPageNumber}`);
      }

      const expectedDiskFile = path.join(stagingDir, `${String(expectedPageNumber).padStart(4, '0')}.webp`);
      if (!fs.existsSync(expectedDiskFile)) {
        throw new UploadServiceError(400, `Page file missing on disk in staging: page ${expectedPageNumber}`);
      }
    }

    // Determine or create series
    let seriesId = session.series_id;
    let seriesSlug = '';
    let isNewSeries = false;

    if (seriesId) {
      const sRow = this.db.prepare('SELECT id, slug FROM series WHERE id = ?').get(seriesId) as { id: string; slug: string } | undefined;
      if (!sRow) {
        throw new UploadServiceError(404, `Series '${seriesId}' not found`);
      }
      seriesSlug = sRow.slug;
    } else if (session.new_series_title) {
      let baseSlug = slugify(session.new_series_title);
      if (!baseSlug) {
        baseSlug = `series-${crypto.randomUUID().slice(0, 8)}`;
      }
      let candidateSlug = baseSlug;
      let counter = 1;
      while (this.db.prepare('SELECT id FROM series WHERE slug = ?').get(candidateSlug)) {
        candidateSlug = `${baseSlug}-${counter++}`;
      }
      seriesSlug = candidateSlug;
      seriesId = `series_${crypto.randomUUID().slice(0, 16)}`;
      isNewSeries = true;
    } else {
      throw new UploadServiceError(400, 'Session has neither seriesId nor newSeriesTitle');
    }

    // Duplicate chapter check: do not overwrite an existing published chapter
    const existingChapterStmt = this.db.prepare(`
      SELECT id FROM chapters
      WHERE series_id = ? AND chapter_number = ? AND visibility_status != 'removed'
    `);
    const existingChapter = existingChapterStmt.get(seriesId, session.chapter_number) as { id: string } | undefined;
    if (existingChapter) {
      throw new UploadServiceError(409, `Chapter ${session.chapter_number} already exists for series '${seriesSlug}'`);
    }

    // Mark session as publishing before filesystem operations
    this.db.prepare("UPDATE upload_sessions SET status = 'publishing' WHERE id = ?").run(uploadId);

    // Compute atomic target directory
    const relDir = path.join('series', seriesSlug, 'chapters', String(session.chapter_number));
    const targetDir = path.resolve(this.storageRoot, relDir);

    if (!isContainedBy(this.storageRoot, targetDir)) {
      throw new UploadServiceError(400, 'Resolved chapter destination is outside storage root');
    }

    await fsPromises.mkdir(path.dirname(targetDir), { recursive: true });

    // Clean any prior orphaned target folder
    try {
      await fsPromises.rm(targetDir, { recursive: true, force: true });
    } catch {}

    // Atomic move from staging to final storage destination
    await fsPromises.rename(stagingDir, targetDir);

    const chapterId = `chap_${crypto.randomUUID().slice(0, 16)}`;

    // SQLite transactional commit
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      if (isNewSeries) {
        this.db.prepare(`
          INSERT INTO series (id, slug, title_primary, type, status, created_by, visibility_status)
          VALUES (?, ?, ?, ?, 'ongoing', ?, 'published')
        `).run(
          seriesId,
          seriesSlug,
          session.new_series_title,
          session.new_series_type || 'manga',
          userId
        );

        this.db.prepare(`
          INSERT INTO series_titles (series_id, language_code, title, is_primary)
          VALUES (?, 'en', ?, 1)
        `).run(seriesId, session.new_series_title);
      }

      let volumeId: string | null = null;
      if (session.volume_number !== null && session.volume_number !== undefined) {
        const volRow = this.db.prepare('SELECT id FROM volumes WHERE series_id = ? AND volume_number = ?').get(seriesId, session.volume_number) as { id: string } | undefined;
        if (volRow) {
          volumeId = volRow.id;
        } else {
          volumeId = `vol_${crypto.randomUUID().slice(0, 12)}`;
          this.db.prepare('INSERT INTO volumes (id, series_id, volume_number) VALUES (?, ?, ?)').run(volumeId, seriesId, session.volume_number);
        }
      }

      this.db.prepare(`
        INSERT INTO chapters (
          id, series_id, volume_id, chapter_number, title, page_count,
          storage_path, uploaded_by, visibility_status, storage_bytes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)
      `).run(
        chapterId,
        seriesId,
        volumeId,
        session.chapter_number,
        session.chapter_title ?? null,
        manifest.pages.length,
        relDir.replace(/\\/g, '/'),
        userId,
        totalBytes
      );

      const insertPageStmt = this.db.prepare(`
        INSERT INTO chapter_pages (chapter_id, page_number, file_name, width, height, aspect_ratio)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const p of manifest.pages) {
        const fileName = `${String(p.pageNumber).padStart(4, '0')}.webp`;
        const ar = p.width > 0 && p.height > 0 ? Number((p.width / p.height).toFixed(4)) : 1;
        insertPageStmt.run(chapterId, p.pageNumber, fileName, p.width, p.height, ar);
      }

      const finalManifestJson = JSON.stringify({
        chapterId,
        seriesSlug,
        volumeNumber: session.volume_number,
        chapterNumber: session.chapter_number,
        chapterTitle: session.chapter_title,
        pageCount: manifest.pages.length,
        totalBytes,
        pages: manifest.pages,
        publishedAt: new Date().toISOString(),
      });

      this.db.prepare(`
        UPDATE upload_sessions
        SET status = 'complete', manifest_json = ?
        WHERE id = ?
      `).run(finalManifestJson, uploadId);

      this.db.exec('COMMIT;');

      // Write manifest.json inside published chapter directory
      try {
        await fsPromises.writeFile(path.join(targetDir, 'manifest.json'), finalManifestJson, 'utf-8');
      } catch {}
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }

    return {
      chapterId,
      seriesSlug,
      pageCount: manifest.pages.length,
    };
  }

  /**
   * Cancels an upload session and cleans up staging directory.
   */
  async cancelUpload(uploadId: string, userId: string, isAdmin = false): Promise<void> {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(uploadId)) {
      throw new UploadServiceError(400, 'Invalid upload ID format');
    }

    const sessionStmt = this.db.prepare('SELECT * FROM upload_sessions WHERE id = ?');
    const session = sessionStmt.get(uploadId) as UploadSessionRecord | undefined;
    if (!session) {
      throw new UploadServiceError(404, 'Upload session not found');
    }

    if (!isAdmin && session.user_id !== userId) {
      throw new UploadServiceError(403, 'Forbidden: upload session belongs to another user');
    }

    if (session.status === 'complete') {
      throw new UploadServiceError(400, 'Cannot cancel an already completed upload');
    }

    this.db.prepare("UPDATE upload_sessions SET status = 'failed' WHERE id = ?").run(uploadId);

    const stagingDir = path.join(this.stagingBaseDir, uploadId);
    try {
      await fsPromises.rm(stagingDir, { recursive: true, force: true });
    } catch {}
  }

  /**
   * Author or admin withdrawal of an uploaded chapter.
   * Marks visibility_status = 'removed', deletes physical files, clears storage_bytes,
   * but retains chapter row so reading history/progress is preserved without breaking foreign keys.
   */
  async withdrawChapter(chapterId: string, userId: string, isAdmin = false): Promise<void> {
    const chStmt = this.db.prepare(`
      SELECT id, series_id, storage_path, uploaded_by, visibility_status
      FROM chapters
      WHERE id = ?
    `);
    const chapter = chStmt.get(chapterId) as {
      id: string;
      series_id: string;
      storage_path: string;
      uploaded_by: string | null;
      visibility_status: string;
    } | undefined;

    if (!chapter) {
      throw new UploadServiceError(404, 'Chapter not found');
    }

    if (!isAdmin && chapter.uploaded_by !== userId) {
      throw new UploadServiceError(403, 'Forbidden: only the author or an administrator can withdraw this chapter');
    }

    if (chapter.visibility_status === 'removed') {
      return; // Already withdrawn
    }

    // Physical deletion of chapter files from disk
    const targetDir = path.resolve(this.storageRoot, chapter.storage_path);
    if (isContainedBy(this.storageRoot, targetDir)) {
      try {
        await fsPromises.rm(targetDir, { recursive: true, force: true });
      } catch {}
    }

    // Update SQLite state
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db.prepare(`
        UPDATE chapters
        SET visibility_status = 'removed', storage_bytes = 0
        WHERE id = ?
      `).run(chapterId);

      this.db.prepare('DELETE FROM chapter_pages WHERE chapter_id = ?').run(chapterId);

      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  /**
   * Periodic / startup cleanup of expired upload sessions (>24 hours).
   */
  async cleanupExpiredUploads(): Promise<number> {
    const expiredStmt = this.db.prepare(`
      SELECT id FROM upload_sessions
      WHERE status = 'failed' OR (status = 'open' AND expires_at < datetime('now'))
    `);
    const expiredRows = expiredStmt.all() as Array<{ id: string }>;

    let cleaned = 0;
    for (const row of expiredRows) {
      const stagingDir = path.join(this.stagingBaseDir, row.id);
      try {
        await fsPromises.rm(stagingDir, { recursive: true, force: true });
        this.db.prepare("UPDATE upload_sessions SET status = 'failed' WHERE id = ?").run(row.id);
        cleaned++;
      } catch {}
    }

    return cleaned;
  }

  /**
   * Startup recovery for publishing sessions interrupted mid-process.
   */
  async reconcilePublishingSessions(): Promise<void> {
    const pubStmt = this.db.prepare("SELECT * FROM upload_sessions WHERE status = 'publishing'");
    const sessions = pubStmt.all() as unknown as UploadSessionRecord[];

    for (const s of sessions) {
      if (s.manifest_json) {
        try {
          const parsed = JSON.parse(s.manifest_json);
          const chRow = this.db.prepare('SELECT id FROM chapters WHERE id = ?').get(parsed.chapterId);
          if (chRow) {
            this.db.prepare("UPDATE upload_sessions SET status = 'complete' WHERE id = ?").run(s.id);
            continue;
          }
        } catch {}
      }

      // Check if staging dir still exists
      const stagingDir = path.join(this.stagingBaseDir, s.id);
      if (fs.existsSync(stagingDir)) {
        // Revert to 'open' so client can finalize or retry
        this.db.prepare("UPDATE upload_sessions SET status = 'open' WHERE id = ?").run(s.id);
      } else {
        this.db.prepare("UPDATE upload_sessions SET status = 'failed' WHERE id = ?").run(s.id);
      }
    }
  }
}
