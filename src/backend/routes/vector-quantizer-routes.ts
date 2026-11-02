/**
 * KuraScroll - Sprint 100: Century Jubilee - Vector Quantizer Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  VectorQuantizerService,
  VectorIndexProfile,
  IndexMode,
  VECTOR_INDEX_PRESETS,
} from '../services/vector-quantizer-service.js';

export interface VectorQuantizerRoutesOptions {
  db: DatabaseInstance;
  vectorQuantizerService?: VectorQuantizerService;
}

export function computeVectorQuantizerEtag(
  seriesId: string,
  indexMode: string,
  embeddingDimension: number,
  similarityThreshold: number,
  maxTopK: number,
  isSpoilerShieldActive: boolean,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"vq-${seriesId}-${indexMode}-${embeddingDimension}-${similarityThreshold}-${maxTopK}-${isSpoilerShieldActive ? 1 : 0}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const vectorQuantizerRoutes: FastifyPluginAsync<VectorQuantizerRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: VectorQuantizerRoutesOptions
) => {
  const service = opts.vectorQuantizerService ?? new VectorQuantizerService(opts.db);

  /**
   * GET /api/v1/reader/vector-quantizer/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/vector-quantizer/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeVectorQuantizerEtag(
      profile.seriesId,
      profile.indexMode,
      profile.embeddingDimension,
      profile.similarityThreshold,
      profile.maxTopK,
      profile.isSpoilerShieldActive,
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
   * POST /api/v1/reader/vector-quantizer/profile
   * Saves or updates vector index profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      indexMode?: IndexMode;
      embeddingDimension?: number;
      similarityThreshold?: number;
      maxTopK?: number;
      isSpoilerShieldActive?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/vector-quantizer/profile', async (request, reply) => {
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
      indexMode: body.indexMode ?? current.indexMode,
      embeddingDimension: body.embeddingDimension ?? current.embeddingDimension,
      similarityThreshold: body.similarityThreshold ?? current.similarityThreshold,
      maxTopK: body.maxTopK ?? current.maxTopK,
      isSpoilerShieldActive: body.isSpoilerShieldActive !== undefined ? body.isSpoilerShieldActive : current.isSpoilerShieldActive,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/vector-quantizer/calculate-similarity
   * Evaluates quantized cosine similarity & spoiler shielding in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      queryVec?: number[];
      candidateVec?: number[];
      dimension?: number;
      similarityThreshold?: number;
      isSpoilerShieldActive?: boolean;
      candidateRevealChapter?: number;
      userCurrentChapter?: number;
      mode?: IndexMode;
    };
  }>('/api/v1/reader/vector-quantizer/calculate-similarity', async (request, reply) => {
    const {
      queryVec,
      candidateVec,
      dimension,
      similarityThreshold,
      isSpoilerShieldActive,
      candidateRevealChapter,
      userCurrentChapter,
      mode,
    } = request.body || {};

    const result = service.calculateQuantizedCosineSimilarity(
      queryVec ?? [10, 20, 30, 40],
      candidateVec ?? [10, 20, 30, 40],
      dimension ?? 64,
      similarityThreshold ?? 0.75,
      isSpoilerShieldActive ?? true,
      candidateRevealChapter ?? 1,
      userCurrentChapter ?? 10,
      mode ?? 'int8_quantized'
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/vector-quantizer/presets
   * Lists predefined vector index configurations
   */
  fastify.get('/api/v1/reader/vector-quantizer/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: VECTOR_INDEX_PRESETS,
    });
  });
};
