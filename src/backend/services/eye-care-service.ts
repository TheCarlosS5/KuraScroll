import { DatabaseInstance, Statement } from '../db/database.js';

export type EyeCareFilterMode =
  | 'default'
  | 'sepia_warm'
  | 'oled_dark'
  | 'smart_invert'
  | 'e_ink_high_contrast';

export interface EyeCarePreferences {
  userId: string;
  filterMode: EyeCareFilterMode;
  brightnessPct: number; // 10 - 200
  contrastPct: number; // 50 - 250
  blueLightReductionPct: number; // 0 - 100
  updatedAt: string;
}

export interface EyeCareFilterParams {
  filterMode: EyeCareFilterMode;
  isMonochromePage?: boolean;
  brightnessPct?: number;
  contrastPct?: number;
  blueLightReductionPct?: number;
}

export class EyeCareService {
  private stmtGet: Statement;
  private stmtUpsert: Statement;

  constructor(private readonly db: DatabaseInstance) {
    this.stmtGet = this.db.prepare(`
      SELECT 
        user_id AS userId,
        filter_mode AS filterMode,
        brightness_pct AS brightnessPct,
        contrast_pct AS contrastPct,
        blue_light_reduction_pct AS blueLightReductionPct,
        updated_at AS updatedAt
      FROM user_eye_care_preferences
      WHERE user_id = ?
    `);

    this.stmtUpsert = this.db.prepare(`
      INSERT INTO user_eye_care_preferences (
        user_id, filter_mode, brightness_pct, contrast_pct, blue_light_reduction_pct, updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        filter_mode = excluded.filter_mode,
        brightness_pct = excluded.brightness_pct,
        contrast_pct = excluded.contrast_pct,
        blue_light_reduction_pct = excluded.blue_light_reduction_pct,
        updated_at = datetime('now')
    `);
  }

  /**
   * Retrieves user's eye care preferences with safe defaults.
   */
  public getPreferences(userId: string): EyeCarePreferences {
    if (!userId) {
      return this.getDefaults('anonymous');
    }

    const row = this.stmtGet.get(userId) as any;
    if (!row) {
      return this.getDefaults(userId);
    }

    return {
      userId: String(row.userId),
      filterMode: row.filterMode,
      brightnessPct: Number(row.brightnessPct),
      contrastPct: Number(row.contrastPct),
      blueLightReductionPct: Number(row.blueLightReductionPct),
      updatedAt: String(row.updatedAt),
    };
  }

  /**
   * Upserts eye care preferences ensuring strict value clamping.
   */
  public upsertPreferences(userId: string, input: Partial<EyeCarePreferences>): EyeCarePreferences {
    if (!userId) {
      throw new Error('userId is required');
    }

    const current = this.getPreferences(userId);

    const validModes: EyeCareFilterMode[] = [
      'default',
      'sepia_warm',
      'oled_dark',
      'smart_invert',
      'e_ink_high_contrast',
    ];

    const filterMode = input.filterMode && validModes.includes(input.filterMode)
      ? input.filterMode
      : current.filterMode;

    const brightnessPct = Math.max(10, Math.min(200, input.brightnessPct ?? current.brightnessPct));
    const contrastPct = Math.max(50, Math.min(250, input.contrastPct ?? current.contrastPct));
    const blueLightReductionPct = Math.max(0, Math.min(100, input.blueLightReductionPct ?? current.blueLightReductionPct));

    this.stmtUpsert.run(
      userId,
      filterMode,
      brightnessPct,
      contrastPct,
      blueLightReductionPct
    );

    return {
      userId,
      filterMode,
      brightnessPct,
      contrastPct,
      blueLightReductionPct,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Computes hardware-accelerated CSS filter string for Intel GMA 4500MHD.
   * Zero CSS blur or backdrop-filter.
   */
  public buildCssFilter(params: EyeCareFilterParams): string {
    const {
      filterMode = 'default',
      isMonochromePage = true,
      brightnessPct = 100,
      contrastPct = 100,
      blueLightReductionPct = 0,
    } = params;

    const filters: string[] = [];

    switch (filterMode) {
      case 'sepia_warm': {
        const sepiaFactor = 0.35 + (blueLightReductionPct / 100) * 0.3;
        filters.push(`sepia(${sepiaFactor.toFixed(2)})`);
        filters.push('contrast(0.95)');
        filters.push('brightness(0.92)');
        break;
      }

      case 'oled_dark': {
        filters.push('contrast(1.05)');
        filters.push('brightness(0.90)');
        break;
      }

      case 'smart_invert': {
        if (isMonochromePage) {
          filters.push('invert(1)');
          filters.push('hue-rotate(180deg)');
          filters.push('contrast(1.15)');
          filters.push('brightness(0.95)');
        } else {
          // Color cover or color insert: protect colors from turning into negative
          filters.push('brightness(0.92)');
          filters.push('contrast(1.04)');
        }
        break;
      }

      case 'e_ink_high_contrast': {
        filters.push('grayscale(1)');
        filters.push('contrast(1.45)');
        filters.push('brightness(1.08)');
        break;
      }

      case 'default':
      default:
        break;
    }

    // Apply custom slider adjustments if deviated from 100%
    if (brightnessPct !== 100) {
      filters.push(`brightness(${(brightnessPct / 100).toFixed(2)})`);
    }
    if (contrastPct !== 100) {
      filters.push(`contrast(${(contrastPct / 100).toFixed(2)})`);
    }

    return filters.length > 0 ? filters.join(' ') : 'none';
  }

  private getDefaults(userId: string): EyeCarePreferences {
    return {
      userId,
      filterMode: 'default',
      brightnessPct: 100,
      contrastPct: 100,
      blueLightReductionPct: 0,
      updatedAt: new Date().toISOString(),
    };
  }
}
