import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, DatabaseInstance, runMigrations } from '../../../src/backend/db/database.js';
import path from 'node:path';
import fs from 'node:fs/promises';

describe('Differential Mirror Fastify Routes (/api/v1/backup/mirror)', () => {
  let db: DatabaseInstance;
  let testRoot: string;
  let destRoot: string;

  beforeEach(async () => {
    testRoot = path.resolve(`./tmp/test-routes-mirror-src-${Date.now()}`);
    destRoot = path.resolve(`./tmp/test-routes-mirror-dest-${Date.now()}`);
    await fs.mkdir(testRoot, { recursive: true });
    await fs.mkdir(destRoot, { recursive: true });
    db = createDatabase(':memory:');
    runMigrations(db);
  });

  afterEach(async () => {
    await fs.rm(testRoot, { recursive: true, force: true }).catch(() => {});
    await fs.rm(destRoot, { recursive: true, force: true }).catch(() => {});
  });

  it('rejects POST /api/v1/backup/mirror without destinationDir with 400', async () => {
    const app = buildApp({ db, storageRoot: testRoot });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/mirror',
      payload: {},
    });

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe('BadRequest');
  });

  it('executes snapshot and returns report via POST /api/v1/backup/mirror', async () => {
    db.exec(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('s1', 'claymore', 'Claymore', 'manga', 'completed');
    `);

    const app = buildApp({ db, storageRoot: testRoot });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/backup/mirror',
      payload: {
        destinationDir: destRoot,
        differential: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.report.type).toBe('full');
    expect(body.report.databaseCopied).toBe(true);

    // Verify history endpoint
    const histRes = await app.inject({
      method: 'GET',
      url: '/api/v1/backup/mirror/history',
    });
    expect(histRes.statusCode).toBe(200);
    const histBody = JSON.parse(histRes.body);
    expect(histBody.success).toBe(true);
    expect(histBody.history.length).toBe(1);
    expect(histBody.history[0].destination_path).toBe(destRoot);
  });
});
