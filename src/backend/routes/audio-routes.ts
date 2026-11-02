/**
 * KuraScroll Dynamic SFX & Ambient Audio Routes
 * Sprint 49 - Fastify Endpoints for Audio Manifests and SFX Triggering
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import { AudioSFXService, AudioTrackInput, SfxCueInput } from '../services/audio-sfx-service.js';

export interface AudioRoutesOptions {
  db: DatabaseInstance;
  audioService?: AudioSFXService;
}

export const audioRoutes: FastifyPluginAsync<AudioRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: AudioRoutesOptions
) => {
  const service = opts.audioService ?? new AudioSFXService(opts.db);

  /**
   * Chapter Audio Manifest: Retrieves all background tracks and SFX cues for the entire chapter.
   * GET /api/v1/chapters/:chapterId/audio/manifest
   */
  fastify.get<{
    Params: {
      chapterId: string;
    };
  }>('/api/v1/chapters/:chapterId/audio/manifest', async (request, reply) => {
    const { chapterId } = request.params;
    if (!chapterId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'chapterId parameter is required',
      });
    }

    const manifest = service.getChapterAudioManifest(chapterId);
    return reply.send({
      success: true,
      manifest,
    });
  });

  /**
   * Page Audio Cues: Retrieves active ambient track and SFX cues for a specific page.
   * GET /api/v1/chapters/:chapterId/pages/:pageNumber/audio
   */
  fastify.get<{
    Params: {
      chapterId: string;
      pageNumber: string;
    };
  }>('/api/v1/chapters/:chapterId/pages/:pageNumber/audio', async (request, reply) => {
    const { chapterId, pageNumber } = request.params;
    const pageNum = parseInt(pageNumber, 10);

    if (!chapterId || isNaN(pageNum) || pageNum < 1) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Valid chapterId and positive pageNumber are required',
      });
    }

    const activeTrack = service.getAudioTrackForPage(chapterId, pageNum);
    const cues = service.getSfxCuesForPage(chapterId, pageNum);

    return reply.send({
      success: true,
      chapterId,
      pageNumber: pageNum,
      activeTrack,
      cues,
    });
  });

  /**
   * Administrative Track Registration:
   * POST /api/v1/admin/chapters/:chapterId/audio/tracks
   */
  fastify.post<{
    Params: {
      chapterId: string;
    };
    Body: Omit<AudioTrackInput, 'chapterId'>;
  }>('/api/v1/admin/chapters/:chapterId/audio/tracks', async (request, reply) => {
    const { chapterId } = request.params;
    const body = request.body || {};

    try {
      const record = service.addAudioTrack({
        ...body,
        chapterId,
      });
      return reply.status(201).send({
        success: true,
        track: record,
      });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Failed to add audio track',
      });
    }
  });

  /**
   * Administrative SFX Cue Registration (single or batch):
   * POST /api/v1/admin/chapters/:chapterId/audio/cues
   */
  fastify.post<{
    Params: {
      chapterId: string;
    };
    Body: {
      cues?: Omit<SfxCueInput, 'chapterId'>[];
      cue?: Omit<SfxCueInput, 'chapterId'>;
    };
  }>('/api/v1/admin/chapters/:chapterId/audio/cues', async (request, reply) => {
    const { chapterId } = request.params;
    const { cues, cue } = request.body || {};

    try {
      if (Array.isArray(cues) && cues.length > 0) {
        const fullCues: SfxCueInput[] = cues.map((c) => ({ ...c, chapterId }));
        const count = service.addSfxCuesBatch(fullCues);
        return reply.status(201).send({
          success: true,
          insertedCount: count,
        });
      } else if (cue) {
        const record = service.addSfxCue({ ...cue, chapterId });
        return reply.status(201).send({
          success: true,
          cue: record,
        });
      }

      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Must provide either cue object or cues array',
      });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Failed to add SFX cue',
      });
    }
  });

  /**
   * Delete Track:
   * DELETE /api/v1/admin/audio/tracks/:id
   */
  fastify.delete<{
    Params: {
      id: string;
    };
  }>('/api/v1/admin/audio/tracks/:id', async (request, reply) => {
    const idNum = parseInt(request.params.id, 10);
    if (isNaN(idNum) || idNum <= 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Valid numeric track id is required',
      });
    }

    const deleted = service.deleteAudioTrack(idNum);
    return reply.send({
      success: true,
      deleted,
    });
  });

  /**
   * Delete SFX Cue:
   * DELETE /api/v1/admin/audio/cues/:id
   */
  fastify.delete<{
    Params: {
      id: string;
    };
  }>('/api/v1/admin/audio/cues/:id', async (request, reply) => {
    const idNum = parseInt(request.params.id, 10);
    if (isNaN(idNum) || idNum <= 0) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Valid numeric cue id is required',
      });
    }

    const deleted = service.deleteSfxCue(idNum);
    return reply.send({
      success: true,
      deleted,
    });
  });
};
