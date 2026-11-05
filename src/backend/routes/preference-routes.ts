import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { UserPreferencesRepository, ReaderTheme } from '../repositories/user-preferences-repository.js';

export function registerPreferenceRoutes(
  app: FastifyInstance,
  db: DatabaseInstance,
  repo?: UserPreferencesRepository
) {
  const prefRepo = repo ?? new UserPreferencesRepository(db);

  /**
   * GET /api/v1/user/preferences
   * Point lookup of reader color theme, battery saver, and prefetch policies.
   */
  app.get('/api/v1/user/preferences', async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    const sessionIdentity = (req as any).sessionIdentity;
    if (!sessionIdentity) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }
    return prefRepo.getPreferences(sessionIdentity.userId);
  });

  /**
   * PUT /api/v1/user/preferences
   * Synchronizes reader preferences and hardware battery policies.
   */
  app.put('/api/v1/user/preferences', async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    const sessionIdentity = (req as any).sessionIdentity;
    if (!sessionIdentity) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }
    const userId = sessionIdentity.userId;

    const body = req.body as {
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

    const updated = prefRepo.updatePreferences(userId, {
      readerTheme: body.readerTheme,
      batterySaverEnabled: body.batterySaverEnabled,
      adaptivePrefetch: body.adaptivePrefetch,
      animationsEnabled: body.animationsEnabled,
    });

    return updated;
  });
}
