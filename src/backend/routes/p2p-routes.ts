/**
 * KuraScroll Local WebRTC P2P Signaling Routes
 * Fastify endpoints for peer room creation, PIN pairing, and SDP/ICE exchange
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { P2PSignalingService } from '../services/p2p-signaling-service.js';

interface P2PRoutesOptions {
  signalingService?: P2PSignalingService;
}

export const p2pRoutes: FastifyPluginAsync<P2PRoutesOptions> = async (
  fastify: FastifyInstance,
  opts: P2PRoutesOptions
) => {
  const service = opts.signalingService || new P2PSignalingService();

  // Create pairing room
  fastify.post<{
    Body: { peerId: string };
  }>('/api/v1/p2p/room/create', async (request, reply) => {
    const { peerId } = request.body || {};
    if (!peerId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing peerId in request body'
      });
    }

    try {
      const room = service.createRoom(peerId);
      return reply.send({ success: true, ...room });
    } catch (err: any) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: err.message
      });
    }
  });

  // Join pairing room with PIN code
  fastify.post<{
    Body: { pinCode: string; peerId: string };
  }>('/api/v1/p2p/room/join', async (request, reply) => {
    const { pinCode, peerId } = request.body || {};
    if (!pinCode || !peerId) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing pinCode or peerId'
      });
    }

    try {
      const result = service.joinRoom(pinCode, peerId);
      return reply.send({ success: true, ...result });
    } catch (err: any) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: err.message
      });
    }
  });

  // Post SDP or ICE candidate signal
  fastify.post<{
    Body: {
      roomId: string;
      fromPeerId: string;
      toPeerId: string;
      type: 'offer' | 'answer' | 'ice-candidate' | 'disconnect';
      payload: any;
    };
  }>('/api/v1/p2p/signal', async (request, reply) => {
    const { roomId, fromPeerId, toPeerId, type, payload } = request.body || {};
    if (!roomId || !fromPeerId || !toPeerId || !type) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Missing required signaling parameters'
      });
    }

    try {
      service.postSignal(roomId, fromPeerId, toPeerId, type, payload);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message
      });
    }
  });

  // Poll pending signals for peer
  fastify.get<{
    Params: { roomId: string; peerId: string };
  }>('/api/v1/p2p/signals/:roomId/:peerId', async (request, reply) => {
    const { roomId, peerId } = request.params;
    const signals = service.pollSignals(roomId, peerId);
    return reply.send({
      success: true,
      count: signals.length,
      signals
    });
  });

  // Leave room
  fastify.post<{
    Body: { roomId: string; peerId: string };
  }>('/api/v1/p2p/room/leave', async (request, reply) => {
    const { roomId, peerId } = request.body || {};
    if (roomId && peerId) {
      service.leaveRoom(roomId, peerId);
    }
    return reply.send({ success: true });
  });
};
