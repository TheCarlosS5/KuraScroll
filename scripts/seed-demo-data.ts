import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createDatabase, runMigrations } from '../src/backend/db/database.js';
import { SeriesRepository } from '../src/backend/repositories/series-repository.js';
import { ChapterRepository } from '../src/backend/repositories/chapter-repository.js';

async function seedDemoData() {
  console.log('🌱 Starting KuraScroll Demo Seeding...');

  const dbPath = path.resolve('./data/kura-scroll.db');
  const storageRoot = path.resolve('./data/storage');
  const coversDir = path.join(storageRoot, 'covers');

  await fs.mkdir(coversDir, { recursive: true });

  const db = createDatabase(dbPath);
  runMigrations(db);

  // Clean slate for demo seeding
  db.exec(`
    DELETE FROM chapter_pages;
    DELETE FROM chapters;
    DELETE FROM series_genres;
    DELETE FROM series_titles;
    DELETE FROM series;
  `);

  const seriesRepo = new SeriesRepository(db);
  const chapRepo = new ChapterRepository(db);

  const demoSeries = [
    {
      id: 'solo-leveling',
      slug: 'solo-leveling',
      titlePrimary: 'Solo Leveling',
      type: 'manhwa' as const,
      status: 'completed' as const,
      demographic: 'shounen' as const,
      releaseYear: 2018,
      author: 'Chugong',
      artist: 'DUBU (REDICE Studio)',
      synopsis: 'In a world where hunters awakened with supernatural powers battle deadly monsters, Sung Jinwoo is notoriously known as the "Weakest Hunter of All Mankind". After surviving a treacherous double dungeon, he awakens with the mysterious ability to see an interface that allows him to level up without limits.',
      genres: ['Action', 'Fantasy', 'Supernatural', 'Dungeon', 'Leveling'],
      color: '#00e5ff',
      titles: [
        { languageCode: 'ko', title: '나 혼자만 레벨업' },
        { languageCode: 'en', title: 'Solo Leveling', isPrimary: true },
        { languageCode: 'es', title: 'Solo Leveling (Sólo yo subo de nivel)' },
        { languageCode: 'ja', title: '俺だけレベルアップな件' }
      ]
    },
    {
      id: 'kimetsu-no-yaiba',
      slug: 'kimetsu-no-yaiba',
      titlePrimary: 'Demon Slayer: Kimetsu no Yaiba',
      type: 'manga' as const,
      status: 'completed' as const,
      demographic: 'shounen' as const,
      releaseYear: 2016,
      author: 'Koyoharu Gotouge',
      artist: 'Koyoharu Gotouge',
      synopsis: 'Taisho-era Japan. Tanjiro Kamado is a kindhearted boy whose family is slaughtered by demons while his younger sister Nezuko is transformed into one. Tanjiro embarks on a dangerous journey to join the Demon Slayer Corps and find a cure to turn Nezuko back into a human.',
      genres: ['Action', 'Historical', 'Supernatural', 'Demons', 'Martial Arts'],
      color: '#dc2626',
      titles: [
        { languageCode: 'ja', title: '鬼滅の刃' },
        { languageCode: 'en', title: 'Demon Slayer: Kimetsu no Yaiba', isPrimary: true },
        { languageCode: 'es', title: 'Guardianes de la Noche' },
        { languageCode: 'ko', title: '귀멸의 칼날' }
      ]
    },
    {
      id: 'tower-of-god',
      slug: 'tower-of-god',
      titlePrimary: 'Tower of God',
      type: 'manhwa' as const,
      status: 'ongoing' as const,
      demographic: 'shounen' as const,
      releaseYear: 2010,
      author: 'SIU',
      artist: 'SIU',
      synopsis: 'What do you desire? Money and wealth? Honor and pride? Authority and power? Revenge? Or something that transcends them all? Whatever you desire is at the top of the Tower. Twenty-Fifth Bam enters the Tower chasing his beloved Rachel.',
      genres: ['Fantasy', 'Action', 'Mystery', 'Adventure', 'Supernatural'],
      color: '#eab308',
      titles: [
        { languageCode: 'ko', title: '신의 탑' },
        { languageCode: 'en', title: 'Tower of God', isPrimary: true },
        { languageCode: 'es', title: 'Torre de Dios' },
        { languageCode: 'ja', title: '神之塔' }
      ]
    },
    {
      id: 'berserk',
      slug: 'berserk',
      titlePrimary: 'Berserk',
      type: 'manga' as const,
      status: 'ongoing' as const,
      demographic: 'seinen' as const,
      releaseYear: 1989,
      author: 'Kentaro Miura',
      artist: 'Kentaro Miura / Studio Gaga',
      synopsis: 'Guts, a former mercenary now known as the "Black Swordsman," is out for revenge. He hunts evil demonic entities known as Apostles while bearing a cursed brand that attracts malevolent spirits every night. A monumental masterpiece of dark fantasy.',
      genres: ['Dark Fantasy', 'Action', 'Seinen', 'Horror', 'Tragedy'],
      color: '#8b5cf6',
      titles: [
        { languageCode: 'ja', title: 'ベルセルク' },
        { languageCode: 'en', title: 'Berserk', isPrimary: true },
        { languageCode: 'es', title: 'Berserk' }
      ]
    },
    {
      id: 'spy-x-family',
      slug: 'spy-x-family',
      titlePrimary: 'SPY×FAMILY',
      type: 'manga' as const,
      status: 'ongoing' as const,
      demographic: 'shounen' as const,
      releaseYear: 2019,
      author: 'Tatsuya Endo',
      artist: 'Tatsuya Endo',
      synopsis: 'Master spy Twilight must create a fake family for Operation Strix. Unbeknownst to him, his adopted daughter Anya is a telepath, and his fake wife Yor is an elite assassin. A delightful comedy-action espionage saga.',
      genres: ['Comedy', 'Action', 'Espionage', 'Family', 'Slice of Life'],
      color: '#10b981',
      titles: [
        { languageCode: 'ja', title: 'スパイファミリー' },
        { languageCode: 'en', title: 'SPY×FAMILY', isPrimary: true },
        { languageCode: 'es', title: 'SPY×FAMILY' }
      ]
    },
    {
      id: 'martial-peak',
      slug: 'martial-peak',
      titlePrimary: 'Martial Peak',
      type: 'manhua' as const,
      status: 'ongoing' as const,
      demographic: 'none' as const,
      releaseYear: 2018,
      author: 'Momo',
      artist: 'Pikapi',
      synopsis: 'The journey to the martial peak is a lonely, solitary and long one. In the face of adversity, you must survive and remain unyielding. Yang Kai, a trial disciple of High Heaven Pavilion, obtains a black book that changes his fate forever.',
      genres: ['Action', 'Martial Arts', 'Cultivation', 'Fantasy', 'Harem'],
      color: '#ec4899',
      titles: [
        { languageCode: 'zh', title: '武炼巅峰' },
        { languageCode: 'en', title: 'Martial Peak', isPrimary: true },
        { languageCode: 'es', title: 'Cúspide Marcial' }
      ]
    }
  ];

  for (const item of demoSeries) {
    console.log(`  -> Processing series: ${item.titlePrimary}`);

    // Generate cover WebP
    const coverFileName = `${item.slug}-cover.webp`;
    const coverPath = path.join(coversDir, coverFileName);

    const coverSvg = `
      <svg width="480" height="720" viewBox="0 0 480 720" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0a0f1d"/>
            <stop offset="50%" stop-color="#121829"/>
            <stop offset="100%" stop-color="#080c14"/>
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stop-color="${item.color}" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="480" height="720" fill="url(#bg)"/>
        <rect width="480" height="720" fill="url(#glow)"/>
        
        <!-- Monogram Badge -->
        <rect x="24" y="24" width="56" height="56" rx="12" fill="#000000" opacity="0.6"/>
        <rect x="24" y="24" width="56" height="56" rx="12" stroke="${item.color}" stroke-width="2" fill="none"/>
        <text x="52" y="60" font-family="monospace" font-size="24" font-weight="900" fill="${item.color}" text-anchor="middle">KS</text>
        
        <!-- Type Badge -->
        <rect x="340" y="28" width="116" height="32" rx="8" fill="#18181b" stroke="#3f3f46" stroke-width="1"/>
        <text x="398" y="50" font-family="sans-serif" font-size="14" font-weight="bold" fill="#e4e4e7" text-anchor="middle">${item.type.toUpperCase()}</text>
        
        <!-- Graphic Center Art Mockup -->
        <circle cx="240" cy="300" r="140" fill="none" stroke="${item.color}" stroke-width="3" stroke-dasharray="12 8" opacity="0.6"/>
        <circle cx="240" cy="300" r="110" fill="#080c14" opacity="0.8"/>
        <text x="240" y="320" font-family="sans-serif" font-size="64" font-weight="900" fill="${item.color}" text-anchor="middle">⚡</text>
        
        <!-- Bottom Panel -->
        <rect x="0" y="520" width="480" height="200" fill="#05080f" opacity="0.95"/>
        <line x1="0" y1="520" x2="480" y2="520" stroke="${item.color}" stroke-width="3"/>
        
        <text x="24" y="565" font-family="sans-serif" font-size="24" font-weight="bold" fill="#ffffff">${item.titlePrimary}</text>
        <text x="24" y="598" font-family="sans-serif" font-size="14" fill="#a1a1aa">${item.author} • ${item.releaseYear}</text>
        <text x="24" y="635" font-family="sans-serif" font-size="13" fill="${item.color}">★ ${item.genres.slice(0, 3).join(' • ')}</text>
        <text x="24" y="685" font-family="monospace" font-size="11" fill="#71717a">KuraScroll Local Storage • 4TB Archive</text>
      </svg>
    `;

    await sharp(Buffer.from(coverSvg)).webp({ quality: 85 }).toFile(coverPath);

    // Upsert series
    seriesRepo.createSeries({
      id: item.id,
      slug: item.slug,
      titlePrimary: item.titlePrimary,
      type: item.type,
      status: item.status,
      demographic: item.demographic,
      synopsis: item.synopsis,
      coverImage: `/storage/covers/${coverFileName}`,
      author: item.author,
      artist: item.artist,
      releaseYear: item.releaseYear,
      genres: item.genres,
    });

    seriesRepo.addSeriesTitles(item.id, item.titles);

    // Create 3 demo chapters for each series
    for (let c = 1; c <= 3; c++) {
      const chapId = `${item.id}-c${c}`;
      const chapDir = path.join(storageRoot, 'series', item.slug, `c${c}`);
      await fs.mkdir(chapDir, { recursive: true });

      const pageCount = item.type === 'manhwa' ? 6 : 8;
      const pageRecords = [];

      for (let p = 1; p <= pageCount; p++) {
        const pageFileName = `p${String(p).padStart(3, '0')}.webp`;
        const pageFilePath = path.join(chapDir, pageFileName);

        const isTallStrip = item.type === 'manhwa';
        const pWidth = isTallStrip ? 1200 : 1440;
        const pHeight = isTallStrip ? 3200 : 2048;

        const pageSvg = `
          <svg width="${pWidth}" height="${pHeight}" viewBox="0 0 ${pWidth} ${pHeight}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${pWidth}" height="${pHeight}" fill="#0b0e14"/>
            
            <!-- Page Header / Watermark -->
            <rect x="0" y="0" width="${pWidth}" height="80" fill="#080c14"/>
            <text x="40" y="50" font-family="monospace" font-size="28" font-weight="bold" fill="${item.color}">KURASCROLL [KS] • ${item.titlePrimary}</text>
            <text x="${pWidth - 40}" y="50" font-family="monospace" font-size="28" fill="#a1a1aa" text-anchor="end">Capítulo ${c} • Página ${p}/${pageCount}</text>
            
            <!-- Manga / Manhwa Panel 1 -->
            <rect x="50" y="120" width="${pWidth - 100}" height="${Math.floor(pHeight * 0.42)}" rx="8" fill="#141824" stroke="#27272a" stroke-width="4"/>
            <text x="${pWidth / 2}" y="${Math.floor(pHeight * 0.28)}" font-family="sans-serif" font-size="48" font-weight="bold" fill="#ffffff" text-anchor="middle">PANEL 1 • ${item.titlePrimary}</text>
            <text x="${pWidth / 2}" y="${Math.floor(pHeight * 0.34)}" font-family="monospace" font-size="28" fill="${item.color}" text-anchor="middle">SLA 98: Jurin-Washburn Bleed &amp; Splatter Active</text>
            
            <!-- Speech Balloon 1 -->
            <rect x="120" y="160" width="340" height="120" rx="24" fill="#ffffff"/>
            <text x="290" y="215" font-family="sans-serif" font-size="22" font-weight="bold" fill="#000000" text-anchor="middle">"¡No te rindas jamás!"</text>
            <text x="290" y="245" font-family="sans-serif" font-size="16" fill="#3f3f46" text-anchor="middle">G-Pen Vector Track</text>

            <!-- SFX Calligraphy Action text -->
            <text x="${pWidth - 180}" y="${Math.floor(pHeight * 0.38)}" font-family="sans-serif" font-size="72" font-weight="900" fill="${item.color}" text-anchor="middle">ドォン!!</text>

            <!-- Manga / Manhwa Panel 2 -->
            <rect x="50" y="${Math.floor(pHeight * 0.56)}" width="${pWidth - 100}" height="${Math.floor(pHeight * 0.38)}" rx="8" fill="#0f131d" stroke="#27272a" stroke-width="4"/>
            <text x="${pWidth / 2}" y="${Math.floor(pHeight * 0.72)}" font-family="sans-serif" font-size="44" font-weight="bold" fill="#e4e4e7" text-anchor="middle">PANEL 2 • ACCIÓN CINEMÁTICA</text>
            <text x="${pWidth / 2}" y="${Math.floor(pHeight * 0.77)}" font-family="monospace" font-size="26" fill="#71717a" text-anchor="middle">Modo Dual: ${item.type === 'manhwa' ? 'Scroll Vertical Infinito' : 'Paginado Horizontal Manga'}</text>
            
            <!-- Speech Balloon 2 -->
            <rect x="${pWidth - 460}" y="${Math.floor(pHeight * 0.60)}" width="380" height="110" rx="24" fill="#ffffff"/>
            <text x="${pWidth - 270}" y="${Math.floor(pHeight * 0.65)}" font-family="sans-serif" font-size="20" font-weight="bold" fill="#000000" text-anchor="middle">"KuraScroll funciona a 60 FPS"</text>
            <text x="${pWidth - 270}" y="${Math.floor(pHeight * 0.68)}" font-family="monospace" font-size="14" fill="#52525b" text-anchor="middle">Intel Pentium T4500 Validado</text>

            <!-- Bottom footer -->
            <rect x="0" y="${pHeight - 60}" width="${pWidth}" height="60" fill="#05080f"/>
            <text x="${pWidth / 2}" y="${pHeight - 24}" font-family="monospace" font-size="20" fill="#52525b" text-anchor="middle">KuraScroll • Fastify 5 + React 19 • Cero Asignaciones</text>
          </svg>
        `;

        await sharp(Buffer.from(pageSvg)).webp({ quality: 80 }).toFile(pageFilePath);

        pageRecords.push({
          pageNumber: p,
          fileName: pageFileName,
          width: pWidth,
          height: pHeight,
          aspectRatio: Number((pWidth / pHeight).toFixed(4)),
          blurhash: null,
        });
      }

      chapRepo.createChapter({
        id: chapId,
        seriesId: item.id,
        chapterNumber: c,
        title: `Capítulo ${c}: El Despertar del Poder`,
        scanlationGroup: 'KuraScan Official',
        pageCount,
        storagePath: path.relative(storageRoot, chapDir).replace(/\\/g, '/'),
      });

      chapRepo.addPages(chapId, pageRecords);
    }
  }

  console.log('✅ Demo seeding finished successfully!');
  db.close();
}

seedDemoData().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
