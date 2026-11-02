import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/backend/app.js';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';

describe('WebRTC P2P Signaling Routes (Sprint 44)', () => {
  let app: FastifyInstance;
  let db: DatabaseInstance;

  beforeEach(async () => {
    db = createDatabase(':memory:');
    runMigrations(db);
    app = buildApp({ db });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates pairing room with 6-digit PIN and allows peer to join', async () => {
    // 1. Peer A creates room
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/p2p/room/create',
      payload: { peerId: 'peer-alpha' }
    });

    expect(createRes.statusCode).toBe(200);
    const createBody = JSON.parse(createRes.payload);
    expect(createBody.success).toBe(true);
    expect(createBody.pinCode).toMatch(/^\d{6}$/);
    expect(createBody.roomId).toBeDefined();

    // 2. Peer B joins room using PIN
    const joinRes = await app.inject({
      method: 'POST',
      url: '/api/v1/p2p/room/join',
      payload: {
        pinCode: createBody.pinCode,
        peerId: 'peer-bravo'
      }
    });

    expect(joinRes.statusCode).toBe(200);
    const joinBody = JSON.parse(joinRes.payload);
    expect(joinBody.success).toBe(true);
    expect(joinBody.roomId).toBe(createBody.roomId);
    expect(joinBody.initiatorPeerId).toBe('peer-alpha');
  });

  it('exchanges SDP offer and answer signals between peers', async () => {
    // Create room
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/p2p/room/create',
      payload: { peerId: 'peer-alice' }
    });
    const { roomId, pinCode } = JSON.parse(createRes.payload);

    // Join room
    await app.inject({
      method: 'POST',
      url: '/api/v1/p2p/room/join',
      payload: { pinCode, peerId: 'peer-bob' }
    });

    // Alice sends SDP offer to Bob
    const offerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/p2p/signal',
      payload: {
        roomId,
        fromPeerId: 'peer-alice',
        toPeerId: 'peer-bob',
        type: 'offer',
        payload: { sdp: 'v=0...' }
      }
    });
    expect(offerRes.statusCode).toBe(200);

    // Bob polls pending signals
    const pollBob = await app.inject({
      method: 'GET',
      url: `/api/v1/p2p/signals/${roomId}/peer-bob`
    });
    expect(pollBob.statusCode).toBe(200);
    const pollBobBody = JSON.parse(pollBob.payload);
    expect(pollBobBody.count).toBe(1);
    expect(pollBobBody.signals[0].type).toBe('offer');
    expect(pollBobBody.signals[0].fromPeerId).toBe('peer-alice');

    // Bob sends SDP answer to Alice
    await app.inject({
      method: 'POST',
      url: '/api/v1/p2p/signal',
      payload: {
        roomId,
        fromPeerId: 'peer-bob',
        toPeerId: 'peer-alice',
        type: 'answer',
        payload: { sdp: 'v=0 answer...' }
      }
    });

    // Alice polls signals
    const pollAlice = await app.inject({
      method: 'GET',
      url: `/api/v1/p2p/signals/${roomId}/peer-alice`
    });
    const pollAliceBody = JSON.parse(pollAlice.payload);
    expect(pollAliceBody.count).toBe(1);
    expect(pollAliceBody.signals[0].type).toBe('answer');
  });

  it('rejects join with invalid PIN code', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/p2p/room/join',
      payload: { pinCode: '999999', peerId: 'peer-intruder' }
    });
    expect(res.statusCode).toBe(404);
  });
});
