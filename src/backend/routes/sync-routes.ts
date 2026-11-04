import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DatabaseInstance } from '../db/database.js';
import { SyncReplayService, ReplayMutationItem } from '../services/sync-replay-service.js';
import { IOCoordinator, sharedIOCoordinator } from '../storage/io/io-coordinator.js';

interface ReplayRequestBody {
  userId?: string;
  mutations: ReplayMutationItem[];
}

export function registerSyncRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  ioCoordinator: IOCoordinator = sharedIOCoordinator
): void {
  const syncService = new SyncReplayService(db, ioCoordinator);

  /**
   * Replays up to 50 queued client mutations in an atomic, sequential batch
   * executed within a single transaction on the mechanical SATA II storage subsystem.
   */
  app.post(
    '/api/v1/sync/replay',
    async (
      req: FastifyRequest<{ Body: ReplayRequestBody }>,
      reply: FastifyReply
    ) => {
      const body = req.body;

      if (!body || !Array.isArray(body.mutations)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Request body must include a "mutations" array',
        });
      }

      if (body.mutations.length > 50) {
        return reply.status(413).send({
          statusCode: 413,
          error: 'Payload Too Large',
          message: 'Maximum batch replay limit is 50 mutations per request',
        });
      }

      let batchBytes = 0;
      for (const mutation of body.mutations as unknown[]) {
        if (!mutation || typeof mutation !== 'object' || Array.isArray(mutation)) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Each mutation must be an object' });
        }
        const item = mutation as Partial<ReplayMutationItem>;
        if (typeof item.clientMutationId !== 'string' || item.clientMutationId.length < 1 || item.clientMutationId.length > 128 ||
            !['UPDATE_PROGRESS', 'CREATE_BOOKMARK', 'DELETE_BOOKMARK'].includes(item.type || '') ||
            !item.payload || typeof item.payload !== 'object' || Array.isArray(item.payload) ||
            (item.timestamp !== undefined && (typeof item.timestamp !== 'string' || !Number.isFinite(Date.parse(item.timestamp))))) {
          return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Mutation envelope is invalid' });
        }
        batchBytes += Buffer.byteLength(JSON.stringify(mutation), 'utf8');
        if (batchBytes > 512 * 1024) {
          return reply.status(413).send({ statusCode: 413, error: 'Payload Too Large', message: 'Mutation batch exceeds 512 KiB' });
        }
      }

      const rawUserId = typeof body?.userId === 'string' && body.userId.trim() ? body.userId.trim() : 'local_user';
      const userId = rawUserId.replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, 100) || 'local_user';

      try {
        const result = await syncService.replayMutations(userId, body.mutations);
        return reply.status(200).send(result);
      } catch (err: any) {
        req.log.error({ err }, 'Offline sync replay failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'Failed to replay mutations batch. Check server logs.',
        });
      }
    }
  );

  /**
   * Retrieves summary telemetry of applied mutations for a given user.
   */
  app.get(
    '/api/v1/sync/status',
    async (
      req: FastifyRequest<{ Querystring: { userId?: string } }>,
      reply: FastifyReply
    ) => {
      const rawUserId = typeof req.query?.userId === 'string' && req.query.userId.trim() ? req.query.userId.trim() : 'local_user';
      const userId = rawUserId.replace(/[^a-zA-Z0-9_\-\.]/g, '').slice(0, 100) || 'local_user';

      const stats = db
        .prepare(
          `
        SELECT 
          COUNT(*) as total_applied,
          MAX(applied_at) as last_applied_at
        FROM applied_mutations
        WHERE user_id = ?
      `
        )
        .get(userId) as { total_applied: number; last_applied_at: string | null };

      return reply.send({
        userId,
        totalApplied: stats?.total_applied ?? 0,
        lastAppliedAt: stats?.last_applied_at ?? null,
      });
    }
  );
}
