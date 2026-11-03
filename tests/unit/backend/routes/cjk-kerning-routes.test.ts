import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import { cjkKerningRoutes } from '../../../../src/backend/routes/cjk-kerning-routes.js';
import { CJKKerningService } from '../../../../src/backend/services/cjk-kerning-service.js';

describe('Sprint 124 - CJK Kerning Routes', () => {
  let db: DatabaseInstance;
  let app: FastifyInstance;
  let service: CJKKerningService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    service = new CJKKerningService(db);
    app = Fastify({ logger: false });
    await app.register(cjkKerningRoutes, {
      db,
      cjkKerningService: service,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('GET /api/v1/reader/cjk-kerning/presets returns all predefined presets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/cjk-kerning/presets',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presets.manga_dense_kanji).toBeDefined();
    expect(body.presets.webtoon_hangul_flow).toBeDefined();
    expect(body.presets.furigana_compact).toBeDefined();
    expect(body.presets.dialogue_whisper).toBeDefined();
    expect(body.presets.raw_fixed).toBeDefined();
  });

  it('GET /api/v1/reader/cjk-kerning/profile/:seriesId returns default profile and supports 304', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/cjk-kerning/profile/series-cjk-route-1',
    });

    expect(res.statusCode).toBe(200);
    const etag = res.headers.etag;
    expect(etag).toBeDefined();

    const resCached = await app.inject({
      method: 'GET',
      url: '/api/v1/reader/cjk-kerning/profile/series-cjk-route-1',
      headers: {
        'if-none-match': etag as string,
      },
    });
    expect(resCached.statusCode).toBe(304);
  });

  it('POST /api/v1/reader/cjk-kerning/profile updates profile and validates input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/cjk-kerning/profile',
      payload: {
        seriesId: 'series-cjk-route-1',
        presetName: 'furigana_compact',
        baseKerningEm: -0.01,
        trackingRatio: 0.008,
        minKerningEm: -0.04,
        maxKerningEm: 0.10,
        opticalWeightRatio: 0.15,
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.profile.presetName).toBe('furigana_compact');
    expect(body.profile.baseKerningEm).toBe(-0.01);
  });

  it('POST /api/v1/reader/cjk-kerning/calculate executes real-time calculation by character or codepoint', async () => {
    // 1. By character string
    const resChar = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/cjk-kerning/calculate',
      payload: {
        character: '鬼',
        baseKerningEm: 0.04,
        trackingRatio: 0.015,
      },
    });

    expect(resChar.statusCode).toBe(200);
    const bodyChar = JSON.parse(resChar.body);
    expect(bodyChar.success).toBe(true);
    expect(bodyChar.result.densityType).toBe('kanji');
    expect(bodyChar.result.kerningEm).toBeGreaterThan(0.04);
    expect(bodyChar.result.cssLetterSpacing).toBeDefined();

    // 2. By codepoint number
    const resCp = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/cjk-kerning/calculate',
      payload: {
        codepoint: 0x3042, // Hiragana A
      },
    });

    expect(resCp.statusCode).toBe(200);
    const bodyCp = JSON.parse(resCp.body);
    expect(bodyCp.result.densityType).toBe('kana');
  });

  it('POST /api/v1/reader/cjk-kerning/calculate returns 400 when missing character and codepoint', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/reader/cjk-kerning/calculate',
      payload: {
        // missing codepoint & character
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
