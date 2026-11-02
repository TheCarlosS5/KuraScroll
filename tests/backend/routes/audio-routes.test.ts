import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { audioRoutes } from '../../../src/backend/routes/audio-routes.js';
import { AudioSFXService } from '../../../src/backend/services/audio-sfx-service.js';

describe('Audio Routes Integration Tests (Sprint 49)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;
  let service: AudioSFXService;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new AudioSFXService(db);

    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('series-naruto', 'naruto', 'Naruto', 'manga', 'completed')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('ch-naruto-1', 'series-naruto', 1, 'Enter Naruto Uzumaki', '/storage/naruto/ch1')
    `).run();

    service.addAudioTrack({
      chapterId: 'ch-naruto-1',
      startPage: 1,
      endPage: 10,
      trackKind: 'ambient',
      ambientPreset: 'tavern',
      volumeLevel: 0.6,
    });

    service.addSfxCue({
      chapterId: 'ch-naruto-1',
      pageNumber: 1,
      cueIndex: 0,
      sfxId: 'sfx_swoosh',
      onomatopoeiaText: 'ザッ',
      synthParams: { waveType: 'triangle', baseFrequencyHz: 220 },
    });

    app = Fastify({ logger: false });
    await app.register(audioRoutes, { db, audioService: service });
    await app.ready();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    db.close();
  });

  it('GET /api/v1/chapters/:chapterId/audio/manifest returns complete manifest', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch-naruto-1/audio/manifest',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.manifest.tracks).toHaveLength(1);
    expect(body.manifest.totalCues).toBe(1);
    expect(body.manifest.cuesByPage['1']).toHaveLength(1);
  });

  it('GET /api/v1/chapters/:chapterId/pages/:pageNumber/audio returns page audio cues', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/chapters/ch-naruto-1/pages/1/audio',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.activeTrack.ambientPreset).toBe('tavern');
    expect(body.cues).toHaveLength(1);
    expect(body.cues[0].onomatopoeiaText).toBe('ザッ');
  });

  it('POST and DELETE /api/v1/admin/chapters/:chapterId/audio/tracks operate seamlessly', async () => {
    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/chapters/ch-naruto-1/audio/tracks',
      payload: {
        startPage: 11,
        trackKind: 'battle',
        ambientPreset: 'battle',
        volumeLevel: 0.9,
      },
    });

    expect(postRes.statusCode).toBe(201);
    const postBody = JSON.parse(postRes.payload);
    expect(postBody.success).toBe(true);
    expect(postBody.track.ambientPreset).toBe('battle');

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/audio/tracks/${postBody.track.id}`,
    });

    expect(delRes.statusCode).toBe(200);
    const delBody = JSON.parse(delRes.payload);
    expect(delBody.deleted).toBe(true);
  });

  it('POST /api/v1/admin/chapters/:chapterId/audio/cues supports batch ingestion', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/chapters/ch-naruto-1/audio/cues',
      payload: {
        cues: [
          { pageNumber: 5, cueIndex: 0, sfxId: 'sfx_don', onomatopoeiaText: 'ドン!!' },
          { pageNumber: 5, cueIndex: 1, sfxId: 'sfx_zap', onomatopoeiaText: 'ビリビリ' },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.insertedCount).toBe(2);
  });
});
