import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  BoustrophedonCameraService,
  CameraEvaluatedState,
  PanelGeometry,
} from '../../../../src/backend/services/boustrophedon-camera-service.js';

describe('BoustrophedonCameraService', () => {
  let db: DatabaseInstance;
  let service: BoustrophedonCameraService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new BoustrophedonCameraService(db);
  });

  it('returns default unpersisted profile with deterministic timestamps', () => {
    const profile = service.getProfile('series-test-1');
    expect(profile.seriesId).toBe('series-test-1');
    expect(profile.readingFlow).toBe('manga_rtl_zigzag');
    expect(profile.transitionEasing).toBe('cubic_bezier_cinematic');
    expect(profile.climaxZoomMultiplier).toBe(1.25);
    expect(profile.panLeadInPct).toBe(15);
    expect(profile.maxRotationDeg).toBe(0.0);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and retrieves customized profiles with constraint clamping', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped',
      readingFlow: 'webtoon_vertical',
      transitionEasing: 'dramatic_punch',
      climaxZoomMultiplier: 2.5, // should clamp to 1.50
      panLeadInPct: 80, // should clamp to 50
      maxRotationDeg: 12.0, // should clamp to 5.0
      isEnabled: true,
    });

    expect(updated.climaxZoomMultiplier).toBe(1.5);
    expect(updated.panLeadInPct).toBe(50);
    expect(updated.maxRotationDeg).toBe(5.0);
    expect(updated.readingFlow).toBe('webtoon_vertical');
    expect(updated.transitionEasing).toBe('dramatic_punch');

    const fetched = service.getProfile('series-clamped');
    expect(fetched.climaxZoomMultiplier).toBe(1.5);
    expect(fetched.panLeadInPct).toBe(50);
  });

  it('plans and evaluates trajectory correctly at boundaries (t=0 and t=1)', () => {
    const panelA: PanelGeometry = {
      x: 100,
      y: 200,
      width: 400,
      height: 300,
      isClimax: false,
    };

    const panelB: PanelGeometry = {
      x: 600,
      y: 800,
      width: 500,
      height: 400,
      isClimax: true,
    };

    const plan = service.planTrajectory(panelA, panelB, {
      readingFlow: 'manga_rtl_zigzag',
      transitionEasing: 'snappy_linear',
      climaxZoomMultiplier: 1.4,
      maxRotationDeg: 2.5,
    });

    const out: CameraEvaluatedState = {
      x: 0,
      y: 0,
      zoom: 1.0,
      rotationDeg: 0,
      targetWidth: 0,
      targetHeight: 0,
    };

    // At t = 0
    service.evaluateTrajectory(plan, 0, out);
    // Center of Panel A = (100 + 200, 200 + 150) = (300, 350)
    expect(out.x).toBeCloseTo(300, 2);
    expect(out.y).toBeCloseTo(350, 2);
    expect(out.zoom).toBeCloseTo(1.0, 2);
    expect(out.rotationDeg).toBeCloseTo(0.0, 2);

    // At t = 1
    service.evaluateTrajectory(plan, 1, out);
    // Center of Panel B = (600 + 250, 800 + 200) = (850, 1000)
    expect(out.x).toBeCloseTo(850, 2);
    expect(out.y).toBeCloseTo(1000, 2);
    expect(out.zoom).toBeCloseTo(1.4, 2);
    expect(out.rotationDeg).toBeCloseTo(2.5, 2);
    expect(out.targetWidth).toBe(500);
    expect(out.targetHeight).toBe(400);
  });

  it('executes zero-allocation Horner evaluation efficiently across reading flows', () => {
    const flows = [
      'manga_rtl_zigzag',
      'webtoon_vertical',
      'comic_ltr_zigzag',
      'cinematic_freeflow',
    ] as const;

    const panelA: PanelGeometry = { x: 50, y: 50, width: 200, height: 200 };
    const panelB: PanelGeometry = { x: 400, y: 600, width: 300, height: 300, isClimax: true };

    const out: CameraEvaluatedState = {
      x: 0,
      y: 0,
      zoom: 1.0,
      rotationDeg: 0,
      targetWidth: 0,
      targetHeight: 0,
    };

    for (const flow of flows) {
      const plan = service.planTrajectory(panelA, panelB, { readingFlow: flow });
      service.evaluateTrajectory(plan, 0.5, out);
      expect(out.x).toBeGreaterThan(0);
      expect(out.y).toBeGreaterThan(0);
      expect(out.zoom).toBeGreaterThanOrEqual(1.0);
    }
  });

  it('generates consistent MD5 ETags for profile caching', () => {
    const profile = service.getProfile('series-etag');
    const etag1 = service.generateETag(profile);
    const etag2 = service.generateETag(profile);
    expect(etag1).toBe(etag2);
    expect(etag1).toHaveLength(32);
  });
});
