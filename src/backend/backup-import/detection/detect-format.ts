import zlib from 'node:zlib';

export type BackupFormat = 'tachiyomi_legacy_json' | 'mihon_json' | 'unknown';

export interface DetectionResult {
  format: BackupFormat;
  isGzip: boolean;
  version?: number;
  decompressedBuffer?: Buffer;
  parsedJson?: any;
}

export function isGzipBuffer(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

export function detectBackupFormat(input: Buffer | string): DetectionResult {
  const buffer = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;

  if (!buffer || buffer.length === 0) {
    return { format: 'unknown', isGzip: false };
  }

  let isGzip = false;
  let decompressedBuffer = buffer;

  if (isGzipBuffer(buffer)) {
    isGzip = true;
    try {
      decompressedBuffer = zlib.gunzipSync(buffer);
    } catch {
      // Corrupt or invalid gzip stream
      return { format: 'unknown', isGzip: true };
    }
  }

  // Attempt to parse UTF-8 text as JSON
  let text = '';
  try {
    text = decompressedBuffer.toString('utf-8').trim();
  } catch {
    return { format: 'unknown', isGzip };
  }

  if (!text.startsWith('{') && !text.startsWith('[')) {
    return { format: 'unknown', isGzip };
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return { format: 'unknown', isGzip };
  }

  if (!json || (typeof json !== 'object' && !Array.isArray(json))) {
    return { format: 'unknown', isGzip };
  }

  // Case 1: Mihon / Modern Tachiyomi JSON
  if (
    typeof json === 'object' &&
    !Array.isArray(json) &&
    json.version !== undefined &&
    (Array.isArray(json.mangas) || Array.isArray(json.backupManga) || Array.isArray(json.categories) || json.sources)
  ) {
    const versionNum = Number(json.version);
    return {
      format: 'mihon_json',
      isGzip,
      version: Number.isNaN(versionNum) ? 1 : versionNum,
      decompressedBuffer: isGzip ? decompressedBuffer : undefined,
      parsedJson: json,
    };
  }

  // Case 2: Tachiyomi Legacy JSON with data object or mangas object without version
  if (
    typeof json === 'object' &&
    !Array.isArray(json) &&
    (Array.isArray(json.data) || Array.isArray(json.mangas) || Array.isArray(json.backupManga))
  ) {
    return {
      format: 'tachiyomi_legacy_json',
      isGzip,
      decompressedBuffer: isGzip ? decompressedBuffer : undefined,
      parsedJson: json,
    };
  }

  // Case 3: Tachiyomi Legacy array of manga objects
  if (Array.isArray(json)) {
    // Verify at least one entry has manga-like properties (title, chapters, source, url)
    const isMangaArray = json.length === 0 || json.some((item) => item && typeof item === 'object' && ('title' in item || 'chapters' in item || 'source' in item));
    if (isMangaArray) {
      return {
        format: 'tachiyomi_legacy_json',
        isGzip,
        decompressedBuffer: isGzip ? decompressedBuffer : undefined,
        parsedJson: json,
      };
    }
  }

  return { format: 'unknown', isGzip };
}
