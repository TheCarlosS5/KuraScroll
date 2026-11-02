import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { ReadingStreakService } from '../services/reading-streak-service.js';
import { ReadingGoalRepository, GoalTargetType } from '../repositories/reading-goal-repository.js';
import { ReadingActivityBuffer } from '../services/reading-activity-buffer.js';
import { IOCoordinator } from '../storage/io/io-coordinator.js';

export interface AnalyticsRouteOptions {
  buffer?: ReadingActivityBuffer;
  ioCoordinator?: IOCoordinator;
}

export function registerAnalyticsRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  options: AnalyticsRouteOptions = {}
): void {
  const streakService = new ReadingStreakService(db);
  const goalRepo = new ReadingGoalRepository(db);
  const activityBuffer =
    options.buffer ?? new ReadingActivityBuffer(goalRepo, options.ioCoordinator);

  // GET /api/v1/analytics/streak
  app.get('/api/v1/analytics/streak', async (req) => {
    const query = req.query as { userId?: string };
    const userId = query.userId || 'local_user';
    const streak = streakService.getStreak(userId);
    return {
      success: true,
      streak,
    };
  });

  // POST /api/v1/analytics/activity (Legacy direct route)
  app.post('/api/v1/analytics/activity', async (req) => {
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

    // Also register in buffered habit activity
    const today = body?.activityDate || new Date().toISOString().slice(0, 10);
    activityBuffer.recordActivity(userId, today, pagesRead, durationSeconds);

    return {
      success: true,
      streak,
    };
  });

  // GET /api/v1/analytics/goals
  app.get('/api/v1/analytics/goals', async (req) => {
    const query = req.query as { userId?: string; date?: string };
    const userId = query.userId || 'local_user';
    const date = query.date || new Date().toISOString().slice(0, 10);

    const goal = goalRepo.getGoal(userId) ?? {
      userId,
      targetType: 'pages' as GoalTargetType,
      targetValue: 30,
      notificationsEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const todayProgress = goalRepo.getDailyProgress(userId, date);
    const calendar = goalRepo.getPast7DaysCalendar(userId, date);
    const lifetime = goalRepo.getLifetimeStats(userId, date);

    return {
      success: true,
      goal,
      today: todayProgress,
      calendar,
      lifetime,
    };
  });

  // PUT /api/v1/analytics/goals
  app.put('/api/v1/analytics/goals', async (req, reply) => {
    const body = req.body as {
      userId?: string;
      targetType?: GoalTargetType;
      targetValue?: number;
      notificationsEnabled?: boolean;
    };

    const userId = body?.userId || 'local_user';
    const targetType = body?.targetType || 'pages';
    const targetValue = typeof body?.targetValue === 'number' && body.targetValue > 0 ? body.targetValue : 30;
    const notificationsEnabled = body?.notificationsEnabled ?? true;

    if (targetType !== 'pages' && targetType !== 'minutes') {
      return reply.code(400).send({
        error: 'Invalid targetType. Must be "pages" or "minutes".',
      });
    }

    const updatedGoal = goalRepo.setGoal({
      userId,
      targetType,
      targetValue,
      notificationsEnabled,
    });

    const today = new Date().toISOString().slice(0, 10);
    const todayProgress = goalRepo.getDailyProgress(userId, today);

    return {
      success: true,
      goal: updatedGoal,
      today: todayProgress,
    };
  });

  // POST /api/v1/analytics/activity/buffered
  app.post('/api/v1/analytics/activity/buffered', async (req) => {
    const body = req.body as {
      userId?: string;
      date?: string;
      pagesDelta?: number;
      secondsDelta?: number;
      flushNow?: boolean;
    };

    const userId = body?.userId || 'local_user';
    const date = body?.date || new Date().toISOString().slice(0, 10);
    const pagesDelta = typeof body?.pagesDelta === 'number' ? body.pagesDelta : 1;
    const secondsDelta = typeof body?.secondsDelta === 'number' ? body.secondsDelta : 0;

    const triggered = activityBuffer.recordActivity(userId, date, pagesDelta, secondsDelta);

    if (body?.flushNow) {
      await activityBuffer.flush();
    }

    return {
      success: true,
      buffered: true,
      thresholdTriggered: triggered,
      pendingCount: activityBuffer.getPendingCount(),
    };
  });

  // GET /api/v1/telemetry/buffer
  app.get('/api/v1/telemetry/buffer', async () => {
    return {
      success: true,
      telemetry: activityBuffer.getTelemetry(),
    };
  });
}
