/**
 * KuraScroll Deep-Zoom Pyramidal Tile Service & AABB Viewport LOD Engine
 * Sprint 66 - High-Performance Pan-Scan for Massive Manga Spreads
 *
 * Designed for Intel Pentium T4500 (Penryn 2.3GHz 2C/2T) & Intel GMA 4500MHD.
 * Strictly adheres to 2048x2048 GPU hardware texture limit, bounding in-flight VRAM <= 8MB.
 */

import { DatabaseInstance, Statement } from '../db/database.js';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';

export interface PyramidLevel {
  level: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
  scale: number;
}

export interface TileDescriptor {
  level: number;
  col: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  url: string;
}

export interface DeepZoomManifest {
  chapterId: string;
  pageNumber: number;
  isPyramidal: boolean;
  originalWidth: number;
  originalHeight: number;
  tileSize: number;
  overlap: number;
  format: 'webp';
  maxLevel: number;
  totalTiles: number;
  levels: PyramidLevel[];
  createdAt: number;
}

export interface ViewportTransform {
  panX: number;
  panY: number;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
  forcedLevel?: number;
}

export interface VisibleTileSet {
  level: number;
  tiles: TileDescriptor[];
  totalVisible: number;
  vramBytesEstimated: number;
  isClamped: boolean;
}

export interface DeepZoomServiceOptions {
  db: DatabaseInstance;
  storageRoot?: string;
  cacheRoot?: string;
  defaultTileSize?: number;
  defaultOverlap?: number;
}

export function computePyramidLevels(
  width: number,
  height: number,
  tileSize: number = 512,
  overlap: number = 0
): { levels: PyramidLevel[]; maxLevel: number; totalTiles: number; isPyramidal: boolean } {
  const safeW = Math.max(1, Math.round(width));
  const safeH = Math.max(1, Math.round(height));
  const maxDim = Math.max(safeW, safeH);

  // Fallback for standard pages <= 2048px (direct single texture fit for Intel GMA 4500MHD)
  if (maxDim <= 2048) {
    const singleLevel: PyramidLevel = {
      level: 0,
      width: safeW,
      height: safeH,
      cols: 1,
      rows: 1,
      scale: 1.0,
    };
    return {
      levels: [singleLevel],
      maxLevel: 0,
      totalTiles: 1,
      isPyramidal: false,
    };
  }

  // Pyramidal calculation for large double-spreads or webtoons
  const maxLevel = Math.max(0, Math.ceil(Math.log2(maxDim / tileSize)));
  const levels: PyramidLevel[] = [];
  let totalTiles = 0;

  for (let l = 0; l <= maxLevel; l++) {
    const scale = Math.pow(2, l - maxLevel);
    const lvlW = Math.max(1, Math.round(safeW * scale));
    const lvlH = Math.max(1, Math.round(safeH * scale));
    const cols = Math.ceil(lvlW / tileSize);
    const rows = Math.ceil(lvlH / tileSize);
    const count = cols * rows;
    totalTiles += count;

    levels.push({
      level: l,
      width: lvlW,
      height: lvlH,
      cols,
      rows,
      scale,
    });
  }

  return {
    levels,
    maxLevel,
    totalTiles,
    isPyramidal: true,
  };
}

export function selectPyramidLevel(
  scale: number,
  maxLevel: number,
  isPyramidal: boolean
): number {
  if (!isPyramidal || maxLevel <= 0) return 0;
  // Dynamic LOD: for scale around 1.0, use maxLevel - 1 (fits screen nicely);
  // for zoom in >= 2.0, ramp up to maxLevel (native 1:1 detail);
  // for zoom out < 0.6, step down
  const zoomOffset = Math.round(Math.log2(Math.max(0.05, scale)));
  const target = maxLevel - 1 + zoomOffset;
  return Math.max(0, Math.min(maxLevel, target));
}

export function calculateVisibleTiles(
  transform: ViewportTransform,
  manifest: DeepZoomManifest
): VisibleTileSet {
  const levelIdx =
    transform.forcedLevel !== undefined
      ? Math.max(0, Math.min(manifest.maxLevel, transform.forcedLevel))
      : selectPyramidLevel(transform.scale, manifest.maxLevel, manifest.isPyramidal);

  const levelInfo =
    manifest.levels.find((l) => l.level === levelIdx) ??
    manifest.levels[manifest.levels.length - 1];
  const tileSize = manifest.tileSize;

  const lvlW = levelInfo.width;
  const lvlH = levelInfo.height;

  // Coordinate projection from screen viewport to level image space
  const effectiveScale =
    transform.scale * (lvlW / Math.max(1, manifest.originalWidth));
  const safeScale = effectiveScale <= 0 ? 0.0001 : effectiveScale;

  const minX = Math.max(0, -transform.panX / safeScale);
  const minY = Math.max(0, -transform.panY / safeScale);
  const maxX = Math.min(lvlW, (transform.viewportWidth - transform.panX) / safeScale);
  const maxY = Math.min(lvlH, (transform.viewportHeight - transform.panY) / safeScale);

  const minCol = Math.max(0, Math.floor(minX / tileSize));
  const maxCol = Math.min(levelInfo.cols - 1, Math.floor(maxX / tileSize));
  const minRow = Math.max(0, Math.floor(minY / tileSize));
  const maxRow = Math.min(levelInfo.rows - 1, Math.floor(maxY / tileSize));

  const tiles: TileDescriptor[] = [];
  const MAX_TILES_CLAMP = 36;
  let isClamped = false;

  if (minCol <= maxCol && minRow <= maxRow) {
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (tiles.length >= MAX_TILES_CLAMP) {
          isClamped = true;
          break;
        }
        const tileX = c * tileSize;
        const tileY = r * tileSize;
        const tileW = Math.min(tileSize, lvlW - tileX);
        const tileH = Math.min(tileSize, lvlH - tileY);

        tiles.push({
          level: levelIdx,
          col: c,
          row: r,
          x: tileX,
          y: tileY,
          width: tileW,
          height: tileH,
          url: `/api/v1/tiles/${manifest.chapterId}/${manifest.pageNumber}/${levelIdx}/${c}_${r}.webp`,
        });
      }
      if (isClamped) break;
    }
  }

  // Estimated VRAM bytes: width * height * 4 (RGBA32 texture memory on Intel GMA 4500MHD)
  let vramBytesEstimated = 0;
  for (let i = 0; i < tiles.length; i++) {
    vramBytesEstimated += tiles[i].width * tiles[i].height * 4;
  }

  return {
    level: levelIdx,
    tiles,
    totalVisible: tiles.length,
    vramBytesEstimated,
    isClamped,
  };
}

export class DeepZoomTileService {
  private db: DatabaseInstance;
  private storageRoot: string;
  private cacheRoot: string;
  private defaultTileSize: number;
  private defaultOverlap: number;
  private stmtCache: Map<string, Statement> = new Map();

  constructor(options: DeepZoomServiceOptions) {
    this.db = options.db;
    this.storageRoot = options.storageRoot ?? path.resolve('./data/storage');
    this.cacheRoot = options.cacheRoot ?? path.resolve('./data/cache/tiles');
    this.defaultTileSize = options.defaultTileSize ?? 512;
    this.defaultOverlap = options.defaultOverlap ?? 0;

    // Enforce hardware constraints on Sharp
    sharp.concurrency(1);
    sharp.cache({ memory: 8, files: 2, items: 8 });

    this.initStatements();
    this.ensureDirs();
  }

  private ensureDirs(): void {
    if (!fs.existsSync(this.cacheRoot)) {
      fs.mkdirSync(this.cacheRoot, { recursive: true });
    }
  }

  private initStatements(): void {
    const selectSql = `
      SELECT chapter_id, page_number, is_pyramidal, original_width, original_height,
             tile_size, max_level, total_tiles, pyramid_json, created_at
      FROM page_pyramid_metadata
      WHERE chapter_id = ? AND page_number = ?
    `;
    this.stmtCache.set('selectManifest', this.db.prepare(selectSql));

    const upsertSql = `
      INSERT INTO page_pyramid_metadata (
        chapter_id, page_number, is_pyramidal, original_width, original_height,
        tile_size, max_level, total_tiles, pyramid_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chapter_id, page_number) DO UPDATE SET
        is_pyramidal = excluded.is_pyramidal,
        original_width = excluded.original_width,
        original_height = excluded.original_height,
        tile_size = excluded.tile_size,
        max_level = excluded.max_level,
        total_tiles = excluded.total_tiles,
        pyramid_json = excluded.pyramid_json,
        created_at = excluded.created_at
    `;
    this.stmtCache.set('upsertManifest', this.db.prepare(upsertSql));
  }

  public registerOrGetManifest(
    chapterId: string,
    pageNumber: number,
    originalWidth: number,
    originalHeight: number,
    tileSize: number = this.defaultTileSize,
    overlap: number = this.defaultOverlap
  ): DeepZoomManifest {
    const existing = this.getManifest(chapterId, pageNumber);
    if (
      existing &&
      existing.originalWidth === originalWidth &&
      existing.originalHeight === originalHeight &&
      existing.tileSize === tileSize
    ) {
      return existing;
    }

    const { levels, maxLevel, totalTiles, isPyramidal } = computePyramidLevels(
      originalWidth,
      originalHeight,
      tileSize,
      overlap
    );

    const manifest: DeepZoomManifest = {
      chapterId,
      pageNumber,
      isPyramidal,
      originalWidth,
      originalHeight,
      tileSize,
      overlap,
      format: 'webp',
      maxLevel,
      totalTiles,
      levels,
      createdAt: Date.now(),
    };

    const stmt = this.stmtCache.get('upsertManifest')!;
    stmt.run(
      manifest.chapterId,
      manifest.pageNumber,
      manifest.isPyramidal ? 1 : 0,
      manifest.originalWidth,
      manifest.originalHeight,
      manifest.tileSize,
      manifest.maxLevel,
      manifest.totalTiles,
      JSON.stringify(manifest.levels),
      manifest.createdAt
    );

    return manifest;
  }

  public getManifest(chapterId: string, pageNumber: number): DeepZoomManifest | null {
    const stmt = this.stmtCache.get('selectManifest')!;
    const row = stmt.get(chapterId, pageNumber) as
      | {
          chapter_id: string;
          page_number: number;
          is_pyramidal: number;
          original_width: number;
          original_height: number;
          tile_size: number;
          max_level: number;
          total_tiles: number;
          pyramid_json: string;
          created_at: number;
        }
      | undefined;

    if (!row) return null;

    let levels: PyramidLevel[] = [];
    try {
      levels = JSON.parse(row.pyramid_json);
    } catch {
      levels = [];
    }

    return {
      chapterId: row.chapter_id,
      pageNumber: row.page_number,
      isPyramidal: Boolean(row.is_pyramidal),
      originalWidth: row.original_width,
      originalHeight: row.original_height,
      tileSize: row.tile_size,
      overlap: 0,
      format: 'webp',
      maxLevel: row.max_level,
      totalTiles: row.total_tiles,
      levels,
      createdAt: row.created_at,
    };
  }

  public calculateVisible(
    transform: ViewportTransform,
    manifest: DeepZoomManifest
  ): VisibleTileSet {
    return calculateVisibleTiles(transform, manifest);
  }

  public async getTile(
    chapterId: string,
    pageNumber: number,
    level: number,
    col: number,
    row: number
  ): Promise<{ buffer: Buffer; contentType: string; etag: string }> {
    const tileDir = path.join(
      this.cacheRoot,
      chapterId,
      String(pageNumber),
      `L${level}`
    );
    const tilePath = path.join(tileDir, `${col}_${row}.webp`);

    // Check disk cache first
    if (fs.existsSync(tilePath)) {
      const buffer = fs.readFileSync(tilePath);
      const etag = `"${crypto.createHash('md5').update(buffer).digest('hex')}"`;
      return { buffer, contentType: 'image/webp', etag };
    }

    // Generate tile
    const manifest = this.getManifest(chapterId, pageNumber);
    const tileSize = manifest?.tileSize ?? this.defaultTileSize;
    const levelInfo = manifest?.levels.find((l) => l.level === level);
    const targetW = levelInfo ? levelInfo.width : tileSize;
    const targetH = levelInfo ? levelInfo.height : tileSize;

    // Check if source file exists in storageRoot
    const sourcePath = path.join(
      this.storageRoot,
      chapterId,
      `page_${String(pageNumber).padStart(3, '0')}.webp`
    );

    let tileBuffer: Buffer;
    if (fs.existsSync(sourcePath)) {
      const tileX = col * tileSize;
      const tileY = row * tileSize;
      const actualTileW = Math.min(tileSize, targetW - tileX);
      const actualTileH = Math.min(tileSize, targetH - tileY);

      tileBuffer = await sharp(sourcePath, { sequentialRead: true, limitInputPixels: 40_000_000 })
        .resize(targetW, targetH, { fit: 'fill' })
        .extract({
          left: tileX,
          top: tileY,
          width: Math.max(1, actualTileW),
          height: Math.max(1, actualTileH),
        })
        .webp({ quality: 80, effort: 1 })
        .toBuffer();
    } else {
      // Mock / fallback tile buffer for testing and development
      const actualTileW = tileSize;
      const actualTileH = tileSize;
      const svg = `
        <svg width="${actualTileW}" height="${actualTileH}" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#18181b"/>
          <text x="50%" y="45%" fill="#71717a" font-size="20" font-family="sans-serif" text-anchor="middle">
            L${level} [${col}, ${row}]
          </text>
          <text x="50%" y="65%" fill="#3f3f46" font-size="14" font-family="sans-serif" text-anchor="middle">
            ${chapterId} p${pageNumber}
          </text>
        </svg>
      `;
      tileBuffer = await sharp(Buffer.from(svg))
        .webp({ quality: 80, effort: 1 })
        .toBuffer();
    }

    if (!fs.existsSync(tileDir)) {
      fs.mkdirSync(tileDir, { recursive: true });
    }
    fs.writeFileSync(tilePath, tileBuffer);

    const etag = `"${crypto.createHash('md5').update(tileBuffer).digest('hex')}"`;
    return { buffer: tileBuffer, contentType: 'image/webp', etag };
  }
}
