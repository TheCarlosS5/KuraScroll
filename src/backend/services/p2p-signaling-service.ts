/**
 * KuraScroll P2P Local WebRTC Signaling Service
 * Lightweight, zero-external-dependency broker for local LAN pairing
 * Low-resource footprint: < 2MB memory overhead, zero persistent disk writes
 * Designed for Intel Pentium T4500 (Penryn 2C/2T) & SQLite WAL environment
 */

import crypto from 'node:crypto';

export interface P2PSignalMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'disconnect';
  payload: any;
  fromPeerId: string;
  toPeerId: string;
  timestamp: number;
}

export interface P2PRoom {
  id: string;
  pinCode: string;
  initiatorPeerId: string;
  joinedPeerId?: string;
  createdAt: number;
  expiresAt: number;
  pendingSignals: Map<string, P2PSignalMessage[]>; // peerId -> signals
}

export class P2PSignalingService {
  private readonly rooms = new Map<string, P2PRoom>(); // roomId -> P2PRoom
  private readonly pinIndex = new Map<string, string>(); // pinCode -> roomId
  private cleanupTimer?: NodeJS.Timeout;

  constructor(private readonly roomTtlMs = 5 * 60 * 1000) {
    // Run cleanup every minute
    this.cleanupTimer = setInterval(() => this.purgeExpiredRooms(), 60_000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.rooms.clear();
    this.pinIndex.clear();
  }

  /**
   * Creates a new pairing room and generates a unique 6-digit PIN.
   */
  public createRoom(initiatorPeerId: string): { roomId: string; pinCode: string; expiresAt: string } {
    this.purgeExpiredRooms();

    const roomId = crypto.randomUUID();
    let pinCode = '';

    // Generate unique 6-digit numeric PIN
    for (let attempts = 0; attempts < 100; attempts++) {
      const candidate = Math.floor(100000 + Math.random() * 900000).toString();
      if (!this.pinIndex.has(candidate)) {
        pinCode = candidate;
        break;
      }
    }

    if (!pinCode) {
      throw new Error('Failed to allocate unique PIN code for pairing room');
    }

    const now = Date.now();
    const expiresAt = now + this.roomTtlMs;

    const room: P2PRoom = {
      id: roomId,
      pinCode,
      initiatorPeerId,
      createdAt: now,
      expiresAt,
      pendingSignals: new Map([[initiatorPeerId, []]])
    };

    this.rooms.set(roomId, room);
    this.pinIndex.set(pinCode, roomId);

    return {
      roomId,
      pinCode,
      expiresAt: new Date(expiresAt).toISOString()
    };
  }

  /**
   * Joins an existing room via 6-digit PIN code.
   * Restricts rooms to maximum 2 peers.
   */
  public joinRoom(pinCode: string, receiverPeerId: string): { roomId: string; initiatorPeerId: string } {
    this.purgeExpiredRooms();

    const roomId = this.pinIndex.get(pinCode);
    if (!roomId) {
      throw new Error('Invalid or expired PIN code');
    }

    const room = this.rooms.get(roomId);
    if (!room || room.expiresAt < Date.now()) {
      throw new Error('Room not found or expired');
    }

    if (room.joinedPeerId && room.joinedPeerId !== receiverPeerId) {
      throw new Error('Room is full (max 2 peers per transfer session)');
    }

    room.joinedPeerId = receiverPeerId;
    if (!room.pendingSignals.has(receiverPeerId)) {
      room.pendingSignals.set(receiverPeerId, []);
    }

    return {
      roomId,
      initiatorPeerId: room.initiatorPeerId
    };
  }

  /**
   * Dispatches a signaling packet (SDP or ICE) to the target peer.
   */
  public postSignal(
    roomId: string,
    fromPeerId: string,
    toPeerId: string,
    type: 'offer' | 'answer' | 'ice-candidate' | 'disconnect',
    payload: any
  ): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found or has expired');
    }

    const queue = room.pendingSignals.get(toPeerId);
    if (!queue) {
      room.pendingSignals.set(toPeerId, []);
    }

    const message: P2PSignalMessage = {
      type,
      payload,
      fromPeerId,
      toPeerId,
      timestamp: Date.now()
    };

    // Bound queue to max 50 pending messages per peer
    const targetQueue = room.pendingSignals.get(toPeerId)!;
    if (targetQueue.length < 50) {
      targetQueue.push(message);
    }
  }

  /**
   * Consumes and clears all pending signals for the given peer.
   */
  public pollSignals(roomId: string, peerId: string): P2PSignalMessage[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const queue = room.pendingSignals.get(peerId);
    if (!queue || queue.length === 0) return [];

    const messages = [...queue];
    queue.length = 0; // drain
    return messages;
  }

  /**
   * Cleans up room when session terminates.
   */
  public leaveRoom(roomId: string, _peerId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      this.pinIndex.delete(room.pinCode);
      this.rooms.delete(roomId);
    }
  }

  private purgeExpiredRooms(): void {
    const now = Date.now();
    for (const [id, room] of this.rooms.entries()) {
      if (room.expiresAt <= now) {
        this.pinIndex.delete(room.pinCode);
        this.rooms.delete(id);
      }
    }
  }
}
