import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';
import {
  SpatialAudioService,
  calculateSpatialAudio,
  SPATIAL_AUDIO_PRESETS,
} from '../../../../src/backend/services/spatial-audio-service.js';

describe('SpatialAudioService', () => {
  let db: DatabaseInstance;
  let service: SpatialAudioService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    service = new SpatialAudioService(db);
  });

  it('returns default unpersisted profile with deterministic timestamps', () => {
    const profile = service.getProfile('series-spatial-1');
    expect(profile.seriesId).toBe('series-spatial-1');
    expect(profile.presetName).toBe('dialogue_near');
    expect(profile.referenceDistancePx).toBe(120.0);
    expect(profile.rolloffFactor).toBe(1.0);
    expect(profile.minGain).toBe(0.025);
    expect(profile.maxDistancePx).toBe(1400.0);
    expect(profile.panRadiusPx).toBe(480.0);
    expect(profile.cutoffOpenHz).toBe(18000.0);
    expect(profile.cutoffClosedHz).toBe(2500.0);
    expect(profile.filterQ).toBe(0.707);
    expect(profile.isEnabled).toBe(true);
    expect(profile.createdAt).toBe(0);
    expect(profile.updatedAt).toBe(0);
  });

  it('upserts and clamps profile parameters within safe bounds', () => {
    const updated = service.upsertProfile({
      seriesId: 'series-clamped-spatial',
      presetName: 'dialogue_occluded',
      referenceDistancePx: 1000.0, // clamp to 500
      rolloffFactor: 5.0, // clamp to 3.0
      minGain: 0.5, // clamp to 0.20
      maxDistancePx: 10000.0, // clamp to 5000
      panRadiusPx: 50.0, // clamp to 100
      cutoffOpenHz: 30000.0, // clamp to 22050
      cutoffClosedHz: 50.0, // clamp to 200
      filterQ: 10.0, // clamp to 4.0
    });

    expect(updated.referenceDistancePx).toBe(500.0);
    expect(updated.rolloffFactor).toBe(3.0);
    expect(updated.minGain).toBe(0.20);
    expect(updated.maxDistancePx).toBe(5000.0);
    expect(updated.panRadiusPx).toBe(100.0);
    expect(updated.cutoffOpenHz).toBe(22050.0);
    expect(updated.cutoffClosedHz).toBe(200.0);
    expect(updated.filterQ).toBe(4.0);
    expect(updated.presetName).toBe('dialogue_occluded');

    const fetched = service.getProfile('series-clamped-spatial');
    expect(fetched.referenceDistancePx).toBe(500.0);
    expect(fetched.rolloffFactor).toBe(3.0);
  });

  it('calculates zero-allocation inverse distance attenuation correctly', () => {
    // Exactly at reference distance -> attenuation = 1.0
    const resAtRef = calculateSpatialAudio(100, 100, 100, 100);
    expect(resAtRef.distancePx).toBe(0);
    expect(resAtRef.attenuation).toBe(1.0);

    // Far distance -> attenuated
    const resFar = calculateSpatialAudio(100, 100, 600, 100, 0.0, 120.0, 1.0, 0.025, 1400.0);
    expect(resFar.distancePx).toBe(500);
    // excess = 500 - 120 = 380, att = 120 / (120 + 380) = 120 / 500 = 0.24
    expect(resFar.attenuation).toBeCloseTo(0.24, 2);
    expect(resFar.attenuation).toBeGreaterThanOrEqual(0.025);
  });

  it('calculates occlusion lowpass biquad cutoff frequency logarithmically', () => {
    // Unoccluded (0.0) -> cutoffOpenHz (18000 Hz)
    const openRes = calculateSpatialAudio(100, 100, 100, 100, 0.0, 120, 1.0, 0.025, 1400, 480, 18000, 2500);
    expect(openRes.cutoffHz).toBe(18000.0);

    // Fully occluded (1.0) -> cutoffClosedHz (2500 Hz)
    const closedRes = calculateSpatialAudio(100, 100, 100, 100, 1.0, 120, 1.0, 0.025, 1400, 480, 18000, 2500);
    expect(closedRes.cutoffHz).toBe(2500.0);

    // Half occluded (0.5) -> geometric mean sqrt(18000 * 2500) = sqrt(45,000,000) ~ 6708 Hz
    const halfRes = calculateSpatialAudio(100, 100, 100, 100, 0.5, 120, 1.0, 0.025, 1400, 480, 18000, 2500);
    expect(halfRes.cutoffHz).toBeGreaterThan(2500);
    expect(halfRes.cutoffHz).toBeLessThan(18000);
    expect(halfRes.cutoffHz).toBeCloseTo(Math.sqrt(18000 * 2500), -1);
  });

  it('calculates equal-power stereo panning law preserving total energy', () => {
    // Center panning (dx = 0) -> theta = pi/4 -> gainL = gainR = cos(pi/4) * A ~ 0.7071 * A
    const centerRes = calculateSpatialAudio(200, 200, 200, 200);
    expect(centerRes.panning).toBe(0.0);
    expect(centerRes.gainLeft).toBeCloseTo(centerRes.gainRight, 3);
    const centerEnergy = centerRes.gainLeft * centerRes.gainLeft + centerRes.gainRight * centerRes.gainRight;
    expect(centerEnergy).toBeCloseTo(centerRes.attenuation * centerRes.attenuation, 3);

    // Full left pan (dx = -panRadiusPx) -> theta = 0 -> gainL = 1.0 * A, gainR = 0
    const leftRes = calculateSpatialAudio(0, 100, 480, 100, 0.0, 120, 1.0, 0.025, 1400, 480);
    expect(leftRes.panning).toBe(-1.0);
    expect(leftRes.gainLeft).toBeCloseTo(leftRes.attenuation, 3);
    expect(leftRes.gainRight).toBeCloseTo(0.0, 3);

    // Full right pan (dx = +panRadiusPx) -> theta = pi/2 -> gainL = 0, gainR = 1.0 * A
    const rightRes = calculateSpatialAudio(960, 100, 480, 100, 0.0, 120, 1.0, 0.025, 1400, 480);
    expect(rightRes.panning).toBe(1.0);
    expect(rightRes.gainLeft).toBeCloseTo(0.0, 3);
    expect(rightRes.gainRight).toBeCloseTo(rightRes.attenuation, 3);
  });

  it('handles disabled state as neutral pass-through', () => {
    const disabled = calculateSpatialAudio(500, 500, 0, 0, 0.8, 120, 1.0, 0.025, 1400, 480, 18000, 2500, false);
    expect(disabled.attenuation).toBe(1.0);
    expect(disabled.cutoffHz).toBe(18000);
    expect(disabled.panning).toBe(0.0);
  });

  it('generates consistent ETags and handles cache clearing', () => {
    const profile = service.getProfile('series-etag');
    const etag1 = service.generateETag(profile);
    const etag2 = service.generateETag(profile);
    expect(etag1).toBe(etag2);

    service.clearCache();
    const fetched = service.getProfile('series-etag');
    expect(fetched.seriesId).toBe('series-etag');
  });

  it('verifies all spatial audio presets are properly configured', () => {
    expect(Object.keys(SPATIAL_AUDIO_PRESETS).length).toBe(5);
    for (const [key, preset] of Object.entries(SPATIAL_AUDIO_PRESETS)) {
      expect(preset.name).toBe(key);
      expect(preset.referenceDistancePx).toBeGreaterThan(0);
      expect(preset.rolloffFactor).toBeGreaterThan(0);
      expect(preset.cutoffOpenHz).toBeGreaterThan(preset.cutoffClosedHz);
    }
  });
});
