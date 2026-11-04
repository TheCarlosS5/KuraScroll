import zlib from 'node:zlib';
import { isGzipBuffer } from '../detection/detect-format.js';

export interface ValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalSeries: number;
  totalChapters: number;
  validSeriesCount: number;
  deduplicatedCount?: number;
}

export interface ValidateBackupOptions {
  /** Maximum allowed size in bytes (default 100MB) */
  maxPayloadBytes?: number;
  /** Maximum allowed series count (default 50,000) */
  maxSeriesCount?: number;
  /** Maximum allowed chapters count (default 500,000) */
  maxChaptersCount?: number;
}

const DEFAULT_MAX_PAYLOAD_BYTES = 100 * 1024 * 1024; // 100MB
const DEFAULT_MAX_SERIES_COUNT = 50_000;
const DEFAULT_MAX_CHAPTERS_COUNT = 500_000;

// Regex to catch standard SQL injection vectors (e.g. '; DROP TABLE..., 1' OR '1'='1, UNION SELECT, comment terminations)
const SQL_INJECTION_PATTERN =
  /(?:;\s*(?:DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|EXEC|TRUNCATE)\s+(?:TABLE|DATABASE|FROM)|'\s*OR\s+['"]?1['"]?\s*=\s*['"]?1|'\s*OR\s+['"]?[a-z0-9]+['"]?\s*=\s*['"]?[a-z0-9]+|\bUNION\s+(?:ALL\s+)?SELECT\b|'\s*;\s*--|;\s*--)/i;

/**
 * Validates a backup payload against physical bounds, structural integrity,
 * data types, SQL injection / null-byte exploits, and internal duplicate entries.
 *
 * Guaranteed to NEVER throw an unhandled exception: returns a detailed ValidationReport.
 */
export function validateBackup(
  input: Buffer | string | any,
  options?: ValidateBackupOptions
): ValidationReport {
  const maxPayloadBytes = options?.maxPayloadBytes ?? DEFAULT_MAX_PAYLOAD_BYTES;
  const maxSeriesCount = options?.maxSeriesCount ?? DEFAULT_MAX_SERIES_COUNT;
  const maxChaptersCount = options?.maxChaptersCount ?? DEFAULT_MAX_CHAPTERS_COUNT;

  const errors: string[] = [];
  const warnings: string[] = [];
  let totalSeries = 0;
  let totalChapters = 0;
  let validSeriesCount = 0;
  let deduplicatedCount = 0;

  try {
    // -----------------------------------------------------------------------
    // 1. Physical Limit & Input Type Validation
    // -----------------------------------------------------------------------
    if (input === null || input === undefined) {
      return {
        valid: false,
        errors: ['Invalid backup payload: input is null or undefined'],
        warnings,
        totalSeries: 0,
        totalChapters: 0,
        validSeriesCount: 0,
      };
    }

    let json: any = null;

    if (Buffer.isBuffer(input)) {
      if (input.byteLength > maxPayloadBytes) {
        return {
          valid: false,
          errors: [
            `Payload size (${input.byteLength} bytes) exceeds maximum allowed limit of ${maxPayloadBytes / (1024 * 1024)}MB`,
          ],
          warnings,
          totalSeries: 0,
          totalChapters: 0,
          validSeriesCount: 0,
        };
      }

      if (input.byteLength === 0) {
        return {
          valid: false,
          errors: ['Empty backup payload (0 bytes)'],
          warnings,
          totalSeries: 0,
          totalChapters: 0,
          validSeriesCount: 0,
        };
      }

      let decompressed: Buffer = input;
      if (isGzipBuffer(input)) {
        try {
          // Enforce the output cap during inflate so a gzip bomb cannot allocate
          // an unbounded buffer before the post-decompression size check.
          decompressed = zlib.gunzipSync(input, { maxOutputLength: maxPayloadBytes });
        } catch (err: any) {
          return {
            valid: false,
            errors: [`Corrupted or truncated GZIP backup stream: ${err.message}`],
            warnings,
            totalSeries: 0,
            totalChapters: 0,
            validSeriesCount: 0,
          };
        }

        if (decompressed.byteLength > maxPayloadBytes) {
          return {
            valid: false,
            errors: [
              `Decompressed payload size (${decompressed.byteLength} bytes) exceeds maximum limit of ${maxPayloadBytes / (1024 * 1024)}MB`,
            ],
            warnings,
            totalSeries: 0,
            totalChapters: 0,
            validSeriesCount: 0,
          };
        }
      }

      const text = decompressed.toString('utf-8');
      try {
        json = JSON.parse(text);
      } catch (err: any) {
        return {
          valid: false,
          errors: [`Corrupted or truncated JSON backup payload: ${err.message}`],
          warnings,
          totalSeries: 0,
          totalChapters: 0,
          validSeriesCount: 0,
        };
      }
    } else if (typeof input === 'string') {
      const byteLen = Buffer.byteLength(input, 'utf-8');
      if (byteLen > maxPayloadBytes) {
        return {
          valid: false,
          errors: [
            `Payload size (${byteLen} bytes) exceeds maximum allowed limit of ${maxPayloadBytes / (1024 * 1024)}MB`,
          ],
          warnings,
          totalSeries: 0,
          totalChapters: 0,
          validSeriesCount: 0,
        };
      }

      const trimmed = input.trim();
      if (trimmed.length === 0) {
        return {
          valid: false,
          errors: ['Empty backup payload (blank string)'],
          warnings,
          totalSeries: 0,
          totalChapters: 0,
          validSeriesCount: 0,
        };
      }

      try {
        json = JSON.parse(trimmed);
      } catch (err: any) {
        return {
          valid: false,
          errors: [`Corrupted or truncated JSON backup payload: ${err.message}`],
          warnings,
          totalSeries: 0,
          totalChapters: 0,
          validSeriesCount: 0,
        };
      }
    } else if (typeof input === 'object') {
      json = input;
    } else {
      return {
        valid: false,
        errors: [`Invalid backup input type: expected Buffer, string, or object, received ${typeof input}`],
        warnings,
        totalSeries: 0,
        totalChapters: 0,
        validSeriesCount: 0,
      };
    }

    // -----------------------------------------------------------------------
    // 2. Root Structure Validation
    // -----------------------------------------------------------------------
    if (!json || (typeof json !== 'object' && !Array.isArray(json))) {
      return {
        valid: false,
        errors: [`Backup root must be an object or array, received ${typeof json}`],
        warnings,
        totalSeries: 0,
        totalChapters: 0,
        validSeriesCount: 0,
      };
    }

    let seriesArray: any[] = [];
    if (Array.isArray(json)) {
      seriesArray = json;
    } else if (json.mangas !== undefined) {
      if (!Array.isArray(json.mangas)) {
        errors.push(`Invalid backup schema: "mangas" field must be an array, received ${typeof json.mangas}`);
      } else {
        seriesArray = json.mangas;
      }
    } else if (json.backupManga !== undefined) {
      if (!Array.isArray(json.backupManga)) {
        errors.push(`Invalid backup schema: "backupManga" field must be an array, received ${typeof json.backupManga}`);
      } else {
        seriesArray = json.backupManga;
      }
    } else if (json.data !== undefined) {
      if (!Array.isArray(json.data)) {
        errors.push(`Invalid backup schema: "data" field must be an array, received ${typeof json.data}`);
      } else {
        seriesArray = json.data;
      }
    } else {
      errors.push('Unrecognized backup format: root object is missing "mangas", "backupManga", or "data" array');
    }

    totalSeries = seriesArray.length;

    // Safety limit on total series count
    if (totalSeries > maxSeriesCount) {
      return {
        valid: false,
        errors: [`Total series count (${totalSeries}) exceeds safety limit of ${maxSeriesCount} entries`],
        warnings,
        totalSeries,
        totalChapters: 0,
        validSeriesCount: 0,
      };
    }

    // -----------------------------------------------------------------------
    // 3. Entry Validation & Deduplication
    // -----------------------------------------------------------------------
    const seenSeries = new Map<string, number>();

    for (let i = 0; i < seriesArray.length; i++) {
      const item = seriesArray[i];
      let seriesHasErrors = false;

      // 3.1 Object shape
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(
          `Series at index [${i}] is not a valid object (received ${
            item === null ? 'null' : Array.isArray(item) ? 'array' : typeof item
          })`
        );
        continue;
      }

      // 3.2 Series Title Integrity
      if (item.title === undefined || item.title === null) {
        errors.push(`Series at index [${i}] is missing a required "title" property`);
        seriesHasErrors = true;
      } else if (typeof item.title !== 'string') {
        errors.push(`Series at index [${i}] title must be a string, received ${typeof item.title}`);
        seriesHasErrors = true;
      } else if (item.title.trim() === '') {
        errors.push(`Series at index [${i}] has an empty or whitespace-only title`);
        seriesHasErrors = true;
      }

      // 3.3 Text Fields Exploitation & UTF-8 / Null Byte Guards
      const textFields: Array<{ name: string; value: any }> = [
        { name: 'title', value: item.title },
        { name: 'author', value: item.author },
        { name: 'artist', value: item.artist },
        { name: 'description', value: item.description },
      ];

      for (const field of textFields) {
        if (typeof field.value === 'string') {
          // Null byte injection check
          if (field.value.includes('\0')) {
            errors.push(
              `Series at index [${i}] contains illegal null byte (\\0) in field "${field.name}"`
            );
            seriesHasErrors = true;
          }

          // Non-printable control characters (ASCII 0x01-0x08, 0x0B, 0x0C, 0x0E-0x1F)
          if (/[\x01-\x08\x0B\x0C\x0E-\x1F]/.test(field.value)) {
            errors.push(
              `Series at index [${i}] contains illegal ASCII control characters in field "${field.name}"`
            );
            seriesHasErrors = true;
          }

          // SQL Injection guard
          if (SQL_INJECTION_PATTERN.test(field.value)) {
            errors.push(
              `Potential SQL injection attack pattern detected in field "${field.name}" for series "${item.title || i}": ${field.value}`
            );
            seriesHasErrors = true;
          }
        }
      }

      // 3.4 Chapter Array & Numbers Validation
      const rawChapters = item.chapters ?? item.backupChapters;
      if (rawChapters !== undefined && rawChapters !== null) {
        if (!Array.isArray(rawChapters)) {
          errors.push(
            `Series at index [${i}] ("${item.title || 'untitled'}") chapters must be an array, received ${typeof rawChapters}`
          );
          seriesHasErrors = true;
        } else {
          if (rawChapters.length > maxChaptersCount) {
            errors.push(`Series at index [${i}] chapter count exceeds safety limit of ${maxChaptersCount} entries`);
            seriesHasErrors = true;
            totalChapters += rawChapters.length;
            continue;
          }
          for (let chIdx = 0; chIdx < rawChapters.length; chIdx++) {
            const ch = rawChapters[chIdx];
            if (!ch || typeof ch !== 'object' || Array.isArray(ch)) {
              errors.push(
                `Chapter at index [${chIdx}] in series "${item.title || 'untitled'}" is not a valid object`
              );
              seriesHasErrors = true;
              continue;
            }

            const rawNum = ch.chapterNumber ?? ch.chapter_number ?? ch.num;
            if (rawNum !== undefined && rawNum !== null) {
              const num = typeof rawNum === 'number' ? rawNum : Number(rawNum);
              if (!Number.isFinite(num) || Math.abs(num) > Number.MAX_SAFE_INTEGER) {
                errors.push(
                  `Chapter at index [${chIdx}] in series "${item.title || 'untitled'}" has invalid/NaN chapter number (${JSON.stringify(rawNum)})`
                );
                seriesHasErrors = true;
              } else if (num < 0) {
                errors.push(
                  `Chapter at index [${chIdx}] in series "${item.title || 'untitled'}" has negative chapter number (${num})`
                );
                seriesHasErrors = true;
              } else {
                totalChapters++;
              }
            } else {
              totalChapters++;
            }
          }
        }
      }

      // 3.5 Duplicate Detection
      if (!seriesHasErrors && typeof item.title === 'string' && item.title.trim().length > 0) {
        const normTitle = item.title.trim().toLowerCase();
        const normUrl = typeof item.url === 'string' && item.url.trim() ? item.url.trim().toLowerCase() : '';
        const normSource = item.source !== undefined ? String(item.source).trim() : '';

        const dedupeKey = normUrl ? `${normSource}:${normUrl}` : `title:${normTitle}`;

        if (seenSeries.has(dedupeKey)) {
          const firstSeenIndex = seenSeries.get(dedupeKey)!;
          warnings.push(
            `Duplicate series detected: "${item.title}" at index [${i}] duplicates entry at index [${firstSeenIndex}]. Deduplication applied.`
          );
          deduplicatedCount++;
        } else {
          seenSeries.set(dedupeKey, i);
          validSeriesCount++;
        }
      }
    }

    // Safety limit on total chapters
    if (totalChapters > maxChaptersCount) {
      errors.push(`Total chapter count (${totalChapters}) exceeds safety limit of ${maxChaptersCount} entries`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      totalSeries,
      totalChapters,
      validSeriesCount,
      deduplicatedCount,
    };
  } catch (unexpectedError: any) {
    // Blanket resilience catch: never allow unhandled exceptions to bubble up
    return {
      valid: false,
      errors: [`Unhandled exception during backup validation: ${unexpectedError?.message || String(unexpectedError)}`],
      warnings,
      totalSeries,
      totalChapters,
      validSeriesCount: 0,
      deduplicatedCount,
    };
  }
}
