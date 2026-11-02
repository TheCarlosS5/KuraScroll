import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  BalloonTailService,
  calculateBalloonTail,
  BALLOON_TAIL_PRESETS,
} from '../../../../src/backend/services/balloon-tail-service.js';

describe('BalloonTailService', () => {
  let db: DatabaseInstance;
  let service: BalloonTailService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new BalloonTailService(db);
  });

  it('returns default unpersisted profile with deterministic timestamps', () => {
    const profile = service.getProfile('series-tail-1');
    expect(profile.seriesId).toBe('series-tail-1');
    expect(profile.tailStyle).toBe('manga_compact');
    expect(profile.balloonShape).toBe('ellipse');
    expect(profile.rootWidthPx).toBe(14.0);
    expect(profile.curvatureFactor).toBe(0.15);
    expect(profile.tipOffsetPx).toBe(4.0);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-tail',
      tailStyle: 'expressive_curve',
      balloonShape: 'polygon_shout',
      rootWidthPx: 80.0, // clamp to 32.0
      curvatureFactor: 1.5, // clamp to 0.50
      tipOffsetPx: 50.0, // clamp to 20.0
    });

    expect(updated.rootWidthPx).toBe(32.0);
    expect(updated.curvatureFactor).toBe(0.50);
    expect(updated.tipOffsetPx).toBe(20.0);
    expect(updated.tailStyle).toBe('expressive_curve');

    const fetched = service.getProfile('series-clamped-tail');
    expect(fetched.rootWidthPx).toBe(32.0);
    expect(fetched.curvatureFactor).toBe(0.50);
  });

  it('calculates zero-allocation quadratic bezier tail accurately', () => {
    const res = calculateBalloonTail(
      200,
      150,
      80,
      50,
      280,
      300,
      'manga_compact',
      'ellipse',
      14.0,
      0.15,
      4.0,
      true
    );

    expect(res.tailStyle).toBe('manga_compact');
    expect(res.angleDeg).toBeGreaterThan(0);
    expect(res.tipX).toBeGreaterThan(200);
    expect(res.tipY).toBeGreaterThan(150);
    expect(res.svgPathD).toContain('M ');
    expect(res.svgPathD).toContain('Q ');
    expect(res.svgPathD).toContain(' Z');
  });

  it('evaluates disabled state cleanly without SVG path', () => {
    const res = calculateBalloonTail(200, 150, 80, 50, 280, 300, 'manga_compact', 'ellipse', 14.0, 0.15, 4.0, false);
    expect(res.svgPathD).toBe('');
    expect(res.lengthPx).toBe(0);
  });

  it('contains valid predefined balloon tail presets', () => {
    const presets = Object.keys(BALLOON_TAIL_PRESETS);
    expect(presets).toContain('manga_compact');
    expect(presets).toContain('expressive_curve');
    expect(presets).toContain('manhwa_clean');
    expect(presets).toContain('whisper_subtle');
    expect(presets).toContain('shout_dynamic');

    expect(BALLOON_TAIL_PRESETS.manga_compact.rootWidthPx).toBe(12.0);
    expect(BALLOON_TAIL_PRESETS.shout_dynamic.rootWidthPx).toBe(24.0);
  });

  it('generates consistent MD5 ETags for caching', () => {
    const profile = service.getProfile('series-etag-tail');
    const etag1 = service.generateETag(profile);
    const etag2 = service.generateETag(profile);
    expect(etag1).toBe(etag2);
    expect(etag1).toHaveLength(32);
  });
});
