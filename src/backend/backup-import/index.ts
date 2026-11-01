import { detectBackupFormat, DetectionResult, BackupFormat } from './detection/detect-format.js';
import { parseTachiyomiBackup, TachiyomiParsedBackup, TachiyomiManga, TachiyomiChapter } from './adapters/tachiyomi-adapter.js';
import { normalizeBackup, NormalizedBackup, NormalizedSeries, NormalizedChapter } from './normalization/normalize-backup.js';
import { validateBackup, ValidationReport, ValidateBackupOptions } from './validation/validate-backup.js';
import {
  importToSqlite,
  exportFromSqlite,
  ImportToSqliteOptions,
  ImportReport,
  ImportErrorDetail,
} from './import/import-to-sqlite.js';

export {
  detectBackupFormat,
  DetectionResult,
  BackupFormat,
  parseTachiyomiBackup,
  TachiyomiParsedBackup,
  TachiyomiManga,
  TachiyomiChapter,
  normalizeBackup,
  NormalizedBackup,
  NormalizedSeries,
  NormalizedChapter,
  validateBackup,
  ValidationReport,
  ValidateBackupOptions,
  importToSqlite,
  exportFromSqlite,
  ImportToSqliteOptions,
  ImportReport,
  ImportErrorDetail,
};

export function importBackup(input: Buffer | string): NormalizedBackup {
  const detection = detectBackupFormat(input);
  if (detection.format === 'unknown') {
    throw new Error('Unknown or unsupported backup format');
  }

  const parsed = parseTachiyomiBackup(detection.parsedJson, detection.format);
  return normalizeBackup(parsed);
}
