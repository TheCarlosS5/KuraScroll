import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DEMO_SLUGS = [
  'solo-leveling',
  'kimetsu-no-yaiba',
  'tower-of-god',
  'berserk',
  'spy-x-family',
  'martial-peak',
];

async function removeDemoData() {
  console.log('[Purge] Removing all demo/mock series and files, keeping only real production mangas...');

  const rootDir = path.resolve('.');
  const dbPath = path.resolve(rootDir, 'data/kura-scroll.db');
  const storageRoot = path.resolve(rootDir, 'data/storage');
  const coversDir = path.join(storageRoot, 'covers');
  const seriesDir = path.join(storageRoot, 'series');

  // 1. Remove from SQLite DB
  if (fsSync.existsSync(dbPath)) {
    const db = new DatabaseSync(dbPath);

    for (const slug of DEMO_SLUGS) {
      console.log(`[DB] Removing '${slug}'...`);
      // Delete chapter pages
      db.exec(`
        DELETE FROM chapter_pages 
        WHERE chapter_id IN (SELECT id FROM chapters WHERE series_id = '${slug}');
      `);
      // Delete chapters
      db.exec(`DELETE FROM chapters WHERE series_id = '${slug}';`);
      // Delete genres
      db.exec(`DELETE FROM series_genres WHERE series_id = '${slug}';`);
      // Delete titles
      db.exec(`DELETE FROM series_titles WHERE series_id = '${slug}';`);
      // Delete progress
      db.exec(`DELETE FROM user_progress WHERE series_id = '${slug}';`);
      // Delete series
      db.exec(`DELETE FROM series WHERE id = '${slug}';`);
      // Delete FTS
      try {
        db.exec(`DELETE FROM series_search_fts WHERE series_id = '${slug}';`);
      } catch {}
      console.log(`  [OK] Cleaned DB entries for '${slug}'.`);
    }

    db.close();
  }

  // 2. Remove mock folders from storage
  for (const slug of DEMO_SLUGS) {
    const mockFolder = path.join(seriesDir, slug);
    if (fsSync.existsSync(mockFolder)) {
      console.log(`[Storage] Deleting mock folder ${mockFolder}...`);
      await fs.rm(mockFolder, { recursive: true, force: true });
    }

    const mockCover = path.join(coversDir, `${slug}-cover.webp`);
    if (fsSync.existsSync(mockCover)) {
      console.log(`[Storage] Deleting mock cover ${mockCover}...`);
      await fs.rm(mockCover, { force: true });
    }
  }

  console.log('\n[Complete] All demo data removed. Only real production mangas remain in KuraScroll.');
}

removeDemoData().catch((err) => {
  console.error('Fatal error during demo cleanup:', err);
  process.exit(1);
});
