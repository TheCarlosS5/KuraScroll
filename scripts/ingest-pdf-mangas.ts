import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import pLimit from 'p-limit';
import { DatabaseSync } from 'node:sqlite';
import { SeriesRepository } from '../src/backend/repositories/series-repository.js';
import { ChapterRepository } from '../src/backend/repositories/chapter-repository.js';
import { createDatabase, runMigrations } from '../src/backend/db/database.js';

// Metadata configurations for the 5 manga/manhwa series in Documents/mangas
interface SeriesMetaConfig {
  slug: string;
  type: 'manga' | 'manhwa' | 'manhua';
  demographic: 'shounen' | 'seinen' | 'shoujo' | 'none';
  genres: string[];
}

const SERIES_PRESETS: Record<string, SeriesMetaConfig> = {
  'dark-lady': {
    slug: 'dark-lady',
    type: 'manhwa',
    demographic: 'shounen',
    genres: ['Acción', 'Fantasía', 'Artes Marciales', 'Reencarnación', 'Aventura'],
  },
  'el-demonio-celestial-del-cosmos-3077': {
    slug: 'el-demonio-celestial-del-cosmos-3077',
    type: 'manhwa',
    demographic: 'shounen',
    genres: ['Acción', 'Ciencia Ficción', 'Artes Marciales', 'Mecha', 'Espacio'],
  },
  'kyouran-reijou-nia-liston': {
    slug: 'kyouran-reijou-nia-liston',
    type: 'manga',
    demographic: 'seinen',
    genres: ['Acción', 'Fantasía', 'Isekai', 'Comedia'],
  },
  'uesugi-kun-wa-onnanoko-wo-yametai': {
    slug: 'uesugi-kun-wa-onnanoko-wo-yametai',
    type: 'manga',
    demographic: 'shounen',
    genres: ['Romance', 'Comedia', 'Escolar', 'Slice of Life', 'Gender Bender'],
  },
  'un-diario-de-conquista': {
    slug: 'un-diario-de-conquista',
    type: 'manhwa',
    demographic: 'shounen',
    genres: ['Fantasía', 'Romance', 'Harem', 'Aventura', 'Reencarnación'],
  },
};

// Extracts embedded JPEGs from PDF binary buffer
function extractJpegsFromPdfBuffer(buf: Buffer): Buffer[] {
  const jpegs: Buffer[] = [];
  let start = -1;
  for (let i = 0; i < buf.length - 1; i++) {
    if (start === -1) {
      if (buf[i] === 0xff && buf[i + 1] === 0xd8 && buf[i + 2] === 0xff) {
        start = i;
      }
    } else {
      if (buf[i] === 0xff && buf[i + 1] === 0xd9) {
        jpegs.push(buf.subarray(start, i + 2));
        start = -1;
      }
    }
  }
  return jpegs;
}

// Parses chapter number from filename like capitulo-1.pdf, capitulo-117-1.pdf, capitulo-0.pdf
function parseChapterNumber(filename: string): number | null {
  const match = filename.match(/capitulo-([0-9]+(?:-[0-9]+|\.[0-9]+)?)\.pdf$/i);
  if (!match) return null;
  const numStr = match[1].replace('-', '.');
  const num = parseFloat(numStr);
  return isNaN(num) ? null : num;
}

// Natural sort for chapter files
function sortChapterFiles(files: string[]): string[] {
  return [...files].sort((a, b) => {
    const numA = parseChapterNumber(a) ?? 0;
    const numB = parseChapterNumber(b) ?? 0;
    return numA - numB;
  });
}

async function ingestPdfSeries() {
  const args = process.argv.slice(2);
  let targetSeries: string | null = null;
  let maxChapters: number = Infinity;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--series' && args[i + 1]) {
      targetSeries = args[++i];
    } else if (args[i] === '--max-chapters' && args[i + 1]) {
      maxChapters = parseInt(args[++i], 10);
    }
  }

  const rootDir = path.resolve('.');
  const mangasRoot = 'C:\\Users\\Admin\\Documents\\mangas';
  const storageRoot = path.resolve(rootDir, 'data/storage');
  const dbPath = path.resolve(rootDir, 'data/kura-scroll.db');

  const db = createDatabase(dbPath);
  runMigrations(db);

  const seriesRepo = new SeriesRepository(db);
  const chapterRepo = new ChapterRepository(db);

  const availableFolders = await fs.readdir(mangasRoot);
  const foldersToProcess = targetSeries
    ? availableFolders.filter((f) => f.toLowerCase() === targetSeries.toLowerCase())
    : availableFolders;

  if (foldersToProcess.length === 0) {
    console.error(`[ERROR] No se encontró la serie solicitada '${targetSeries}' en ${mangasRoot}`);
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(`[KuraScroll] INGESTA DE MANGAS / MANHWAS REALES EN KURASCROLL`);
  console.log(`[Source] Origen: ${mangasRoot}`);
  console.log(`[Target] Destino: ${storageRoot}`);
  console.log(`[Series] Series a procesar: ${foldersToProcess.join(', ')}`);
  if (maxChapters !== Infinity) {
    console.log(`[Limit] Límite por serie: primeros ${maxChapters} capítulos`);
  }
  console.log(`======================================================\n`);

  for (const folder of foldersToProcess) {
    const seriesDir = path.join(mangasRoot, folder);
    const stat = await fs.stat(seriesDir);
    if (!stat.isDirectory()) continue;

    const slug = folder;
    const preset = SERIES_PRESETS[slug] || {
      slug,
      type: 'manga' as const,
      demographic: 'shounen' as const,
      genres: ['Manga'],
    };

    // 1. Parse sinopsis.md
    let titlePrimary = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    let synopsis = '';
    const sinopsisPath = path.join(seriesDir, 'sinopsis.md');
    if (fsSync.existsSync(sinopsisPath)) {
      const content = await fs.readFile(sinopsisPath, 'utf-8');
      const titleMatch = content.match(/^#\s*(.+)$/m);
      if (titleMatch) {
        titlePrimary = titleMatch[1].trim();
      }
      const sinopsisMatch = content.match(/##\s*Sinopsis\s*\n+([\s\S]*?)(?=\n\s*Fuente:|\n#|$)/i);
      if (sinopsisMatch) {
        synopsis = sinopsisMatch[1].trim();
      }
    }

    // 2. Process cover image (portada/portada.png -> data/storage/covers/<slug>-cover.webp)
    const coversDir = path.join(storageRoot, 'covers');
    await fs.mkdir(coversDir, { recursive: true });
    const coverDestPath = path.join(coversDir, `${slug}-cover.webp`);
    const portadaPath = path.join(seriesDir, 'portada', 'portada.png');

    if (fsSync.existsSync(portadaPath) && !fsSync.existsSync(coverDestPath)) {
      console.log(`[Cover] Optimizando portada para '${titlePrimary}'...`);
      await sharp(portadaPath)
        .resize({ width: 640, withoutEnlargement: true })
        .webp({ quality: 85, effort: 3 })
        .toFile(coverDestPath);
    }

    const coverRelativeUrl = `/storage/covers/${slug}-cover.webp`;

    // 3. Register or update Series in DB
    const existingSeries = seriesRepo.getSeriesBySlug(slug);
    if (!existingSeries) {
      console.log(`[Create] Creando registro para serie '${titlePrimary}' (${preset.type.toUpperCase()})...`);
      seriesRepo.createSeries({
        id: slug,
        slug,
        titlePrimary,
        type: preset.type,
        status: 'ongoing',
        demographic: preset.demographic,
        synopsis,
        coverImage: coverRelativeUrl,
        genres: preset.genres,
      });

      seriesRepo.addSeriesTitles(slug, [
        { languageCode: 'es', title: titlePrimary, isPrimary: true },
        { languageCode: 'en', title: titlePrimary, isPrimary: false },
      ]);
    } else {
      console.log(`[Info] La serie '${titlePrimary}' ya está registrada en la base de datos.`);
    }

    // 4. Ingest Chapters
    const capitulosDir = path.join(seriesDir, 'capitulos');
    if (!fsSync.existsSync(capitulosDir)) {
      console.warn(`[Warn] No se encontró la carpeta 'capitulos' en ${seriesDir}`);
      continue;
    }

    const chapterFiles = await fs.readdir(capitulosDir);
    const pdfFiles = chapterFiles.filter((f) => f.toLowerCase().endsWith('.pdf'));
    const sortedPdfs = sortChapterFiles(pdfFiles);
    const filesToIngest = sortedPdfs.slice(0, maxChapters);

    console.log(`\n[Ingest] Ingestando capítulos para '${titlePrimary}' (${filesToIngest.length} archivos)...`);

    let processedCount = 0;
    const seriesStartTime = Date.now();

    for (let i = 0; i < filesToIngest.length; i++) {
      const pdfFileName = filesToIngest[i];
      const chapNum = parseChapterNumber(pdfFileName);
      if (chapNum === null) {
        console.warn(`  [Warn] No se pudo determinar el número de capítulo de: ${pdfFileName}`);
        continue;
      }

      const chapterId = `${slug}-c${chapNum}`;

      // Check if chapter already exists in database
      const existingChap = chapterRepo.getChapter(chapterId);
      if (existingChap) {
        // Already ingested
        continue;
      }

      const chapStartTime = Date.now();
      const pdfFullPath = path.join(capitulosDir, pdfFileName);
      const pdfBuffer = await fs.readFile(pdfFullPath);

      // Extract raw JPEGs from PDF
      const jpegs = extractJpegsFromPdfBuffer(pdfBuffer);
      if (jpegs.length === 0) {
        console.warn(`  [Warn] Capítulo ${chapNum} (${pdfFileName}) no contiene imágenes JPEG válidas.`);
        continue;
      }

      // Target directory for chapter WebP pages
      const relStorageDir = `series/${slug}/c${chapNum}`;
      const absStorageDir = path.join(storageRoot, relStorageDir);
      await fs.mkdir(absStorageDir, { recursive: true });

      // Analyze page dimensions and split webtoon strips > 16000px height (WebP limit: 16383px)
      const sliceJobs: Array<{
        buf: Buffer;
        extract?: { left: number; top: number; width: number; height: number };
        width: number;
        height: number;
      }> = [];

      for (let j = 0; j < jpegs.length; j++) {
        const jpegBuf = jpegs[j];
        const meta = await sharp(jpegBuf).metadata();
        const origW = meta.width ?? 1440;
        const origH = meta.height ?? 1440;

        if (origH > 16000) {
          const numSlices = Math.ceil(origH / 12000);
          const sliceH = Math.floor(origH / numSlices);
          for (let s = 0; s < numSlices; s++) {
            const top = s * sliceH;
            const h = s === numSlices - 1 ? origH - top : sliceH;
            sliceJobs.push({
              buf: jpegBuf,
              extract: { left: 0, top, width: origW, height: h },
              width: origW,
              height: h,
            });
          }
        } else {
          sliceJobs.push({
            buf: jpegBuf,
            width: origW,
            height: origH,
          });
        }
      }

      // Convert pages in parallel using 6 worker limit for 8-core CPU
      const limit = pLimit(6);
      const pagesMeta: Array<{
        pageNumber: number;
        fileName: string;
        width: number;
        height: number;
        aspectRatio: number;
        fileSizeBytes: number;
      }> = [];

      await Promise.all(
        sliceJobs.map((job, idx) =>
          limit(async () => {
            const pageNum = idx + 1;
            const pageFileName = `p${String(pageNum).padStart(3, '0')}.webp`;
            const pageDestPath = path.join(absStorageDir, pageFileName);

            let pipeline = sharp(job.buf);
            if (job.extract) {
              pipeline = pipeline.extract(job.extract);
            } else {
              pipeline = pipeline.rotate();
            }

            if (job.width > 1440) {
              pipeline = pipeline.resize({ width: 1440, withoutEnlargement: true, fit: 'inside' });
            }

            const outputInfo = await pipeline
              .webp({ quality: 80, effort: 1 })
              .toFile(pageDestPath);

            const width = outputInfo.width;
            const height = outputInfo.height;
            const aspectRatio = height > 0 ? Number((width / height).toFixed(4)) : 1;

            pagesMeta[idx] = {
              pageNumber: pageNum,
              fileName: pageFileName,
              width,
              height,
              aspectRatio,
              fileSizeBytes: outputInfo.size,
            };
          })
        )
      );

      // Insert chapter record in DB
      chapterRepo.createChapter({
        id: chapterId,
        seriesId: slug,
        volumeId: null,
        chapterNumber: chapNum,
        title: `Capítulo ${chapNum}`,
        pageCount: pagesMeta.length,
        storagePath: relStorageDir,
      });

      // Insert pages in DB
      chapterRepo.addPages(chapterId, pagesMeta);

      processedCount++;
      const chapElapsed = Date.now() - chapStartTime;
      const progressPercent = (((i + 1) / filesToIngest.length) * 100).toFixed(1);
      console.log(
        `  [OK] [${progressPercent}%] Cap. ${chapNum} listo: ${pagesMeta.length} páginas WebP (${chapElapsed}ms)`
      );
    }

    const seriesElapsedSec = ((Date.now() - seriesStartTime) / 1000).toFixed(1);
    console.log(
      `[Success] Serie '${titlePrimary}' completada: ${processedCount} capítulos nuevos procesados en ${seriesElapsedSec}s.\n`
    );
  }

  console.log(`\n[Create] TODAS LAS SERIES PROCESADAS CON ÉXITO [Create]`);
  db.close();
}

ingestPdfSeries().catch((err) => {
  console.error('Error fatal durante la ingesta de PDFs:', err);
  process.exit(1);
});
