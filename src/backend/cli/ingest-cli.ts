import path from 'node:path';
import fs from 'node:fs';
import { createDatabase, runMigrations } from '../db/database.js';
import { SeriesRepository } from '../repositories/series-repository.js';
import { ChapterRepository } from '../repositories/chapter-repository.js';
import { ingestChapter } from '../services/chapter-ingestion-service.js';
import { ingestVolumeArchive } from '../services/volume-extractor.js';
import { importToSqlite } from '../backup-import/import/import-to-sqlite.js';

export interface CliArgs {
  mode: 'chapter' | 'volume' | 'backup';
  series?: string;
  chapter?: number;
  file: string;
  volume: number;
  title?: string;
  storageRoot?: string;
  dbPath?: string;
}

export function parseCliArgs(args: string[]): CliArgs {
  const result: Partial<CliArgs> = {
    volume: 1,
    mode: 'chapter',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--series' && args[i + 1]) {
      result.series = args[++i];
    } else if (arg === '--chap' && args[i + 1]) {
      result.chapter = Number.parseFloat(args[++i]);
    } else if (arg === '--file' && args[i + 1]) {
      result.file = args[++i];
    } else if (arg === '--volume' && args[i + 1]) {
      result.mode = 'volume';
      result.file = args[++i];
    } else if (arg === '--backup' && args[i + 1]) {
      result.mode = 'backup';
      result.file = args[++i];
    } else if (arg === '--vol' && args[i + 1]) {
      result.volume = Number.parseFloat(args[++i]);
    } else if (arg === '--title' && args[i + 1]) {
      result.title = args[++i];
    } else if (arg === '--storage' && args[i + 1]) {
      result.storageRoot = args[++i];
    } else if (arg === '--db' && args[i + 1]) {
      result.dbPath = args[++i];
    }
  }

  // Backup mode validation
  if (result.mode === 'backup') {
    if (!result.file) {
      throw new Error('Faltan parámetros requeridos para backup: --backup <ruta-al-archivo>');
    }
    return result as CliArgs;
  }

  // Volume mode validation
  if (result.mode === 'volume') {
    if (!result.file) {
      throw new Error('Faltan parámetros requeridos para volumen: --volume <ruta-al-archivo>');
    }
    if (!result.series) {
      const base = path.basename(result.file, path.extname(result.file));
      result.series = base.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    return result as CliArgs;
  }

  // Chapter mode validation
  if (!result.series || result.chapter === undefined || Number.isNaN(result.chapter) || !result.file) {
    throw new Error('Faltan parámetros requeridos: --series <slug> --chap <num> --file <ruta>');
  }

  return result as CliArgs;
}

export async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  let parsed: CliArgs;
  try {
    parsed = parseCliArgs(args);
  } catch (err: any) {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${err.message}`);
    console.log(`\nUso:\n  Capítulo: npx tsx src/backend/cli/ingest-cli.ts --series <slug> --chap <num> --file <ruta> [--vol 1]\n  Volumen:  npx tsx src/backend/cli/ingest-cli.ts --volume <ruta-cbz> [--series <slug>] [--vol 1]\n  Backup:   npx tsx src/backend/cli/ingest-cli.ts --backup <ruta.json|.tachibk>\n`);
    process.exit(1);
  }

  const storageRoot = parsed.storageRoot || process.env.STORAGE_ROOT || path.resolve('./data/storage');
  const dbPath = parsed.dbPath || path.resolve('./data/kura-scroll.db');

  if (!fs.existsSync(parsed.file)) {
    console.error(`\x1b[31m[ERROR]\x1b[0m El archivo o carpeta fuente no existe: ${parsed.file}`);
    process.exit(1);
  }

  const db = createDatabase(dbPath);
  runMigrations(db);

  if (parsed.mode === 'backup') {
    console.log(`\x1b[36m[KuraScroll Ingest CLI]\x1b[0m Importando backup desde '${parsed.file}'...`);
    const buffer = await fs.promises.readFile(parsed.file);
    const report = await importToSqlite({ db, backup: buffer, strict: false });
    console.log(`\x1b[32m✔ Migración completada!\x1b[0m Series importadas: ${report.seriesImported}, Capítulos: ${report.chaptersCreated} (${report.durationMs}ms)`);
    return;
  }

  if (parsed.mode === 'volume') {
    console.log(`\x1b[36m[KuraScroll Ingest CLI]\x1b[0m Ingestando volumen '${parsed.file}' para la serie '${parsed.series}'...`);
    const volResult = await ingestVolumeArchive({
      storageRoot,
      seriesSlug: parsed.series!,
      volumeNumber: parsed.volume,
      sourceArchive: parsed.file,
      db,
    });
    console.log(`\x1b[32m✔ Volumen procesado con éxito!\x1b[0m Capítulos detectados: ${volResult.totalChapters}, Páginas WebP: ${volResult.totalValidPages}`);
    return;
  }

  console.log(`\x1b[36m[KuraScroll Ingest CLI]\x1b[0m Iniciando ingesta para la serie '${parsed.series}'...`);
  console.log(`📂 Archivo fuente: ${parsed.file}`);
  console.log(`💾 Almacenamiento 4TB: ${storageRoot}`);

  const seriesRepo = new SeriesRepository(db);
  const chapterRepo = new ChapterRepository(db);

  let series = seriesRepo.getSeriesBySlug(parsed.series!);
  if (!series) {
    console.log(`ℹ️ La serie '${parsed.series}' no existe aún en la base de datos. Creando entrada básica...`);
    seriesRepo.createSeries({
      id: parsed.series!,
      slug: parsed.series!,
      titlePrimary: parsed.series!.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      type: 'manhwa',
      status: 'ongoing',
    });
    seriesRepo.addSeriesTitles(parsed.series!, [
      { languageCode: 'en', title: parsed.series!, isPrimary: true },
    ]);
  }

  const startTime = Date.now();
  const result = await ingestChapter({
    storageRoot,
    seriesSlug: parsed.series!,
    volumeNumber: parsed.volume,
    chapterNumber: parsed.chapter!,
    sourcePath: parsed.file,
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalMB = (result.totalBytes / (1024 * 1024)).toFixed(2);
  const chapterId = `${parsed.series}-c${parsed.chapter}`;

  chapterRepo.createChapter({
    id: chapterId,
    seriesId: parsed.series!,
    volumeId: null,
    chapterNumber: parsed.chapter!,
    title: parsed.title || `Capítulo ${parsed.chapter}`,
    pageCount: result.pageCount,
    storagePath: result.relativeStorageDir,
  });

  chapterRepo.addPages(chapterId, result.pages);

  console.log(`\x1b[32m✔ Ingesta completada con éxito en ${durationSec}s!\x1b[0m`);
  console.log(`  📄 Total de páginas WebP optimizadas: ${result.pageCount}`);
  console.log(`  📦 Peso total en disco: ${totalMB} MB`);
  console.log(`  📁 Ruta relativa: ${result.relativeStorageDir}`);
}

if (process.argv[1]?.endsWith('ingest-cli.ts')) {
  runCli().catch((e) => {
    console.error('Fatal CLI Error:', e);
    process.exit(1);
  });
}
