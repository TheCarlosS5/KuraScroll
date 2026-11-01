import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface OptimizeOptions {
  pageNumber?: number;
  maxImageWidth?: number;
  webpQuality?: number;
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
  const maxImageWidth = options.maxImageWidth ?? 1440;
  const webpQuality = options.webpQuality ?? 82;
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
    effort: 4,
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
