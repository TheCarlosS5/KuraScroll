import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

async function purgeAllTestData() {
  console.log('[Purge] Purging all test, demo, and mock data from KuraScroll...');

  const rootDir = path.resolve('.');
  const dbPath = path.resolve(rootDir, 'data/kura-scroll.db');
  const storageRoot = path.resolve(rootDir, 'data/storage');
  const coversDir = path.join(storageRoot, 'covers');
  const seriesDir = path.join(storageRoot, 'series');
  const incomingDir = path.join(storageRoot, 'incoming');
  const tmpDir = path.resolve(rootDir, 'tmp');
  const testScratchDir = path.resolve(rootDir, 'test-scratch');
  const scratchDir = path.resolve(rootDir, 'scratch');

  // 1. Purge SQLite Database Tables
  if (fsSync.existsSync(dbPath)) {
    console.log('[Database] Purging SQLite database tables...');
    const db = new DatabaseSync(dbPath);

    const tablesToClear = [
      'chapter_pages',
      'chapters',
      'volumes',
      'series_genres',
      'series_titles',
      'series',
      'user_progress',
      'user_reading_streaks',
      'user_daily_activity',
      'user_badges',
      'user_bookmarks',
      'applied_mutations',
      'user_genre_read_stats',
      'duplicate_merge_history',
      'chapter_page_dwell_stats',
      'chapter_speech_bubbles',
      'series_embeddings',
      'chapter_story_recaps',
      'corrupt_files_log',
      'library_snapshots',
      'folder_sync_state',
    ];

    for (const table of tablesToClear) {
      try {
        db.exec(`DELETE FROM "${table}";`);
        console.log(`  [OK] Cleared table ${table}`);
      } catch (err: any) {
        console.warn(`  [Warn] Could not clear table ${table}: ${err.message}`);
      }
    }

    try {
      db.exec(`DELETE FROM series_search_fts;`);
      console.log('  [OK] Cleared FTS search index');
    } catch (e: any) {
      console.warn('  [Warn] FTS clear notice:', e.message);
    }

    try {
      db.exec('VACUUM;');
      console.log('  [OK] Database vacuumed successfully.');
    } catch (e: any) {
      console.warn('  [Warn] Vacuum notice:', e.message);
    }

    db.close();
  }

  // 2. Clean storage covers
  if (fsSync.existsSync(coversDir)) {
    console.log('[Covers] Cleaning data/storage/covers/...');
    const covers = await fs.readdir(coversDir);
    for (const f of covers) {
      if (f !== '.gitkeep') {
        await fs.rm(path.join(coversDir, f), { recursive: true, force: true });
        console.log(`  [OK] Deleted cover: ${f}`);
      }
    }
  } else {
    await fs.mkdir(coversDir, { recursive: true });
  }

  // 3. Clean storage series chapters
  if (fsSync.existsSync(seriesDir)) {
    console.log('[Series] Cleaning data/storage/series/...');
    const seriesFolders = await fs.readdir(seriesDir);
    for (const s of seriesFolders) {
      if (s !== '.gitkeep') {
        await fs.rm(path.join(seriesDir, s), { recursive: true, force: true });
        console.log(`  [OK] Deleted series directory: ${s}`);
      }
    }
  } else {
    await fs.mkdir(seriesDir, { recursive: true });
  }

  // 4. Ensure incoming directory exists
  if (!fsSync.existsSync(incomingDir)) {
    await fs.mkdir(incomingDir, { recursive: true });
    console.log('[Incoming] Created data/storage/incoming/ directory');
  }

  // 5. Clean tmp directory
  if (fsSync.existsSync(tmpDir)) {
    console.log('[Clean] Cleaning tmp/ directory...');
    const tmpFiles = await fs.readdir(tmpDir);
    for (const tf of tmpFiles) {
      if (tf !== '.gitkeep') {
        await fs.rm(path.join(tmpDir, tf), { recursive: true, force: true });
        console.log(`  [OK] Deleted tmp item: ${tf}`);
      }
    }
  }

  // 6. Remove test-scratch if present
  if (fsSync.existsSync(testScratchDir)) {
    console.log('[Clean] Removing test-scratch/ directory...');
    await fs.rm(testScratchDir, { recursive: true, force: true });
    console.log('  [OK] Removed test-scratch/');
  }

  // 7. Clean sprint test scripts in scratch/
  if (fsSync.existsSync(scratchDir)) {
    console.log('[Clean] Cleaning sprint scripts from scratch/ directory...');
    const scratchFiles = await fs.readdir(scratchDir);
    for (const sf of scratchFiles) {
      await fs.rm(path.join(scratchDir, sf), { recursive: true, force: true });
    }
    await fs.rm(scratchDir, { recursive: true, force: true });
    console.log('  [OK] Removed scratch/');
  }

  console.log('\n[Done] ALL TEST, MOCK, AND DEMO DATA SUCCESSFULLY PURGED! [Done]');
}

purgeAllTestData().catch((err) => {
  console.error('Fatal error purging data:', err);
  process.exit(1);
});
