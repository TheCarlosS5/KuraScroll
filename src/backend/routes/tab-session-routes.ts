/**
 * KuraScroll Multi-Tab Session & Leader Election Fastify Routes
 * Sprint 65 - Zero-Latency Cross-Tab Coordination Endpoints
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  TabSessionService,
  TabHeartbeatInput,
  TabSessionRecord,
} from '../services/tab-session-service.js';

export interface TabSessionRoutesOptions {
  db: DatabaseInstance;
  tabSessionService?: TabSessionService;
}

export const tabSessionRoutes: FastifyPluginAsync<TabSessionRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: TabSessionRoutesOptions
) => {
  const service = opts.tabSessionService ?? new TabSessionService(opts.db);

  /**
   * POST /api/v1/sync/tabs/heartbeat
   * Upserts tab session heartbeat
   */
  fastify.post<{
    Body: TabHeartbeatInput;
  }>('/api/v1/sync/tabs/heartbeat', async (request, reply) => {
    const { tabId, userId, isLeader, leaderEpoch, activeSeriesId, activeChapterId } =
      request.body ?? {};

    if (!tabId || !tabId.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Body field "tabId" is required',
      });
    }

    const session: TabSessionRecord = service.recordHeartbeat({
      tabId,
      userId,
      isLeader,
      leaderEpoch,
      activeSeriesId,
      activeChapterId,
    });

    return reply.status(200).send({
      success: true,
      session,
    });
  });

  /**
   * GET /api/v1/sync/tabs/active
   * Lists active tab sessions for a user
   */
  fastify.get<{
    Querystring: {
      userId?: string;
      maxAgeMs?: string | number;
    };
  }>('/api/v1/sync/tabs/active', async (request, reply) => {
    const { userId = 'default_user', maxAgeMs } = request.query;

    const maxAge =
      maxAgeMs !== undefined
        ? typeof maxAgeMs === 'string'
          ? parseInt(maxAgeMs, 10)
          : maxAgeMs
        : 15000;

    const sessions = service.getActiveSessions(userId, maxAge);

    return reply.status(200).send({
      success: true,
      count: sessions.length,
      sessions,
    });
  });

  /**
   * POST /api/v1/sync/tabs/resign
   * Explicitly resigns leadership for a tab
   */
  fastify.post<{
    Body: { tabId?: string };
  }>('/api/v1/sync/tabs/resign', async (request, reply) => {
    const { tabId } = request.body ?? {};

    if (!tabId || !tabId.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Body field "tabId" is required',
      });
    }

    const resigned = service.resignLeader(tabId.trim());

    return reply.status(200).send({
      success: true,
      resigned,
    });
  });

  /**
   * DELETE /api/v1/sync/tabs/:tabId
   * Deregisters a closed tab session
   */
  fastify.delete<{
    Params: { tabId: string };
  }>('/api/v1/sync/tabs/:tabId', async (request, reply) => {
    const { tabId } = request.params;

    if (!tabId || !tabId.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Parameter "tabId" is required',
      });
    }

    const removed = service.removeSession(tabId.trim());

    return reply.status(200).send({
      success: true,
      removed,
    });
  });
};
