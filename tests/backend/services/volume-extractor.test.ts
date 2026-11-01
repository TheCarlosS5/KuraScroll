import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import AdmZip from 'adm-zip';
import sharp from 'sharp';
import {
  detectArchiveStructure,
  isJunkEntry,
  isValidEntry,
  parseChapterNumber,
  ingestVolumeArchive,
} from '../../../src/backend/services/volume-extractor';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database';
import { ChapterRepository } from '../../../src/backend/repositories/chapter-repository';

describe('Volume Extractor: detectArchiveStructure & Helper Functions', () => {
  it('correctly parses chapter numbers from various naming conventions', () => {
    expect(parseChapterNumber('Chapter 1')).toBe(1);
    expect(parseChapterNumber('Chapter 02')).toBe(2);
    expect(parseChapterNumber('Ch.3')).toBe(3);
    expect(parseChapterNumber('Ch 10.5')).toBe(10.5);
    expect(parseChapterNumber('Capitulo 04')).toBe(4);
    expect(parseChapterNumber('c05')).toBe(5);
    expect(parseChapterNumber('06')).toBe(6);
    expect(parseChapterNumber('Vol 1 Ch 07')).toBe(7);
  });

  it('filters out system junk files like __MACOSX/, .DS_Store, Thumbs.db, and ._*', () => {
    expect(isJunkEntry('__MACOSX/._01.jpg')).toBe(true);
    expect(isJunkEntry('__MACOSX/Chapter 1/01.jpg')).toBe(true);
    expect(isJunkEntry('Chapter 1/.DS_Store')).toBe(true);
    expect(isJunkEntry('Chapter 1/Thumbs.db')).toBe(true);
    expect(isJunkEntry('Chapter 1/desktop.ini')).toBe(true);
    expect(isJunkEntry('Chapter 1/._01.png')).toBe(true);

    expect(isJunkEntry('Chapter 1/01.jpg')).toBe(false);
    expect(isJunkEntry('c01_001.png')).toBe(false);

    expect(isValidEntry('Chapter 1/01.jpg')).toBe(true);
    expect(isValidEntry('Chapter 1/text.txt')).toBe(false);
    expect(isValidEntry('Chapter 1/.DS_Store')).toBe(false);
  });

  it('detects volume with subfolders Chapter 1/, Chapter 2/, Chapter 10/ and preserves natural order', () => {
    const entries = [
      'Chapter 1/01.jpg',
      'Chapter 1/02.jpg',
      'Chapter 2/01.jpg',
      'Chapter 2/02.jpg',
      'Chapter 10/01.jpg',
    ];

    const result = detectArchiveStructure(entries);
    expect(result.isVolume).toBe(true);
    expect(result.chapters.length).toBe(3);

    // Natural sort order: Chapter 1, Chapter 2, Chapter 10 (2 before 10)
    expect(result.chapters[0].chapterNumber).toBe(1);
    expect(result.chapters[1].chapterNumber).toBe(2);
    expect(result.chapters[2].chapterNumber).toBe(10);

    expect(result.chapters[0].entryNames).toEqual(['Chapter 1/01.jpg', 'Chapter 1/02.jpg']);
    expect(result.chapters[1].entryNames).toEqual(['Chapter 2/01.jpg', 'Chapter 2/02.jpg']);
    expect(result.chapters[2].entryNames).toEqual(['Chapter 10/01.jpg']);
  });

  it('detects volume with common root wrapper folder (e.g. Vol 1/Ch 01/)', () => {
    const entries = [
      'One_Piece_Vol_01/Ch 01/01.png',
      'One_Piece_Vol_01/Ch 01/02.png',
      'One_Piece_Vol_01/Ch 02/01.png',
    ];

    const result = detectArchiveStructure(entries);
    expect(result.isVolume).toBe(true);
    expect(result.chapters.length).toBe(2);
    expect(result.chapters[0].chapterNumber).toBe(1);
    expect(result.chapters[1].chapterNumber).toBe(2);
    expect(result.chapters[0].entryNames).toEqual([
      'One_Piece_Vol_01/Ch 01/01.png',
      'One_Piece_Vol_01/Ch 01/02.png',
    ]);
  });

  it('detects volume with numeric prefix files (c01_001.jpg, c02_001.jpg)', () => {
    const entries = [
      'c01_001.jpg',
      'c01_002.jpg',
      'c01_010.jpg',
      'c02_001.jpg',
      'c02_002.jpg',
      'c10_001.jpg',
    ];

    const result = detectArchiveStructure(entries);
    expect(result.isVolume).toBe(true);
    expect(result.chapters.length).toBe(3);

    expect(result.chapters[0].chapterNumber).toBe(1);
    expect(result.chapters[1].chapterNumber).toBe(2);
    expect(result.chapters[2].chapterNumber).toBe(10);

    // Natural page sorting within chapter 1: 001, 002, 010
    expect(result.chapters[0].entryNames).toEqual([
      'c01_001.jpg',
      'c01_002.jpg',
      'c01_010.jpg',
    ]);
  });

  it('ignores system junk entries in volume archive detection', () => {
    const entries = [
      '__MACOSX/._Chapter 1',
      '__MACOSX/Chapter 1/._01.jpg',
      'Chapter 1/.DS_Store',
      'Chapter 1/Thumbs.db',
      'Chapter 1/01.jpg',
      'Chapter 2/01.jpg',
    ];

    const result = detectArchiveStructure(entries);
    expect(result.isVolume).toBe(true);
    expect(result.chapters.length).toBe(2);
    expect(result.chapters[0].entryNames).toEqual(['Chapter 1/01.jpg']);
    expect(result.chapters[1].entryNames).toEqual(['Chapter 2/01.jpg']);
  });

  it('falls back cleanly to single chapter when no internal hierarchy is present', () => {
    const entries = ['001.jpg', '002.jpg', '010.jpg'];

    const result = detectArchiveStructure(entries);
    expect(result.isVolume).toBe(false);
    expect(result.chapters.length).toBe(1);
    expect(result.chapters[0].chapterNumber).toBe(1);
    expect(result.chapters[0].entryNames).toEqual(['001.jpg', '002.jpg', '010.jpg']);
  });

  it('detects volume containing nested .cbz and .zip archives', () => {
    const entries = [
      'Chapter 01.cbz',
      'Chapter 02.cbz',
      'Chapter 10.zip',
    ];

    const result = detectArchiveStructure(entries);
    expect(result.isVolume).toBe(true);
    expect(result.chapters.length).toBe(3);
    expect(result.chapters[0].chapterNumber).toBe(1);
    expect(result.chapters[1].chapterNumber).toBe(2);
    expect(result.chapters[2].chapterNumber).toBe(10);
  });
});

describe('Volume Extractor: ingestVolumeArchive E2E Ingestion Pipeline', () => {
  sharp.cache(false);
  const tmpDir = path.resolve(__dirname, 'tmp-volume-ingest');
  const volumeZipPath = path.join(tmpDir, 'mock_volume_01.cbz');
  let db: DatabaseInstance;

  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });

    // Build a real mock multi-chapter volume .cbz using sharp and AdmZip
    const dummyImg1 = await sharp({
      create: { width: 400, height: 600, channels: 3, background: { r: 255, g: 0, b: 0 } },
    }).png().toBuffer();

    const dummyImg2 = await sharp({
      create: { width: 400, height: 600, channels: 3, background: { r: 0, g: 255, b: 0 } },
    }).png().toBuffer();

    const dummyImg3 = await sharp({
      create: { width: 400, height: 600, channels: 3, background: { r: 0, g: 0, b: 255 } },
    }).png().toBuffer();

    const zip = new AdmZip();
    zip.addFile('Chapter 1/01.png', dummyImg1);
    zip.addFile('Chapter 1/02.png', dummyImg2);
    zip.addFile('Chapter 2/01.png', dummyImg3);
    zip.addFile('__MACOSX/._Chapter 1', Buffer.from('junk'));
    zip.addFile('Chapter 1/.DS_Store', Buffer.from('junk'));

    zip.writeZip(volumeZipPath);

    db = createDatabase(':memory:');
    runMigrations(db);
  });

  afterAll(async () => {
    db.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('ingests multi-chapter volume sequentially, creates WebP pages, manifest, and DB navigation pointers', async () => {
    const result = await ingestVolumeArchive({
      storageRoot: tmpDir,
      seriesSlug: 'one-piece',
      volumeNumber: 1,
      sourceArchive: volumeZipPath,
      db,
      maxImageWidth: 480,
      webpQuality: 80,
    });

    expect(result.isVolume).toBe(true);
    expect(result.totalChapters).toBe(2);

    // Verify Chapter 1
    const ch1 = result.chapters[0];
    expect(ch1.chapterNumber).toBe(1);
    expect(ch1.pageCount).toBe(2);
    expect(ch1.chapterId).toBe('one-piece-c1');

    // Verify Chapter 2
    const ch2 = result.chapters[1];
    expect(ch2.chapterNumber).toBe(2);
    expect(ch2.pageCount).toBe(1);
    expect(ch2.chapterId).toBe('one-piece-c2');

    // Verify files on disk
    const ch1Manifest = path.join(tmpDir, ch1.relativeStorageDir, 'manifest.json');
    const ch1P1 = path.join(tmpDir, ch1.relativeStorageDir, '001.webp');
    const ch1P2 = path.join(tmpDir, ch1.relativeStorageDir, '002.webp');
    expect(await fs.stat(ch1Manifest)).toBeDefined();
    expect(await fs.stat(ch1P1)).toBeDefined();
    expect(await fs.stat(ch1P2)).toBeDefined();

    // Verify SQLite registration and Chapter Navigation Pointers
    const chapterRepo = new ChapterRepository(db);
    const detail1 = chapterRepo.getChapterWithPages('one-piece-c1');
    const detail2 = chapterRepo.getChapterWithPages('one-piece-c2');

    expect(detail1).toBeDefined();
    expect(detail1?.pages.length).toBe(2);
    expect(detail1?.prevChapterId).toBeNull();
    expect(detail1?.nextChapterId).toBe('one-piece-c2'); // Pointer to next chapter

    expect(detail2).toBeDefined();
    expect(detail2?.pages.length).toBe(1);
    expect(detail2?.prevChapterId).toBe('one-piece-c1'); // Pointer to previous chapter
    expect(detail2?.nextChapterId).toBeNull();
  });
});
