import { describe, it, expect } from 'vitest';
import { getStorageConfig } from '../../../src/backend/config/storage-config';
import path from 'node:path';

describe('getStorageConfig', () => {
  it('returns default storage configuration when env vars are missing', () => {
    const config = getStorageConfig({});
    expect(config.storageRoot).toBe(path.resolve('./data/storage'));
    expect(config.maxImageWidth).toBe(1440);
    expect(config.webpQuality).toBe(82);
  });

  it('respects custom environment overrides', () => {
    const config = getStorageConfig({
      STORAGE_ROOT: 'D:/MangaDrive',
      MAX_IMAGE_WIDTH: '1600',
      WEBP_QUALITY: '90'
    });
    expect(config.storageRoot).toBe(path.resolve('D:/MangaDrive'));
    expect(config.maxImageWidth).toBe(1600);
    expect(config.webpQuality).toBe(90);
  });
});
