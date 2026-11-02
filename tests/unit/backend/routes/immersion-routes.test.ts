import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { ImmersionService } from '../../../../src/backend/services/immersion-service.js';
import { immersionRoutes } from '../../../../src/backend/routes/immersion-routes.js';

describe('Sprint 56 - ImmersionRoutes Fastify Integration', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: ImmersionService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new ImmersionService(db);

    app = Fastify();
    await app.register(immersionRoutes, { immersionService: service });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/users/me/immersion-preferences returns default settings', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me/immersion-preferences',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.hapticsEnabled).toBe(false);
    expect(body.data.screenRumbleEnabled).toBe(false);
  });

  it('PATCH /api/v1/users/me/immersion-preferences updates and persists settings', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me/immersion-preferences',
      payload: {
        hapticsEnabled: true,
        screenRumbleEnabled: true,
        maxHapticIntensity: 2,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.hapticsEnabled).toBe(true);
    expect(body.data.screenRumbleEnabled).toBe(true);
    expect(body.data.maxHapticIntensity).toBe(2);
  });

  it('POST /api/v1/telemetry/impact-batches records a telemetry batch', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry/impact-batches',
      payload: {
        sessionId: 'sess_fastify_test',
        sourceType: 'sfx',
        intensity: 1,
        triggerCount: 16,
        hapticAcceptedCount: 16,
        rumbleExecutedCount: 16,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.batchId).toBeDefined();

    // Check summary
    const summaryRes = await app.inject({
      method: 'GET',
      url: '/api/v1/telemetry/impact-summary',
    });
    expect(summaryRes.statusCode).toBe(200);
    const summaryBody = summaryRes.json();
    expect(summaryBody.data.totalTriggers).toBe(16);
  });
});
