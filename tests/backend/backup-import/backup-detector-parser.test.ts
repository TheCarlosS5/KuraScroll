import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import {
  detectBackupFormat,
  parseTachiyomiBackup,
  normalizeBackup,
  importBackup,
} from '../../../src/backend/backup-import/index';

describe('Backup Detector & Normalizer (Tachiyomi & Mihon)', () => {
  describe('Format Detection (detectBackupFormat)', () => {
    it('detects uncompressed Tachiyomi legacy JSON with manga array', () => {
      const payload = JSON.stringify([
        {
          title: 'Berserk',
          author: 'Kentarou Miura',
          status: 1,
          chapters: [{ name: 'Chapter 1', chapter_number: 1 }],
        },
      ]);

      const result = detectBackupFormat(payload);
      expect(result.format).toBe('tachiyomi_legacy_json');
      expect(result.isGzip).toBe(false);
      expect(result.parsedJson).toBeDefined();
    });

    it('detects uncompressed Tachiyomi legacy JSON with data wrapper', () => {
      const payload = JSON.stringify({
        data: [
          {
            title: 'Chainsaw Man',
            author: 'Tatsuki Fujimoto',
            status: 1,
          },
        ],
      });

      const result = detectBackupFormat(payload);
      expect(result.format).toBe('tachiyomi_legacy_json');
      expect(result.isGzip).toBe(false);
    });

    it('detects modern Mihon JSON with version and mangas object', () => {
      const payload = JSON.stringify({
        version: 2,
        mangas: [
          {
            title: 'One Piece',
            author: 'Eiichiro Oda',
            status: 1,
          },
        ],
        categories: [{ name: 'Reading', order: 0 }],
      });

      const result = detectBackupFormat(payload);
      expect(result.format).toBe('mihon_json');
      expect(result.version).toBe(2);
      expect(result.isGzip).toBe(false);
    });

    it('detects and decompresses GZIP-compressed backup buffers', () => {
      const rawJson = JSON.stringify({
        version: 3,
        mangas: [
          {
            title: 'Tower of God',
            genre: ['Action', 'Fantasy', 'Manhwa'],
            status: 1,
          },
        ],
      });

      const gzipBuffer = zlib.gzipSync(Buffer.from(rawJson, 'utf-8'));
      const result = detectBackupFormat(gzipBuffer);

      expect(result.isGzip).toBe(true);
      expect(result.format).toBe('mihon_json');
      expect(result.version).toBe(3);
      expect(result.decompressedBuffer).toBeDefined();
      expect(result.parsedJson.mangas[0].title).toBe('Tower of God');
    });

    it('returns unknown for corrupted GZIP streams', () => {
      // Valid gzip magic header 0x1f 0x8b followed by corrupt random bytes
      const corruptGzip = Buffer.from([0x1f, 0x8b, 0x00, 0x99, 0x88, 0x77, 0x66]);
      const result = detectBackupFormat(corruptGzip);

      expect(result.format).toBe('unknown');
      expect(result.isGzip).toBe(true);
    });

    it('returns unknown for plain non-backup JSON objects', () => {
      const payload = JSON.stringify({
        appName: 'RandomApp',
        theme: 'dark',
        settings: { notifications: true },
      });

      const result = detectBackupFormat(payload);
      expect(result.format).toBe('unknown');
      expect(result.isGzip).toBe(false);
    });

    it('returns unknown for empty or arbitrary non-JSON strings', () => {
      expect(detectBackupFormat('').format).toBe('unknown');
      expect(detectBackupFormat('random plain text payload').format).toBe('unknown');
      expect(detectBackupFormat(Buffer.alloc(0)).format).toBe('unknown');
    });
  });

  describe('Parser & Normalization Pipeline', () => {
    it('parses and normalizes manga attributes, chapters, and reading history', () => {
      const sampleBackup = {
        version: 2,
        mangas: [
          {
            title: 'Solo Leveling (나 혼자만 레벨업)',
            author: 'Chugong',
            artist: 'DUBU (REDICE STUDIO)',
            description: 'In a world where awakened hunters battle deadly monsters...',
            genre: ['Action', 'Fantasy', 'Manhwa', 'Supernatural'],
            status: 2, // COMPLETED
            source: 'Asura Scans',
            url: 'https://asura.gg/series/solo-leveling',
            thumbnail_url: 'https://cdn.example.com/covers/solo.webp',
            chapters: [
              {
                name: 'Chapter 01 - E-Rank Hunter',
                chapter_number: 1,
                scanlator: 'Asura',
                read: true,
                last_page_read: 15,
                url: '/chapter/1',
              },
              {
                name: 'Chapter 02 - Double Dungeon',
                chapter_number: 2,
                scanlator: 'Asura',
                read: false,
                last_page_read: 0,
                url: '/chapter/2',
              },
            ],
            history: [
              {
                chapter_url: '/chapter/1',
                read_at: 1698840000000,
              },
            ],
          },
        ],
      };

      const parsed = parseTachiyomiBackup(sampleBackup, 'mihon_json');
      expect(parsed.mangas.length).toBe(1);

      const normalized = normalizeBackup(parsed);
      expect(normalized.format).toBe('mihon_json');
      expect(normalized.version).toBe(2);
      expect(normalized.seriesCount).toBe(1);
      expect(normalized.chapterCount).toBe(2);

      const series = normalized.series[0];
      expect(series.titlePrimary).toBe('Solo Leveling (나 혼자만 레벨업)');
      expect(series.slug).toBe('solo-leveling');
      expect(series.type).toBe('manhwa'); // deduced from genre 'Manhwa' and source 'Asura Scans'
      expect(series.status).toBe('completed'); // mapped from status 2
      expect(series.author).toBe('Chugong');
      expect(series.artist).toBe('DUBU (REDICE STUDIO)');
      expect(series.genres).toContain('Fantasy');
      expect(series.coverUrl).toBe('https://cdn.example.com/covers/solo.webp');

      // Check extracted alternative titles
      const altTitles = series.titles.map((t) => t.title);
      expect(altTitles).toContain('Solo Leveling (나 혼자만 레벨업)');
      expect(altTitles).toContain('나 혼자만 레벨업');

      // Check chapters
      expect(series.chapters.length).toBe(2);
      expect(series.chapters[0].chapterNumber).toBe(1);
      expect(series.chapters[0].isRead).toBe(true);
      expect(series.chapters[0].lastPageRead).toBe(15);
      expect(series.chapters[0].readAt).toBeInstanceOf(Date);
      expect(series.chapters[0].readAt?.getTime()).toBe(1698840000000);

      expect(series.chapters[1].chapterNumber).toBe(2);
      expect(series.chapters[1].isRead).toBe(false);
      expect(series.chapters[1].readAt).toBeNull();
    });

    it('correctly maps various status codes and text values', () => {
      const createMangaWithStatus = (status: any) => ({
        title: `Series ${status}`,
        genre: ['Action'],
        status,
        chapters: [],
      });

      const parsed = parseTachiyomiBackup({
        mangas: [
          createMangaWithStatus(1), // ONGOING
          createMangaWithStatus(2), // COMPLETED
          createMangaWithStatus(5), // CANCELLED
          createMangaWithStatus(6), // ON_HIATUS
          createMangaWithStatus('Publishing Finished'), // completed
          createMangaWithStatus('On Hiatus'), // hiatus
        ],
      });

      const normalized = normalizeBackup(parsed);
      expect(normalized.series[0].status).toBe('ongoing');
      expect(normalized.series[1].status).toBe('completed');
      expect(normalized.series[2].status).toBe('cancelled');
      expect(normalized.series[3].status).toBe('hiatus');
      expect(normalized.series[4].status).toBe('completed');
      expect(normalized.series[5].status).toBe('hiatus');
    });

    it('correctly deduces series type from genres and source indicators', () => {
      const backup = {
        mangas: [
          {
            title: 'Korean Webtoon',
            genre: ['Drama', 'Webtoon'],
            chapters: [],
          },
          {
            title: 'Chinese Cultivation',
            genre: ['Martial Arts', 'Manhua'],
            chapters: [],
          },
          {
            title: 'Classic Manga',
            genre: ['Shounen', 'Action'],
            chapters: [],
          },
          {
            title: 'Superhero Comic',
            genre: ['Action', 'Western Comic'],
            chapters: [],
          },
        ],
      };

      const normalized = normalizeBackup(parseTachiyomiBackup(backup));
      expect(normalized.series[0].type).toBe('manhwa');
      expect(normalized.series[1].type).toBe('manhua');
      expect(normalized.series[2].type).toBe('manga');
      expect(normalized.series[3].type).toBe('comic');
    });

    it('handles comma-separated string genres and extracts chapter numbers from names', () => {
      const backup = [
        {
          title: 'Naruto',
          genre: 'Action, Adventure, Martial Arts',
          chapters: [
            { name: 'Ch. 1 - Uzumaki Naruto' },
            { name: 'Ch. 2 - Konohamaru' },
            { name: 'Chapter 10.5 - Extra' },
          ],
        },
      ];

      const normalized = normalizeBackup(parseTachiyomiBackup(backup));
      const naruto = normalized.series[0];

      expect(naruto.genres).toEqual(['Action', 'Adventure', 'Martial Arts']);
      expect(naruto.chapters.length).toBe(3);
      expect(naruto.chapters[0].chapterNumber).toBe(1);
      expect(naruto.chapters[1].chapterNumber).toBe(2);
      expect(naruto.chapters[2].chapterNumber).toBe(10.5);
    });

    it('end-to-end importBackup processes GZIP buffer and throws on unknown format', () => {
      const json = JSON.stringify({
        version: 2,
        mangas: [
          {
            title: 'Fullmetal Alchemist',
            author: 'Hiromu Arakawa',
            genre: ['Action', 'Adventure', 'Steampunk'],
            status: 2,
            chapters: [{ name: 'Chapter 1', chapter_number: 1, read: true }],
          },
        ],
      });

      const gzip = zlib.gzipSync(Buffer.from(json));
      const result = importBackup(gzip);

      expect(result.seriesCount).toBe(1);
      expect(result.series[0].titlePrimary).toBe('Fullmetal Alchemist');
      expect(result.series[0].status).toBe('completed');
      expect(result.series[0].chapters[0].isRead).toBe(true);

      // Throws on unknown input
      expect(() => importBackup('invalid-not-backup')).toThrowError('Unknown or unsupported backup format');
    });
  });
});
