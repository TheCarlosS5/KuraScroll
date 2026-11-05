import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { UserPreferencesRepository, ReaderTheme } from '../repositories/user-preferences-repository.js';
import { AuthService } from '../services/auth-service.js';
import { extractSessionToken } from '../middleware/auth-middleware.js';

export function registerPreferenceRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  repo?: UserPreferencesRepository
) {
  const prefRepo = repo ?? new UserPreferencesRepository(db);
  const authService = new AuthService(db);

  function getEffectiveUserId(req: FastifyRequest, explicitId?: string): string {
    if (explicitId && typeof explicitId === 'string' && explicitId.trim()) {
      return explicitId.trim();
    }
    if (req.user?.id) return req.user.id;
    const token = extractSessionToken(req);
    if (token) {
      try {
        const user = authService.validateSessionToken(token);
        if (user) return user.id;
      } catch {}
    }
    const headerUserId = req.headers['x-user-id'];
    if (typeof headerUserId === 'string' && headerUserId.trim()) {
      return headerUserId.trim();
    }
    return 'local_user';
  }

  /**
   * GET /api/v1/user/preferences
   * Point lookup of reader color theme, battery saver, and prefetch policies.
   */
  app.get('/api/v1/user/preferences', async (req: FastifyRequest) => {
    const query = req.query as { userId?: string };
    const userId = getEffectiveUserId(req, query.userId);
    return prefRepo.getPreferences(userId);
  });

  /**
   * PUT /api/v1/user/preferences
   * Synchronizes reader preferences and hardware battery policies.
   */
  app.put('/api/v1/user/preferences', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as {
      userId?: string;
      readerTheme?: ReaderTheme;
      batterySaverEnabled?: boolean;
      adaptivePrefetch?: boolean;
      animationsEnabled?: boolean;
    };

    if (!body || typeof body !== 'object') {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'Request body must be a valid JSON object',
      });
    }

    const userId = getEffectiveUserId(req, body.userId);
    const updated = prefRepo.updatePreferences(userId, {
      readerTheme: body.readerTheme,
      batterySaverEnabled: body.batterySaverEnabled,
      adaptivePrefetch: body.adaptivePrefetch,
      animationsEnabled: body.animationsEnabled,
    });

    return updated;
  });
}
