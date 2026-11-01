import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import path from 'node:path';
import { DatabaseInstance } from '../db/database.js';
import { calculateStorageTelemetry } from '../services/storage-telemetry.js';
import { imageCache, manifestCache } from '../cache/media-cache.js';

export interface TelemetryRoutesOptions {
  db: DatabaseInstance;
  storageRoot?: string;
}

export function registerTelemetryRoutes(
  app: FastifyInstance,
  options: TelemetryRoutesOptions
): void {
  const { db } = options;
  const storageRoot = options.storageRoot
    ? path.resolve(options.storageRoot)
    : path.resolve(process.env.STORAGE_ROOT || './data/storage');

  // GET /api/v1/storage/telemetry
  app.get('/api/v1/storage/telemetry', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const report = await calculateStorageTelemetry(db, storageRoot);
    return {
      success: true,
      telemetry: report,
    };
  });

  // POST /api/v1/storage/cache/flush
  app.post('/api/v1/storage/cache/flush', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const imagesFreed = imageCache.usedBytes;
    const manifestsFreed = manifestCache.usedBytes;

    imageCache.clear();
    manifestCache.clear();

    return {
      success: true,
      message: 'ByteLRU in-memory buffer caches flushed cleanly.',
      freedBytes: {
        images: imagesFreed,
        manifests: manifestsFreed,
        total: imagesFreed + manifestsFreed,
      },
      timestamp: new Date().toISOString(),
    };
  });
}
