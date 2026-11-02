/**
 * KuraScroll Continuous Reading Session Milestones & Autonomous Cloudless Sync Fastify Routes
 * Sprint 85 - CloudlessSync Engine
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  CloudlessSyncService,
  SyncMilestoneProfile,
  SyncMode,
  resolveVectorClockMerge,
  computeSyncMilestoneEtag,
  SUPPORTED_SYNC_MODES,
} from '../services/cloudless-sync-service.js';

export interface CloudlessSyncRoutesOptions {
  db: DatabaseInstance;
  cloudlessSyncService?: CloudlessSyncService;
}

export const cloudlessSyncRoutes: FastifyPluginAsync<CloudlessSyncRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: CloudlessSyncRoutesOptions
) => {
  const service = opts.cloudlessSyncService ?? new CloudlessSyncService(opts.db);

  /**
   * GET /api/v1/reader/cloudless-sync/milestone/:seriesId
   * Retrieves active milestone profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
    Querystring: { userId?: string };
  }>('/api/v1/reader/cloudless-sync/milestone/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;
    const { userId } = request.query;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId, userId);
    const etag = computeSyncMilestoneEtag(
      profile.seriesId,
      profile.deviceId,
      profile.vectorClock,
      profile.chaptersCompleted,
      profile.totalReadingSeconds
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).send({ success: true, profile });
  });

  /**
   * POST /api/v1/reader/cloudless-sync/milestone
   * Saves or updates a sync milestone profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      userId?: string;
      deviceId?: string;
      vectorClock?: number;
      chaptersCompleted?: number;
      totalReadingSeconds?: number;
      streakDays?: number;
      syncMode?: SyncMode;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/cloudless-sync/milestone', async (request, reply) => {
    const body = request.body;
    if (!body || !body.seriesId || body.seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'seriesId is required',
      });
    }

    const saved = service.saveProfile({
      seriesId: body.seriesId.trim(),
      userId: body.userId ?? 'default_user',
      deviceId: body.deviceId ?? 'host_pc',
      vectorClock: body.vectorClock ?? 1,
      chaptersCompleted: body.chaptersCompleted ?? 0,
      totalReadingSeconds: body.totalReadingSeconds ?? 0,
      streakDays: body.streakDays ?? 1,
      syncMode: body.syncMode ?? 'local_broadcast',
      isEnabled: body.isEnabled ?? true,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: saved });
  });

  /**
   * POST /api/v1/reader/cloudless-sync/reconcile-peer
   * Reconciles peer state using CRDT vector clock merge (SLA 49)
   */
  fastify.post<{
    Body: {
      seriesId: string;
      userId?: string;
      remoteState: {
        deviceId: string;
        vectorClock: number;
        chaptersCompleted: number;
        totalReadingSeconds: number;
        timestamp: number;
      };
    };
  }>('/api/v1/reader/cloudless-sync/reconcile-peer', async (request, reply) => {
    const body = request.body;
    if (!body || !body.seriesId || !body.remoteState) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'seriesId and remoteState are required',
      });
    }

    const localProfile = service.getProfile(body.seriesId, body.userId);
    const reconciled = service.reconcilePeerState(localProfile, body.remoteState);

    return reply.status(200).send({ success: true, profile: reconciled });
  });

  /**
   * GET /api/v1/reader/cloudless-sync/modes
   * Returns supported cloudless sync modes
   */
  fastify.get('/api/v1/reader/cloudless-sync/modes', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      modes: SUPPORTED_SYNC_MODES,
    });
  });
};
