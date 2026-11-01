import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import path from 'node:path';
import { DatabaseInstance } from '../db/database.js';
import { calculateStorageTelemetry } from '../services/storage-telemetry.js';
import { imageCache, manifestCache } from '../cache/media-cache.js';
import { AdaptiveIngestionController } from '../services/adaptive-ingestion-controller.js';
import { SelfHealingIndexer } from '../services/self-healing-indexer.js';
import { ImageIntegrityService } from '../services/image-integrity-service.js';

export interface TelemetryRoutesOptions {
  db: DatabaseInstance;
  storageRoot?: string;
  adaptiveController?: AdaptiveIngestionController;
  selfHealingIndexer?: SelfHealingIndexer;
  imageIntegrityService?: ImageIntegrityService;
}

export function registerTelemetryRoutes(
  app: FastifyInstance,
  options: TelemetryRoutesOptions
): void {
  const { db, adaptiveController } = options;
  const storageRoot = options.storageRoot
    ? path.resolve(options.storageRoot)
    : path.resolve(process.env.STORAGE_ROOT || './data/storage');

  const selfHealingIndexer =
    options.selfHealingIndexer ??
    new SelfHealingIndexer({
      db,
      storageRoot,
      adaptiveController,
    });

  const integrityService =
    options.imageIntegrityService ??
    new ImageIntegrityService({
      db,
      storageRoot,
      adaptiveController,
    });

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

  // GET /api/v1/telemetry/adaptive
  app.get('/api/v1/telemetry/adaptive', async (_req: FastifyRequest, _reply: FastifyReply) => {
    if (!adaptiveController) {
      return {
        success: false,
        message: 'AdaptiveIngestionController not attached to server.',
      };
    }
    return {
      success: true,
      status: adaptiveController.getStatus(),
    };
  });

  // POST /api/v1/telemetry/adaptive/override
  app.post(
    '/api/v1/telemetry/adaptive/override',
    async (req: FastifyRequest<{ Body: { action?: 'pause' | 'resume' | 'clear' } }>, reply: FastifyReply) => {
      if (!adaptiveController) {
        return reply.status(400).send({
          success: false,
          message: 'AdaptiveIngestionController not attached to server.',
        });
      }

      const action = req.body?.action;
      if (action === 'pause') {
        adaptiveController.forcePause();
      } else if (action === 'resume') {
        adaptiveController.forceResume();
      } else if (action === 'clear') {
        adaptiveController.clearForce();
      } else {
        return reply.status(400).send({
          success: false,
          message: "Invalid action. Expected 'pause', 'resume', or 'clear'.",
        });
      }

      return {
        success: true,
        action,
        status: adaptiveController.getStatus(),
      };
    }
  );

  // POST /api/v1/admin/self-heal
  app.post('/api/v1/admin/self-heal', async (_req: FastifyRequest, _reply: FastifyReply) => {
    const report = await selfHealingIndexer.runFullHealing();
    return {
      success: true,
      report,
    };
  });

  // GET /api/v1/telemetry/integrity
  app.get('/api/v1/telemetry/integrity', async (_req: FastifyRequest, _reply: FastifyReply) => {
    return {
      success: true,
      corruptFiles: integrityService.getCorruptFiles(),
    };
  });

  // POST /api/v1/telemetry/integrity/scan
  app.post(
    '/api/v1/telemetry/integrity/scan',
    async (req: FastifyRequest<{ Body: { chapterId?: string; deep?: boolean } }>, reply: FastifyReply) => {
      const chapterId = req.body?.chapterId;
      if (!chapterId) {
        return reply.status(400).send({
          success: false,
          message: 'Missing chapterId parameter',
        });
      }

      try {
        const report = await integrityService.scanChapter(chapterId, req.body?.deep ?? false);
        return {
          success: true,
          report,
        };
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          message: err.message,
        });
      }
    }
  );
}
