/**
 * KuraScroll LAN Companion Sync & QR Bridge Fastify Routes
 * Sprint 69 - Direct Mobile Reader LAN Endpoints
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { DatabaseInstance } from '../db/database.js';
import {
  LanCompanionService,
  CompanionDeviceType,
} from '../services/lan-companion-service.js';

export interface LanCompanionRoutesOptions {
  db: DatabaseInstance;
  lanCompanionService?: LanCompanionService;
  port?: number;
}

export const lanCompanionRoutes: FastifyPluginAsync<LanCompanionRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: LanCompanionRoutesOptions
) => {
  const service = opts.lanCompanionService ?? new LanCompanionService(opts.db);
  const serverPort = opts.port ?? 4000;

  /**
   * GET /api/v1/network/lan-info
   * Returns host network info, LAN IPv4, and active device count
   */
  fastify.get('/api/v1/network/lan-info', async (_request, reply) => {
    const lanIp = service.getDeterministicLanIp();
    const activeSessions = service.listActiveSessions();

    return reply.status(200).send({
      success: true,
      lanIp,
      port: serverPort,
      pairedDevicesCount: activeSessions.length,
      protocol: 'http',
    });
  });

  /**
   * POST /api/v1/network/qr-pair/create
   * Generates a 90s ephemeral QR code pairing session
   */
  fastify.post('/api/v1/network/qr-pair/create', async (request, reply) => {
    const clientIp = request.ip || '127.0.0.1';
    const result = service.createPairingSession(serverPort, clientIp);

    return reply.status(201).send({
      success: true,
      ...result,
    });
  });

  /**
   * POST /api/v1/network/qr-pair/handshake
   * Validates pairing token from mobile phone scan and returns long-term session token
   */
  fastify.post<{
    Body: {
      pairingId: string;
      rawToken: string;
      deviceName?: string;
      deviceType?: CompanionDeviceType;
    };
  }>('/api/v1/network/qr-pair/handshake', async (request, reply) => {
    const { pairingId, rawToken, deviceName, deviceType } = request.body || {};

    if (!pairingId || !rawToken) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing pairingId or rawToken in request body',
      });
    }

    const clientIp = request.ip || '127.0.0.1';
    const handshake = service.verifyAndClaimHandshake(
      pairingId,
      rawToken,
      clientIp,
      deviceName,
      deviceType
    );

    if (!handshake.success) {
      const status =
        handshake.error === 'SESSION_NOT_FOUND'
          ? 404
          : handshake.error === 'TOO_MANY_FAILED_ATTEMPTS'
          ? 429
          : handshake.error === 'SESSION_EXPIRED' || handshake.error === 'SESSION_REVOKED'
          ? 410
          : 401;

      return reply.status(status).send({
        statusCode: status,
        error: handshake.error || 'Authentication Failed',
        message: 'Pairing handshake failed',
      });
    }

    return reply.status(200).send({
      ...handshake,
    });
  });

  /**
   * GET /api/v1/network/companion/session/:pairingId
   * Retrieves active state and location for companion reader
   */
  fastify.get<{
    Params: { pairingId: string };
  }>('/api/v1/network/companion/session/:pairingId', async (request, reply) => {
    const { pairingId } = request.params;
    const session = service.getSession(pairingId);

    if (!session) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Pairing session not found',
      });
    }

    return reply.status(200).send({
      success: true,
      session: {
        pairingId: session.pairingId,
        deviceName: session.deviceName,
        deviceType: session.deviceType,
        status: session.status,
        activeSeriesId: session.activeSeriesId,
        activeChapterId: session.activeChapterId,
        activePageNumber: session.activePageNumber,
        lastSeenAt: session.lastSeenAt,
      },
    });
  });

  /**
   * POST /api/v1/network/companion/sync-progress
   * Updates reading progress from mobile companion
   */
  fastify.post<{
    Body: {
      pairingId: string;
      sessionToken: string;
      seriesId?: string;
      chapterId?: string;
      pageNumber: number;
    };
  }>('/api/v1/network/companion/sync-progress', async (request, reply) => {
    const { pairingId, sessionToken, seriesId, chapterId, pageNumber } =
      request.body || {};

    if (!pairingId || !sessionToken || typeof pageNumber !== 'number') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing pairingId, sessionToken, or pageNumber',
      });
    }

    const ok = service.syncProgress({
      pairingId,
      sessionToken,
      seriesId,
      chapterId,
      pageNumber,
    });

    if (!ok) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Failed to synchronize progress: invalid session or token',
      });
    }

    return reply.status(200).send({
      success: true,
      message: 'Reading progress synchronized',
    });
  });

  /**
   * GET /api/v1/network/companion/active-devices
   * Lists all paired mobile/tablet devices
   */
  fastify.get('/api/v1/network/companion/active-devices', async (_request, reply) => {
    const devices = service.listActiveSessions();
    return reply.status(200).send({
      success: true,
      count: devices.length,
      devices: devices.map((d) => ({
        pairingId: d.pairingId,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        clientIp: d.clientIp,
        activePageNumber: d.activePageNumber,
        pairedAt: d.pairedAt,
        lastSeenAt: d.lastSeenAt,
      })),
    });
  });

  /**
   * POST /api/v1/network/companion/revoke
   * Revokes a companion device session
   */
  fastify.post<{
    Body: { pairingId: string };
  }>('/api/v1/network/companion/revoke', async (request, reply) => {
    const { pairingId } = request.body || {};
    if (!pairingId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing pairingId',
      });
    }

    const ok = service.revokeSession(pairingId);
    return reply.status(200).send({
      success: ok,
      message: ok ? 'Session revoked' : 'Session not found',
    });
  });
};
