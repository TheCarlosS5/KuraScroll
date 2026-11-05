import { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import sharp from 'sharp';
import { DatabaseInstance } from '../db/database.js';
import { SeriesRepository } from '../repositories/series-repository.js';
import { ChapterRepository } from '../repositories/chapter-repository.js';
import { AuthService } from '../services/auth-service.js';
import { createAuthMiddleware } from '../middleware/auth-middleware.js';
import { generateSeriesSlug, assertPathContained, validateImageMagicBytes } from '../services/upload-service.js';
import { optimizeImageToWebP } from '../services/image-processor.js';
import type { PageMetadata } from '../services/image-processor.js';
import { extractArchive } from '../services/archive-extractor.js';
import { getAppConfig } from '../config/app-config.js';
import { uploadConcurrencyGuard } from '../middleware/upload-concurrency.js';
import pLimit from 'p-limit';

// Global bounded concurrency limiters for 2GB VPS:
// - archiveUploadLimit: Max 1 concurrent archive extraction & batch ingestion across the instance
// - sharpUploadLimit: Max 1 concurrent Sharp image processing operation to prevent libvips RAM spikes
export const archiveUploadLimit = pLimit(1);
export const sharpUploadLimit = pLimit(1);

export function registerUploadRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  storageRoot: string
): void {
  const seriesRepo = new SeriesRepository(db);
  const chapterRepo = new ChapterRepository(db);
  const authService = new AuthService(db);
  const authMiddleware = createAuthMiddleware(authService);
  const config = getAppConfig();
  let activeArchiveRequests = 0;

  // Helper to verify user is owner of the series or an admin/moderator
  function canManageSeries(userId: string, role: string, seriesId: string): boolean {
    if (role === 'admin' || role === 'moderator') return true;
    const stmt = db.prepare('SELECT uploader_user_id FROM series WHERE id = ?');
    const row = stmt.get(seriesId) as any;
    return Boolean(row && row.uploader_user_id === userId);
  }

  // POST /api/v1/manga - Create a new user-published manga series
  app.post(
    '/api/v1/manga',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth, authMiddleware.requireVerified] },
    async (req, reply) => {
      const body = (req.body || {}) as {
        titlePrimary?: string;
        type?: 'manga' | 'manhwa' | 'manhua' | 'comic';
        status?: 'ongoing' | 'completed' | 'hiatus' | 'cancelled';
        demographic?: 'shounen' | 'seinen' | 'shoujo' | 'josei' | 'none';
        synopsis?: string;
        author?: string;
        artist?: string;
        releaseYear?: number;
        genres?: string[];
      };

      if (!body.titlePrimary || !body.titlePrimary.trim()) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'El título principal (titlePrimary) es obligatorio.',
        };
      }

      const titlePrimary = body.titlePrimary.trim();
      const type = body.type || 'manga';
      const status = body.status || 'ongoing';
      const demographic = body.demographic || 'none';

      let baseSlug = generateSeriesSlug(titlePrimary);
      let slug = baseSlug;
      let counter = 1;

      // Ensure slug uniqueness
      while (seriesRepo.getSeriesBySlug(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const seriesId = crypto.randomUUID();
      const userId = req.user!.id;

      try {
        seriesRepo.createSeries({
          id: seriesId,
          slug,
          titlePrimary,
          type,
          status,
          demographic,
          synopsis: body.synopsis,
          author: body.author,
          artist: body.artist,
          releaseYear: body.releaseYear,
          genres: body.genres,
          uploaderUserId: userId,
          // Keep a new series hidden until its first chapter upload completes.
          visibility: 'draft',
        });

        // Add primary title to series_titles for multi-lingual search & FTS
        seriesRepo.addSeriesTitles(seriesId, [
          { languageCode: 'es', title: titlePrimary, isPrimary: true },
        ]);

        reply.status(201);
        return {
          statusCode: 201,
          series: seriesRepo.getSeriesBySlug(slug),
          message: 'Serie creada exitosamente.',
        };
      } catch (err: any) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Error al crear la serie.',
        };
      }
    }
  );

  // PUT /api/v1/manga/:seriesId - Update manga metadata (Owner or Admin/Moderator)
  app.put(
    '/api/v1/manga/:seriesId',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth] },
    async (req, reply) => {
      const { seriesId } = req.params as { seriesId: string };
      const userId = req.user!.id;
      const role = req.user!.role;

      if (!canManageSeries(userId, role, seriesId)) {
        reply.status(403);
        return {
          statusCode: 403,
          error: 'Forbidden',
          message: 'No tiene permisos para modificar esta serie.',
        };
      }

      const body = (req.body || {}) as {
        titlePrimary?: string;
        status?: string;
        synopsis?: string;
        author?: string;
        artist?: string;
        visibility?: string;
      };

      const existingStmt = db.prepare('SELECT * FROM series WHERE id = ?');
      const existing = existingStmt.get(seriesId) as any;
      if (!existing) {
        reply.status(404);
        return {
          statusCode: 404,
          error: 'Not Found',
          message: 'Serie no encontrada.',
        };
      }

      const newTitle = body.titlePrimary !== undefined ? body.titlePrimary.trim() : existing.title_primary;
      const newStatus = body.status !== undefined ? body.status : existing.status;
      const newSynopsis = body.synopsis !== undefined ? body.synopsis : existing.synopsis;
      const newAuthor = body.author !== undefined ? body.author : existing.author;
      const newArtist = body.artist !== undefined ? body.artist : existing.artist;
      const newVisibility = body.visibility !== undefined ? body.visibility : existing.visibility;

      const allowedVisibility = req.user!.role === 'admin' || req.user!.role === 'moderator'
        ? ['draft', 'published', 'under_review', 'removed']
        : ['draft', 'published'];
      if (!allowedVisibility.includes(newVisibility)) {
        return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Estado de publicación no válido.' });
      }

      const updateStmt = db.prepare(`
        UPDATE series
        SET title_primary = ?, status = ?, synopsis = ?, author = ?, artist = ?, visibility = ?, updated_at = datetime('now')
        WHERE id = ?
      `);

      updateStmt.run(newTitle, newStatus, newSynopsis, newAuthor, newArtist, newVisibility, seriesId);

      return {
        statusCode: 200,
        ok: true,
        message: 'Serie actualizada correctamente.',
      };
    }
  );

  // DELETE /api/v1/manga/:seriesId - Soft delete manga (visibility = 'removed')
  app.delete(
    '/api/v1/manga/:seriesId',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth] },
    async (req, reply) => {
      const { seriesId } = req.params as { seriesId: string };
      const userId = req.user!.id;
      const role = req.user!.role;

      if (!canManageSeries(userId, role, seriesId)) {
        reply.status(403);
        return {
          statusCode: 403,
          error: 'Forbidden',
          message: 'No tiene permisos para eliminar esta serie.',
        };
      }

      const stmt = db.prepare(`
        UPDATE series
        SET visibility = 'removed', updated_at = datetime('now')
        WHERE id = ?
      `);
      stmt.run(seriesId);

      return {
        statusCode: 200,
        ok: true,
        message: 'Serie retirada de la plataforma.',
      };
    }
  );

  // POST /api/v1/manga/:seriesId/cover - Upload series cover image
  app.post(
    '/api/v1/manga/:seriesId/cover',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth, uploadConcurrencyGuard] },
    async (req, reply) => {
      const { seriesId } = req.params as { seriesId: string };
      if (!canManageSeries(req.user!.id, req.user!.role, seriesId)) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'No tiene permisos para modificar esta serie.' });
      }

      const existing = db.prepare('SELECT id FROM series WHERE id = ?').get(seriesId);
      if (!existing) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Serie no encontrada.' });
      }

      const coversDir = path.resolve(storageRoot, 'covers');
      assertPathContained(coversDir, storageRoot);
      await fsPromises.mkdir(coversDir, { recursive: true });

      const maxBytes = 10 * 1024 * 1024; // 10 MB
      let fileBuffer: Buffer | null = null;
      let fileParts = 0;
      let invalidField = false;

      const parts = req.parts({
        limits: { files: 1, fileSize: maxBytes, fields: 0, parts: 2 },
      });

      for await (const part of parts) {
        if (part.type !== 'file') {
          invalidField = true;
          continue;
        }
        fileParts += 1;
        const input = await part.toBuffer();
        if (fileParts === 1 && (part.fieldname === 'cover' || part.fieldname === 'image' || part.fieldname === 'file')) {
          fileBuffer = input;
        } else {
          invalidField = true;
        }
        if (part.file.truncated || input.length > maxBytes) {
          return reply.code(413).send({
            statusCode: 413,
            error: 'Payload Too Large',
            message: 'La portada debe pesar como máximo 10 MB.',
          });
        }
      }

      if (invalidField || fileParts !== 1 || !fileBuffer) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Envía una sola imagen en el campo "cover".',
        });
      }

      const signature = validateImageMagicBytes(fileBuffer.subarray(0, 12));
      if (!signature.valid) {
        return reply.code(415).send({
          statusCode: 415,
          error: 'Unsupported Media Type',
          message: signature.error || 'Formato de imagen no soportado.',
        });
      }

      const coverFileName = `${seriesId}.webp`;
      const outputPath = path.resolve(coversDir, coverFileName);
      assertPathContained(outputPath, coversDir);

      try {
        await sharpUploadLimit(() =>
          sharp(fileBuffer)
            .rotate()
            .resize({ width: 800, withoutEnlargement: true, fit: 'inside' })
            .webp({ quality: 85 })
            .toFile(outputPath)
        );

        const coverUrl = `/storage/covers/${coverFileName}?v=${Date.now()}`;
        db.prepare(`
          UPDATE series
          SET cover_image = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(coverUrl, seriesId);

        return reply.code(200).send({
          statusCode: 200,
          coverUrl,
          message: 'Portada actualizada correctamente.',
        });
      } catch (err: any) {
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Error al procesar y optimizar la portada.',
        });
      }
    }
  );

  // POST /api/v1/manga/:seriesId/chapters - Create chapter entry
  app.post(
    '/api/v1/manga/:seriesId/chapters',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth, authMiddleware.requireVerified] },
    async (req, reply) => {
      const { seriesId } = req.params as { seriesId: string };
      const userId = req.user!.id;
      const role = req.user!.role;

      if (!canManageSeries(userId, role, seriesId)) {
        reply.status(403);
        return {
          statusCode: 403,
          error: 'Forbidden',
          message: 'No tiene permisos para publicar capítulos en esta serie.',
        };
      }

      const body = (req.body || {}) as {
        chapterNumber?: number;
        title?: string;
        scanlationGroup?: string;
      };

      if (body.chapterNumber === undefined || Number.isNaN(Number(body.chapterNumber))) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'chapterNumber es obligatorio y debe ser numérico.',
        };
      }

      const chapterNumber = Number(body.chapterNumber);
      if (!Number.isFinite(chapterNumber) || chapterNumber < 0) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'chapterNumber debe ser un número finito mayor o igual a cero.',
        };
      }
      const chapterId = crypto.randomUUID();
      const relativeStoragePath = `series/${seriesId}/c${chapterNumber}`;
      const absoluteStoragePath = path.resolve(storageRoot, relativeStoragePath);

      assertPathContained(absoluteStoragePath, storageRoot);

      if (!fs.existsSync(absoluteStoragePath)) {
        fs.mkdirSync(absoluteStoragePath, { recursive: true });
      }

      try {
        chapterRepo.createChapter({
          id: chapterId,
          seriesId,
          chapterNumber,
          title: body.title,
          scanlationGroup: body.scanlationGroup,
          pageCount: 0,
          storagePath: relativeStoragePath,
          visibility: 'draft',
        });

        reply.status(201);
        return {
          statusCode: 201,
          chapter: {
            id: chapterId,
            seriesId,
            chapterNumber,
            title: body.title,
            storagePath: relativeStoragePath,
          },
          message: 'Capítulo registrado. Puede subir las páginas a continuación.',
        };
      } catch (err: any) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: err.message || 'Error al registrar el capítulo.',
        };
      }
    }
  );

  // POST /api/v1/manga/:seriesId/chapters/:chapterId/pages - Stream and optimize page images
  app.post(
    '/api/v1/manga/:seriesId/chapters/:chapterId/pages',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth, authMiddleware.requireVerified, uploadConcurrencyGuard] },
    async (req, reply) => {
      const { seriesId, chapterId } = req.params as { seriesId: string; chapterId: string };
      if (!canManageSeries(req.user!.id, req.user!.role, seriesId)) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'No tiene permisos para subir páginas a este manga.' });
      }

      const chapter = db.prepare(`
        SELECT c.id, c.storage_path, c.page_count, s.uploader_user_id
        FROM chapters c JOIN series s ON s.id = c.series_id
        WHERE c.id = ? AND c.series_id = ?
      `).get(chapterId, seriesId) as { id: string; storage_path: string; page_count: number; uploader_user_id: string | null } | undefined;
      if (!chapter) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Capítulo no encontrado.' });
      }
      if (chapter.page_count >= config.upload.maxPagesPerChapter) {
        return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: `Este capítulo ya llegó al máximo de ${config.upload.maxPagesPerChapter} páginas.` });
      }
      const uploadOwnerId = chapter.uploader_user_id || req.user!.id;

      const chapterDir = path.resolve(storageRoot, chapter.storage_path);
      assertPathContained(chapterDir, storageRoot);
      await fsPromises.mkdir(chapterDir, { recursive: true });

      let writtenFile: string | null = null;
      const maxFileBytes = config.upload.maxFileSizeMb * 1024 * 1024;

      try {
        let fileParts = 0;
        let fileBuffer: Buffer | null = null;
        let invalidField = false;
        const parts = req.parts({
          limits: { files: 2, fileSize: maxFileBytes, fields: 0, parts: 2 },
        });

        for await (const part of parts) {
          if (part.type !== 'file') {
            invalidField = true;
            continue;
          }
          fileParts += 1;
          const input = await part.toBuffer();
          if (fileParts === 1 && part.fieldname === 'page') fileBuffer = input;
          else invalidField = true;
          if (part.file.truncated || input.length > maxFileBytes) {
            return reply.code(413).send({ statusCode: 413, error: 'Payload Too Large', message: `Cada página debe pesar como máximo ${config.upload.maxFileSizeMb} MB.` });
          }
        }

        if (invalidField || fileParts !== 1 || !fileBuffer) {
          return reply.code(400).send({ statusCode: 400, error: 'Bad Request', message: 'Envía una sola imagen en el campo "page".' });
        }
        const signature = validateImageMagicBytes(fileBuffer.subarray(0, 12));
        if (!signature.valid) {
          return reply.code(415).send({ statusCode: 415, error: 'Unsupported Media Type', message: signature.error || 'Formato de imagen no soportado.' });
        }

        const fileName = `page-${crypto.randomUUID()}.webp`;
        const outputPath = path.resolve(chapterDir, fileName);
        assertPathContained(outputPath, chapterDir);
        writtenFile = outputPath;
        const optimized = await sharpUploadLimit(() =>
          optimizeImageToWebP(fileBuffer, outputPath, { pageNumber: 1 })
        );

        db.exec('BEGIN IMMEDIATE');
        try {
          const currentCount = db.prepare('SELECT COUNT(*) AS total FROM chapter_pages WHERE chapter_id = ?').get(chapterId) as { total: number };
          if (Number(currentCount.total) >= config.upload.maxPagesPerChapter) {
            throw Object.assign(new Error(`Un capítulo admite hasta ${config.upload.maxPagesPerChapter} páginas.`), { statusCode: 409 });
          }
          const used = db.prepare(`
            SELECT COALESCE(SUM(cp.file_size_bytes), 0) AS total
            FROM series s
            JOIN chapters c ON c.series_id = s.id
            JOIN chapter_pages cp ON cp.chapter_id = c.id
            WHERE s.uploader_user_id = ?
          `).get(uploadOwnerId) as { total: number };
          const quotaBytes = config.upload.userQuotaGb * 1024 * 1024 * 1024;
          if (Number(used?.total || 0) + optimized.fileSizeBytes > quotaBytes) {
            throw Object.assign(new Error(`La cuenta supera su cuota de ${config.upload.userQuotaGb} GB.`), { statusCode: 413 });
          }
          const pageNumber = Number(currentCount.total) + 1;
          chapterRepo.addPages(chapterId, [{ ...optimized, pageNumber }]);
          db.exec('COMMIT');
          return reply.code(201).send({
            statusCode: 201,
            chapterId,
            pageNumber,
            pageCount: pageNumber,
            fileName,
            message: 'Página subida y optimizada correctamente.',
          });
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      } catch (error) {
        if (writtenFile) await fsPromises.rm(writtenFile, { force: true });
        const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number((error as { statusCode: unknown }).statusCode)
          : 400;
        const message = typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'No se pudo procesar la carga de páginas.';
        return reply.code(statusCode >= 400 && statusCode < 500 ? statusCode : 400).send({
          statusCode,
          error: statusCode === 413 ? 'Payload Too Large' : 'Bad Request',
          message,
        });
      }
    }
  );

  // POST /api/v1/manga/:seriesId/chapters/:chapterId/upload-archive - Ingest chapter pages via ZIP / CBZ
  app.post(
    '/api/v1/manga/:seriesId/chapters/:chapterId/upload-archive',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth, authMiddleware.requireVerified, uploadConcurrencyGuard] },
    async (req, reply) => {
      const { seriesId, chapterId } = req.params as { seriesId: string; chapterId: string };
      if (!canManageSeries(req.user!.id, req.user!.role, seriesId)) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'No tiene permisos para subir capítulos a este manga.' });
      }

      const chapter = db.prepare(`
        SELECT c.id, c.storage_path, c.page_count, s.uploader_user_id
        FROM chapters c JOIN series s ON s.id = c.series_id
        WHERE c.id = ? AND c.series_id = ?
      `).get(chapterId, seriesId) as { id: string; storage_path: string; page_count: number; uploader_user_id: string | null } | undefined;
      if (!chapter) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Capítulo no encontrado.' });
      }

      const chapterDir = path.resolve(storageRoot, chapter.storage_path);
      assertPathContained(chapterDir, storageRoot);
      await fsPromises.mkdir(chapterDir, { recursive: true });

      const maxArchiveBytes = 250 * 1024 * 1024; // 250 MB
      const tempDir = path.resolve(storageRoot, 'tmp', `arch-${crypto.randomUUID()}`);
      await fsPromises.mkdir(tempDir, { recursive: true });
      const tempArchiveFile = path.resolve(tempDir, 'upload.zip');

      // Reject before reading the request body if another archive is already
      // using the instance's bounded extraction and image-processing budget.
      if (activeArchiveRequests >= 1) {
        await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        return reply.code(429).send({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'El servidor está procesando otra carga. Inténtalo de nuevo en unos momentos.',
        });
      }
      activeArchiveRequests += 1;

      let archiveSaved = false;
      let filesCommitted = false;
      let committedPageCount = chapter.page_count;
      const createdFiles: string[] = [];
      try {
        let fileParts = 0;
        let invalidField = false;

        const parts = req.parts({
          limits: { files: 1, fileSize: maxArchiveBytes, fields: 0, parts: 2 },
        });

        for await (const part of parts) {
          if (part.type !== 'file') {
            invalidField = true;
            continue;
          }
          fileParts += 1;
          const ext = path.extname(part.filename).toLowerCase();
          if ((ext !== '.zip' && ext !== '.cbz') || part.fieldname !== 'archive') {
            invalidField = true;
            for await (const _chunk of part.file) {
              // Drain rejected multipart file streams so the request can finish cleanly.
            }
            continue;
          }

          const writeStream = fs.createWriteStream(tempArchiveFile);
          await new Promise<void>((resolve, reject) => {
            part.file.pipe(writeStream);
            writeStream.on('finish', () => resolve());
            writeStream.on('error', (err) => reject(err));
            part.file.on('error', (err) => reject(err));
          });
          archiveSaved = true;

          if (part.file.truncated) {
            return reply.code(413).send({
              statusCode: 413,
              error: 'Payload Too Large',
              message: 'El archivo ZIP/CBZ supera el límite de 250 MB.',
            });
          }
        }

        if (invalidField || fileParts !== 1 || !archiveSaved) {
          return reply.code(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Envía un único archivo comprimido (.zip o .cbz) en el campo "archive".',
          });
        }

        // Bounded concurrency backpressure: reject if archive processing queue is already saturated
        if (archiveUploadLimit.pendingCount >= 1) {
          return reply.code(429).send({
            statusCode: 429,
            error: 'Too Many Requests',
            message: 'El servidor está procesando otra carga de archivo. Por favor, reintente en unos momentos.',
          });
        }

        let addedPageCount = 0;

        await archiveUploadLimit(async () => {
          const extractDest = path.resolve(tempDir, 'extracted');
          const extractedImages = await extractArchive(tempArchiveFile, extractDest);

          if (extractedImages.length === 0) {
            throw Object.assign(
              new Error('El archivo comprimido no contiene imágenes válidas (.jpg, .png, .webp).'),
              { statusCode: 400 }
            );
          }

          if (chapter.page_count + extractedImages.length > config.upload.maxPagesPerChapter) {
            throw Object.assign(
              new Error(`El archivo contiene ${extractedImages.length} páginas, superando el límite de ${config.upload.maxPagesPerChapter} páginas por capítulo.`),
              { statusCode: 409 }
            );
          }

          const quotaBytes = config.upload.userQuotaGb * 1024 * 1024 * 1024;
          const uploadOwnerId = chapter.uploader_user_id || req.user!.id;

          const optimizedPages: PageMetadata[] = [];

          for (let i = 0; i < extractedImages.length; i++) {
            const imgPath = extractedImages[i];

            // Read only first 12 bytes for magic byte validation (avoid loading entire image into V8 heap)
            const handle = await fsPromises.open(imgPath, 'r');
            const headerBuf = Buffer.alloc(12);
            try {
              await handle.read(headerBuf, 0, 12, 0);
            } finally {
              await handle.close();
            }

            const sig = validateImageMagicBytes(headerBuf);
            if (!sig.valid) {
              continue;
            }

            const fileName = `page-${crypto.randomUUID()}.webp`;
            const outputPath = path.resolve(chapterDir, fileName);
            assertPathContained(outputPath, chapterDir);

            createdFiles.push(outputPath);

            // Stream directly from disk via file path + enforce Sharp concurrency bound
            const meta = await sharpUploadLimit(() =>
              optimizeImageToWebP(imgPath, outputPath, { pageNumber: i + 1 })
            );
            optimizedPages.push(meta);

            // Cooperative multitasking: yield event loop after each page to serve HTTP traffic & health checks
            await new Promise((resolve) => setImmediate(resolve));
          }

          if (optimizedPages.length === 0) {
            throw Object.assign(
              new Error('No se encontraron imágenes válidas dentro del archivo comprimido.'),
              { statusCode: 400 }
            );
          }

          db.exec('BEGIN IMMEDIATE');
          try {
            const currentCount = db.prepare('SELECT COUNT(*) AS total FROM chapter_pages WHERE chapter_id = ?').get(chapterId) as { total: number };
            const nextPageCount = Number(currentCount.total) + optimizedPages.length;
            if (nextPageCount > config.upload.maxPagesPerChapter) {
              throw Object.assign(new Error(`Un capítulo admite hasta ${config.upload.maxPagesPerChapter} páginas.`), { statusCode: 409 });
            }

            const used = db.prepare(`
              SELECT COALESCE(SUM(cp.file_size_bytes), 0) AS total
              FROM series s
              JOIN chapters c ON c.series_id = s.id
              JOIN chapter_pages cp ON cp.chapter_id = c.id
              WHERE s.uploader_user_id = ?
            `).get(uploadOwnerId) as { total: number };
            const addedBytes = optimizedPages.reduce((sum, page) => sum + page.fileSizeBytes, 0);
            if (Number(used?.total || 0) + addedBytes > quotaBytes) {
              throw Object.assign(new Error(`La cuenta supera su cuota de ${config.upload.userQuotaGb} GB.`), { statusCode: 413 });
            }

            const pagesWithNumbers = optimizedPages.map((page, index) => ({
              ...page,
              pageNumber: Number(currentCount.total) + index + 1,
            }));
            chapterRepo.addPages(chapterId, pagesWithNumbers);
            committedPageCount = nextPageCount;
            addedPageCount = optimizedPages.length;
            db.exec('COMMIT');
            filesCommitted = true;
          } catch (dbErr) {
            db.exec('ROLLBACK');
            throw dbErr;
          }
        });

        return reply.code(201).send({
          statusCode: 201,
          chapterId,
          pageCount: committedPageCount,
          addedPages: addedPageCount,
          message: `${addedPageCount} páginas extraídas y optimizadas exitosamente.`,
        });
      } catch (err: any) {
        const statusCode = typeof err === 'object' && err !== null && 'statusCode' in err
          ? Number(err.statusCode)
          : 400;
        if (!filesCommitted) {
          await Promise.all(createdFiles.map((file) => fsPromises.rm(file, { force: true }).catch(() => {})));
        }
        return reply.code(statusCode >= 400 && statusCode < 500 ? statusCode : 500).send({
          statusCode,
          error: statusCode === 413 ? 'Payload Too Large' : 'Bad Request',
          message: err.message || 'Error al procesar el archivo comprimido.',
        });
      } finally {
        await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        activeArchiveRequests = Math.max(0, activeArchiveRequests - 1);
      }
    }
  );

  // PUT /api/v1/manga/:seriesId/chapters/:chapterId/publish - Publish a complete chapter
  app.put(
    '/api/v1/manga/:seriesId/chapters/:chapterId/publish',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth, authMiddleware.requireVerified] },
    async (req, reply) => {
      const { seriesId, chapterId } = req.params as { seriesId: string; chapterId: string };
      if (!canManageSeries(req.user!.id, req.user!.role, seriesId)) {
        return reply.code(403).send({ statusCode: 403, error: 'Forbidden', message: 'No tiene permisos para publicar este capítulo.' });
      }

      const result = db.prepare(`
        UPDATE chapters SET visibility = 'published'
        WHERE id = ? AND series_id = ? AND page_count > 0
      `).run(chapterId, seriesId);
      if (Number(result.changes || 0) === 0) {
        const chapter = db.prepare('SELECT page_count FROM chapters WHERE id = ? AND series_id = ?').get(chapterId, seriesId) as { page_count: number } | undefined;
        const exists = Boolean(chapter);
        return reply.code(exists ? 409 : 404).send({
          statusCode: exists ? 409 : 404,
          error: exists ? 'Conflict' : 'Not Found',
          message: exists ? 'Sube al menos una página antes de publicar el capítulo.' : 'Capítulo no encontrado.',
        });
      }

      return reply.code(200).send({ statusCode: 200, chapterId, visibility: 'published', message: 'Capítulo publicado.' });
    }
  );

  // DELETE /api/v1/manga/:seriesId/chapters/:chapterId - Hide chapter
  app.delete(
    '/api/v1/manga/:seriesId/chapters/:chapterId',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth] },
    async (req, reply) => {
      const { seriesId, chapterId } = req.params as { seriesId: string; chapterId: string };
      const userId = req.user!.id;
      const role = req.user!.role;

      if (!canManageSeries(userId, role, seriesId)) {
        reply.status(403);
        return {
          statusCode: 403,
          error: 'Forbidden',
          message: 'No tiene permisos para eliminar este capítulo.',
        };
      }

      const existingChapter = db.prepare(`
        SELECT storage_path, visibility FROM chapters WHERE id = ? AND series_id = ?
      `).get(chapterId, seriesId) as { storage_path: string; visibility: string } | undefined;
      if (!existingChapter) {
        return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Capítulo no encontrado.' });
      }

      if (existingChapter.visibility === 'draft') {
        const chapterDir = path.resolve(storageRoot, existingChapter.storage_path);
        assertPathContained(chapterDir, storageRoot);
        if (chapterDir === path.resolve(storageRoot)) {
          return reply.code(409).send({ statusCode: 409, error: 'Conflict', message: 'La ruta del capítulo no es válida.' });
        }

        db.exec('BEGIN IMMEDIATE');
        try {
          db.prepare('DELETE FROM chapter_pages WHERE chapter_id = ?').run(chapterId);
          db.prepare('DELETE FROM chapters WHERE id = ? AND series_id = ?').run(chapterId, seriesId);
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
        await fsPromises.rm(chapterDir, { recursive: true, force: true });
        return reply.code(200).send({ statusCode: 200, ok: true, message: 'Borrador de capítulo eliminado.' });
      }

      const stmt = db.prepare(`
        UPDATE chapters
        SET visibility = 'removed'
        WHERE id = ? AND series_id = ?
      `);
      stmt.run(chapterId, seriesId);

      return {
        statusCode: 200,
        ok: true,
        message: 'Capítulo retirado.',
      };
    }
  );
}
