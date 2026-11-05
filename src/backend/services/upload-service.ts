import path from 'node:path';
import fs from 'node:fs';

export interface MagicByteValidationResult {
  valid: boolean;
  mimeType?: string;
  extension?: string;
  error?: string;
}

export function validateImageMagicBytes(buffer: Buffer): MagicByteValidationResult {
  if (buffer.length < 12) {
    return { valid: false, error: 'El archivo es demasiado pequeño para ser una imagen válida.' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, mimeType: 'image/jpeg', extension: '.jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return { valid: true, mimeType: 'image/png', extension: '.png' };
  }

  // WebP: RIFF ... WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, mimeType: 'image/webp', extension: '.webp' };
  }

  // GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
    buffer[3] === 0x38 && (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61
  ) {
    return { valid: true, mimeType: 'image/gif', extension: '.gif' };
  }

  return { valid: false, error: 'Formato de imagen no soportado. Se admiten JPEG, PNG, WebP y GIF.' };
}

export function sanitizePathSegment(segment: string): string {
  return segment
    .replace(/\.\./g, '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();
}

export function assertPathContained(targetPath: string, parentDir: string): void {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedParent = path.resolve(parentDir);
  const relative = path.relative(resolvedParent, resolvedTarget);

  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Violación de seguridad: Intento de escape de directorio detectado.');
  }
}

export function generateSeriesSlug(title: string): string {
  const normalized = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'manga-' + Date.now();
}
