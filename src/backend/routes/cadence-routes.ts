import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  ReadingCadenceService,
  ReadingMode,
} from '../services/reading-cadence-service.js';
import { AuthService } from '../services/auth-service.js';
import { createAuthMiddleware } from '../middleware/auth-middleware.js';
import { getAppConfig } from '../config/app-config.js';

export interface CadenceRoutesOptions {
  db: DatabaseInstance;
  cadenceService?: ReadingCadenceService;
}

export const cadenceRoutes: FastifyPluginAsync<CadenceRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: CadenceRoutesOptions
) => {
  const service = opts.cadenceService ?? new ReadingCadenceService(opts.db);
  const config = getAppConfig();
  const auth = createAuthMiddleware(new AuthService(opts.db));
  const cadencePreHandler = [auth.attachUser];

  /**
   * GET /api/v1/users/:userId/cadence
   * Retrieves reading velocity profile for a user and mode.
   */
  fastify.get<{
    Params: { userId: string };
    Querystring: { mode?: ReadingMode };
  }>('/api/v1/users/:userId/cadence', { preHandler: cadencePreHandler }, async (request, reply) => {
    const userId = request.user?.id || (request.headers['x-user-id'] as string) || request.params.userId || 'local_user';
    const mode = request.query?.mode || 'manga';

    if (!userId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'userId is required',
      });
    }

    const profile = service.getUserCadence(userId, mode);
    return reply.send({
      success: true,
      profile,
    });
  });

  /**
   * POST /api/v1/cadence/record-transition
   * Records a page transition dwell time and computes updated dynamic estimate.
   */
  fastify.post<{
    Body: {
      userId: string;
      chapterId: string;
      pageNumber: number;
      dwellSeconds: number;
      readingMode?: ReadingMode;
      isDoubleSpread?: boolean;
      totalPages?: number;
    };
  }>('/api/v1/cadence/record-transition', { preHandler: cadencePreHandler }, async (request, reply) => {
    const body = request.body;

    if (
      !body ||
      !body.userId ||
      !body.chapterId ||
      body.pageNumber === undefined ||
      body.dwellSeconds === undefined
    ) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'userId, chapterId, pageNumber, and dwellSeconds are required',
      });
    }

    const effectiveUserId = request.user?.id || (request.headers['x-user-id'] as string) || body.userId || 'local_user';

    const result = service.recordTransition({
      userId: effectiveUserId,
      chapterId: body.chapterId,
      pageNumber: Number(body.pageNumber),
      dwellSeconds: Number(body.dwellSeconds),
      readingMode: body.readingMode,
      isDoubleSpread: Boolean(body.isDoubleSpread),
      totalPages: body.totalPages !== undefined ? Number(body.totalPages) : undefined,
    });

    return reply.send({
      success: true,
      prediction: result,
    });
  });

  /**
   * GET /api/v1/chapters/:chapterId/estimate
   * Queries dynamic completion estimate for a given chapter and page position.
   */
  fastify.get<{
    Params: { chapterId: string };
    Querystring: {
      userId: string;
      currentPage: string;
      totalPages: string;
      mode?: ReadingMode;
    };
  }>('/api/v1/chapters/:chapterId/estimate', async (request, reply) => {
    const { chapterId } = request.params;
    const { userId, currentPage, totalPages, mode } = request.query || {};

    if (!chapterId || !userId || !currentPage || !totalPages) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'chapterId, userId, currentPage, and totalPages query parameters are required',
      });
    }

    const cur = parseInt(currentPage, 10);
    const tot = parseInt(totalPages, 10);

    if (isNaN(cur) || isNaN(tot) || cur < 1 || tot < cur) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid currentPage or totalPages numeric bounds',
      });
    }

    const prediction = service.predictCompletion(userId, chapterId, cur, tot, mode || 'manga');
    return reply.send({
      success: true,
      chapterId,
      prediction,
    });
  });

  /**
   * DELETE /api/v1/users/:userId/cadence
   * Resets cadence profile to cold-start baseline.
   */
  fastify.delete<{
    Params: { userId: string };
    Querystring: { mode?: ReadingMode };
  }>('/api/v1/users/:userId/cadence', async (request, reply) => {
    const { userId } = request.params;
    const mode = request.query?.mode;

    service.resetCadence(userId, mode);
    return reply.send({
      success: true,
      message: `Cadence profile reset for user ${userId}`,
    });
  });
};
