import { ByteLRU } from './byte-lru.js';
import { CacheLoader } from './cache-loader.js';
import type { ChapterDetail } from '../repositories/chapter-repository.js';

export type ChapterManifest = ChapterDetail;

export const manifestCache = new ByteLRU<ChapterDetail>({
  maxBytes: 32 * 1024 * 1024,      // 32 MB
  maxEntryBytes: 2 * 1024 * 1024,  // 2 MB per manifest
});

export const imageCache = new ByteLRU<Buffer>({
  maxBytes: 256 * 1024 * 1024,     // 256 MB
  maxEntryBytes: 8 * 1024 * 1024,  // 8 MB per page image
});

export const manifestLoader = new CacheLoader<ChapterDetail>(manifestCache);
export const imageLoader = new CacheLoader<Buffer>(imageCache);
