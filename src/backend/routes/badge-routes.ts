import { FastifyInstance } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { BadgeEvaluatorService } from '../services/badge-evaluator-service.js';
import { IOCoordinator } from '../storage/io/io-coordinator.js';

export interface BadgeRouteOptions {
  evaluator?: BadgeEvaluatorService;
  ioCoordinator?: IOCoordinator;
}

export function registerBadgeRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  options: BadgeRouteOptions = {}
): void {
  const evaluator = options.evaluator ?? new BadgeEvaluatorService(db, options.ioCoordinator);
  const repo = evaluator.getBadgeRepository();

  let totalEvaluations = 0;
  let totalEvaluationDurationMs = 0;

  // GET /api/v1/badges - List all badges with user progress
  app.get('/api/v1/badges', async (req) => {
    const query = req.query as { userId?: string };
    const userId = query.userId || 'local_user';

    const badges = repo.getUserBadges(userId);
    const summary = repo.getBadgeSummary(userId);

    return {
      success: true,
      badges,
      summary,
    };
  });

  // GET /api/v1/badges/unnotified - List unlocked badges not yet celebrated
  app.get('/api/v1/badges/unnotified', async (req) => {
    const query = req.query as { userId?: string };
    const userId = query.userId || 'local_user';

    const unnotified = repo.getUnnotifiedBadges(userId);

    return {
      success: true,
      unnotified,
    };
  });

  // POST /api/v1/badges/notified - Dismiss celebration for badge IDs
  app.post('/api/v1/badges/notified', async (req, reply) => {
    const body = req.body as { userId?: string; badgeIds?: string[] };
    const userId = body?.userId || 'local_user';
    const badgeIds = body?.badgeIds || [];

    if (!Array.isArray(badgeIds)) {
      return reply.code(400).send({ error: 'badgeIds must be an array of strings' });
    }

    repo.markBadgesNotified(userId, badgeIds);

    return {
      success: true,
      markedCount: badgeIds.length,
    };
  });

  // POST /api/v1/badges/evaluate - Trigger badge evaluation
  app.post('/api/v1/badges/evaluate', async (req) => {
    const body = req.body as {
      userId?: string;
      currentHour?: number;
      distinctGenresRead?: number;
      weekendDaysCompleted?: number;
    };
    const userId = body?.userId || 'local_user';

    const startTime = performance.now();
    const newlyUnlocked = await evaluator.evaluateUserBadges(userId, {
      currentHour: body?.currentHour,
      distinctGenresRead: body?.distinctGenresRead,
      weekendDaysCompleted: body?.weekendDaysCompleted,
    });
    const duration = performance.now() - startTime;

    totalEvaluations++;
    totalEvaluationDurationMs += duration;

    return {
      success: true,
      newlyUnlocked,
      evaluationDurationMs: Number(duration.toFixed(2)),
    };
  });

  // GET /api/v1/telemetry/badges - Badge subsystem telemetry
  app.get('/api/v1/telemetry/badges', async (req) => {
    const query = req.query as { userId?: string };
    const userId = query.userId || 'local_user';

    const summary = repo.getBadgeSummary(userId);
    const unlocked = repo.getUnlockedBadges(userId);
    const mostRecent = unlocked.length > 0 ? unlocked[0].unlockedAt : null;
    const avgLatency =
      totalEvaluations > 0 ? totalEvaluationDurationMs / totalEvaluations : 0;

    return {
      success: true,
      telemetry: {
        total_unlocked_badges: summary.unlocked,
        total_catalog_badges: summary.total,
        completion_percentage_overall: summary.percentage,
        most_recent_unlock_timestamp: mostRecent,
        evaluation_latency_p95_ms: Number(avgLatency.toFixed(2)),
        total_evaluations: totalEvaluations,
      },
    };
  });
}
