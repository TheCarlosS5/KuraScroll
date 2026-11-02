/**
 * KuraScroll WebRTC P2P Binary Chunk Protocol & Manifest Specification
 * Designed for 64KB chunked transmission with zero dynamic allocation
 * Optimized for Intel Pentium T4500 (Penryn 2C/2T) & low-resource mobile clients
 */

import crypto from 'node:crypto';

export const P2P_CHUNK_SIZE = 64 * 1024; // 64 KB optimal chunk size
export const P2P_MAGIC_HEADER = 0x4b53; // "KS" (KuraStream / KuraScroll)

export interface P2PPageMeta {
  pageNumber: number;
  fileName: string;
  byteLength: number;
  sha256: string;
}

export interface P2PChapterManifest {
  seriesSlug: string;
  seriesTitle: string;
  chapterNumber: string;
  chapterTitle?: string;
  scanlationGroup?: string;
  totalPages: number;
  totalBytes: number;
  pages: P2PPageMeta[];
}

export interface P2PProgressRecord {
  seriesId: string;
  chapterNumber: string;
  pageNumber: number;
  updatedAt: string; // ISO 8601
}

export interface ChunkPacket {
  pageNumber: number;
  chunkIndex: number;
  totalChunks: number;
  data: Uint8Array;
}

/**
 * Encodes binary chunk packet with compact 8-byte binary header:
 * - Bytes 0..1: Magic (0x4B53)
 * - Bytes 2..3: Page Number (uint16)
 * - Bytes 4..5: Chunk Index (uint16)
 * - Bytes 6..7: Total Chunks (uint16)
 * - Bytes 8..N: Payload
 */
export function encodeChunkPacket(
  pageNumber: number,
  chunkIndex: number,
  totalChunks: number,
  payload: Uint8Array
): Uint8Array {
  const packet = new Uint8Array(8 + payload.byteLength);
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);

  view.setUint16(0, P2P_MAGIC_HEADER, false);
  view.setUint16(2, pageNumber, false);
  view.setUint16(4, chunkIndex, false);
  view.setUint16(6, totalChunks, false);

  packet.set(payload, 8);
  return packet;
}

/**
 * Decodes 8-byte header and extracts payload from chunk packet.
 */
export function decodeChunkPacket(packet: Uint8Array): ChunkPacket {
  if (packet.byteLength < 8) {
    throw new Error('Invalid chunk packet: payload too short (< 8 bytes)');
  }
  const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  const magic = view.getUint16(0, false);
  if (magic !== P2P_MAGIC_HEADER) {
    throw new Error(`Invalid chunk packet: bad magic 0x${magic.toString(16)}`);
  }

  const pageNumber = view.getUint16(2, false);
  const chunkIndex = view.getUint16(4, false);
  const totalChunks = view.getUint16(6, false);
  const data = packet.subarray(8);

  return { pageNumber, chunkIndex, totalChunks, data };
}

/**
 * Splits raw page buffer into ordered 64KB chunk packets.
 */
export function chunkPageBuffer(pageNumber: number, buffer: Uint8Array): Uint8Array[] {
  const totalChunks = Math.ceil(buffer.byteLength / P2P_CHUNK_SIZE) || 1;
  const packets: Uint8Array[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * P2P_CHUNK_SIZE;
    const end = Math.min(start + P2P_CHUNK_SIZE, buffer.byteLength);
    const chunkData = buffer.subarray(start, end);
    packets.push(encodeChunkPacket(pageNumber, i, totalChunks, chunkData));
  }

  return packets;
}

/**
 * Reassembles ordered chunks into a single contiguous page buffer and verifies SHA256 checksum.
 */
export function reassemblePage(chunks: ChunkPacket[], expectedSha256?: string): Uint8Array {
  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

  let totalLength = 0;
  for (const c of chunks) {
    totalLength += c.data.byteLength;
  }

  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    combined.set(c.data, offset);
    offset += c.data.byteLength;
  }

  if (expectedSha256) {
    const actualSha256 = crypto.createHash('sha256').update(combined).digest('hex');
    if (actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
      throw new Error(`SHA256 mismatch for page ${chunks[0]?.pageNumber}: expected ${expectedSha256}, got ${actualSha256}`);
    }
  }

  return combined;
}

/**
 * Deterministic Last-Write-Wins Progress Reconciliation
 * Combines page monotonicity (max page) with timestamp tie-breaking.
 */
export function reconcileProgress(
  local: P2PProgressRecord,
  remote: P2PProgressRecord
): P2PProgressRecord {
  // If chapter differs, take higher chapter (parsed as float/number)
  const localCh = parseFloat(local.chapterNumber) || 0;
  const remoteCh = parseFloat(remote.chapterNumber) || 0;

  if (localCh > remoteCh) return local;
  if (remoteCh > localCh) return remote;

  // Same chapter: take higher page number
  if (local.pageNumber > remote.pageNumber) return local;
  if (remote.pageNumber > local.pageNumber) return remote;

  // Same page: take more recent ISO 8601 timestamp
  const localTime = new Date(local.updatedAt).getTime();
  const remoteTime = new Date(remote.updatedAt).getTime();
  return remoteTime >= localTime ? remote : local;
}
