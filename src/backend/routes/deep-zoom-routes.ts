/**
 * KuraScroll Deep-Zoom Pyramidal Fastify Routes
 * Sprint 66 - High-Performance Tile Streaming & AABB Viewport Resolution
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  DeepZoomTileService,
  DeepZoomManifest,
  ViewportTransform,
} from '../services/deep-zoom-tile-service.js';

export interface DeepZoomRoutesOptions {
  db: DatabaseInstance;
  deepZoomService?: DeepZoomTileService;
  storageRoot?: string;
  cacheRoot?: string;
}

export const deepZoomRoutes: FastifyPluginAsync<DeepZoomRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: DeepZoomRoutesOptions
) => {
  const service =
    opts.deepZoomService ??
    new DeepZoomTileService({
      db: opts.db,
      storageRoot: opts.storageRoot,
      cacheRoot: opts.cacheRoot,
    });

  /**
   * GET /api/v1/tiles/:chapterId/:pageNumber/meta
   * Returns deep-zoom pyramidal metadata manifest
   */
  fastify.get<{
    Params: { chapterId: string; pageNumber: string };
    Querystring: { width?: string; height?: string; tileSize?: string };
  }>('/api/v1/tiles/:chapterId/:pageNumber/meta', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);

    if (isNaN(pageNum) || pageNum < 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid pageNumber parameter',
      });
    }

    let manifest = service.getManifest(chapterId, pageNum);

    // If query provides width/height and manifest not yet registered, auto-register
    if (!manifest && request.query.width && request.query.height) {
      const w = parseInt(request.query.width, 10);
      const h = parseInt(request.query.height, 10);
      const s = request.query.tileSize ? parseInt(request.query.tileSize, 10) : undefined;
      if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
        manifest = service.registerOrGetManifest(chapterId, pageNum, w, h, s);
      }
    }

    if (!manifest) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Deep zoom metadata for chapter ${chapterId} page ${pageNum} not found`,
      });
    }

    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.status(200).send({
      success: true,
      manifest,
    });
  });

  /**
   * POST /api/v1/tiles/:chapterId/:pageNumber/register
   * Registers or calculates pyramidal tile metadata for a page
   */
  fastify.post<{
    Params: { chapterId: string; pageNumber: string };
    Body: { width: number; height: number; tileSize?: number; overlap?: number };
  }>('/api/v1/tiles/:chapterId/:pageNumber/register', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);
    const { width, height, tileSize, overlap } = request.body ?? {};

    if (isNaN(pageNum) || pageNum < 0 || !width || !height || width <= 0 || height <= 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Valid pageNumber, width and height are required',
      });
    }

    const manifest = service.registerOrGetManifest(
      chapterId,
      pageNum,
      width,
      height,
      tileSize,
      overlap
    );

    return reply.status(200).send({
      success: true,
      manifest,
    });
  });

  /**
   * POST /api/v1/tiles/viewport-tiles
   * Resolves visible tiles for an AABB viewport transform in microseconds
   */
  fastify.post<{
    Body: {
      transform: ViewportTransform;
      manifest: DeepZoomManifest;
    };
  }>('/api/v1/tiles/viewport-tiles', async (request, reply) => {
    const { transform, manifest } = request.body ?? {};

    if (!transform || !manifest) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'transform and manifest objects are required',
      });
    }

    const visibleTileSet = service.calculateVisible(transform, manifest);

    return reply.status(200).send({
      success: true,
      visibleTileSet,
    });
  });

  /**
   * GET /api/v1/tiles/:chapterId/:pageNumber/:level/:tile
   * Serves an individual WebP tile with HTTP 304 / ETag support
   */
  fastify.get<{
    Params: {
      chapterId: string;
      pageNumber: string;
      level: string;
      tile: string;
    };
  }>('/api/v1/tiles/:chapterId/:pageNumber/:level/:tile', async (request, reply) => {
    const { chapterId, pageNumber, level, tile } = request.params;
    const pageNum = parseInt(pageNumber, 10);
    const levelNum = parseInt(level, 10);

    const match = tile.match(/^(\d+)_(\d+)\.webp$/);
    if (!match || isNaN(pageNum) || isNaN(levelNum)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid tile format. Expected {col}_{row}.webp',
      });
    }

    const col = parseInt(match[1], 10);
    const row = parseInt(match[2], 10);

    try {
      const tileData = await service.getTile(chapterId, pageNum, levelNum, col, row);

      const clientEtag = request.headers['if-none-match'];
      if (clientEtag && clientEtag === tileData.etag) {
        return reply.status(304).send();
      }

      reply.header('Content-Type', tileData.contentType);
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      reply.header('ETag', tileData.etag);
      return reply.status(200).send(tileData.buffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: `Failed to fetch tile: ${msg}`,
      });
    }
  });
};
