import path from 'node:path';

export interface StorageConfig {
  storageRoot: string;
  maxImageWidth: number;
  webpQuality: number;
}

export function getStorageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const storageRoot = env.STORAGE_ROOT
    ? path.resolve(env.STORAGE_ROOT)
    : path.resolve('./data/storage');

  const maxImageWidth = env.MAX_IMAGE_WIDTH ? Number.parseInt(env.MAX_IMAGE_WIDTH, 10) : 1440;
  const webpQuality = env.WEBP_QUALITY ? Number.parseInt(env.WEBP_QUALITY, 10) : 82;

  return {
    storageRoot,
    maxImageWidth: Number.isNaN(maxImageWidth) ? 1440 : maxImageWidth,
    webpQuality: Number.isNaN(webpQuality) ? 82 : webpQuality,
  };
}
