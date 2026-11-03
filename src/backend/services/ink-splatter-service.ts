import { DatabaseInstance } from '../db/database.js';

export type InkSplatterPresetName =
  | 'shonen_impact_burst'
  | 'vintage_gpen_newsprint'
  | 'deluxe_bristol_clean'
  | 'dramatic_blood_splatter'
  | 'raw_fixed';

export interface InkSplatterProfile {
  seriesId: string;
  presetName: InkSplatterPresetName;
  strokeVelocity: number;
  bleedRadiusPx: number;
  splatterDensity: number;
  wickingRate: number;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface InkSplatterPreset {
  name: InkSplatterPresetName;
  label: string;
  strokeVelocity: number;
  bleedRadiusPx: number;
  splatterDensity: number;
  wickingRate: number;
  description: string;
}

export const INK_SPLATTER_PRESETS: Record<InkSplatterPresetName, InkSplatterPreset> = {
  shonen_impact_burst: {
    name: 'shonen_impact_burst',
    label: 'Shōnen Action Impact Burst',
    strokeVelocity: 750.0,
    bleedRadiusPx: 1.8,
    splatterDensity: 0.70,
    wickingRate: 0.55,
    description: 'Dynamic G-pen ink micro-droplet ejection and capillary feathering for high-impact combat SFX and onomatopoeia.',
  },
  vintage_gpen_newsprint: {
    name: 'vintage_gpen_newsprint',
    label: 'Vintage G-Pen Newsprint',
    strokeVelocity: 200.0,
    bleedRadiusPx: 2.4,
    splatterDensity: 0.25,
    wickingRate: 0.80,
    description: 'Traditional dip-pen drawing on unsized recycled pulp with deep fibrous capillary bleed along paper pores.',
  },
  deluxe_bristol_clean: {
    name: 'deluxe_bristol_clean',
    label: 'Deluxe Bristol Kent Board',
    strokeVelocity: 300.0,
    bleedRadiusPx: 0.4,
    splatterDensity: 0.10,
    wickingRate: 0.15,
    description: 'Ultra-sized professional manga art board with near-zero capillary wicking and crisp line containment.',
  },
  dramatic_blood_splatter: {
    name: 'dramatic_blood_splatter',
    label: 'Dramatic Splatter Burst',
    strokeVelocity: 950.0,
    bleedRadiusPx: 3.2,
    splatterDensity: 0.90,
    wickingRate: 0.65,
    description: 'High-velocity visceral ink spray for climactic battle manga and horror/seinen splash spreads.',
  },
  raw_fixed: {
    name: 'raw_fixed',
    label: 'Raw Pass-Through (Disabled)',
    strokeVelocity: 0.0,
    bleedRadiusPx: 0.0,
    splatterDensity: 0.0,
    wickingRate: 0.0,
    description: 'Completely bypasses splatter physics and feathering, delivering perfectly crisp vector edges.',
  },
};

export interface InkSplatterDroplet {
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

export interface InkSplatterResult {
  originX: number;
  originY: number;
  dropletCount: number;
  effectiveBleed: number;
  wickingSpread: number;
  isSuppressed: boolean;
  latencyUs: number;
  droplets: InkSplatterDroplet[];
}

const MAX_DROPLETS = 16;
const STATIC_DROPLETS_POOL: InkSplatterDroplet[] = Array.from({ length: MAX_DROPLETS }, () => ({
  x: 0,
  y: 0,
  radius: 0,
  opacity: 0,
}));

const STATIC_SPLATTER_RESULT: InkSplatterResult = {
  originX: 0,
  originY: 0,
  dropletCount: 0,
  effectiveBleed: 0,
  wickingSpread: 0,
  isSuppressed: false,
  latencyUs: 0,
  droplets: STATIC_DROPLETS_POOL,
};

export class InkSplatterService {
  private db: DatabaseInstance;
  private lruCache: Map<string, InkSplatterProfile>;

  constructor(db: DatabaseInstance) {
    this.db = db;
    this.lruCache = new Map();
    this.initSchema();
  }

  public initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ink_splatter_profiles (
          series_id TEXT PRIMARY KEY,
          preset_name TEXT NOT NULL DEFAULT 'shonen_impact_burst' CHECK (preset_name IN (
              'shonen_impact_burst',
              'vintage_gpen_newsprint',
              'deluxe_bristol_clean',
              'dramatic_blood_splatter',
              'raw_fixed'
          )),
          stroke_velocity REAL NOT NULL DEFAULT 250.0 CHECK (stroke_velocity >= 0.0 AND stroke_velocity <= 1000.0),
          bleed_radius_px REAL NOT NULL DEFAULT 1.2 CHECK (bleed_radius_px >= 0.0 AND bleed_radius_px <= 5.0),
          splatter_density REAL NOT NULL DEFAULT 0.3 CHECK (splatter_density >= 0.0 AND splatter_density <= 1.0),
          wicking_rate REAL NOT NULL DEFAULT 0.4 CHECK (wicking_rate >= 0.0 AND wicking_rate <= 1.0),
          is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ink_splatter_lookup 
          ON ink_splatter_profiles(series_id);
    `);
  }

  public getProfile(seriesId: string): InkSplatterProfile {
    const cached = this.lruCache.get(seriesId);
    if (cached) {
      return cached;
    }

    const row = this.db
      .prepare(`SELECT * FROM ink_splatter_profiles WHERE series_id = ?`)
      .get(seriesId) as any;

    if (!row) {
      const preset = INK_SPLATTER_PRESETS.shonen_impact_burst;
      const defaultProfile: InkSplatterProfile = {
        seriesId,
        presetName: preset.name,
        strokeVelocity: preset.strokeVelocity,
        bleedRadiusPx: preset.bleedRadiusPx,
        splatterDensity: preset.splatterDensity,
        wickingRate: preset.wickingRate,
        isEnabled: true,
        createdAt: 0,
        updatedAt: 0,
      };
      this.lruCache.set(seriesId, defaultProfile);
      return defaultProfile;
    }

    const profile: InkSplatterProfile = {
      seriesId: row.series_id,
      presetName: row.preset_name as InkSplatterPresetName,
      strokeVelocity: row.stroke_velocity,
      bleedRadiusPx: row.bleed_radius_px,
      splatterDensity: row.splatter_density,
      wickingRate: row.wicking_rate,
      isEnabled: row.is_enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    this.lruCache.set(seriesId, profile);
    return profile;
  }

  public setProfile(
    profile: Partial<InkSplatterProfile> & { seriesId: string }
  ): InkSplatterProfile {
    const current = this.getProfile(profile.seriesId);
    const now = Date.now();

    const strokeVelocity = profile.strokeVelocity !== undefined ? Math.max(0.0, Math.min(1000.0, profile.strokeVelocity)) : current.strokeVelocity;
    const bleedRadiusPx = profile.bleedRadiusPx !== undefined ? Math.max(0.0, Math.min(5.0, profile.bleedRadiusPx)) : current.bleedRadiusPx;
    const splatterDensity = profile.splatterDensity !== undefined ? Math.max(0.0, Math.min(1.0, profile.splatterDensity)) : current.splatterDensity;
    const wickingRate = profile.wickingRate !== undefined ? Math.max(0.0, Math.min(1.0, profile.wickingRate)) : current.wickingRate;
    const presetName = profile.presetName || current.presetName;
    const isEnabled = profile.isEnabled !== undefined ? (profile.isEnabled ? 1 : 0) : (current.isEnabled ? 1 : 0);

    this.db
      .prepare(
        `INSERT INTO ink_splatter_profiles 
          (series_id, preset_name, stroke_velocity, bleed_radius_px, splatter_density, wicking_rate, is_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(series_id) DO UPDATE SET
          preset_name = excluded.preset_name,
          stroke_velocity = excluded.stroke_velocity,
          bleed_radius_px = excluded.bleed_radius_px,
          splatter_density = excluded.splatter_density,
          wicking_rate = excluded.wicking_rate,
          is_enabled = excluded.is_enabled,
          updated_at = excluded.updated_at`
      )
      .run(
        profile.seriesId,
        presetName,
        strokeVelocity,
        bleedRadiusPx,
        splatterDensity,
        wickingRate,
        isEnabled,
        current.createdAt || now,
        now
      );

    this.lruCache.delete(profile.seriesId);
    return this.getProfile(profile.seriesId);
  }

  public applyPreset(seriesId: string, presetName: InkSplatterPresetName): InkSplatterProfile {
    const preset = INK_SPLATTER_PRESETS[presetName] || INK_SPLATTER_PRESETS.shonen_impact_burst;
    return this.setProfile({
      seriesId,
      presetName: preset.name,
      strokeVelocity: preset.strokeVelocity,
      bleedRadiusPx: preset.bleedRadiusPx,
      splatterDensity: preset.splatterDensity,
      wickingRate: preset.wickingRate,
      isEnabled: presetName !== 'raw_fixed',
    });
  }

  public deleteProfile(seriesId: string): boolean {
    this.lruCache.delete(seriesId);
    const info = this.db
      .prepare(`DELETE FROM ink_splatter_profiles WHERE series_id = ?`)
      .run(seriesId);
    return (info as any).changes > 0;
  }

  public listProfiles(): InkSplatterProfile[] {
    const rows = this.db
      .prepare(`SELECT * FROM ink_splatter_profiles ORDER BY updated_at DESC`)
      .all() as any[];

    return rows.map((row) => ({
      seriesId: row.series_id,
      presetName: row.preset_name as InkSplatterPresetName,
      strokeVelocity: row.stroke_velocity,
      bleedRadiusPx: row.bleed_radius_px,
      splatterDensity: row.splatter_density,
      wickingRate: row.wicking_rate,
      isEnabled: row.is_enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  public static hash2D(x: number, y: number, seed: number = 0x501a): number {
    const h =
      Math.imul((x | 0) ^ 0x45d9f3b, 0x27d4eb2d) ^
      Math.imul((y | 0) ^ 0x165667b1, 0x27d4eb2d) ^
      (seed | 0);
    return ((h ^ (h >>> 15)) & 0x7fffffff) / 0x7fffffff;
  }

  /**
   * SLA 98 Zero-Allocation Analytical Ink Splatter & Capillary Feathering Evaluator.
   * Target Latency: < 20 µs on Intel Pentium T4500 (2.30 GHz, Penryn 45nm).
   */
  public evaluateSplatter(
    originX: number,
    originY: number,
    angleRad: number = 0,
    strokeVelocity: number = 250.0,
    profile?: Partial<InkSplatterProfile>
  ): InkSplatterResult {
    const tStart = performance.now();

    const isEnabled = profile?.isEnabled ?? true;
    const velocity = Math.max(0.0, Math.min(1000.0, profile?.strokeVelocity ?? strokeVelocity));
    const bleedRadius = Math.max(0.0, Math.min(5.0, profile?.bleedRadiusPx ?? 1.2));
    const density = Math.max(0.0, Math.min(1.0, profile?.splatterDensity ?? 0.3));
    const wicking = Math.max(0.0, Math.min(1.0, profile?.wickingRate ?? 0.4));

    if (!isEnabled || (velocity <= 0.001 && bleedRadius <= 0.001)) {
      STATIC_SPLATTER_RESULT.originX = originX;
      STATIC_SPLATTER_RESULT.originY = originY;
      STATIC_SPLATTER_RESULT.dropletCount = 0;
      STATIC_SPLATTER_RESULT.effectiveBleed = 0.0;
      STATIC_SPLATTER_RESULT.wickingSpread = 0.0;
      STATIC_SPLATTER_RESULT.isSuppressed = true;
      STATIC_SPLATTER_RESULT.latencyUs = (performance.now() - tStart) * 1000.0;
      return STATIC_SPLATTER_RESULT;
    }

    // Jurin-Washburn capillary wicking spread
    const effectiveBleed = bleedRadius * (1.0 + wicking * 0.5);
    const wickingSpread = bleedRadius > 0 ? (effectiveBleed - bleedRadius) / bleedRadius : 0.0;

    // Zero-velocity test condition: static pen dot has no directional splatter
    if (velocity <= 0.001) {
      STATIC_SPLATTER_RESULT.originX = originX;
      STATIC_SPLATTER_RESULT.originY = originY;
      STATIC_SPLATTER_RESULT.dropletCount = 0;
      STATIC_SPLATTER_RESULT.effectiveBleed = effectiveBleed;
      STATIC_SPLATTER_RESULT.wickingSpread = wickingSpread;
      STATIC_SPLATTER_RESULT.isSuppressed = false;
      STATIC_SPLATTER_RESULT.latencyUs = (performance.now() - tStart) * 1000.0;
      return STATIC_SPLATTER_RESULT;
    }

    // Number of droplets proportional to velocity and density
    const maxCount = Math.min(MAX_DROPLETS, Math.floor(density * (velocity / 100.0) * 2.0));
    const dropletCount = Math.max(1, maxCount);

    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);

    for (let i = 0; i < dropletCount; i++) {
      const rnd1 = InkSplatterService.hash2D((originX + i * 17) | 0, (originY + i * 23) | 0, i);
      const rnd2 = InkSplatterService.hash2D((originX + i * 31) | 0, (originY + i * 47) | 0, i + 99);

      // Tangential ejection distance with quadratic air drag
      const dist = (velocity * 0.04) * (rnd1 * 0.8 + 0.2);
      // Lateral spread perpendicular to stroke
      const lateral = (rnd2 - 0.5) * 12.0 * (1.0 - rnd1 * 0.5);

      const dx = cosA * dist - sinA * lateral;
      const dy = sinA * dist + cosA * lateral;

      const drop = STATIC_DROPLETS_POOL[i];
      drop.x = originX + dx;
      drop.y = originY + dy;
      drop.radius = Math.max(0.4, (1.8 - rnd1 * 1.2) * (density + 0.2));
      drop.opacity = Math.max(0.3, Math.min(1.0, 1.0 - (dist / (velocity * 0.06))));
    }

    STATIC_SPLATTER_RESULT.originX = originX;
    STATIC_SPLATTER_RESULT.originY = originY;
    STATIC_SPLATTER_RESULT.dropletCount = dropletCount;
    STATIC_SPLATTER_RESULT.effectiveBleed = effectiveBleed;
    STATIC_SPLATTER_RESULT.wickingSpread = wickingSpread;
    STATIC_SPLATTER_RESULT.isSuppressed = false;
    STATIC_SPLATTER_RESULT.latencyUs = (performance.now() - tStart) * 1000.0;

    return STATIC_SPLATTER_RESULT;
  }
}
