/**
 * KuraScroll Offline Storage Vault & Quota Arbiter Fastify Routes
 * Sprint 72 - Offline Chapter Management, Weighted LRU Eviction & Quota Guard
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  StorageVaultService,
  VaultChapterRecord,
  QuotaPolicyRecord,
} from '../services/storage-vault-service.js';
import crypto from 'node:crypto';

export interface StorageVaultRoutesOptions {
  db: DatabaseInstance;
  storageVaultService?: StorageVaultService;
}

export const storageVaultRoutes: FastifyPluginAsync<StorageVaultRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: StorageVaultRoutesOptions
) => {
  const service = opts.storageVaultService ?? new StorageVaultService(opts.db);

  /**
   * GET /api/v1/vault/inventory/:userId
   * Retrieves all offline chapters in the vault for a user
   */
  fastify.get<{
    Params: { userId: string };
  }>('/api/v1/vault/inventory/:userId', async (request, reply) => {
    const { userId } = request.params;

    if (!userId || userId.trim() === '') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid userId parameter',
      });
    }

    const inventory = service.getVaultInventory(userId);
    const payload = JSON.stringify({ success: true, count: inventory.length, inventory });
    const etag = `"${crypto.createHash('md5').update(payload).digest('hex')}"`;

    if (request.headers['if-none-match'] === etag) {
      return reply.status(304).send();
    }

    reply.header('Cache-Control', 'private, max-age=60, must-revalidate');
    reply.header('ETag', etag);
    return reply.status(200).type('application/json').send(payload);
  });

  /**
   * POST /api/v1/vault/register
   * Registers a newly downloaded chapter in the vault
   */
  fastify.post<{
    Body: Omit<VaultChapterRecord, 'id'>;
  }>('/api/v1/vault/register', async (request, reply) => {
    const body = request.body;

    if (!body || !body.userId || !body.chapterId || typeof body.totalBytes !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request body. Required: userId, chapterId, totalBytes',
      });
    }

    try {
      const saved = service.registerDownloadedChapter(body);
      return reply.status(200).send({
        success: true,
        chapter: saved,
      });
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: err.message || 'Failed to register chapter in vault',
      });
    }
  });

  /**
   * POST /api/v1/vault/pin
   * Toggles pinned protection status on an offline chapter
   */
  fastify.post<{
    Body: { userId: string; chapterId: string; isPinned?: boolean };
  }>('/api/v1/vault/pin', async (request, reply) => {
    const { userId, chapterId, isPinned } = request.body || {};

    if (!userId || !chapterId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request body. Required: userId, chapterId',
      });
    }

    const nextState = service.togglePin(userId, chapterId, isPinned);
    return reply.status(200).send({
      success: true,
      chapterId,
      isPinned: nextState,
    });
  });

  /**
   * POST /api/v1/vault/evict
   * Evaluates storage quota pressure and evicts weighted candidates
   */
  fastify.post<{
    Body: { userId: string; requiredBytes: number; activeChapterId?: string };
  }>('/api/v1/vault/evict', async (request, reply) => {
    const { userId, requiredBytes, activeChapterId } = request.body || {};

    if (!userId || typeof requiredBytes !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request body. Required: userId, requiredBytes',
      });
    }

    const result = service.evaluateAndEvict(userId, requiredBytes, activeChapterId);
    return reply.status(200).send({
      success: true,
      ...result,
    });
  });

  /**
   * GET /api/v1/vault/status/:userId
   * Retrieves summary metrics of vault usage and quota thresholds
   */
  fastify.get<{
    Params: { userId: string };
  }>('/api/v1/vault/status/:userId', async (request, reply) => {
    const { userId } = request.params;
    const status = service.getVaultStatus(userId);
    return reply.status(200).send({
      success: true,
      status,
    });
  });

  /**
   * GET /api/v1/vault/policy/:userId
   * Retrieves user quota policies
   */
  fastify.get<{
    Params: { userId: string };
  }>('/api/v1/vault/policy/:userId', async (request, reply) => {
    const { userId } = request.params;
    const policy = service.getQuotaPolicy(userId);
    return reply.status(200).send({
      success: true,
      policy,
    });
  });

  /**
   * PUT /api/v1/vault/policy
   * Updates user quota policies
   */
  fastify.put<{
    Body: QuotaPolicyRecord;
  }>('/api/v1/vault/policy', async (request, reply) => {
    const body = request.body;

    if (!body || !body.userId || typeof body.maxQuotaBytes !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid request body. Required: userId, maxQuotaBytes',
      });
    }

    const updated = service.updateQuotaPolicy(body);
    return reply.status(200).send({
      success: true,
      policy: updated,
    });
  });

  /**
   * DELETE /api/v1/vault/chapter/:userId/:chapterId
   * Deletes a chapter from the offline vault
   */
  fastify.delete<{
    Params: { userId: string; chapterId: string };
  }>('/api/v1/vault/chapter/:userId/:chapterId', async (request, reply) => {
    const { userId, chapterId } = request.params;
    const deleted = service.deleteChapter(userId, chapterId);
    return reply.status(200).send({
      success: deleted,
      message: deleted ? `Chapter ${chapterId} deleted` : `Chapter ${chapterId} not found`,
    });
  });
};
