import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';

// Bound Sharp concurrency and memory cache for the 2GB VPS target:
// - sharp.concurrency(1): Restrict libvips to 1 worker thread per image to prevent thread contention & RSS spikes
// - sharp.cache: Cap cache memory to 16MB and set files: 0 to avoid holding open file descriptors (prevents Windows EBUSY on cleanup)
sharp.concurrency(1);
sharp.cache({
  memory: 16,
  files: 0,
  items: 32,
});

export interface OptimizeOptions {
  pageNumber?: number;
  maxImageWidth?: number;
  webpQuality?: number;
  effort?: number;
  thermalSaver?: boolean;
}

export interface PageMetadata {
  pageNumber: number;
  fileName: string;
  width: number;
  height: number;
  aspectRatio: number;
  fileSizeBytes: number;
}

export async function optimizeImageToWebP(
  input: string | Buffer,
  outputPath: string,
  options: OptimizeOptions = {}
): Promise<PageMetadata> {
  const isThermal = options.thermalSaver === true;
  const maxImageWidth = options.maxImageWidth ?? (isThermal ? 1280 : 1440);
  const webpQuality = options.webpQuality ?? (isThermal ? 75 : 82);
  const effort = options.effort ?? (isThermal ? 2 : 4);
  const pageNumber = options.pageNumber ?? 1;

  let pipeline = sharp(input).rotate(); // auto-orient based on EXIF

  const metadata = await pipeline.metadata();
  const originalWidth = metadata.width ?? maxImageWidth;
  const originalHeight = metadata.height ?? maxImageWidth;

  if (originalWidth > maxImageWidth) {
    pipeline = pipeline.resize({
      width: maxImageWidth,
      withoutEnlargement: true,
      fit: 'inside',
    });
  }

  pipeline = pipeline.webp({
    quality: webpQuality,
    effort,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const outputInfo = await pipeline.toFile(outputPath);

  const finalWidth = outputInfo.width;
  const finalHeight = outputInfo.height;
  const aspectRatio = finalHeight > 0 ? Number((finalWidth / finalHeight).toFixed(4)) : 1;

  return {
    pageNumber,
    fileName: path.basename(outputPath),
    width: finalWidth,
    height: finalHeight,
    aspectRatio,
    fileSizeBytes: outputInfo.size,
  };
}
