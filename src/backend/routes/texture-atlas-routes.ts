/**
 * KuraScroll - Sprint 112: Micro-Tile GPU Texture Atlas Packer & Virtual VRAM Compactor Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  TextureAtlasService,
  PackingStrategy,
  calculateTextureAtlasPlacement,
  TEXTURE_ATLAS_PRESETS,
} from '../services/texture-atlas-service.js';

export interface TextureAtlasRoutesOptions {
  db: DatabaseInstance;
  textureAtlasService?: TextureAtlasService;
}

export function computeTextureAtlasEtag(
  seriesId: string,
  packingStrategy: string,
  atlasMaxDimension: number,
  tilePaddingPx: number,
  maxActiveAtlases: number,
  vramBudgetMb: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"ta-${seriesId}-${packingStrategy}-${atlasMaxDimension}-${tilePaddingPx}-${maxActiveAtlases}-${vramBudgetMb}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const textureAtlasRoutes: FastifyPluginAsync<TextureAtlasRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: TextureAtlasRoutesOptions
) => {
  const service = opts.textureAtlasService ?? new TextureAtlasService(opts.db);

  /**
   * GET /api/v1/reader/texture-atlas/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/texture-atlas/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeTextureAtlasEtag(
      profile.seriesId,
      profile.packingStrategy,
      profile.atlasMaxDimension,
      profile.tilePaddingPx,
      profile.maxActiveAtlases,
      profile.vramBudgetMb,
      profile.isEnabled,
      profile.updatedAt
    );

    const clientEtag = request.headers['if-none-match'];
    if (clientEtag && clientEtag === etag) {
      return reply.status(304).send();
    }

    return reply
      .header('ETag', etag)
      .header('Cache-Control', 'private, no-cache')
      .status(200)
      .send({
        success: true,
        profile,
      });
  });

  /**
   * POST /api/v1/reader/texture-atlas/profile
   * Saves or updates texture atlas profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      packingStrategy?: PackingStrategy;
      atlasMaxDimension?: number;
      tilePaddingPx?: number;
      maxActiveAtlases?: number;
      vramBudgetMb?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/texture-atlas/profile', async (request, reply) => {
    const body = request.body;
    if (!body || !body.seriesId || body.seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing or empty seriesId',
      });
    }

    const updated = service.upsertProfile({
      seriesId: body.seriesId,
      packingStrategy: body.packingStrategy,
      atlasMaxDimension: body.atlasMaxDimension,
      tilePaddingPx: body.tilePaddingPx,
      maxActiveAtlases: body.maxActiveAtlases,
      vramBudgetMb: body.vramBudgetMb,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/texture-atlas/pack
   * Real-time zero-allocation tile atlas packing and UV calculation
   */
  fastify.post<{
    Body: {
      tileId?: string;
      rawW?: number;
      rawH?: number;
      sequenceIndex?: number;
      atlasMaxDimension?: number;
      tilePaddingPx?: number;
      maxActiveAtlases?: number;
      vramBudgetMb?: number;
      strategy?: PackingStrategy;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/texture-atlas/pack', async (request, reply) => {
    const body = request.body ?? {};

    const result = calculateTextureAtlasPlacement(
      body.tileId ?? 'tile-default',
      body.rawW ?? 512,
      body.rawH ?? 512,
      body.sequenceIndex ?? 0,
      body.atlasMaxDimension ?? 2048,
      body.tilePaddingPx ?? 4,
      body.maxActiveAtlases ?? 2,
      body.vramBudgetMb ?? 32,
      body.strategy ?? 'guillotine_bssf',
      body.isEnabled ?? true
    );

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  /**
   * GET /api/v1/reader/texture-atlas/presets
   * Retrieves predefined hardware atlas presets
   */
  fastify.get('/api/v1/reader/texture-atlas/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: service.getPresets(),
    });
  });
};
