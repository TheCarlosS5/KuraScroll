import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../../src/backend/app';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';

describe('Sprint 33: User Preferences HTTP Routes', () => {
  let db: DatabaseInstance;
  let app: any;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    app = buildApp({ db });
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('GET /api/v1/user/preferences returns default preferences for new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/user/preferences?userId=local_reader',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.userId).toBe('local_reader');
    expect(body.readerTheme).toBe('carbon');
    expect(body.batterySaverEnabled).toBe(true);
  });

  it('PUT /api/v1/user/preferences updates theme and power policies', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/user/preferences',
      payload: {
        userId: 'local_reader',
        readerTheme: 'oled',
        batterySaverEnabled: true,
        animationsEnabled: false,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.userId).toBe('local_reader');
    expect(body.readerTheme).toBe('oled');
    expect(body.animationsEnabled).toBe(false);

    // Verify GET retrieves updated state
    const getRes = await app.inject({
      method: 'GET',
      url: '/api/v1/user/preferences?userId=local_reader',
    });
    expect(getRes.statusCode).toBe(200);
    const getBody = JSON.parse(getRes.body);
    expect(getBody.readerTheme).toBe('oled');
    expect(getBody.animationsEnabled).toBe(false);
  });

  it('PUT /api/v1/user/preferences rejects invalid payload gracefully', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/user/preferences',
      payload: null,
    });

    expect(res.statusCode).toBe(400);
  });
});
