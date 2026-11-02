import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  encodeChunkPacket,
  decodeChunkPacket,
  chunkPageBuffer,
  reassemblePage,
  reconcileProgress,
  P2P_CHUNK_SIZE
} from '../../../src/backend/utils/p2p-chunk-protocol.js';

describe('P2P Chunk Protocol Unit Suite (Sprint 44)', () => {
  it('encodes and decodes binary chunk packets with magic KS header', () => {
    const rawData = new Uint8Array([10, 20, 30, 40, 50]);
    const packet = encodeChunkPacket(1, 0, 3, rawData);

    expect(packet.byteLength).toBe(8 + 5);

    const decoded = decodeChunkPacket(packet);
    expect(decoded.pageNumber).toBe(1);
    expect(decoded.chunkIndex).toBe(0);
    expect(decoded.totalChunks).toBe(3);
    expect(Array.from(decoded.data)).toEqual([10, 20, 30, 40, 50]);
  });

  it('chunks a 150KB page buffer into 3 ordered 64KB packets and reassembles with SHA256 verification', () => {
    const pageData = new Uint8Array(150 * 1024);
    // Fill with deterministic byte values
    for (let i = 0; i < pageData.length; i++) {
      pageData[i] = i % 256;
    }
    const expectedSha256 = crypto.createHash('sha256').update(pageData).digest('hex');

    const packets = chunkPageBuffer(1, pageData);
    expect(packets.length).toBe(3);

    const decodedChunks = packets.map(decodeChunkPacket);
    expect(decodedChunks[0].data.byteLength).toBe(P2P_CHUNK_SIZE);
    expect(decodedChunks[1].data.byteLength).toBe(P2P_CHUNK_SIZE);
    expect(decodedChunks[2].data.byteLength).toBe(150 * 1024 - 2 * P2P_CHUNK_SIZE);

    const reassembled = reassemblePage(decodedChunks, expectedSha256);
    expect(reassembled.byteLength).toBe(pageData.byteLength);
    expect(Array.from(reassembled.subarray(0, 10))).toEqual(Array.from(pageData.subarray(0, 10)));
  });

  it('rejects corrupted page chunks with checksum error', () => {
    const pageData = new Uint8Array(1024);
    pageData.fill(42);

    const packets = chunkPageBuffer(1, pageData);
    const decodedChunks = packets.map(decodeChunkPacket);

    // Corrupt one byte
    decodedChunks[0].data[0] = 99;

    expect(() => reassemblePage(decodedChunks, 'invalid_sha256')).toThrow(/SHA256 mismatch/);
  });

  it('reconciles reading progress with monotonic chapter and page ordering', () => {
    const local = {
      seriesId: 's-1',
      chapterNumber: '10',
      pageNumber: 15,
      updatedAt: '2026-11-01T10:00:00Z'
    };
    const remote = {
      seriesId: 's-1',
      chapterNumber: '10',
      pageNumber: 22, // further ahead
      updatedAt: '2026-11-01T09:30:00Z'
    };

    const winner = reconcileProgress(local, remote);
    expect(winner.pageNumber).toBe(22);
  });
});
