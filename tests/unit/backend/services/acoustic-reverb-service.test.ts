import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AcousticReverbService,
  calculateAcousticReverb,
  ACOUSTIC_REVERB_PRESETS,
} from '../../../../src/backend/services/acoustic-reverb-service.js';
import { createDatabase, DatabaseInstance } from '../../../../src/backend/db/database.js';

describe('Sprint 108 - AcousticReverbService', () => {
  let db: DatabaseInstance;
  let service: AcousticReverbService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS acoustic_reverb_profiles (
        series_id TEXT PRIMARY KEY,
        scene_environment TEXT NOT NULL DEFAULT 'confined_room' CHECK (scene_environment IN (
            'confined_room',
            'cave_echo',
            'outdoor_open',
            'cathedral_vast',
            'dampened_bedroom',
            'custom'
        )),
        room_size_m3 REAL NOT NULL DEFAULT 85.0 CHECK (room_size_m3 >= 5.0 AND room_size_m3 <= 10000.0),
        absorption_coeff REAL NOT NULL DEFAULT 0.35 CHECK (absorption_coeff >= 0.01 AND absorption_coeff <= 0.99),
        t60_decay_s REAL NOT NULL DEFAULT 1.20 CHECK (t60_decay_s >= 0.10 AND t60_decay_s <= 10.00),
        damping_freq_hz REAL NOT NULL DEFAULT 2800.0 CHECK (damping_freq_hz >= 200.0 AND damping_freq_hz <= 20000.0),
        early_reflections_ms TEXT NOT NULL DEFAULT '[18, 31, 47, 63]',
        wet_dry_mix REAL NOT NULL DEFAULT 0.28 CHECK (wet_dry_mix >= 0.00 AND wet_dry_mix <= 1.00),
        is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_acoustic_reverb_lookup ON acoustic_reverb_profiles(series_id);
    `);
    service = new AcousticReverbService(db);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // ignore
    }
  });

  it('should return default profile if none exists', () => {
    const profile = service.getProfile('test-series-108');
    expect(profile.seriesId).toBe('test-series-108');
    expect(profile.sceneEnvironment).toBe('confined_room');
    expect(profile.roomSizeM3).toBe(85.0);
    expect(profile.absorptionCoeff).toBe(0.35);
    expect(profile.t60DecayS).toBe(1.20);
    expect(profile.dampingFreqHz).toBe(2800.0);
    expect(profile.isEnabled).toBe(true);
  });

  it('should upsert and retrieve updated profile', () => {
    const updated = service.upsertProfile({
      seriesId: 'test-series-108',
      sceneEnvironment: 'cave_echo',
      roomSizeM3: 500.0,
      absorptionCoeff: 0.10,
      t60DecayS: 3.20,
      dampingFreqHz: 1600.0,
      wetDryMix: 0.60,
      isEnabled: true,
    });

    expect(updated.seriesId).toBe('test-series-108');
    expect(updated.sceneEnvironment).toBe('cave_echo');
    expect(updated.roomSizeM3).toBe(500.0);
    expect(updated.t60DecayS).toBe(3.20);
    expect(updated.dampingFreqHz).toBe(1600.0);
    expect(updated.wetDryMix).toBe(0.60);

    const retrieved = service.getProfile('test-series-108');
    expect(retrieved.sceneEnvironment).toBe('cave_echo');
    expect(retrieved.roomSizeM3).toBe(500.0);
  });

  it('should calculate reverberation and maintain feedback stability', () => {
    const result = calculateAcousticReverb(
      85.0,
      0.35,
      1.20,
      2800.0,
      0.28,
      [18, 31, 47, 63],
      'confined_room',
      true
    );

    expect(result.sceneEnvironment).toBe('confined_room');
    expect(result.t60DecayS).toBe(1.20);
    expect(result.feedbackGain).toBeLessThanOrEqual(0.95);
    expect(result.feedbackGain).toBeGreaterThan(0.0);
    expect(result.isStable).toBe(true);
    expect(result.dampingFreqHz).toBe(2800.0);
    expect(result.earlyReflectionTapsMs.length).toBe(4);
    expect(result.wetGain).toBeGreaterThan(0.0);
    expect(result.dryGain).toBeGreaterThan(0.0);
  });

  it('should produce zero feedback and dry gain 1.0 when disabled', () => {
    const result = calculateAcousticReverb(
      85.0,
      0.35,
      1.20,
      2800.0,
      0.28,
      [18, 31, 47, 63],
      'confined_room',
      false
    );

    expect(result.feedbackGain).toBe(0.0);
    expect(result.t60DecayS).toBe(0.0);
    expect(result.dryGain).toBe(1.0);
    expect(result.wetGain).toBe(0.0);
  });

  it('should evaluate different acoustic presets accurately', () => {
    const cave = calculateAcousticReverb(
      ACOUSTIC_REVERB_PRESETS.cave_echo.roomSizeM3,
      ACOUSTIC_REVERB_PRESETS.cave_echo.absorptionCoeff,
      ACOUSTIC_REVERB_PRESETS.cave_echo.t60DecayS,
      ACOUSTIC_REVERB_PRESETS.cave_echo.dampingFreqHz,
      ACOUSTIC_REVERB_PRESETS.cave_echo.wetDryMix,
      ACOUSTIC_REVERB_PRESETS.cave_echo.earlyReflectionsMs,
      'cave_echo',
      true
    );

    const outdoor = calculateAcousticReverb(
      ACOUSTIC_REVERB_PRESETS.outdoor_open.roomSizeM3,
      ACOUSTIC_REVERB_PRESETS.outdoor_open.absorptionCoeff,
      ACOUSTIC_REVERB_PRESETS.outdoor_open.t60DecayS,
      ACOUSTIC_REVERB_PRESETS.outdoor_open.dampingFreqHz,
      ACOUSTIC_REVERB_PRESETS.outdoor_open.wetDryMix,
      ACOUSTIC_REVERB_PRESETS.outdoor_open.earlyReflectionsMs,
      'outdoor_open',
      true
    );

    expect(cave.t60DecayS).toBeGreaterThan(outdoor.t60DecayS);
    expect(cave.feedbackGain).toBeGreaterThan(outdoor.feedbackGain);
    expect(outdoor.dampingFreqHz).toBeGreaterThan(cave.dampingFreqHz);
  });

  it('should return valid presets dictionary', () => {
    const presets = service.getPresets();
    expect(presets.confined_room).toBeDefined();
    expect(presets.cave_echo).toBeDefined();
    expect(presets.outdoor_open).toBeDefined();
    expect(presets.cathedral_vast).toBeDefined();
    expect(presets.dampened_bedroom).toBeDefined();
  });

  it('should evaluate in < 50 µs per call after warmup', () => {
    // Warmup
    for (let i = 0; i < 1000; i++) {
      calculateAcousticReverb(100, 0.3, 1.5, 3000, 0.3, [20, 35, 50, 70], 'custom', true);
    }

    const t0 = process.hrtime.bigint();
    const result = calculateAcousticReverb(100, 0.3, 1.5, 3000, 0.3, [20, 35, 50, 70], 'custom', true);
    const t1 = process.hrtime.bigint();
    const durationUs = Number(t1 - t0) / 1000;

    expect(result.isStable).toBe(true);
    expect(durationUs).toBeLessThan(50);
  });
});
