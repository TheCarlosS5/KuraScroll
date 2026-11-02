/**
 * KuraScroll - Sprint 94: Multi-Tier Intelligent Storage Vault Tiering Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  StorageTierService,
  StorageTierProfile,
  AutoTieringMode,
  TieringCandidateInput,
  STORAGE_TIERING_PRESETS,
} from '../services/storage-tier-service.js';

export interface StorageTierRoutesOptions {
  db: DatabaseInstance;
  storageTierService?: StorageTierService;
}

export function computeStorageTierEtag(
  seriesId: string,
  autoTieringMode: string,
  hotRetentionDays: number,
  warmRetentionDays: number,
  diskQuotaTargetGb: number,
  isAutoEvictionEnabled: boolean,
  isPinned: boolean,
  updatedAt: number
): string {
  return `"st-${seriesId}-${autoTieringMode}-${hotRetentionDays}-${warmRetentionDays}-${diskQuotaTargetGb}-${isAutoEvictionEnabled ? 1 : 0}-${isPinned ? 1 : 0}-${updatedAt}"`;
}

export const storageTierRoutes: FastifyPluginAsync<StorageTierRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: StorageTierRoutesOptions
) => {
  const service = opts.storageTierService ?? new StorageTierService(opts.db);

  /**
   * GET /api/v1/reader/storage-tier/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/storage-tier/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeStorageTierEtag(
      profile.seriesId,
      profile.autoTieringMode,
      profile.hotRetentionDays,
      profile.warmRetentionDays,
      profile.diskQuotaTargetGb,
      profile.isAutoEvictionEnabled,
      profile.isPinned,
      profile.updatedAt
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).send({ success: true, profile });
  });

  /**
   * POST /api/v1/reader/storage-tier/profile
   * Saves or updates a storage tier profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      autoTieringMode?: AutoTieringMode;
      hotRetentionDays?: number;
      warmRetentionDays?: number;
      diskQuotaTargetGb?: number;
      isAutoEvictionEnabled?: boolean;
      isPinned?: boolean;
    };
  }>('/api/v1/reader/storage-tier/profile', async (request, reply) => {
    const body = request.body;
    if (!body || !body.seriesId || body.seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing or empty seriesId',
      });
    }

    const current = service.getProfile(body.seriesId);
    const updated = service.setProfile({
      seriesId: body.seriesId,
      autoTieringMode: body.autoTieringMode ?? current.autoTieringMode,
      hotRetentionDays: body.hotRetentionDays ?? current.hotRetentionDays,
      warmRetentionDays: body.warmRetentionDays ?? current.warmRetentionDays,
      diskQuotaTargetGb: body.diskQuotaTargetGb ?? current.diskQuotaTargetGb,
      isAutoEvictionEnabled: body.isAutoEvictionEnabled !== undefined ? body.isAutoEvictionEnabled : current.isAutoEvictionEnabled,
      isPinned: body.isPinned !== undefined ? body.isPinned : current.isPinned,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/storage-tier/calculate-tiering-plan
   * Evaluates candidates and arbitrates tier distribution in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      candidates?: TieringCandidateInput[];
      profile?: Partial<StorageTierProfile>;
      nowMs?: number;
    };
  }>('/api/v1/reader/storage-tier/calculate-tiering-plan', async (request, reply) => {
    const { candidates, profile, nowMs } = request.body || {};

    const plan = service.calculateTieringPlan(
      candidates ?? [],
      profile,
      nowMs ?? Date.now()
    );

    return reply.status(200).send({ success: true, plan });
  });

  /**
   * GET /api/v1/reader/storage-tier/presets
   * Lists predefined storage tier retention policies
   */
  fastify.get('/api/v1/reader/storage-tier/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: STORAGE_TIERING_PRESETS,
    });
  });
};
