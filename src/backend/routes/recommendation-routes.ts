import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { RecommendationService } from '../services/recommendation-service.js';
import { ReadingVelocityService } from '../services/reading-velocity-service.js';

export function registerRecommendationRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  services?: {
    recommendationService?: RecommendationService;
    velocityService?: ReadingVelocityService;
  }
) {
  const recService = services?.recommendationService ?? new RecommendationService(db);
  const velService = services?.velocityService ?? new ReadingVelocityService();

  /**
   * GET /api/v1/recommendations/personalized
   * Returns content-based recommendations with otaku reasoning badges and affinity scoring.
   */
  app.get('/api/v1/recommendations/personalized', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { userId?: string; limit?: string };
    const userId = query.userId || 'default-user';
    const limit = Math.min(20, Math.max(1, Number.parseInt(query.limit || '8', 10)));

    const recommendations = recService.getRecommendations(userId, limit);

    // Augment with personalized estimated reading time if velocity is available
    const velocity = velService.getStats(userId);
    const enriched = recommendations.map((item) => ({
      ...item,
      estimatedChapterMinutes: Math.max(1, Math.round((20 * velocity.secondsPerPage) / 60)),
    }));

    return {
      recommendations: enriched,
      total: enriched.length,
      cached: true,
    };
  });

  /**
   * GET /api/v1/analytics/reading-velocity
   * Returns real-time reading velocity statistics (PPM, SPP, confidence).
   */
  app.get('/api/v1/analytics/reading-velocity', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { userId?: string; seriesId?: string };
    const userId = query.userId || 'default-user';
    const seriesId = query.seriesId;

    const stats = velService.getStats(userId, seriesId);
    return stats;
  });

  /**
   * POST /api/v1/analytics/velocity/sample
   * Ingests a raw page-turn duration sample into the EMA smoother.
   */
  app.post('/api/v1/analytics/velocity/sample', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { userId?: string; seriesId: string; durationSeconds: number };
    if (!body || typeof body.durationSeconds !== 'number' || !body.seriesId) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Must provide seriesId and durationSeconds as a number',
      });
    }

    const userId = body.userId || 'default-user';
    const accepted = velService.recordSample(userId, body.seriesId, body.durationSeconds);
    const currentStats = velService.getStats(userId, body.seriesId);

    return {
      accepted,
      pagesPerMinute: currentStats.pagesPerMinute,
      secondsPerPage: currentStats.secondsPerPage,
      confidence: currentStats.confidence,
    };
  });
}
