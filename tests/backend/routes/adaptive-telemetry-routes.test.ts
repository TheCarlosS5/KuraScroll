import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, DatabaseInstance, runMigrations } from '../../../src/backend/db/database.js';
import { AdaptiveIngestionController } from '../../../src/backend/services/adaptive-ingestion-controller.js';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('Adaptive Ingestion Controller Telemetry & Fastify Routes', () => {
  let db: DatabaseInstance;
  let testDir: string;
  let controller: AdaptiveIngestionController;

  beforeEach(async () => {
    testDir = path.resolve(`./tmp/test-adaptive-routes-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    db = createDatabase(':memory:');
    runMigrations(db);
    controller = new AdaptiveIngestionController({
      windowSize: 10,
    });
  });

  afterEach(async () => {
    controller.stop();
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it('GET /api/v1/telemetry/adaptive returns controller metrics and state', async () => {
    const app = buildApp({
      db,
      storageRoot: testDir,
      adaptiveController: controller,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/telemetry/adaptive',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.status.state).toBe('RUNNING');
    expect(body.status.isPaused).toBe(false);
  });

  it('automatically measures route latencies through onResponse hook', async () => {
    const app = buildApp({
      db,
      storageRoot: testDir,
      adaptiveController: controller,
    });

    // Make 3 requests
    await app.inject({ method: 'GET', url: '/health' });
    await app.inject({ method: 'GET', url: '/health' });
    await app.inject({ method: 'GET', url: '/health' });

    const status = controller.getStatus();
    expect(status.samplesCount).toBe(3);
    expect(status.p95Ms).toBeGreaterThanOrEqual(0);
  });

  it('POST /api/v1/telemetry/adaptive/override allows pause, clear and resume', async () => {
    const app = buildApp({
      db,
      storageRoot: testDir,
      adaptiveController: controller,
    });

    // Pause override
    const pauseRes = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry/adaptive/override',
      payload: { action: 'pause' },
    });
    expect(pauseRes.statusCode).toBe(200);
    expect(JSON.parse(pauseRes.body).status.state).toBe('PAUSED');
    expect(controller.getStatus().forcedState).toBe('PAUSED');

    // Resume override
    const resumeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry/adaptive/override',
      payload: { action: 'resume' },
    });
    expect(resumeRes.statusCode).toBe(200);
    expect(JSON.parse(resumeRes.body).status.state).toBe('RUNNING');

    // Clear override
    const clearRes = await app.inject({
      method: 'POST',
      url: '/api/v1/telemetry/adaptive/override',
      payload: { action: 'clear' },
    });
    expect(clearRes.statusCode).toBe(200);
    expect(controller.getStatus().forcedState).toBeNull();
  });

  it('POST /api/v1/admin/self-heal triggers recovery and returns report', async () => {
    const app = buildApp({
      db,
      storageRoot: testDir,
      adaptiveController: controller,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/self-heal',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.report.integrity.checkpointOk).toBe(true);
    expect(body.report.durationMs).toBeGreaterThanOrEqual(0);
  });
});
