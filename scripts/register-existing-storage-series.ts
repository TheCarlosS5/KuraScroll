import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { DatabaseSync } from 'node:sqlite';
import { SeriesRepository } from '../src/backend/repositories/series-repository.js';
import { ChapterRepository } from '../src/backend/repositories/chapter-repository.js';
import { createDatabase, runMigrations } from '../src/backend/db/database.js';

interface SeriesConfig {
  slug: string;
  titlePrimary: string;
  titleRomaji?: string;
  titleNative?: string;
  type: 'manga' | 'manhwa' | 'manhua';
  status: 'ongoing' | 'completed';
  demographic: 'shounen' | 'seinen' | 'shoujo' | 'none';
  synopsis: string;
  author?: string;
  artist?: string;
  genres: string[];
}

const SERIES_PRESETS: Record<string, SeriesConfig> = {
  'dark-lady': {
    slug: 'dark-lady',
    titlePrimary: 'Dark Lady',
    titleRomaji: 'MookHyang - Dark Lady',
    titleNative: '묵향 다크레이디',
    type: 'manhwa',
    status: 'ongoing',
    demographic: 'shounen',
    synopsis: 'MookHyang, el legendario maestro del culto demoníaco, es transportado a un mundo de fantasía occidental con magia y dragones tras una traición.',
    author: 'Jeon Dong-hee',
    artist: 'Lee Jae-heon',
    genres: ['Acción', 'Fantasía', 'Artes Marciales', 'Reencarnación', 'Aventura'],
  },
  'el-demonio-celestial-del-cosmos-3077': {
    slug: 'el-demonio-celestial-del-cosmos-3077',
    titlePrimary: 'El Demonio Celestial del Cosmos 3077',
    titleRomaji: 'Space Heavenly Demon 3077',
    titleNative: '우주 천마 3077',
    type: 'manhwa',
    status: 'ongoing',
    demographic: 'shounen',
    synopsis: 'En el año 3077, la tecnología y el cultivo marcial convergen en una épica espacial donde el legendario demonio celestial despierta en una nave futurista.',
    author: 'Studio Grida',
    artist: 'Redice',
    genres: ['Acción', 'Ciencia Ficción', 'Artes Marciales', 'Mecha', 'Espacio'],
  },
  'kyouran-reijou-nia-liston': {
    slug: 'kyouran-reijou-nia-liston',
    titlePrimary: 'Kyouran Reijou Nia Liston',
    titleRomaji: 'Kyouran Reijou Nia Liston',
    titleNative: '狂乱令嬢ニア・リストン',
    type: 'manga',
    status: 'ongoing',
    demographic: 'seinen',
    synopsis: 'Una temible artista marcial renace como la pequeña y enfermiza noble Nia Liston, pero conserva sus devastadoras habilidades de combate.',
    author: 'Minamino Umikaze',
    artist: 'Kodama Naoko',
    genres: ['Acción', 'Fantasía', 'Isekai', 'Comedia'],
  },
  'uesugi-kun-wa-onnanoko-wo-yametai': {
    slug: 'uesugi-kun-wa-onnanoko-wo-yametai',
    titlePrimary: 'Uesugi-kun wa Onnanoko wo Yametai',
    titleRomaji: 'Uesugi-kun wa Onnanoko wo Yametai',
    titleNative: '上杉くんは女の子をやめたい',
    type: 'manga',
    status: 'ongoing',
    demographic: 'shounen',
    synopsis: 'Una divertida comedia de enredos escolares sobre identidad, romance y situaciones cotidianas llenas de humor juvenil.',
    author: 'Manga Studio',
    artist: 'Uesugi Art',
    genres: ['Romance', 'Comedia', 'Escolar', 'Slice of Life'],
  },
  'un-diario-de-conquista': {
    slug: 'un-diario-de-conquista',
    titlePrimary: 'Un Diario de Conquista',
    titleRomaji: 'A Conquest Diary',
    titleNative: '정복 일기',
    type: 'manhwa',
    status: 'ongoing',
    demographic: 'shounen',
    synopsis: 'Las crónicas de un intrépido protagonista navegando alianzas, conquistas y desafíos en un reino repleto de magia y poder.',
    author: 'Manhwa Creator',
    artist: 'Studio Pen',
    genres: ['Fantasía', 'Romance', 'Aventura', 'Reencarnación'],
  },
};

async function main() {
  const rootDir = path.resolve('.');
  const storageRoot = path.resolve(rootDir, 'data/storage');
  const seriesStorageRoot = path.join(storageRoot, 'series');
  const dbPath = path.resolve(rootDir, 'data/kura-scroll.db');

  const db = createDatabase(dbPath);
  runMigrations(db);

  const seriesRepo = new SeriesRepository(db);
  const chapterRepo = new ChapterRepository(db);

  const entries = await fs.readdir(seriesStorageRoot);

  for (const slug of entries) {
    const seriesDir = path.join(seriesStorageRoot, slug);
    const stat = await fs.stat(seriesDir);
    if (!stat.isDirectory()) continue;

    const preset = SERIES_PRESETS[slug];
    if (!preset) {
      console.log(`[Skip] Serie '${slug}' no está en la lista de producción.`);
      continue;
    }

    console.log(`\n[Sync] Procesando serie de producción: '${preset.titlePrimary}' (${slug})...`);

    const coverPath = `/storage/covers/${slug}-cover.webp`;
    let existingSeries = seriesRepo.getSeriesBySlug(slug);

    if (!existingSeries) {
      existingSeries = seriesRepo.createSeries({
        id: slug,
        slug: slug,
        titlePrimary: preset.titlePrimary,
        titleRomaji: preset.titleRomaji,
        titleNative: preset.titleNative,
        type: preset.type,
        status: preset.status,
        demographic: preset.demographic,
        synopsis: preset.synopsis,
        coverImage: coverPath,
        author: preset.author,
        artist: preset.artist,
        genres: preset.genres,
      });
      console.log(`  [OK] Serie '${preset.titlePrimary}' creada en la base de datos.`);
    }

    // Read chapter folders inside series folder (e.g. c1, c2, c3... or c188)
    const chapFolders = await fs.readdir(seriesDir);
    let registeredChaps = 0;

    for (const chapFolder of chapFolders) {
      const match = chapFolder.match(/^c([0-9]+(?:-[0-9]+|\.[0-9]+)?)$/i);
      if (!match) continue;

      const chapNum = parseFloat(match[1].replace('-', '.'));
      if (isNaN(chapNum)) continue;

      const chapterId = `${slug}-${chapFolder}`;
      const existingChap = chapterRepo.getChapter(chapterId);
      if (existingChap) continue;

      const chapDir = path.join(seriesDir, chapFolder);
      const pageFiles = (await fs.readdir(chapDir))
        .filter((f) => f.endsWith('.webp'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      if (pageFiles.length === 0) continue;

      const relStorageDir = `series/${slug}/${chapFolder}`;
      const pagesMeta: Array<{
        pageNumber: number;
        fileName: string;
        width: number;
        height: number;
        aspectRatio: number;
        fileSizeBytes: number;
      }> = [];

      for (let pIdx = 0; pIdx < pageFiles.length; pIdx++) {
        const pFile = pageFiles[pIdx];
        const pPath = path.join(chapDir, pFile);
        const pStat = await fs.stat(pPath);
        
        let width = 1080;
        let height = 1920;
        if (pIdx === 0) {
          try {
            const m = await sharp(pPath).metadata();
            width = m.width || 1080;
            height = m.height || 1920;
          } catch {
            // fallback defaults
          }
        }

        pagesMeta.push({
          pageNumber: pIdx + 1,
          fileName: pFile,
          width,
          height,
          aspectRatio: Number((width / height).toFixed(4)),
          fileSizeBytes: pStat.size,
        });
      }

      chapterRepo.createChapter({
        id: chapterId,
        seriesId: slug,
        volumeId: null,
        chapterNumber: chapNum,
        title: `Capítulo ${chapNum}`,
        pageCount: pagesMeta.length,
        storagePath: relStorageDir,
      });

      chapterRepo.addPages(chapterId, pagesMeta);
      registeredChaps++;
    }

    console.log(`  [OK] ${registeredChaps} capítulos registrados para '${preset.titlePrimary}'.`);
  }

  console.log(`\n[Sync Complete] Todas las series de producción han sido sincronizadas en kura-scroll.db.`);
  db.close();
}

main().catch((err) => {
  console.error('Error durante la sincronización:', err);
  process.exit(1);
});
