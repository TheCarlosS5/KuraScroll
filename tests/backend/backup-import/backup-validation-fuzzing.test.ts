import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {
  validateBackup,
  ValidationReport,
} from '../../../src/backend/backup-import/index';

describe('Senior QA & Resilience Suite: Backup Migration Validation & Corruption Fuzzing (Sprint 11.2)', () => {
  // =========================================================================
  // 1. Truncated & Corrupted Stream Fuzzing
  // =========================================================================
  describe('1. Truncated JSON & Corrupted Stream Fuzzing', () => {
    it('1.1: handles JSON abruptly truncated midway without unhandled exceptions', () => {
      // Simulates an interrupted network download or cut-off file transfer
      const fullJson = JSON.stringify({
        version: 2,
        mangas: [
          {
            title: 'Berserk',
            author: 'Kentarou Miura',
            chapters: [
              { name: 'Chapter 1', chapterNumber: 1 },
              { name: 'Chapter 2', chapterNumber: 2 },
            ],
          },
        ],
      });

      // Truncate at character 45
      const truncated = fullJson.slice(0, 45);

      const report = validateBackup(truncated);
      expect(report.valid).toBe(false);
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.errors.some((e) => e.includes('Corrupted or truncated JSON'))).toBe(true);
      expect(report.validSeriesCount).toBe(0);
    });

    it('1.2: catches truncated/corrupted GZIP streams gracefully', () => {
      const validGzipHeader = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const corruptPayload = Buffer.concat([validGzipHeader, crypto.randomBytes(32)]);

      const report = validateBackup(corruptPayload);
      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes('Corrupted or truncated GZIP'))).toBe(true);
    });

    it('1.3: rejects empty or blank payloads gracefully', () => {
      expect(validateBackup('').valid).toBe(false);
      expect(validateBackup('    ').valid).toBe(false);
      expect(validateBackup(Buffer.alloc(0)).valid).toBe(false);
      expect(validateBackup(null as any).valid).toBe(false);
      expect(validateBackup(undefined as any).valid).toBe(false);
    });
  });

  // =========================================================================
  // 2. Cross-Type & Schema Violation Fuzzing
  // =========================================================================
  describe('2. Cross-Type & Schema Violations', () => {
    it('2.1: flags title as number instead of string', () => {
      const payload = {
        version: 2,
        mangas: [
          {
            title: 123456, // Cross-type violation: number instead of string
            author: 'Unknown',
          },
        ],
      };

      const report = validateBackup(payload);
      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes('title must be a string'))).toBe(true);
      expect(report.validSeriesCount).toBe(0);
    });

    it('2.2: flags chapters as an object instead of an array', () => {
      const payload = {
        version: 2,
        mangas: [
          {
            title: 'Chainsaw Man',
            chapters: { '0': { name: 'Ch 1', chapterNumber: 1 } }, // Object instead of Array
          },
        ],
      };

      const report = validateBackup(payload);
      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes('chapters must be an array'))).toBe(true);
    });

    it('2.3: flags series with missing or empty title strings', () => {
      const payload = {
        version: 2,
        mangas: [
          { author: 'Author Only' }, // Missing title
          { title: '', author: 'Blank Title' }, // Empty string
          { title: '   ', author: 'Whitespace Title' }, // Whitespace
        ],
      };

      const report = validateBackup(payload);
      expect(report.valid).toBe(false);
      expect(report.errors.length).toBeGreaterThanOrEqual(3);
      expect(report.validSeriesCount).toBe(0);
    });

    it('2.4: flags non-array mangas/data container', () => {
      const payload = {
        version: 2,
        mangas: 'this should be an array',
      };

      const report = validateBackup(payload);
      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes('"mangas" field must be an array'))).toBe(true);
    });
  });

  // =========================================================================
  // 3. Chapter Number Integrity & Bounds
  // =========================================================================
  describe('3. Chapter Number Integrity & Bounds', () => {
    it('3.1: rejects negative chapter numbers', () => {
      const payload = {
        mangas: [
          {
            title: 'Monster',
            chapters: [
              { name: 'Prologue', chapterNumber: 0 }, // Valid
              { name: 'Invalid Chap', chapterNumber: -5 }, // Negative
            ],
          },
        ],
      };

      const report = validateBackup(payload);
      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes('negative chapter number (-5)'))).toBe(true);
    });

    it('3.2: rejects NaN chapter numbers', () => {
      const payload = {
        mangas: [
          {
            title: 'Vinland Saga',
            chapters: [
              { name: 'Chapter One', chapterNumber: NaN },
              { name: 'Chapter Two', chapterNumber: 'not-a-number' },
            ],
          },
        ],
      };

      const report = validateBackup(payload);
      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes('invalid/NaN chapter number'))).toBe(true);
    });

    it('3.3: accepts valid chapter numbers (including decimal 0.5, 10.5, and 0)', () => {
      const payload = {
        mangas: [
          {
            title: 'One Piece',
            chapters: [
              { name: 'Chapter 0 (One-Shot)', chapterNumber: 0 },
              { name: 'Chapter 1', chapterNumber: 1 },
              { name: 'Chapter 10.5 (Special)', chapterNumber: 10.5 },
              { name: 'Chapter 1100', chapterNumber: 1100 },
            ],
          },
        ],
      };

      const report = validateBackup(payload);
      expect(report.valid).toBe(true);
      expect(report.errors.length).toBe(0);
      expect(report.totalChapters).toBe(4);
      expect(report.validSeriesCount).toBe(1);
    });
  });

  // =========================================================================
  // 4. Duplicate Series Detection & Deduplication (50 Duplicates)
  // =========================================================================
  describe('4. Duplicate Detection & Deduplication (50 Duplicates)', () => {
    it('4.1: automatically deduplicates 50 repeated instances of a series with warnings without invalidating backup', () => {
      const duplicateCount = 50;
      const mangas: any[] = [];

      // Generate 50 duplicate entries of "Solo Leveling" across different simulated categories
      for (let i = 0; i < duplicateCount; i++) {
        mangas.push({
          title: 'Solo Leveling',
          author: 'Chugong',
          artist: 'DUBU',
          url: '/manga/solo-leveling',
          source: 'mangadex',
          chapters: [{ name: `Chapter ${i + 1}`, chapterNumber: i + 1 }],
        });
      }

      const payload = {
        version: 2,
        mangas,
      };

      const report = validateBackup(payload);

      // Duplicates must NOT cause the backup to fail (valid remains true)
      expect(report.valid).toBe(true);
      expect(report.errors.length).toBe(0);
      expect(report.totalSeries).toBe(50);
      // Only 1 unique valid series
      expect(report.validSeriesCount).toBe(1);
      // Exactly 49 duplicate warnings logged
      expect(report.warnings.length).toBe(49);
      expect(report.deduplicatedCount).toBe(49);
      expect(
        report.warnings.every((w) => w.includes('Duplicate series detected: "Solo Leveling"'))
      ).toBe(true);
    });

    it('4.2: correctly differentiates distinct series with different titles/URLs', () => {
      const payload = {
        mangas: [
          { title: 'Berserk', url: '/manga/berserk', source: 'mangadex' },
          { title: 'Vagabond', url: '/manga/vagabond', source: 'mangadex' },
          { title: 'Vinland Saga', url: '/manga/vinland-saga', source: 'mangadex' },
        ],
      };

      const report = validateBackup(payload);
      expect(report.valid).toBe(true);
      expect(report.totalSeries).toBe(3);
      expect(report.validSeriesCount).toBe(3);
      expect(report.warnings.length).toBe(0);
      expect(report.deduplicatedCount).toBe(0);
    });
  });

  // =========================================================================
  // 5. Extreme Unicode, Emojis, and Diacritics
  // =========================================================================
  describe('5. Extreme Unicode, Emojis, and Diacritics Support', () => {
    it('5.1: cleanly validates and preserves titles with Arabic, Kanji, Hangul, Cyrillic, diacritics, and emojis', () => {
      const multilingualSeries = [
        {
          title: 'مغامرات جوجو العجيبة: ستار الغبار 🌟',
          author: 'هيروهيكو أراكي',
          description: 'رحلة إلى مصر لهزيمة ديو.',
        },
        {
          title: '進撃の巨人 - 悔いなき選択 (Attack on Titan)',
          author: '諫山創',
          description: 'リヴァイ兵長の過去を描く公式スピンオフ！',
        },
        {
          title: '나 혼자만 레벨업 ⚔️ 👑 (Solo Leveling)',
          author: '추공 (Chugong)',
          description: '인류 최약병기 성진우의 각성!',
        },
        {
          title: 'Берсерк: Золотой век (Berserk: Golden Age)',
          author: 'Кэнтаро Миура',
          description: 'История Гатса и Банды Ястреба.',
        },
        {
          title: 'Truyện Tranh Đại Chiến Cực Kì Hấp Dẫn - Tiếng Việt',
          author: 'Tác giả Việt Nam',
          description: 'Dấu thanh điệu tiếng Việt: ắ, ằ, ẳ, ẵ, ặ, ấ, ầ, ẩ, ẫ, ậ, đ.',
        },
        {
          title: '🔥 Legendary Reader! 📖 ✨ 🚀 💫',
          author: 'Emoji Master 🎉',
          description: 'Mixed unicode & complex symbols: ⛩️ 🏯 🗼 🗽.',
        },
      ];

      const payload = {
        version: 2,
        mangas: multilingualSeries,
      };

      const report = validateBackup(payload);
      expect(report.valid).toBe(true);
      expect(report.errors.length).toBe(0);
      expect(report.totalSeries).toBe(6);
      expect(report.validSeriesCount).toBe(6);
    });

    it('5.2: works seamlessly when encoded as UTF-8 string or Buffer', () => {
      const jsonStr = JSON.stringify({
        mangas: [{ title: '鬼滅の刃 🗡️ (Demon Slayer)', author: '吾峠呼世晴' }],
      });

      const buffer = Buffer.from(jsonStr, 'utf-8');
      const report = validateBackup(buffer);

      expect(report.valid).toBe(true);
      expect(report.validSeriesCount).toBe(1);
    });
  });

  // =========================================================================
  // 6. SQL Injection & Null-Byte Exploit Defenses
  // =========================================================================
  describe('6. SQL Injection & Null-Byte Exploit Defenses', () => {
    it('6.1: catches malicious SQL injection in title or author fields', () => {
      const maliciousPayload = {
        mangas: [
          {
            title: "Berserk'; DROP TABLE series;--",
            author: 'Hacker',
          },
          {
            title: 'Normal Title',
            author: "' UNION SELECT * FROM sqlite_master;--",
          },
          {
            title: "Exploit 1' OR '1'='1",
            author: "Admin'; DELETE FROM chapters; --",
          },
        ],
      };

      const report = validateBackup(maliciousPayload);
      expect(report.valid).toBe(false);
      expect(report.errors.length).toBeGreaterThanOrEqual(3);
      expect(report.errors.some((e) => e.includes('Potential SQL injection'))).toBe(true);
      expect(report.validSeriesCount).toBe(0);
    });

    it('6.2: catches null-byte truncation attacks (\\0) in text fields', () => {
      const nullBytePayload = {
        mangas: [
          {
            title: 'Innocent_Looking_Title\0.exe',
            author: 'Exploit Author',
          },
          {
            title: 'Another Title',
            description: 'Some text with a sneaky null byte: \0 danger',
          },
        ],
      };

      const report = validateBackup(nullBytePayload);
      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes('illegal null byte (\\0)'))).toBe(true);
    });

    it('6.3: catches illegal ASCII control characters (0x01-0x1F)', () => {
      const controlCharPayload = {
        mangas: [
          {
            title: 'Corrupted\x07\x08Title',
            author: 'Bad\x1BInput',
          },
        ],
      };

      const report = validateBackup(controlCharPayload);
      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes('illegal ASCII control characters'))).toBe(true);
    });

    it('6.4: does NOT false-positive on legitimate punctuation, contractions, or titles', () => {
      const legitimateTitles = [
        "JoJo's Bizarre Adventure",
        "Don't Toy With Me, Miss Nagatoro",
        'Steins;Gate',
        'Fate/stay night: Unlimited Blade Works',
        'Kaguya-sama: Love Is War!',
        'Re:Zero - Starting Life in Another World',
        'That Time I Got Reincarnated as a Slime',
      ];

      const payload = {
        mangas: legitimateTitles.map((title) => ({ title, author: "Author's Name" })),
      };

      const report = validateBackup(payload);
      expect(report.valid).toBe(true);
      expect(report.errors.length).toBe(0);
      expect(report.validSeriesCount).toBe(legitimateTitles.length);
    });
  });

  // =========================================================================
  // 7. Physical Bounds & DoS Limits
  // =========================================================================
  describe('7. Physical Bounds & DoS Limits', () => {
    it('7.1: rejects oversized payloads exceeding maxPayloadBytes limit without memory exhaustion', () => {
      // Test with custom maxPayloadBytes limit of 2KB
      const oversizedPayload = Buffer.alloc(4096, 'A');

      const report = validateBackup(oversizedPayload, { maxPayloadBytes: 2048 });
      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes('exceeds maximum allowed limit'))).toBe(true);
    });

    it('7.2: rejects backups exceeding maximum series safety limit (e.g. 50,000 series)', () => {
      // Test limit enforcement with maxSeriesCount: 5
      const mangas = Array.from({ length: 10 }, (_, i) => ({ title: `Series ${i + 1}` }));
      const payload = { mangas };

      const report = validateBackup(payload, { maxSeriesCount: 5 });
      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes('exceeds safety limit of 5 entries'))).toBe(true);
    });

    it('7.3: rejects backups exceeding maximum chapters safety limit', () => {
      const payload = {
        mangas: [
          {
            title: 'Infinite Chapters',
            chapters: Array.from({ length: 20 }, (_, i) => ({
              name: `Ch ${i}`,
              chapterNumber: i,
            })),
          },
        ],
      };

      const report = validateBackup(payload, { maxChaptersCount: 10 });
      expect(report.valid).toBe(false);
      expect(report.errors.some((e) => e.includes('exceeds safety limit of 10 entries'))).toBe(true);
    });
  });

  // =========================================================================
  // 8. Blanket Resilience: Never Throws Unhandled Exceptions
  // =========================================================================
  describe('8. Blanket Resilience: Never Throws Unhandled Exceptions', () => {
    it('8.1: survives arbitrary random binary noise fuzzing without crashing', () => {
      for (let run = 0; run < 15; run++) {
        const noise = crypto.randomBytes(64 + run * 32);
        expect(() => {
          const report = validateBackup(noise);
          expect(report.valid).toBe(false);
          expect(Array.isArray(report.errors)).toBe(true);
          expect(Array.isArray(report.warnings)).toBe(true);
        }).not.toThrow();
      }
    });

    it('8.2: survives malformed primitives and circular references', () => {
      expect(() => validateBackup(123456 as any)).not.toThrow();
      expect(() => validateBackup(true as any)).not.toThrow();
      expect(() => validateBackup(Symbol('malicious') as any)).not.toThrow();

      // Object with throwing getter
      const explosiveObject = {
        get mangas() {
          throw new Error('Boom in getter!');
        },
      };

      expect(() => {
        const report = validateBackup(explosiveObject);
        expect(report.valid).toBe(false);
        expect(report.errors.some((e) => e.includes('Boom in getter!'))).toBe(true);
      }).not.toThrow();
    });
  });
});
