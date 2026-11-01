import path from 'node:path';
import fs from 'node:fs';
import { createDatabase, runMigrations } from '../db/database.js';
import { SeriesRepository } from '../repositories/series-repository.js';
import { ChapterRepository } from '../repositories/chapter-repository.js';
import { ingestChapter } from '../services/chapter-ingestion-service.js';

export interface CliArgs {
  series: string;
  chapter: number;
  file: string;
  volume: number;
  title?: string;
  storageRoot?: string;
}

export function parseCliArgs(args: string[]): CliArgs {
  const result: Partial<CliArgs> = {
    volume: 1,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--series' && args[i + 1]) {
      result.series = args[++i];
    } else if (arg === '--chap' && args[i + 1]) {
      result.chapter = Number.parseFloat(args[++i]);
    } else if (arg === '--file' && args[i + 1]) {
      result.file = args[++i];
    } else if (arg === '--vol' && args[i + 1]) {
      result.volume = Number.parseFloat(args[++i]);
    } else if (arg === '--title' && args[i + 1]) {
      result.title = args[++i];
    } else if (arg === '--storage' && args[i + 1]) {
      result.storageRoot = args[++i];
    }
  }

  if (!result.series || result.chapter === undefined || Number.isNaN(result.chapter) || !result.file) {
    throw new Error('Faltan parámetros requeridos: --series <slug> --chap <num> --file <ruta>');
  }

  return result as CliArgs;
}

async function runCli() {
  const args = process.argv.slice(2);
  let parsed: CliArgs;
  try {
    parsed = parseCliArgs(args);
  } catch (err: any) {
    console.error(`\x1b[31m[ERROR]\x1b[0m ${err.message}`);
    console.log(`\nUso:\n  npx tsx src/backend/cli/ingest-cli.ts --series <slug> --chap <num> --file <ruta> [--vol 1] [--title "Título"]\n`);
    process.exit(1);
  }

  const storageRoot = parsed.storageRoot || process.env.STORAGE_ROOT || path.resolve('./data/storage');
  const dbPath = path.resolve('./data/kura-scroll.db');

  console.log(`\x1b[36m[KuraScroll Ingest CLI]\x1b[0m Iniciando ingesta para la serie '${parsed.series}'...`);
  console.log(`📂 Archivo fuente: ${parsed.file}`);
  console.log(`💾 Almacenamiento 4TB: ${storageRoot}`);

  if (!fs.existsSync(parsed.file)) {
    console.error(`\x1b[31m[ERROR]\x1b[0m El archivo o carpeta fuente no existe: ${parsed.file}`);
    process.exit(1);
  }

  const db = createDatabase(dbPath);
  runMigrations(db);

  const seriesRepo = new SeriesRepository(db);
  const chapterRepo = new ChapterRepository(db);

  let series = seriesRepo.getSeriesBySlug(parsed.series);
  if (!series) {
    console.log(`ℹ️ La serie '${parsed.series}' no existe aún en la base de datos. Creando entrada básica...`);
    seriesRepo.createSeries({
      id: parsed.series,
      slug: parsed.series,
      titlePrimary: parsed.series.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      type: 'manhwa',
      status: 'ongoing',
    });
    seriesRepo.addSeriesTitles(parsed.series, [
      { languageCode: 'en', title: parsed.series, isPrimary: true },
    ]);
  }

  const startTime = Date.now();
  const result = await ingestChapter({
    storageRoot,
    seriesSlug: parsed.series,
    volumeNumber: parsed.volume,
    chapterNumber: parsed.chapter,
    sourcePath: parsed.file,
  });

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalMB = (result.totalBytes / (1024 * 1024)).toFixed(2);
  const chapterId = `${parsed.series}-c${parsed.chapter}`;

  chapterRepo.createChapter({
    id: chapterId,
    seriesId: parsed.series,
    volumeId: null,
    chapterNumber: parsed.chapter,
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
