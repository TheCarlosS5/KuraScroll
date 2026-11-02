/**
 * KuraScroll - Sprint 99: Adaptive Per-Panel Visual Pacing & Dynamic Zoom Framing Fastify Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  PanelPacingService,
  PanelPacingProfile,
  PacingMode,
  PanelAabb,
  PANEL_PACING_PRESETS,
} from '../services/panel-pacing-service.js';

export interface PanelPacingRoutesOptions {
  db: DatabaseInstance;
  panelPacingService?: PanelPacingService;
}

export function computePanelPacingEtag(
  seriesId: string,
  pacingMode: string,
  transitionDurationMs: number,
  zoomOvershootRatio: number,
  edgePaddingPx: number,
  isMotionReduced: boolean,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"pp-${seriesId}-${pacingMode}-${transitionDurationMs}-${zoomOvershootRatio}-${edgePaddingPx}-${isMotionReduced ? 1 : 0}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const panelPacingRoutes: FastifyPluginAsync<PanelPacingRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: PanelPacingRoutesOptions
) => {
  const service = opts.panelPacingService ?? new PanelPacingService(opts.db);

  /**
   * GET /api/v1/reader/panel-pacing/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/panel-pacing/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computePanelPacingEtag(
      profile.seriesId,
      profile.pacingMode,
      profile.transitionDurationMs,
      profile.zoomOvershootRatio,
      profile.edgePaddingPx,
      profile.isMotionReduced,
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
   * POST /api/v1/reader/panel-pacing/profile
   * Saves or updates panel pacing profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      pacingMode?: PacingMode;
      transitionDurationMs?: number;
      zoomOvershootRatio?: number;
      edgePaddingPx?: number;
      isMotionReduced?: boolean;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/panel-pacing/profile', async (request, reply) => {
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
      pacingMode: body.pacingMode ?? current.pacingMode,
      transitionDurationMs: body.transitionDurationMs ?? current.transitionDurationMs,
      zoomOvershootRatio: body.zoomOvershootRatio ?? current.zoomOvershootRatio,
      edgePaddingPx: body.edgePaddingPx ?? current.edgePaddingPx,
      isMotionReduced: body.isMotionReduced !== undefined ? body.isMotionReduced : current.isMotionReduced,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : current.isEnabled,
      updatedAt: Date.now(),
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/panel-pacing/calculate-framing
   * Evaluates framing transforms and translation vectors in sub-20 microseconds
   */
  fastify.post<{
    Body: {
      sourceAabb?: PanelAabb;
      targetAabb?: PanelAabb;
      viewportWidth?: number;
      viewportHeight?: number;
      progress?: number;
      overshootRatio?: number;
      edgePadding?: number;
      isMotionReduced?: boolean;
      durationMs?: number;
      mode?: PacingMode;
    };
  }>('/api/v1/reader/panel-pacing/calculate-framing', async (request, reply) => {
    const {
      sourceAabb,
      targetAabb,
      viewportWidth,
      viewportHeight,
      progress,
      overshootRatio,
      edgePadding,
      isMotionReduced,
      durationMs,
      mode,
    } = request.body || {};

    const result = service.calculatePanelFramingTransform(
      sourceAabb ?? { x: 0, y: 0, width: 800, height: 600 },
      targetAabb ?? { x: 0, y: 0, width: 800, height: 600 },
      viewportWidth ?? 1280,
      viewportHeight ?? 720,
      progress ?? 1.0,
      overshootRatio ?? 1.05,
      edgePadding ?? 16,
      isMotionReduced ?? false,
      durationMs ?? 280,
      mode ?? 'cinematic_smooth'
    );

    return reply.status(200).send({ success: true, result });
  });

  /**
   * GET /api/v1/reader/panel-pacing/presets
   * Lists predefined panel pacing configurations
   */
  fastify.get('/api/v1/reader/panel-pacing/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: PANEL_PACING_PRESETS,
    });
  });
};
