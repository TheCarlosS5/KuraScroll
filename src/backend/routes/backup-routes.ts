import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { importToSqlite, exportFromSqlite } from '../backup-import/import/import-to-sqlite.js';
import { BackupDaemon } from '../daemon/backup-daemon.js';

export function registerBackupRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  backupDaemon?: BackupDaemon
): void {
  // POST /api/v1/backup/import: Ingests backup (JSON or buffer) and commits to SQLite + FTS5
  app.post('/api/v1/backup/import', async (req, reply) => {
    try {
      const body = req.body as any;

      if (!body) {
        reply.status(400);
        return {
          success: false,
          error: 'BadRequest',
          message: 'Empty backup payload received',
        };
      }

      // Payload can be direct backup, or wrapped in { backup, strict, chunkSize }
      const backupPayload = body.backup !== undefined ? body.backup : body;
      const strict = body.strict === true;
      const chunkSize = typeof body.chunkSize === 'number' ? body.chunkSize : 50;

      const report = await importToSqlite({
        db,
        backup: backupPayload,
        strict,
        chunkSize,
      });

      return report;
    } catch (err: any) {
      reply.status(400);
      return {
        success: false,
        error: 'ImportFailed',
        message: err.message,
      };
    }
  });

  // GET /api/v1/backup/export: Generates and downloads a complete JSON library snapshot
  app.get('/api/v1/backup/export', async (req, reply) => {
    try {
      const query = req.query as { userId?: string };
      const userId = query?.userId || 'local_user';

      const exportData = exportFromSqlite(db, userId);

      const filename = `kurascroll-backup-${new Date().toISOString().slice(0, 10)}.json`;
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      return exportData;
    } catch (err: any) {
      reply.status(500);
      return {
        success: false,
        error: 'ExportFailed',
        message: err.message,
      };
    }
  });
}
