import { FastifyInstance } from 'fastify';
import path from 'node:path';
import fs from 'node:fs/promises';
import { DatabaseInstance } from '../db/database.js';
import { importToSqlite, exportFromSqlite } from '../backup-import/import/import-to-sqlite.js';
import { BackupDaemon } from '../daemon/backup-daemon.js';
import { DifferentialMirrorService } from '../services/differential-mirror-service.js';

export function registerBackupRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  backupDaemon?: BackupDaemon,
  differentialMirror?: DifferentialMirrorService,
  mirrorRoot = path.resolve('./data/storage/backups/mirrors'),
  storageRoot = path.resolve('./data/storage')
): void {
  let backupOperationInProgress = false;
  // POST /api/v1/backup/import: Ingests backup (JSON or buffer) and commits to SQLite + FTS5
  app.post('/api/v1/backup/import', { bodyLimit: 16 * 1024 * 1024 }, async (req, reply) => {
    if (backupOperationInProgress) {
      return reply.status(409).send({ success: false, error: 'Conflict', message: 'Another backup operation is already in progress' });
    }
    backupOperationInProgress = true;
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
      const strict = body.strict === undefined ? false : body.strict;
      const chunkSize = body.chunkSize === undefined ? 50 : body.chunkSize;
      if (typeof strict !== 'boolean' || !Number.isSafeInteger(chunkSize) || chunkSize < 1 || chunkSize > 500) {
        reply.status(400);
        return { success: false, error: 'BadRequest', message: 'strict must be boolean and chunkSize must be an integer between 1 and 500' };
      }

      const report = await importToSqlite({
        db,
        backup: backupPayload,
        strict,
        chunkSize,
      });

      return report;
    } catch (err: any) {
      console.error('[backup-import] failed:', err);
      reply.status(500);
      return {
        success: false,
        error: 'ImportFailed',
        message: 'Backup import failed. Check the payload and server logs.',
      };
    } finally {
      backupOperationInProgress = false;
    }
  });

  // GET /api/v1/backup/export: Generates and downloads a complete JSON library snapshot
  app.get('/api/v1/backup/export', async (req, reply) => {
    try {
      const exportData = exportFromSqlite(db, 'local_user');

      const filename = `kurascroll-backup-${new Date().toISOString().slice(0, 10)}.json`;
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      return exportData;
    } catch (err: any) {
      console.error('[backup-export] failed:', err);
      reply.status(500);
      return {
        success: false,
        error: 'ExportFailed',
        message: 'Backup export failed. Check server logs.',
      };
    }
  });

  // POST /api/v1/backup/mirror: Creates differential or full offline disk mirror snapshot
  app.post('/api/v1/backup/mirror', async (req, reply) => {
    if (backupOperationInProgress) {
      return reply.status(409).send({ success: false, error: 'Conflict', message: 'A mirror operation is already in progress' });
    }
    backupOperationInProgress = true;
    try {
      const body = req.body as { destinationDir?: string; differential?: boolean };
      if (!body?.destinationDir || typeof body.destinationDir !== 'string' || !body.destinationDir.trim()) {
        reply.status(400);
        return { success: false, error: 'BadRequest', message: 'Missing destinationDir parameter' };
      }
      if (body?.differential !== undefined && typeof body.differential !== 'boolean') {
        reply.status(400);
        return { success: false, error: 'BadRequest', message: 'differential must be a boolean' };
      }
      if (!differentialMirror) {
        reply.status(500);
        return {
          success: false,
          error: 'Unavailable',
          message: 'DifferentialMirrorService not available',
        };
      }

      const destinationDir = path.resolve(body.destinationDir);
      const report = await differentialMirror.createSnapshot({
        destinationDir,
        differential: body.differential,
      });

      return {
        success: true,
        report,
      };
    } catch (err: any) {
      console.error('[backup-mirror] failed:', err);
      reply.status(500);
      return {
        success: false,
        error: 'MirrorFailed',
        message: 'Mirror creation failed. Check server logs.',
      };
    } finally {
      backupOperationInProgress = false;
    }
  });

  // GET /api/v1/backup/mirror/history: Retrieves historical snapshot records
  app.get('/api/v1/backup/mirror/history', async () => {
    if (!differentialMirror) {
      return { success: false, history: [] };
    }
    return {
      success: true,
      history: differentialMirror.getSnapshotHistory(),
    };
  });
}
