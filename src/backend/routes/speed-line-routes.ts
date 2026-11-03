/**
 * KuraScroll - Sprint 125: Dynamic Speed-Line Vector Synthesizer & Kinetic Impact Focus Engine Routes
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  SpeedLineService,
  SpeedLinePresetName,
  SpeedLineMode,
  SPEED_LINE_PRESETS,
  calculateSpeedLines,
  evaluateImpactPulse,
} from '../services/speed-line-service.js';

export interface SpeedLineRoutesOptions {
  db: DatabaseInstance;
  speedLineService?: SpeedLineService;
}

export function computeSpeedLineEtag(
  seriesId: string,
  presetName: string,
  mode: string,
  lineCount: number,
  focusX: number,
  focusY: number,
  angleJitter: number,
  minLengthRatio: number,
  maxLengthRatio: number,
  minWidthPx: number,
  maxWidthPx: number,
  pulseDurationMs: number,
  isEnabled: boolean,
  updatedAt: number
): string {
  return `"sl-${seriesId}-${presetName}-${mode}-${lineCount}-${focusX}-${focusY}-${angleJitter}-${minLengthRatio}-${maxLengthRatio}-${minWidthPx}-${maxWidthPx}-${pulseDurationMs}-${isEnabled ? 1 : 0}-${updatedAt}"`;
}

export const speedLineRoutes: FastifyPluginAsync<SpeedLineRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: SpeedLineRoutesOptions
) => {
  const service = opts.speedLineService ?? new SpeedLineService(opts.db);

  /**
   * GET /api/v1/reader/speed-line/presets
   */
  fastify.get('/api/v1/reader/speed-line/presets', async (_request, reply) => {
    return reply.status(200).send({
      success: true,
      presets: SPEED_LINE_PRESETS,
    });
  });

  /**
   * GET /api/v1/reader/speed-line/profile/:seriesId
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/reader/speed-line/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const profile = service.getProfile(seriesId);
    const etag = computeSpeedLineEtag(
      profile.seriesId,
      profile.presetName,
      profile.mode,
      profile.lineCount,
      profile.focusX,
      profile.focusY,
      profile.angleJitter,
      profile.minLengthRatio,
      profile.maxLengthRatio,
      profile.minWidthPx,
      profile.maxWidthPx,
      profile.pulseDurationMs,
      profile.isEnabled,
      profile.updatedAt
    );

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('ETag', etag);
    reply.header('Cache-Control', 'private, no-cache');
    return reply.status(200).send({
      success: true,
      profile,
    });
  });

  /**
   * PUT /api/v1/reader/speed-line/profile/:seriesId
   */
  fastify.put<{
    Params: { seriesId: string };
    Body: {
      presetName?: SpeedLinePresetName;
      mode?: SpeedLineMode;
      lineCount?: number;
      focusX?: number;
      focusY?: number;
      angleJitter?: number;
      minLengthRatio?: number;
      maxLengthRatio?: number;
      minWidthPx?: number;
      maxWidthPx?: number;
      pulseDurationMs?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/speed-line/profile/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or missing seriesId parameter',
      });
    }

    const body = request.body || {};

    if (body.presetName && !SPEED_LINE_PRESETS[body.presetName]) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid presetName: ${body.presetName}`,
      });
    }

    if (body.mode && !['radial', 'parallel', 'none'].includes(body.mode)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: `Invalid mode: ${body.mode}`,
      });
    }

    if (body.lineCount !== undefined && (body.lineCount < 0 || body.lineCount > 256)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'lineCount must be between 0 and 256',
      });
    }

    if (body.focusX !== undefined && (body.focusX < 0.0 || body.focusX > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'focusX must be between 0.0 and 1.0',
      });
    }

    if (body.focusY !== undefined && (body.focusY < 0.0 || body.focusY > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'focusY must be between 0.0 and 1.0',
      });
    }

    if (body.minLengthRatio !== undefined && (body.minLengthRatio < 0.0 || body.minLengthRatio > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'minLengthRatio must be between 0.0 and 1.0',
      });
    }

    if (body.maxLengthRatio !== undefined && (body.maxLengthRatio < 0.0 || body.maxLengthRatio > 1.0)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'maxLengthRatio must be between 0.0 and 1.0',
      });
    }

    if (body.minLengthRatio !== undefined && body.maxLengthRatio !== undefined) {
      if (body.minLengthRatio > body.maxLengthRatio) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'minLengthRatio must be <= maxLengthRatio',
        });
      }
    }

    if (body.minWidthPx !== undefined && body.maxWidthPx !== undefined) {
      if (body.minWidthPx > body.maxWidthPx) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'minWidthPx must be <= maxWidthPx',
        });
      }
    }

    const updated = service.saveProfile(seriesId, body);
    const etag = computeSpeedLineEtag(
      updated.seriesId,
      updated.presetName,
      updated.mode,
      updated.lineCount,
      updated.focusX,
      updated.focusY,
      updated.angleJitter,
      updated.minLengthRatio,
      updated.maxLengthRatio,
      updated.minWidthPx,
      updated.maxWidthPx,
      updated.pulseDurationMs,
      updated.isEnabled,
      updated.updatedAt
    );

    reply.header('ETag', etag);
    return reply.status(200).send({
      success: true,
      profile: updated,
    });
  });

  /**
   * POST /api/v1/reader/speed-line/evaluate
   */
  fastify.post<{
    Body: {
      mode?: SpeedLineMode;
      lineCount?: number;
      focusX?: number;
      focusY?: number;
      angleJitter?: number;
      minLengthRatio?: number;
      maxLengthRatio?: number;
      minWidthPx?: number;
      maxWidthPx?: number;
      seed?: number;
      isEnabled?: boolean;
    };
  }>('/api/v1/reader/speed-line/evaluate', async (request, reply) => {
    const {
      mode = 'radial',
      lineCount = 72,
      focusX = 0.50,
      focusY = 0.50,
      angleJitter = 0.035,
      minLengthRatio = 0.25,
      maxLengthRatio = 0.95,
      minWidthPx = 0.70,
      maxWidthPx = 2.00,
      seed = 1337,
      isEnabled = true,
    } = request.body || {};

    const buffer = calculateSpeedLines(
      mode,
      lineCount,
      focusX,
      focusY,
      angleJitter,
      minLengthRatio,
      maxLengthRatio,
      minWidthPx,
      maxWidthPx,
      seed,
      isEnabled
    );

    return reply.status(200).send({
      success: true,
      count: buffer.count,
      latencyUs: buffer.latencyUs,
    });
  });

  /**
   * POST /api/v1/reader/speed-line/pulse
   */
  fastify.post<{
    Body: {
      elapsedMs?: number;
      pulseDurationMs?: number;
      intensityAmplitude?: number;
      radiusAmplitude?: number;
    };
  }>('/api/v1/reader/speed-line/pulse', async (request, reply) => {
    const {
      elapsedMs = 0,
      pulseDurationMs = 320,
      intensityAmplitude = 1.0,
      radiusAmplitude = 0.25,
    } = request.body || {};

    const pulse = evaluateImpactPulse(
      elapsedMs,
      pulseDurationMs,
      intensityAmplitude,
      radiusAmplitude
    );

    return reply.status(200).send({
      success: true,
      pulse,
    });
  });
};
