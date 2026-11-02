/**
 * KuraScroll Client Frame Drop Telemetry Routes
 * Sprint 54 - Fastify Endpoints for Client Rendering Performance
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { FrameTelemetryService } from '../services/frame-telemetry-service.js';
import { GovernorState } from '../utils/frame-pacer.js';

export interface FrameTelemetryRoutesOptions {
  db: DatabaseInstance;
  telemetryService?: FrameTelemetryService;
}

export const frameTelemetryRoutes: FastifyPluginAsync<FrameTelemetryRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: FrameTelemetryRoutesOptions
) => {
  const service = opts.telemetryService ?? new FrameTelemetryService(opts.db);

  /**
   * POST /api/v1/telemetry/frame-drops
   * Records a client-side frame drop report.
   */
  fastify.post<{
    Body: {
      userId: string;
      fpsAverage: number;
      dropRatePct: number;
      governorState: GovernorState;
      readingMode?: string;
    };
  }>('/api/v1/telemetry/frame-drops', async (request, reply) => {
    const body = request.body;

    if (
      !body ||
      !body.userId ||
      body.fpsAverage === undefined ||
      body.dropRatePct === undefined ||
      !body.governorState
    ) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'userId, fpsAverage, dropRatePct, and governorState are required',
      });
    }

    const saved = service.recordReport({
      userId: body.userId,
      fpsAverage: Number(body.fpsAverage),
      dropRatePct: Number(body.dropRatePct),
      governorState: body.governorState,
      readingMode: body.readingMode || 'manga',
    });

    return reply.status(201).send({
      success: true,
      report: saved,
    });
  });

  /**
   * GET /api/v1/telemetry/frame-drops
   * Returns telemetry summary and recent client reports.
   */
  fastify.get<{
    Querystring: { limit?: string };
  }>('/api/v1/telemetry/frame-drops', async (request, reply) => {
    const limit = request.query?.limit ? parseInt(request.query.limit, 10) : 20;
    const summary = service.getTelemetrySummary();
    const recent = service.getRecentReports(isNaN(limit) ? 20 : limit);

    return reply.send({
      success: true,
      summary,
      recent,
    });
  });
};
