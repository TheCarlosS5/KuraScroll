import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { StatsAnalyticsRepository } from '../repositories/stats-analytics-repository.js';

export function registerStatsRoutes(app: FastifyInstance, db: DatabaseInstance): void {
  const repo = new StatsAnalyticsRepository(db);

  // Get genre radar statistics for low-power polar chart
  app.get('/api/v1/analytics/stats-radar', async (req) => {
    const query = req.query as { userId?: string; limit?: string };
    const userId = query.userId || 'default_user';
    const limit = query.limit ? Math.min(20, Math.max(3, parseInt(query.limit, 10))) : 8;

    return repo.getGenreRadarStats(userId, limit);
  });

  // Get activity heatmap for GitHub-style calendar grid
  app.get('/api/v1/analytics/activity-heatmap', async (req) => {
    const query = req.query as { userId?: string; daysBack?: string };
    const userId = query.userId || 'default_user';
    const daysBack = query.daysBack ? Math.min(730, Math.max(7, parseInt(query.daysBack, 10))) : 364;

    return repo.getActivityHeatmap(userId, daysBack);
  });

  // Record chapter completion for incremental stats updates
  app.post('/api/v1/analytics/record-read', async (req, reply) => {
    const body = req.body as { userId?: string; chapterId?: string; readingSeconds?: number };

    if (!body || !body.chapterId) {
      reply.status(400);
      return { statusCode: 400, error: 'Bad Request', message: 'chapterId is required' };
    }

    const userId = body.userId || 'default_user';
    const readingSeconds = typeof body.readingSeconds === 'number' ? body.readingSeconds : 0;

    repo.recordChapterRead(userId, body.chapterId, readingSeconds);
    return { success: true };
  });
}
