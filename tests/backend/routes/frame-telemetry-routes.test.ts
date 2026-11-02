import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('Sprint 54: Frame Telemetry Routes', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);

    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/v1/telemetry/frame-drops saves report successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry/frame-drops',
      payload: {
        userId: 'reader_gma',
        fpsAverage: 45.2,
        dropRatePct: 12.5,
        governorState: 'paced_30',
        readingMode: 'webtoon',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.report.id).toBeGreaterThan(0);
    expect(body.report.governorState).toBe('paced_30');
  });

  it('POST /api/v1/telemetry/frame-drops validates payload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry/frame-drops',
      payload: {
        userId: 'reader_gma',
        // missing fpsAverage, dropRatePct, governorState
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('GET /api/v1/telemetry/frame-drops returns summary and recent reports', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry/frame-drops',
      payload: {
        userId: 'reader_1',
        fpsAverage: 60.0,
        dropRatePct: 1.0,
        governorState: 'nominal_60',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/telemetry/frame-drops?limit=5',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.summary.totalReports).toBe(1);
    expect(body.recent).toHaveLength(1);
  });
});
