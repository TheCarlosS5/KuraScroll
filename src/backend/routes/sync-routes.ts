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

      const userId = body.userId || 'local_user';

      try {
        const result = await syncService.replayMutations(userId, body.mutations);
        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message || 'Failed to replay mutations batch',
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
      const userId = req.query?.userId || 'local_user';

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
