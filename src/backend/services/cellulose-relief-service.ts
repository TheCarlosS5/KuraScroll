import { DatabaseInstance } from '../db/database.js';

export type CelluloseReliefPresetName =
  | 'tankobon_woodfree_matte'
  | 'shonen_pulp_unbleached'
  | 'kanzenban_cotton_satin'
  | 'vintage_aged_newsprint'
  | 'raw_fixed';

export interface CelluloseReliefProfile {
  seriesId: string;
  presetName: CelluloseReliefPresetName;
  grainScale: number;
  reliefDepth: number;
  fiberDensity: number;
  lightAngle: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CelluloseReliefPreset {
  name: CelluloseReliefPresetName;
  label: string;
  grainScale: number;
  reliefDepth: number;
  fiberDensity: number;
  lightAngle: number;
  description: string;
}

export const CELLULOSE_RELIEF_PRESETS: Record<CelluloseReliefPresetName, CelluloseReliefPreset> = {
  tankobon_woodfree_matte: {
    name: 'tankobon_woodfree_matte',
    label: 'Tankōbon Standard Woodfree',
    grainScale: 1.00,
    reliefDepth: 0.25,
    fiberDensity: 0.50,
    lightAngle: 0.785398, // 45 deg
    description: 'Commercial manga pocket edition paper with balanced mineral loading and subtle matte fiber relief.',
  },
  shonen_pulp_unbleached: {
    name: 'shonen_pulp_unbleached',
    label: 'Shōnen Magazine Unbleached Pulp',
    grainScale: 1.40,
    reliefDepth: 0.45,
    fiberDensity: 0.75,
    lightAngle: 0.645772, // ~37 deg
    description: 'Rustic recycled thermomechanical wood pulp with prominent fibrous ridges and micro-shadowing.',
  },
  kanzenban_cotton_satin: {
    name: 'kanzenban_cotton_satin',
    label: 'Kanzenban Cotton Satin',
    grainScale: 0.60,
    reliefDepth: 0.08,
    fiberDensity: 0.20,
    lightAngle: 0.855211, // ~49 deg
    description: 'Collector edition super-calendered Kraft paper with long cotton fibers and ultra-smooth satin surface.',
  },
  vintage_aged_newsprint: {
    name: 'vintage_aged_newsprint',
    label: 'Vintage Aged Newsprint',
    grainScale: 1.80,
    reliefDepth: 0.60,
    fiberDensity: 0.85,
    lightAngle: 0.523599, // 30 deg
    description: 'Oxidized yellowed newsprint with micro-flaking cellulose and pronounced tactile depth under grazing light.',
  },
  raw_fixed: {
    name: 'raw_fixed',
    label: 'Raw Pass-Through (Disabled)',
    grainScale: 1.00,
    reliefDepth: 0.00,
    fiberDensity: 0.00,
    lightAngle: 0.785398,
    description: 'Completely bypasses cellulose relief synthesis for perfectly flat digital rendering.',
  },
};

export interface CelluloseReliefResult {
  x: number;
  y: number;
  kDensity: number;
  height: number;
  diffuseLight: number;
  effectiveRelief: number;
  isSuppressedByInk: boolean;
  latencyUs: number;
}

const STATIC_RELIEF_RESULT: CelluloseReliefResult = {
  x: 0,
  y: 0,
  kDensity: 0,
  height: 0,
  diffuseLight: 0,
  effectiveRelief: 0,
  isSuppressedByInk: false,
  latencyUs: 0,
};

export class CelluloseReliefService {
  private db: DatabaseInstance;
  private lruCache: Map<string, CelluloseReliefProfile>;

  constructor(db: DatabaseInstance) {
    this.db = db;
    this.lruCache = new Map();
    this.initSchema();
  }

  public initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cellulose_relief_profiles (
          series_id TEXT PRIMARY KEY,
          preset_name TEXT NOT NULL DEFAULT 'tankobon_woodfree_matte' CHECK (preset_name IN (
              'tankobon_woodfree_matte',
              'shonen_pulp_unbleached',
              'kanzenban_cotton_satin',
              'vintage_aged_newsprint',
              'raw_fixed'
          )),
          grain_scale REAL NOT NULL DEFAULT 1.00 CHECK (grain_scale >= 0.1 AND grain_scale <= 5.0),
          relief_depth REAL NOT NULL DEFAULT 0.25 CHECK (relief_depth >= 0.0 AND relief_depth <= 1.0),
          fiber_density REAL NOT NULL DEFAULT 0.50 CHECK (fiber_density >= 0.0 AND fiber_density <= 1.0),
          light_angle REAL NOT NULL DEFAULT 0.785398 CHECK (light_angle >= 0.0 AND light_angle <= 1.570796),
          is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cellulose_relief_lookup 
          ON cellulose_relief_profiles(series_id);
    `);
  }

  public getProfile(seriesId: string): CelluloseReliefProfile {
    const cached = this.lruCache.get(seriesId);
    if (cached) {
      return cached;
    }

    const row = this.db
      .prepare(`SELECT * FROM cellulose_relief_profiles WHERE series_id = ?`)
      .get(seriesId) as any;

    if (!row) {
      const preset = CELLULOSE_RELIEF_PRESETS.tankobon_woodfree_matte;
      const defaultProfile: CelluloseReliefProfile = {
        seriesId,
        presetName: preset.name,
        grainScale: preset.grainScale,
        reliefDepth: preset.reliefDepth,
        fiberDensity: preset.fiberDensity,
        lightAngle: preset.lightAngle,
        isEnabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.lruCache.set(seriesId, defaultProfile);
      return defaultProfile;
    }

    const profile: CelluloseReliefProfile = {
      seriesId: row.series_id,
      presetName: row.preset_name as CelluloseReliefPresetName,
      grainScale: row.grain_scale,
      reliefDepth: row.relief_depth,
      fiberDensity: row.fiber_density,
      lightAngle: row.light_angle,
      isEnabled: row.is_enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    this.lruCache.set(seriesId, profile);
    return profile;
  }

  public setProfile(
    profile: Partial<CelluloseReliefProfile> & { seriesId: string }
  ): CelluloseReliefProfile {
    const current = this.getProfile(profile.seriesId);
    const now = Date.now();

    const grainScale = profile.grainScale !== undefined ? Math.max(0.1, Math.min(5.0, profile.grainScale)) : current.grainScale;
    const reliefDepth = profile.reliefDepth !== undefined ? Math.max(0.0, Math.min(1.0, profile.reliefDepth)) : current.reliefDepth;
    const fiberDensity = profile.fiberDensity !== undefined ? Math.max(0.0, Math.min(1.0, profile.fiberDensity)) : current.fiberDensity;
    const lightAngle = profile.lightAngle !== undefined ? Math.max(0.0, Math.min(Math.PI / 2, profile.lightAngle)) : current.lightAngle;
    const presetName = profile.presetName || current.presetName;
    const isEnabled = profile.isEnabled !== undefined ? (profile.isEnabled ? 1 : 0) : (current.isEnabled ? 1 : 0);

    this.db
      .prepare(
        `INSERT INTO cellulose_relief_profiles 
          (series_id, preset_name, grain_scale, relief_depth, fiber_density, light_angle, is_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(series_id) DO UPDATE SET
          preset_name = excluded.preset_name,
          grain_scale = excluded.grain_scale,
          relief_depth = excluded.relief_depth,
          fiber_density = excluded.fiber_density,
          light_angle = excluded.light_angle,
          is_enabled = excluded.is_enabled,
          updated_at = excluded.updated_at`
      )
      .run(
        profile.seriesId,
        presetName,
        grainScale,
        reliefDepth,
        fiberDensity,
        lightAngle,
        isEnabled,
        current.createdAt || now,
        now
      );

    this.lruCache.delete(profile.seriesId);
    return this.getProfile(profile.seriesId);
  }

  public applyPreset(seriesId: string, presetName: CelluloseReliefPresetName): CelluloseReliefProfile {
    const preset = CELLULOSE_RELIEF_PRESETS[presetName] || CELLULOSE_RELIEF_PRESETS.tankobon_woodfree_matte;
    return this.setProfile({
      seriesId,
      presetName: preset.name,
      grainScale: preset.grainScale,
      reliefDepth: preset.reliefDepth,
      fiberDensity: preset.fiberDensity,
      lightAngle: preset.lightAngle,
      isEnabled: presetName !== 'raw_fixed',
    });
  }

  public deleteProfile(seriesId: string): boolean {
    this.lruCache.delete(seriesId);
    const info = this.db
      .prepare(`DELETE FROM cellulose_relief_profiles WHERE series_id = ?`)
      .run(seriesId);
    return (info as any).changes > 0;
  }

  public listProfiles(): CelluloseReliefProfile[] {
    const rows = this.db
      .prepare(`SELECT * FROM cellulose_relief_profiles ORDER BY updated_at DESC`)
      .all() as any[];

    return rows.map((row) => ({
      seriesId: row.series_id,
      presetName: row.preset_name as CelluloseReliefPresetName,
      grainScale: row.grain_scale,
      reliefDepth: row.relief_depth,
      fiberDensity: row.fiber_density,
      lightAngle: row.light_angle,
      isEnabled: row.is_enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /**
   * Deterministic 2D PRNG hash using bitwise integer multiplication (Math.imul).
   * Zero heap allocations, O(1) evaluation.
   */
  public static hash2D(x: number, y: number, seed: number = 0x1337): number {
    const h =
      Math.imul((x | 0) ^ 0x45d9f3b, 0x27d4eb2d) ^
      Math.imul((y | 0) ^ 0x165667b1, 0x27d4eb2d) ^
      (seed | 0);
    return ((h ^ (h >>> 15)) & 0x7fffffff) / 0x7fffffff;
  }

  /**
   * SLA 97 Zero-Allocation High-Speed Micro-Relief & Cellulose Texture Evaluator.
   * Target Latency: < 20 µs on Intel Pentium T4500 (2.30 GHz, Penryn 45nm).
   */
  public evaluateRelief(
    x: number,
    y: number,
    kDensity: number,
    profile?: Partial<CelluloseReliefProfile>
  ): CelluloseReliefResult {
    const tStart = performance.now();

    const isEnabled = profile?.isEnabled ?? true;
    const grainScale = profile?.grainScale ?? 1.00;
    const reliefDepth = profile?.reliefDepth ?? 0.25;
    const fiberDensity = profile?.fiberDensity ?? 0.50;
    const lightAngle = profile?.lightAngle ?? 0.785398;

    const clampedK = Math.max(0.0, Math.min(1.0, kDensity));

    // Ink Absorption Barrier: dense carbon ink seals paper pores (relief is 0)
    if (!isEnabled || reliefDepth <= 0.0001 || clampedK >= 0.999) {
      STATIC_RELIEF_RESULT.x = x;
      STATIC_RELIEF_RESULT.y = y;
      STATIC_RELIEF_RESULT.kDensity = clampedK;
      STATIC_RELIEF_RESULT.height = 0.0;
      STATIC_RELIEF_RESULT.diffuseLight = 1.0;
      STATIC_RELIEF_RESULT.effectiveRelief = 0.0;
      STATIC_RELIEF_RESULT.isSuppressedByInk = clampedK >= 0.999;
      STATIC_RELIEF_RESULT.latencyUs = (performance.now() - tStart) * 1000.0;
      return STATIC_RELIEF_RESULT;
    }

    // 1. Central height evaluation
    const sx = (x * grainScale) | 0;
    const sy = (y * grainScale) | 0;
    const grain = CelluloseReliefService.hash2D(sx, sy);
    const filament = Math.sin(x * 0.15 + grain * 3.141592653589793) * Math.cos(y * 0.08);
    const height = grain * (1.0 - fiberDensity) + Math.abs(filament) * fiberDensity;

    // 2. Numerical gradient approximation
    const gR = CelluloseReliefService.hash2D(sx + 1, sy);
    const gL = CelluloseReliefService.hash2D(sx - 1, sy);
    const gD = CelluloseReliefService.hash2D(sx, sy + 1);
    const gU = CelluloseReliefService.hash2D(sx, sy - 1);
    const dhdx = (gR - gL) * 0.5;
    const dhdy = (gD - gU) * 0.5;

    // 3. Perturbed normal vector
    const nx = -reliefDepth * dhdx;
    const ny = -reliefDepth * dhdy;
    const nz = 1.0;
    const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + 1.0);
    const normX = nx * invLen;
    const normY = ny * invLen;
    const normZ = nz * invLen;

    // 4. Grazing light vector and Lambertian diffuse reflection
    const lx = Math.cos(lightAngle);
    const ly = 0.0;
    const lz = Math.sin(lightAngle);
    const dotNL = normX * lx + normY * ly + normZ * lz;
    const diffuseLight = Math.max(0.0, dotNL);

    // 5. Ink absorption modulation
    const inkFactor = 1.0 - clampedK;
    const effectiveRelief = diffuseLight * inkFactor;

    STATIC_RELIEF_RESULT.x = x;
    STATIC_RELIEF_RESULT.y = y;
    STATIC_RELIEF_RESULT.kDensity = clampedK;
    STATIC_RELIEF_RESULT.height = height;
    STATIC_RELIEF_RESULT.diffuseLight = diffuseLight;
    STATIC_RELIEF_RESULT.effectiveRelief = effectiveRelief;
    STATIC_RELIEF_RESULT.isSuppressedByInk = clampedK > 0.05;
    STATIC_RELIEF_RESULT.latencyUs = (performance.now() - tStart) * 1000.0;

    return STATIC_RELIEF_RESULT;
  }
}
