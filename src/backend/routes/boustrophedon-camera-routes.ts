/**
 * KuraScroll - Sprint 114: Adaptive Boustrophedon Panel Sequence Flow & Cinematic Camera Pan Director Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  BoustrophedonCameraService,
  BoustrophedonCameraProfile,
  ReadingFlow,
  TransitionEasing,
  PanelGeometry,
  CameraTrajectoryPlan,
  CameraEvaluatedState,
} from '../services/boustrophedon-camera-service.js';

export interface BoustrophedonCameraRoutesOptions {
  db: DatabaseInstance;
  boustrophedonCameraService?: BoustrophedonCameraService;
}

export function computeBoustrophedonCameraEtag(
  seriesId: string,
  readingFlow: string,
  transitionEasing: string,
  climaxZoomMultiplier: number,
  panLeadInPct: number,
  maxRotationDeg: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"bc-${seriesId}-${readingFlow}-${transitionEasing}-${climaxZoomMultiplier}-${panLeadInPct}-${maxRotationDeg}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const boustrophedonCameraRoutes: FastifyPluginAsync<BoustrophedonCameraRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: BoustrophedonCameraRoutesOptions
) => {
  const service = opts.boustrophedonCameraService ?? new BoustrophedonCameraService(opts.db);

  /**
   * GET /api/v1/reader/boustrophedon-camera/profile/:seriesId
   * Retrieves active profile with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/boustrophedon-camera/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeBoustrophedonCameraEtag(
      profile.seriesId,
      profile.readingFlow,
      profile.transitionEasing,
      profile.climaxZoomMultiplier,
      profile.panLeadInPct,
      profile.maxRotationDeg,
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
   * POST /api/v1/reader/boustrophedon-camera/profile
   * Saves or updates boustrophedon camera profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      readingFlow?: ReadingFlow;
      transitionEasing?: TransitionEasing;
      climaxZoomMultiplier?: number;
      panLeadInPct?: number;
      maxRotationDeg?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/boustrophedon-camera/profile', async (request, reply) => {
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
      readingFlow: body.readingFlow,
      transitionEasing: body.transitionEasing,
      climaxZoomMultiplier: body.climaxZoomMultiplier,
      panLeadInPct: body.panLeadInPct,
      maxRotationDeg: body.maxRotationDeg,
      isEnabled: body.isEnabled,
    });

    return reply.status(200).send({ success: true, profile: updated });
  });

  /**
   * POST /api/v1/reader/boustrophedon-camera/plan-trajectory
   * Computes cubic bezier trajectory coefficients between two panels
   */
  fastify.post<{
    Body: {
      panelA: PanelGeometry;
      panelB: PanelGeometry;
      profile?: Partial<BoustrophedonCameraProfile>;
    };
  }>('/api/v1/reader/boustrophedon-camera/plan-trajectory', async (request, reply) => {
    const { panelA, panelB, profile } = request.body;
    if (!panelA || !panelB) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Both panelA and panelB are required',
      });
    }

    const plan = service.planTrajectory(panelA, panelB, profile);
    return reply.status(200).send({
      success: true,
      plan,
    });
  });

  /**
   * POST /api/v1/reader/boustrophedon-camera/evaluate
   * Zero-allocation Horner polynomial evaluation at progress t
   */
  fastify.post<{
    Body: {
      trajectory: CameraTrajectoryPlan;
      progress: number;
    };
  }>('/api/v1/reader/boustrophedon-camera/evaluate', async (request, reply) => {
    const { trajectory, progress } = request.body;
    if (!trajectory || progress === undefined) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Both trajectory and progress are required',
      });
    }

    const out: CameraEvaluatedState = {
      x: 0,
      y: 0,
      zoom: 1.0,
      rotationDeg: 0,
      targetWidth: 0,
      targetHeight: 0,
    };

    service.evaluateTrajectory(trajectory, progress, out);

    return reply.status(200).send({
      success: true,
      evaluatedState: out,
    });
  });
};
