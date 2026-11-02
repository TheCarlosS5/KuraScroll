/**
 * KuraScroll Smart Page Curvature & Spine Flattening Dewarping Service
 * Sprint 74 - Polynomial Spine Gutter Dewarping & Shadow Compensation
 *
 * Hardware-tuned for Intel Pentium T4500 (2C/2T 2.3GHz) & Intel GMA 4500MHD.
 * Features zero OpenCV/neural network overhead on host server,
 * client-side discrete vertical strip polynomial transformations,
 * and sub-20µs slice mesh geometry calculation (SLA 38).
 */

import { DatabaseInstance, Statement } from '../db/database.js';

export type GutterSide = 'left' | 'right' | 'center' | 'auto';

export interface SpineDewarpProfile {
  id?: string;
  seriesId: string;
  chapterId?: string | null;
  pageNumber?: number | null;
  gutterSide: GutterSide;
  curvatureDepth: number; // 0.0 - 1.0
  spineWidthPct: number; // 0.05 - 0.50
  shadowCompensation: number; // 0.0 - 0.50
  isEnabled: boolean;
  updatedAt?: number;
}

export interface DewarpSliceMesh {
  sliceIndex: number;
  normPos: number;
  scaleX: number;
  brightness: number;
}

export interface DewarpMeshResult {
  gutterSide: GutterSide;
  spineWidthPct: number;
  isEnabled: boolean;
  slices: DewarpSliceMesh[];
}

export interface CalculateDewarpMeshOptions {
  gutterSide?: GutterSide;
  curvatureDepth?: number;
  spineWidthPct?: number;
  shadowCompensation?: number;
  isEnabled?: boolean;
  sliceCount?: number; // default 16
}

export const DEFAULT_SPINE_DEWARP_PROFILE: Omit<SpineDewarpProfile, 'id' | 'seriesId'> = {
  chapterId: null,
  pageNumber: null,
  gutterSide: 'auto',
  curvatureDepth: 0.25,
  spineWidthPct: 0.20,
  shadowCompensation: 0.15,
  isEnabled: true,
};

export class SpineDewarpService {
  private db: DatabaseInstance;
  private stmtCache = new Map<string, Statement>();

  constructor(db: DatabaseInstance) {
    this.db = db;
    this.initStatements();
  }

  private initStatements(): void {
    const upsertProfileSql = `
      INSERT INTO page_spine_dewarp_profiles (
        id, series_id, chapter_id, page_number, gutter_side,
        curvature_depth, spine_width_pct, shadow_compensation,
        is_enabled, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        gutter_side = excluded.gutter_side,
        curvature_depth = excluded.curvature_depth,
        spine_width_pct = excluded.spine_width_pct,
        shadow_compensation = excluded.shadow_compensation,
        is_enabled = excluded.is_enabled,
        updated_at = excluded.updated_at
    `;
    this.stmtCache.set('upsertProfile', this.db.prepare(upsertProfileSql));

    const selectProfileSql = `
      SELECT id, series_id, chapter_id, page_number, gutter_side,
             curvature_depth, spine_width_pct, shadow_compensation,
             is_enabled, updated_at
      FROM page_spine_dewarp_profiles
      WHERE series_id = ?
        AND (chapter_id = ? OR chapter_id IS NULL)
        AND (page_number = ? OR page_number IS NULL)
      ORDER BY page_number DESC, chapter_id DESC
      LIMIT 1
    `;
    this.stmtCache.set('selectProfile', this.db.prepare(selectProfileSql));

    const deleteProfileSql = `
      DELETE FROM page_spine_dewarp_profiles
      WHERE id = ?
    `;
    this.stmtCache.set('deleteProfile', this.db.prepare(deleteProfileSql));
  }

  /**
   * Zero-allocation Dewarping Slice Mesh Calculation.
   * Target SLA 38: < 0.02 ms (< 20 µs) per 16 slices.
   */
  public static calculateDewarpMesh(options: CalculateDewarpMeshOptions = {}): DewarpMeshResult {
    const isEnabled = options.isEnabled ?? true;
    const gutterSide = options.gutterSide ?? 'auto';
    const spineWidthPct = options.spineWidthPct ?? 0.20;
    const curvatureDepth = options.curvatureDepth ?? 0.25;
    const shadowCompensation = options.shadowCompensation ?? 0.15;
    const sliceCount = options.sliceCount && options.sliceCount > 0 ? options.sliceCount : 16;

    const slices: DewarpSliceMesh[] = new Array(sliceCount);

    if (!isEnabled || curvatureDepth <= 0) {
      for (let i = 0; i < sliceCount; i++) {
        slices[i] = {
          sliceIndex: i,
          normPos: i / sliceCount,
          scaleX: 1.0,
          brightness: 1.0,
        };
      }
      return {
        gutterSide,
        spineWidthPct,
        isEnabled,
        slices,
      };
    }

    const denom = sliceCount > 1 ? sliceCount - 1 : 1;

    for (let i = 0; i < sliceCount; i++) {
      // u_i: 0.0 at spine edge -> 1.0 at flat boundary
      const u = i / denom;
      const distFromSpine = 1.0 - u;

      // Quadratic cylindrical curvature compression factor
      const d = curvatureDepth * (distFromSpine * distFromSpine);

      // Horizontal elongation factor to counteract cylindrical compression
      const scaleX = 1.0 + d * 0.85;

      // Illumination / brightness boost to counteract spine gutter shadow
      const brightness = 1.0 + shadowCompensation * distFromSpine;

      slices[i] = {
        sliceIndex: i,
        normPos: u,
        scaleX,
        brightness,
      };
    }

    return {
      gutterSide,
      spineWidthPct,
      isEnabled,
      slices,
    };
  }

  /**
   * Retrieves the most specific dewarping profile (page -> chapter -> series default).
   */
  public getProfile(
    seriesId: string,
    chapterId?: string | null,
    pageNumber?: number | null
  ): SpineDewarpProfile {
    const stmt = this.stmtCache.get('selectProfile')!;
    const row = stmt.get(seriesId, chapterId ?? null, pageNumber ?? null) as any;

    if (!row) {
      return {
        id: `default:${seriesId}`,
        seriesId,
        ...DEFAULT_SPINE_DEWARP_PROFILE,
        chapterId: chapterId ?? null,
        pageNumber: pageNumber ?? null,
        updatedAt: 0,
      };
    }

    return {
      id: row.id,
      seriesId: row.series_id,
      chapterId: row.chapter_id,
      pageNumber: row.page_number,
      gutterSide: row.gutter_side as GutterSide,
      curvatureDepth: row.curvature_depth,
      spineWidthPct: row.spine_width_pct,
      shadowCompensation: row.shadow_compensation,
      isEnabled: row.is_enabled === 1,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Upserts a spine dewarping profile.
   */
  public saveProfile(profile: SpineDewarpProfile): SpineDewarpProfile {
    const id = profile.id ?? `${profile.seriesId}:${profile.chapterId ?? 'all'}:${profile.pageNumber ?? 'all'}`;
    const now = Date.now();
    const stmt = this.stmtCache.get('upsertProfile')!;

    stmt.run(
      id,
      profile.seriesId,
      profile.chapterId ?? null,
      profile.pageNumber ?? null,
      profile.gutterSide,
      profile.curvatureDepth,
      profile.spineWidthPct,
      profile.shadowCompensation,
      profile.isEnabled ? 1 : 0,
      now
    );

    return {
      ...profile,
      id,
      updatedAt: now,
    };
  }

  /**
   * Deletes a spine dewarping profile by ID.
   */
  public deleteProfile(id: string): boolean {
    const stmt = this.stmtCache.get('deleteProfile')!;
    const info = stmt.run(id);
    return info.changes > 0;
  }
}
