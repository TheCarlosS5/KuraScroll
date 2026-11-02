/**
 * KuraScroll Dynamic Dialogue Text-to-Speech Fastify Routes
 * Sprint 75 - Client-Side Multi-Voice Synthesis, Role Profiles & Queue Dispatch
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  DialogueTTSService,
  DialogueVoiceProfile,
  UserTTSPreferences,
  DialogueBubbleInput,
  VoiceRole,
} from '../services/dialogue-tts-service.js';
import crypto from 'node:crypto';

export interface DialogueTTSRoutesOptions {
  db: DatabaseInstance;
  dialogueTTSService?: DialogueTTSService;
}

export const dialogueTTSRoutes: FastifyPluginAsync<DialogueTTSRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: DialogueTTSRoutesOptions
) => {
  const service = opts.dialogueTTSService ?? new DialogueTTSService(opts.db);

  /**
   * GET /api/v1/dialogue-tts/profiles/:seriesId
   * Retrieves voice profiles for all characters in a series with ETag caching
   */
  fastify.get<{
    Params: { seriesId: string };
  }>('/api/v1/dialogue-tts/profiles/:seriesId', async (request, reply) => {
    const { seriesId } = request.params;

    if (!seriesId || seriesId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid seriesId parameter',
      });
    }

    const profiles = service.getProfilesBySeries(seriesId);
    const payload = JSON.stringify({ success: true, seriesId, profiles });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).type('application/json').send(payload);
  });

  /**
   * POST /api/v1/dialogue-tts/profile
   * Creates or updates a character voice profile
   */
  fastify.post<{
    Body: {
      seriesId: string;
      characterName: string;
      voiceRole?: VoiceRole;
      pitchOffset?: number;
      rateMultiplier?: number;
      preferredVoiceName?: string;
    };
  }>('/api/v1/dialogue-tts/profile', async (request, reply) => {
    const body = request.body;

    if (!body || !body.seriesId || !body.characterName) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'seriesId and characterName are required',
      });
    }

    const saved = service.upsertProfile({
      seriesId: body.seriesId,
      characterName: body.characterName,
      voiceRole: body.voiceRole ?? 'narrator',
      pitchOffset: body.pitchOffset ?? 0.0,
      rateMultiplier: body.rateMultiplier ?? 1.0,
      preferredVoiceName: body.preferredVoiceName ?? '',
    });

    return reply.status(200).send({ success: true, profile: saved });
  });

  /**
   * GET /api/v1/dialogue-tts/preferences/:userId
   * Retrieves user TTS preferences
   */
  fastify.get<{
    Params: { userId: string };
  }>('/api/v1/dialogue-tts/preferences/:userId', async (request, reply) => {
    const { userId } = request.params;

    if (!userId || userId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid userId parameter',
      });
    }

    const preferences = service.getUserPreferences(userId);
    const payload = JSON.stringify({ success: true, preferences });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).type('application/json').send(payload);
  });

  /**
   * PUT /api/v1/dialogue-tts/preferences
   * Updates user TTS preferences
   */
  fastify.put<{
    Body: {
      userId: string;
      masterRate?: number;
      masterVolume?: number;
      autoAdvance?: boolean;
      autoPlay?: boolean;
      defaultNarratorVoice?: string;
    };
  }>('/api/v1/dialogue-tts/preferences', async (request, reply) => {
    const body = request.body;

    if (!body || !body.userId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'userId is required',
      });
    }

    const current = service.getUserPreferences(body.userId);
    const updated = service.upsertUserPreferences({
      userId: body.userId,
      masterRate: body.masterRate ?? current.masterRate,
      masterVolume: body.masterVolume ?? current.masterVolume,
      autoAdvance: body.autoAdvance ?? current.autoAdvance,
      autoPlay: body.autoPlay ?? current.autoPlay,
      defaultNarratorVoice: body.defaultNarratorVoice ?? current.defaultNarratorVoice,
    });

    return reply.status(200).send({ success: true, preferences: updated });
  });

  /**
   * POST /api/v1/dialogue-tts/resolve-queue
   * Fast dialogue queue serialization and voice role resolution (SLA 39)
   */
  fastify.post<{
    Body: {
      seriesId?: string;
      userId?: string;
      bubbles: DialogueBubbleInput[];
      profiles?: DialogueVoiceProfile[];
      userPrefs?: Partial<UserTTSPreferences>;
    };
  }>('/api/v1/dialogue-tts/resolve-queue', async (request, reply) => {
    const { seriesId, userId, bubbles, profiles: explicitProfiles, userPrefs: explicitPrefs } = request.body || {};

    if (!Array.isArray(bubbles)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'bubbles array is required',
      });
    }

    const profiles = explicitProfiles ?? (seriesId ? service.getProfilesBySeries(seriesId) : []);
    const userPrefs = explicitPrefs ?? (userId ? service.getUserPreferences(userId) : undefined);

    const queue = service.resolveDialogueQueue(bubbles, profiles, userPrefs);

    return reply.status(200).send({
      success: true,
      queue,
    });
  });
};
