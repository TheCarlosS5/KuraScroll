/**
 * KuraScroll Adaptive Paper Tone, E-Ink Simulation & Palette Remapping Service
 * Sprint 64 - Zero-Latency Circadian Tone Calibration for Intel Pentium T4500 & Intel GMA 4500MHD
 *
 * Implements SVG feColorMatrix parameter synthesis and SQLite profile persistence.
 * Zero CSS blur, zero backdrop-filter, zero V8 heap thrashing.
 */

import crypto from 'node:crypto';
import { DatabaseInstance, Statement } from '../db/database.js';

export type PaperTonePreset =
  | 'ORIGINAL'
  | 'SEPIA_CALIDO'
  | 'PAPEL_E_INK'
  | 'PERIODICO_VINTAGE'
  | 'AMBAR_MEDIANOCHE'
  | 'NOIR_ALTO_CONTRASTE';

export const VALID_PRESETS: PaperTonePreset[] = [
  'ORIGINAL',
  'SEPIA_CALIDO',
  'PAPEL_E_INK',
  'PERIODICO_VINTAGE',
  'AMBAR_MEDIANOCHE',
  'NOIR_ALTO_CONTRASTE',
];

export interface PaperToneProfile {
  id: string;
  userId: string;
  seriesId: string | null;
  preset: PaperTonePreset;
  warmth: number; // -1.0 to 1.0
  contrast: number; // 0.5 to 2.0
  brightness: number; // 0.5 to 1.5
  customMatrix: number[] | null;
  svgMatrix: string;
  updatedAt: string;
}

export interface SetPaperToneInput {
  userId?: string;
  seriesId?: string | null;
  preset?: PaperTonePreset | string;
  warmth?: number;
  contrast?: number;
  brightness?: number;
  customMatrix?: number[] | null;
}

export interface PresetMetadata {
  id: PaperTonePreset;
  name: string;
  description: string;
  blueLightReductionPercent: number;
  baseMatrix: number[];
}

export const PRESET_DEFINITIONS: Record<PaperTonePreset, PresetMetadata> = {
  ORIGINAL: {
    id: 'ORIGINAL',
    name: 'Original (Bypass)',
    description: 'Sin modificaciones colorimétricas. Renderizado sRGB estándar neutral D65.',
    blueLightReductionPercent: 0,
    baseMatrix: [
      1, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 1, 0,
    ],
  },
  SEPIA_CALIDO: {
    id: 'SEPIA_CALIDO',
    name: 'Sepia Cálido',
    description: 'Tono sepia suave (~3200K) que emula papel envejecido y reduce la fatiga visual nocturna.',
    blueLightReductionPercent: 40,
    baseMatrix: [
      0.393, 0.769, 0.189, 0, 0.05,
      0.349, 0.686, 0.168, 0, 0.02,
      0.272, 0.534, 0.131, 0, -0.02,
      0, 0, 0, 1, 0,
    ],
  },
  PAPEL_E_INK: {
    id: 'PAPEL_E_INK',
    name: 'Papel E-Ink',
    description: 'Simula la reflectancia mate de un panel E-Ink Carta 1200 con distribución de grises equilibrada.',
    blueLightReductionPercent: 15,
    baseMatrix: [
      0.280, 0.560, 0.110, 0, 0.04,
      0.280, 0.560, 0.110, 0, 0.04,
      0.260, 0.540, 0.100, 0, 0.02,
      0, 0, 0, 1, 0,
    ],
  },
  PERIODICO_VINTAGE: {
    id: 'PERIODICO_VINTAGE',
    name: 'Periódico Vintage',
    description: 'Tono papel prensa japonés tradicional (lignina oxidada) con blancos marfil y tinta carbón suave.',
    blueLightReductionPercent: 48,
    baseMatrix: [
      0.350, 0.650, 0.150, 0, 0.08,
      0.320, 0.620, 0.140, 0, 0.06,
      0.250, 0.500, 0.100, 0, 0.01,
      0, 0, 0, 1, 0,
    ],
  },
  AMBAR_MEDIANOCHE: {
    id: 'AMBAR_MEDIANOCHE',
    name: 'Ámbar Medianoche',
    description: 'Corte circadiano profundo (< 2200K) con 93% de atenuación de luz azul para lectura en oscuridad absoluta.',
    blueLightReductionPercent: 93,
    baseMatrix: [
      0.350, 0.650, 0.150, 0, 0.10,
      0.250, 0.550, 0.100, 0, 0.04,
      0.020, 0.050, 0.010, 0, 0.00,
      0, 0, 0, 1, 0,
    ],
  },
  NOIR_ALTO_CONTRASTE: {
    id: 'NOIR_ALTO_CONTRASTE',
    name: 'Noir Alto Contraste',
    description: 'Entintado monocromo binario puro. Elimina medios tonos difusos y realza el trazo shonen.',
    blueLightReductionPercent: 0,
    baseMatrix: [
      0.500, 1.000, 0.200, 0, -0.15,
      0.500, 1.000, 0.200, 0, -0.15,
      0.500, 1.000, 0.200, 0, -0.15,
      0, 0, 0, 1, 0,
    ],
  },
};

export class PaperToneService {
  private db: DatabaseInstance;
  private stmtCache: Map<string, Statement> = new Map();

  constructor(db: DatabaseInstance) {
    this.db = db;
    this.initStatements();
  }

  private initStatements(): void {
    const selectScopedSql = `
      SELECT id, user_id, series_id, preset, warmth, contrast, brightness, custom_matrix, updated_at
      FROM user_paper_tone_profiles
      WHERE user_id = ? AND (series_id = ? OR (series_id IS NULL AND ? IS NULL))
      LIMIT 1
    `;
    this.stmtCache.set('selectScoped', this.db.prepare(selectScopedSql));

    const selectSeriesWithFallbackSql = `
      SELECT id, user_id, series_id, preset, warmth, contrast, brightness, custom_matrix, updated_at
      FROM user_paper_tone_profiles
      WHERE user_id = ? AND (series_id = ? OR series_id IS NULL)
      ORDER BY CASE WHEN series_id IS NOT NULL THEN 0 ELSE 1 END
      LIMIT 1
    `;
    this.stmtCache.set('selectWithFallback', this.db.prepare(selectSeriesWithFallbackSql));

    const upsertSql = `
      INSERT INTO user_paper_tone_profiles (
        id, user_id, series_id, preset, warmth, contrast, brightness, custom_matrix, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, IFNULL(series_id, '__global__')) DO UPDATE SET
        preset = excluded.preset,
        warmth = excluded.warmth,
        contrast = excluded.contrast,
        brightness = excluded.brightness,
        custom_matrix = excluded.custom_matrix,
        updated_at = datetime('now')
    `;
    this.stmtCache.set('upsert', this.db.prepare(upsertSql));

    const deleteSql = `
      DELETE FROM user_paper_tone_profiles
      WHERE user_id = ? AND (series_id = ? OR (series_id IS NULL AND ? IS NULL))
    `;
    this.stmtCache.set('delete', this.db.prepare(deleteSql));
  }

  /**
   * Sanitizes and bounds input parameters.
   */
  public static sanitizeParams(input: {
    preset?: string;
    warmth?: number;
    contrast?: number;
    brightness?: number;
  }): {
    preset: PaperTonePreset;
    warmth: number;
    contrast: number;
    brightness: number;
  } {
    let preset: PaperTonePreset = 'ORIGINAL';
    if (input.preset && VALID_PRESETS.includes(input.preset as PaperTonePreset)) {
      preset = input.preset as PaperTonePreset;
    }

    const rawWarmth = Number(input.warmth ?? 0.0);
    const warmth = Number.isFinite(rawWarmth)
      ? Math.max(-1.0, Math.min(1.0, Math.round(rawWarmth * 100) / 100))
      : 0.0;

    const rawContrast = Number(input.contrast ?? 1.0);
    const contrast = Number.isFinite(rawContrast)
      ? Math.max(0.5, Math.min(2.0, Math.round(rawContrast * 100) / 100))
      : 1.0;

    const rawBrightness = Number(input.brightness ?? 1.0);
    const brightness = Number.isFinite(rawBrightness)
      ? Math.max(0.5, Math.min(1.5, Math.round(rawBrightness * 100) / 100))
      : 1.0;

    return { preset, warmth, contrast, brightness };
  }

  /**
   * Computes the 20-float space-delimited SVG feColorMatrix string from parameters.
   */
  public static computeSvgMatrix(
    preset: PaperTonePreset,
    warmth = 0.0,
    contrast = 1.0,
    brightness = 1.0,
    customMatrix?: number[] | null
  ): string {
    let base: number[];

    if (customMatrix && Array.isArray(customMatrix) && customMatrix.length === 20) {
      // Validate all coefficients
      const isValid = customMatrix.every((v) => Number.isFinite(v));
      base = isValid ? [...customMatrix] : [...PRESET_DEFINITIONS.ORIGINAL.baseMatrix];
    } else {
      const def = PRESET_DEFINITIONS[preset] ?? PRESET_DEFINITIONS.ORIGINAL;
      base = [...def.baseMatrix];
    }

    // Apply brightness scaling to RGB rows
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        base[row * 5 + col] *= brightness;
      }
    }

    // Apply contrast scaling centered on 0.5 midpoint
    if (contrast !== 1.0) {
      const offset = 0.5 * (1.0 - contrast);
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          base[row * 5 + col] *= contrast;
        }
        base[row * 5 + 4] += offset;
      }
    }

    // Apply warmth adjustments: warmth > 0 increases Red and decreases Blue; warmth < 0 does inverse
    if (warmth !== 0.0) {
      const redDelta = warmth * 0.08;
      const blueDelta = -warmth * 0.12;

      base[0 * 5 + 4] += redDelta; // Red row offset
      base[2 * 5 + 4] += blueDelta; // Blue row offset
    }

    // Clamp all coefficients to avoid extreme overflows
    const clamped = base.map((v) => {
      if (!Number.isFinite(v)) return 0;
      return Math.round(Math.max(-2.0, Math.min(2.0, v)) * 1000) / 1000;
    });

    return clamped.join(' ');
  }

  /**
   * Retrieves active paper tone profile with series-specific priority and global fallback.
   */
  public getProfile(userId = 'default_user', seriesId?: string | null): PaperToneProfile {
    const stmt = this.stmtCache.get('selectWithFallback');
    if (!stmt) {
      throw new Error('Prepared statement selectWithFallback not initialized');
    }

    const row = stmt.get(userId, seriesId ?? null) as any;

    if (!row) {
      const defaultPreset: PaperTonePreset = 'ORIGINAL';
      return {
        id: `default_${userId}`,
        userId,
        seriesId: seriesId ?? null,
        preset: defaultPreset,
        warmth: 0.0,
        contrast: 1.0,
        brightness: 1.0,
        customMatrix: null,
        svgMatrix: PaperToneService.computeSvgMatrix(defaultPreset),
        updatedAt: new Date().toISOString(),
      };
    }

    const { preset, warmth, contrast, brightness } = PaperToneService.sanitizeParams({
      preset: row.preset,
      warmth: row.warmth,
      contrast: row.contrast,
      brightness: row.brightness,
    });

    let customMatrix: number[] | null = null;
    if (row.custom_matrix) {
      try {
        const parsed = JSON.parse(row.custom_matrix);
        if (Array.isArray(parsed) && parsed.length === 20) {
          customMatrix = parsed;
        }
      } catch {}
    }

    const svgMatrix = PaperToneService.computeSvgMatrix(
      preset,
      warmth,
      contrast,
      brightness,
      customMatrix
    );

    return {
      id: row.id,
      userId: row.user_id,
      seriesId: row.series_id,
      preset,
      warmth,
      contrast,
      brightness,
      customMatrix,
      svgMatrix,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Sets or updates paper tone profile in SQLite.
   */
  public setProfile(input: SetPaperToneInput): PaperToneProfile {
    const userId = input.userId ?? 'default_user';
    const seriesId = input.seriesId ?? null;

    const { preset, warmth, contrast, brightness } = PaperToneService.sanitizeParams(input);

    let customMatrixStr: string | null = null;
    let customMatrixArr: number[] | null = null;
    if (input.customMatrix && Array.isArray(input.customMatrix) && input.customMatrix.length === 20) {
      const valid = input.customMatrix.every((n) => Number.isFinite(n));
      if (valid) {
        customMatrixArr = input.customMatrix;
        customMatrixStr = JSON.stringify(customMatrixArr);
      }
    }

    const profileId = `tone_${crypto.randomUUID().slice(0, 12)}`;
    const stmt = this.stmtCache.get('upsert');
    if (!stmt) {
      throw new Error('Prepared statement upsert not initialized');
    }

    stmt.run(
      profileId,
      userId,
      seriesId,
      preset,
      warmth,
      contrast,
      brightness,
      customMatrixStr
    );

    const svgMatrix = PaperToneService.computeSvgMatrix(
      preset,
      warmth,
      contrast,
      brightness,
      customMatrixArr
    );

    return {
      id: profileId,
      userId,
      seriesId,
      preset,
      warmth,
      contrast,
      brightness,
      customMatrix: customMatrixArr,
      svgMatrix,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Deletes a paper tone profile (resets to system default).
   */
  public resetProfile(userId = 'default_user', seriesId?: string | null): boolean {
    const stmt = this.stmtCache.get('delete');
    if (!stmt) return false;

    const targetSeries = seriesId ?? null;
    const res = stmt.run(userId, targetSeries, targetSeries);
    return res.changes > 0;
  }

  /**
   * Returns list of available presets and metadata.
   */
  public getPresets(): PresetMetadata[] {
    return Object.values(PRESET_DEFINITIONS);
  }
}
