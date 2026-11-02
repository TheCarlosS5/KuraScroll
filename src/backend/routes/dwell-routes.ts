/**
 * KuraScroll Reading Dwell & Kinetic Attention Heatmap Routes
 * Sprint 45 - Fastify Endpoints for Attention Telemetry Ingestion and Heatmap Projections
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { DwellTelemetryService, DwellEventInput } from '../services/dwell-telemetry-service.js';

export interface DwellRoutesOptions {
  db: DatabaseInstance;
  dwellService?: DwellTelemetryService;
}

export const dwellRoutes: FastifyPluginAsync<DwellRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: DwellRoutesOptions
) => {
  const service = opts.dwellService ?? new DwellTelemetryService(opts.db);

  // Ingest a batch of dwell events
  fastify.post<{
    Body: {
      events: DwellEventInput[];
    };
  }>('/api/v1/analytics/dwell/batch', async (request, reply) => {
    const events = request.body?.events;
    if (!Array.isArray(events)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request body must contain an array of events'
      });
    }

    const result = service.recordBatch(events);
    const telemetry = service.getTelemetry();

    return reply.send({
      success: true,
      accepted: result.accepted,
      rejected: result.rejected,
      dirtyBuffered: telemetry.dirtyCount
    });
  });

  // Retrieve chapter attention heatmap
  fastify.get<{
    Params: { chapterId: string };
    Querystring: { minReads?: string };
  }>('/api/v1/analytics/chapter/:chapterId/dwell-heatmap', async (request, reply) => {
    const { chapterId } = request.params;
    if (!chapterId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing chapterId parameter'
      });
    }

    const minReads = request.query.minReads ? parseInt(request.query.minReads, 10) : 0;
    const response = service.getChapterDwellHeatmap(chapterId, { minTotalReads: minReads });
    return reply.send(response);
  });

  // Direct manual flush endpoint (useful for tests or reader unload)
  fastify.post('/api/v1/analytics/dwell/flush', async (_request, reply) => {
    const flushedCount = service.flush();
    return reply.send({
      success: true,
      flushedCount,
      telemetry: service.getTelemetry()
    });
  });

  // Telemetry monitoring endpoint
  fastify.get('/api/v1/analytics/dwell/telemetry', async (_request, reply) => {
    return reply.send({
      success: true,
      telemetry: service.getTelemetry()
    });
  });
};
