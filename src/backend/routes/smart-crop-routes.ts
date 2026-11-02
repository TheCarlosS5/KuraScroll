/**
 * KuraScroll Adaptive Panel Dynamic Cropping & Smart Margin Trimming Fastify Routes
 * Sprint 84 - SmartCrop Engine
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  SmartCropService,
  SmartCropProfile,
  SmartCropMode,
  ContentBounds,
  calculateCropBoundingBox,
  computeSmartCropEtag,
  SUPPORTED_CROP_MODES,
} from '../services/smart-crop-service.js';

export interface SmartCropRoutesOptions {
  db: DatabaseInstance;
  smartCropService?: SmartCropService;
}

export const smartCropRoutes: FastifyPluginAsync<SmartCropRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: SmartCropRoutesOptions
) => {
  const service = opts.smartCropService ?? new SmartCropService(opts.db);

  /**
   * GET /api/v1/reader/smart-crop/profile/:seriesId
   * Retrieves active smart crop profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/smart-crop/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeSmartCropEtag(
      profile.mode,
      profile.marginThreshold,
      profile.aspectRatioLock,
      profile.targetAspectRatio,
      profile.paddingPx,
      profile.isEnabled
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).send({ success: true, profile });
  });

  /**
   * POST /api/v1/reader/smart-crop/profile
   * Saves or updates a smart crop profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      mode?: SmartCropMode;
      marginThreshold?: number;
      aspectRatioLock?: boolean;
      targetAspectRatio?: number;
      paddingPx?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/smart-crop/profile', async (request, reply) => {
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
      mode: body.mode ?? 'dialogue_safe',
      marginThreshold: body.marginThreshold ?? 0.96,
      aspectRatioLock: body.aspectRatioLock ?? false,
      targetAspectRatio: body.targetAspectRatio ?? 0.70,
      paddingPx: body.paddingPx ?? 12,
      isEnabled: body.isEnabled ?? true,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: saved });
  });

  /**
   * POST /api/v1/reader/smart-crop/calculate-crop
   * Zero-allocation sub-20µs crop bounding box resolution (SLA 48)
   */
  fastify.post<{
    Body: {
      pageWidth: number;
      pageHeight: number;
      contentBounds: ContentBounds;
      mode?: SmartCropMode;
      paddingPx?: number;
      lockAspectRatio?: boolean;
      targetRatio?: number;
    };
  }>('/api/v1/reader/smart-crop/calculate-crop', async (request, reply) => {
    const body = request.body;
    if (!body || !body.contentBounds) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'pageWidth, pageHeight, and contentBounds are required',
      });
    }

    const cropResult = calculateCropBoundingBox(
      body.pageWidth,
      body.pageHeight,
      body.contentBounds,
      body.mode,
      body.paddingPx,
      body.lockAspectRatio,
      body.targetRatio
    );

    return reply.status(200).send({ success: true, cropResult });
  });

  /**
   * GET /api/v1/reader/smart-crop/modes
   * Returns dictionary of supported smart crop modes
   */
  fastify.get('/api/v1/reader/smart-crop/modes', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      modes: SUPPORTED_CROP_MODES,
    });
  });
};
