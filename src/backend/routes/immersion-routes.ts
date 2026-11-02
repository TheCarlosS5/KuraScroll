/**
 * Sprint 56 - Fastify Routes for Immersion Preferences & Impact Telemetry
 */

import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { ImmersionService, ImmersionPreferencesInput, ImpactTelemetryBatchInput } from '../services/immersion-service.js';

export interface ImmersionRoutesOptions {
  immersionService: ImmersionService;
}

export const immersionRoutes: FastifyPluginAsync<ImmersionRoutesOptions> = async (
  fastify: FastifyInstance,
  options: ImmersionRoutesOptions
) => {
  const { immersionService } = options;

  // GET /api/v1/users/me/immersion-preferences
  fastify.get(
    '/api/v1/users/me/immersion-preferences',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      const userId = user?.id || user?.userId || 'guest_user';

      const preferences = immersionService.getPreferences(userId);
      return reply.status(200).send({
        success: true,
        data: preferences,
      });
    }
  );

  // PATCH /api/v1/users/me/immersion-preferences
  fastify.patch(
    '/api/v1/users/me/immersion-preferences',
    async (request: FastifyRequest<{ Body: ImmersionPreferencesInput }>, reply: FastifyReply) => {
      const user = (request as any).user;
      const userId = user?.id || user?.userId || 'guest_user';

      const updated = immersionService.updatePreferences(userId, request.body || {});
      return reply.status(200).send({
        success: true,
        data: updated,
      });
    }
  );

  // POST /api/v1/telemetry/impact-batches
  fastify.post(
    '/api/v1/telemetry/impact-batches',
    async (request: FastifyRequest<{ Body: ImpactTelemetryBatchInput }>, reply: FastifyReply) => {
      const user = (request as any).user;
      const userId = user?.id || user?.userId || request.body?.userId || 'guest_user';

      const batch = {
        ...request.body,
        userId,
      };

      const batchId = immersionService.recordTelemetryBatch(batch);
      return reply.status(201).send({
        success: true,
        data: { batchId },
      });
    }
  );

  // GET /api/v1/telemetry/impact-summary
  fastify.get(
    '/api/v1/telemetry/impact-summary',
    async (request: FastifyRequest<{ Querystring: { userId?: string } }>, reply: FastifyReply) => {
      const summary = immersionService.getAggregatedTelemetry(request.query.userId);
      return reply.status(200).send({
        success: true,
        data: summary,
      });
    }
  );
};
