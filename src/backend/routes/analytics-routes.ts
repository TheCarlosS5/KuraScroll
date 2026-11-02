import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { ReadingStreakService } from '../services/reading-streak-service.js';

export function registerAnalyticsRoutes(app: FastifyInstance, db: DatabaseInstance): void {
  const streakService = new ReadingStreakService(db);

  // GET /api/v1/analytics/streak
  app.get('/api/v1/analytics/streak', async (req, reply) => {
    const query = req.query as { userId?: string };
    const userId = query.userId || 'local_user';
    const streak = streakService.getStreak(userId);
    return {
      success: true,
      streak,
    };
  });

  // POST /api/v1/analytics/activity
  app.post('/api/v1/analytics/activity', async (req, reply) => {
    const body = req.body as {
      userId?: string;
      pagesRead?: number;
      durationSeconds?: number;
      activityDate?: string;
    };

    const userId = body?.userId || 'local_user';
    const pagesRead = typeof body?.pagesRead === 'number' ? body.pagesRead : 1;
    const durationSeconds = typeof body?.durationSeconds === 'number' ? body.durationSeconds : 0;

    const streak = streakService.recordActivity(
      userId,
      pagesRead,
      durationSeconds,
      body?.activityDate
    );

    return {
      success: true,
      streak,
    };
  });
}
