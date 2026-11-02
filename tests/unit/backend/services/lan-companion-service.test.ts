import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  LanCompanionService,
} from '../../../../src/backend/services/lan-companion-service.js';

describe('LanCompanionService Unit Tests (Sprint 69)', () => {
  let db: DatabaseInstance;
  let service: LanCompanionService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new LanCompanionService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Deterministic LAN IPv4 Discovery & QR SVG Generator', () => {
    it('resolves deterministic private LAN IP without returning APIPA 169.254', () => {
      const ip = service.getDeterministicLanIp();
      expect(typeof ip).toBe('string');
      expect(ip.length).toBeGreaterThan(0);
      expect(ip.startsWith('169.254.')).toBe(false);
    });

    it('generates valid vector SVG QR Code for pairing URL', () => {
      const svg = service.generateQrSvg('http://192.168.1.10:4000/companion/#test', 256);
      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('width="256"');
      expect(svg).toContain('shape-rendering="crispEdges"');
      expect(svg).toContain('<path d="M');
    });
  });

  describe('Pairing Session Lifecycle & Cryptographic Handshake', () => {
    it('creates an ephemeral pairing session with 90-second TTL and 256-bit token', () => {
      const result = service.createPairingSession(4000, '192.168.1.50');

      expect(result.pairingId).toBeDefined();
      expect(result.rawToken.length).toBe(64); // 32 bytes hex = 64 chars
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(result.pairingUrl).toContain(result.pairingId);
      expect(result.pairingUrl).toContain(result.rawToken);
      expect(result.qrSvg).toContain('<svg');

      const session = service.getSession(result.pairingId);
      expect(session).toBeDefined();
      expect(session?.status).toBe('PENDING');
      expect(session?.failedAttempts).toBe(0);
    });

    it('successfully claims handshake with correct token and generates session token', () => {
      const sessionData = service.createPairingSession(4000, '192.168.1.50');

      const handshake = service.verifyAndClaimHandshake(
        sessionData.pairingId,
        sessionData.rawToken,
        '192.168.1.99',
        'Pixel 8 Pro',
        'mobile'
      );

      expect(handshake.success).toBe(true);
      expect(handshake.sessionToken).toBeDefined();
      expect(handshake.sessionToken?.length).toBe(64);

      // Verify updated status
      const updated = service.getSession(sessionData.pairingId);
      expect(updated?.status).toBe('PAIRED');
      expect(updated?.deviceName).toBe('Pixel 8 Pro');
      expect(updated?.clientIp).toBe('192.168.1.99');
      expect(updated?.pairedAt).toBeDefined();
    });

    it('rejects handshake with invalid token and increments failed attempts', () => {
      const sessionData = service.createPairingSession(4000, '192.168.1.50');

      const handshake = service.verifyAndClaimHandshake(
        sessionData.pairingId,
        'incorrect_token_hash_value',
        '192.168.1.99'
      );

      expect(handshake.success).toBe(false);
      expect(handshake.error).toBe('INVALID_TOKEN');

      const session = service.getSession(sessionData.pairingId);
      expect(session?.failedAttempts).toBe(1);
    });

    it('locks out pairing after 5 consecutive failed token attempts', () => {
      const sessionData = service.createPairingSession(4000, '192.168.1.50');

      for (let i = 0; i < 5; i++) {
        service.verifyAndClaimHandshake(sessionData.pairingId, 'wrong_token', '192.168.1.99');
      }

      const lockedOut = service.verifyAndClaimHandshake(
        sessionData.pairingId,
        sessionData.rawToken,
        '192.168.1.99'
      );

      expect(lockedOut.success).toBe(false);
      expect(lockedOut.error).toBe('TOO_MANY_FAILED_ATTEMPTS');
    });

    it('rejects expired pairing sessions', () => {
      const sessionData = service.createPairingSession(4000, '192.168.1.50');

      // Fast-forward session expiration
      const session = service.getSession(sessionData.pairingId)!;
      session.expiresAt = Date.now() - 5000;

      const handshake = service.verifyAndClaimHandshake(
        sessionData.pairingId,
        sessionData.rawToken,
        '192.168.1.99'
      );

      expect(handshake.success).toBe(false);
      expect(handshake.error).toBe('SESSION_EXPIRED');
    });
  });

  describe('Companion Reading Synchronization & Active Device Management', () => {
    it('synchronizes reading progress from paired mobile device', () => {
      const sessionData = service.createPairingSession();
      const handshake = service.verifyAndClaimHandshake(
        sessionData.pairingId,
        sessionData.rawToken,
        '192.168.1.100'
      );

      expect(handshake.success).toBe(true);

      const ok = service.syncProgress({
        pairingId: sessionData.pairingId,
        sessionToken: handshake.sessionToken!,
        seriesId: 'solo-leveling',
        chapterId: 'chap-150',
        pageNumber: 24,
      });

      expect(ok).toBe(true);

      const session = service.getSession(sessionData.pairingId);
      expect(session?.activeSeriesId).toBe('solo-leveling');
      expect(session?.activeChapterId).toBe('chap-150');
      expect(session?.activePageNumber).toBe(24);
    });

    it('lists active paired companion sessions', () => {
      const session1 = service.createPairingSession();
      const session2 = service.createPairingSession();

      service.verifyAndClaimHandshake(session1.pairingId, session1.rawToken, '192.168.1.1', 'iPad Air', 'tablet');

      const active = service.listActiveSessions();
      expect(active.length).toBe(1);
      expect(active[0].deviceName).toBe('iPad Air');
    });

    it('revokes a companion session and prevents further sync', () => {
      const sessionData = service.createPairingSession();
      const handshake = service.verifyAndClaimHandshake(sessionData.pairingId, sessionData.rawToken, '192.168.1.1');

      const revoked = service.revokeSession(sessionData.pairingId);
      expect(revoked).toBe(true);

      const session = service.getSession(sessionData.pairingId);
      expect(session?.status).toBe('REVOKED');

      const syncAttempt = service.syncProgress({
        pairingId: sessionData.pairingId,
        sessionToken: handshake.sessionToken!,
        pageNumber: 30,
      });
      expect(syncAttempt).toBe(false);
    });
  });
});
