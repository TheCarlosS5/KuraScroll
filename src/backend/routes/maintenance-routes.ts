import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { StorageCompactorService } from '../services/storage-compactor-service.js';

export interface MaintenanceRoutesOptions {
  db: DatabaseInstance;
  storageRoot: string;
  dbPath?: string;
  compactorService?: StorageCompactorService;
}

export function registerMaintenanceRoutes(
  app: FastifyInstance,
  options: MaintenanceRoutesOptions
): void {
  const compactor =
    options.compactorService ??
    new StorageCompactorService({
      db: options.db,
      storageRoot: options.storageRoot,
      dbPath: options.dbPath,
    });

  // Get current storage, WAL and compaction status
  app.get('/api/v1/admin/maintenance/status', async () => {
    return {
      success: true,
      status: compactor.getStatus(),
    };
  });

  // Trigger non-blocking storage compaction and WAL checkpointer
  app.post('/api/v1/admin/maintenance/compact', async (req, reply) => {
    try {
      const report = await compactor.runCompaction();
      return {
        success: true,
        report,
      };
    } catch (err: any) {
      req.log.error({ err }, 'Storage compaction failed');
      if (err.message && err.message.includes('already in progress')) {
        reply.status(409);
        return {
          statusCode: 409,
          error: 'Conflict',
          message: err.message,
        };
      }
      reply.status(500);
      return {
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Compaction failed. Check server logs.',
      };
    }
  });
}
