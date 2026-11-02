import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('Maintenance Fastify Routes (Sprint 42)', () => {
  let app: any;
  let db: DatabaseInstance;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ks-maint-route-test-'));
    db = createDatabase(':memory:');
    runMigrations(db);

    app = buildApp({ db, storageRoot: tempDir });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('GET /api/v1/admin/maintenance/status returns compaction and WAL telemetry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/maintenance/status',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBeDefined();
    expect(typeof body.status.freelistPages).toBe('number');
    expect(body.status.isCompacting).toBe(false);
  });

  it('POST /api/v1/admin/maintenance/compact executes compaction pass successfully', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/maintenance/compact',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.report).toBeDefined();
    expect(typeof body.report.durationMs).toBe('number');
    expect(body.report.orphanFilesDeleted).toBe(0);
  });
});
