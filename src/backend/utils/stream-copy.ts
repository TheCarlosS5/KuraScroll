import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';

export const CHUNK_SIZE_64KB = 64 * 1024; // 64 KiB buffer for SATA II HDD & Pentium T4500

/**
 * Copies a file using chunked streaming with 64KB highWaterMark
 * to avoid memory pressure and disk seek thrashing on mechanical SATA II HDDs.
 */
export async function copyFileWithBackpressure(
  src: string,
  dest: string,
  signal?: AbortSignal
): Promise<void> {
  const readStream = createReadStream(src, { highWaterMark: CHUNK_SIZE_64KB });
  const writeStream = createWriteStream(dest, { highWaterMark: CHUNK_SIZE_64KB, flags: 'w' });
  await pipeline(readStream, writeStream, { signal });
}

/**
 * Computes the cryptographic checksum (SHA256 by default) of a file
 * using chunked streaming with 64KB highWaterMark, avoiding loading
 * whole databases or archives into V8 heap.
 */
export async function calculateFileHashStream(
  filePath: string,
  algorithm = 'sha256'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = createReadStream(filePath, { highWaterMark: CHUNK_SIZE_64KB });
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}
