import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fsPromises from 'node:fs/promises';
import sharp from 'sharp';
import { DatabaseInstance } from '../db/database.js';
import { UserRepository } from '../repositories/user-repository.js';
import { AuthService } from '../services/auth-service.js';
import { createAuthMiddleware } from '../middleware/auth-middleware.js';
import { validateImageMagicBytes, assertPathContained } from '../services/upload-service.js';
import { uploadConcurrencyGuard } from '../middleware/upload-concurrency.js';

export function registerProfileRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  storageRoot: string = path.resolve('./data/storage')
): void {
  const userRepo = new UserRepository(db);
  const authService = new AuthService(db);
  const authMiddleware = createAuthMiddleware(authService);

  // GET /api/v1/users/:handle - Public profile
  app.get('/api/v1/users/:handle', async (req, reply) => {
    const { handle } = req.params as { handle: string };
    const profile = userRepo.getPublicProfile(handle);

    if (!profile) {
      reply.status(404);
      return {
        statusCode: 404,
        error: 'Not Found',
        message: `El usuario @${handle} no existe.`,
      };
    }

    // Fetch public published series uploaded by this user
    let publishedSeries: any[] = [];
    try {
      const seriesStmt = db.prepare(`
        SELECT id, slug, title_primary, type, status, cover_image, updated_at
        FROM series
        WHERE uploader_user_id = ? AND visibility = 'published'
        ORDER BY updated_at DESC
        LIMIT 50
      `);
      publishedSeries = seriesStmt.all(profile.id) as any[];
    } catch {
      publishedSeries = [];
    }

    return {
      profile,
      series: publishedSeries.map((s) => ({
        id: s.id,
        slug: s.slug,
        titlePrimary: s.title_primary,
        type: s.type,
        status: s.status,
        coverImage: s.cover_image,
        updatedAt: s.updated_at,
      })),
    };
  });

  // PUT /api/v1/users/me - Update authenticated user's own profile
  app.put(
    '/api/v1/users/me',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth] },
    async (req, reply) => {
      const body = (req.body || {}) as {
        displayName?: string;
        bio?: string;
        avatarUrl?: string;
      };

      const userId = req.user!.id;

      if (body.displayName && body.displayName.trim().length > 60) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'El nombre visible no puede exceder 60 caracteres.',
        };
      }

      if (body.bio && body.bio.length > 500) {
        reply.status(400);
        return {
          statusCode: 400,
          error: 'Bad Request',
          message: 'La biografía no puede exceder 500 caracteres.',
        };
      }

      const updatedUser = userRepo.updateProfile(userId, {
        displayName: body.displayName,
        bio: body.bio,
        avatarUrl: body.avatarUrl,
      });

      return {
        statusCode: 200,
        user: updatedUser,
        message: 'Perfil actualizado correctamente.',
      };
    }
  );

  // POST /api/v1/users/me/avatar - Upload authenticated user's avatar image
  app.post(
    '/api/v1/users/me/avatar',
    { preHandler: [authMiddleware.attachUser, authMiddleware.requireAuth, uploadConcurrencyGuard] },
    async (req, reply) => {
      const userId = req.user!.id;
      const avatarDir = path.resolve(storageRoot, 'avatars');
      assertPathContained(avatarDir, storageRoot);
      await fsPromises.mkdir(avatarDir, { recursive: true });

      const maxBytes = 5 * 1024 * 1024; // 5 MB
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
        if (fileParts === 1 && part.fieldname === 'avatar') {
          fileBuffer = input;
        } else {
          invalidField = true;
        }
        if (part.file.truncated || input.length > maxBytes) {
          return reply.code(413).send({
            statusCode: 413,
            error: 'Payload Too Large',
            message: 'El avatar no puede superar los 5 MB.',
          });
        }
      }

      if (invalidField || fileParts !== 1 || !fileBuffer) {
        return reply.code(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Envía una sola imagen en el campo "avatar".',
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

      const avatarFileName = `${userId}.webp`;
      const outputPath = path.resolve(avatarDir, avatarFileName);
      assertPathContained(outputPath, avatarDir);

      try {
        await sharp(fileBuffer)
          .rotate()
          .resize(256, 256, { fit: 'cover' })
          .webp({ quality: 85 })
          .toFile(outputPath);

        const avatarUrl = `/storage/avatars/${avatarFileName}?v=${Date.now()}`;
        const updatedUser = userRepo.updateProfile(userId, { avatarUrl });

        return reply.code(200).send({
          statusCode: 200,
          avatarUrl,
          user: updatedUser,
          message: 'Avatar actualizado correctamente.',
        });
      } catch (err: any) {
        return reply.code(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Error al procesar la imagen del avatar.',
        });
      }
    }
  );
}
