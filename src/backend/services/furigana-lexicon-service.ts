/**
 * KuraScroll CJK Furigana & Manga Lore Lexicon Engine
 * Sprint 62 - Zero-Latency Japanese Kanji Furigana & Manhwa Lore Terminology Popover
 *
 * Designed for Intel Pentium T4500 (V8 heap <= 512MB) and 4TB mechanical SATA II HDD.
 * Features a bounded in-memory LRU cache (1,000 entries, < 250KB RAM),
 * half-width Katakana and Unicode NFC normalization, and prepared SQLite B-Tree index point lookups.
 */

import { DatabaseInstance, Statement } from '../db/database.js';
import crypto from 'node:crypto';

export type LexiconCategory = 'KANJI' | 'VOCAB' | 'SERIES_LORE' | 'NAME' | 'SFX';

export interface LexiconEntryInput {
  id?: string;
  term: string;
  reading: string;
  romaji: string;
  category: LexiconCategory;
  definitionEs: string;
  definitionEn?: string;
  seriesId?: string | null;
  frequency?: number;
}

export interface LexiconEntry {
  id: string;
  term: string;
  reading: string;
  romaji: string;
  category: LexiconCategory;
  definitionEs: string;
  definitionEn?: string;
  seriesId: string | null;
  frequency: number;
  createdAt: string;
  updatedAt: string;
}

export const MAX_LRU_ENTRIES = 1000;

export class FuriganaLexiconService {
  private db: DatabaseInstance;
  private lruCache: Map<string, LexiconEntry> = new Map();
  private stmtCache: Map<string, Statement> = new Map();

  private hitCount = 0;
  private missCount = 0;

  constructor(db: DatabaseInstance) {
    this.db = db;
    this.initStatements();
    this.seedDefaultEntries();
  }

  private initStatements(): void {
    const upsertSql = `
      INSERT INTO cjk_lexicon_entries (
        id, term, reading, romaji, category, definition_es, definition_en, series_id, frequency, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(term, series_id) DO UPDATE SET
        reading = excluded.reading,
        romaji = excluded.romaji,
        category = excluded.category,
        definition_es = excluded.definition_es,
        definition_en = excluded.definition_en,
        frequency = cjk_lexicon_entries.frequency + 1,
        updated_at = datetime('now')
    `;
    this.stmtCache.set('upsert', this.db.prepare(upsertSql));

    const selectSeriesSpecificSql = `
      SELECT id, term, reading, romaji, category, definition_es, definition_en, series_id, frequency, created_at, updated_at
      FROM cjk_lexicon_entries
      WHERE term = ? AND series_id = ?
      LIMIT 1
    `;
    this.stmtCache.set('selectSeriesSpecific', this.db.prepare(selectSeriesSpecificSql));

    const selectGlobalSql = `
      SELECT id, term, reading, romaji, category, definition_es, definition_en, series_id, frequency, created_at, updated_at
      FROM cjk_lexicon_entries
      WHERE term = ? AND series_id IS NULL
      LIMIT 1
    `;
    this.stmtCache.set('selectGlobal', this.db.prepare(selectGlobalSql));

    const searchSql = `
      SELECT id, term, reading, romaji, category, definition_es, definition_en, series_id, frequency, created_at, updated_at
      FROM cjk_lexicon_entries
      WHERE (term LIKE ? OR reading LIKE ? OR romaji LIKE ?)
      ORDER BY frequency DESC
      LIMIT ?
    `;
    this.stmtCache.set('search', this.db.prepare(searchSql));

    const countSql = `SELECT COUNT(*) as count FROM cjk_lexicon_entries`;
    this.stmtCache.set('count', this.db.prepare(countSql));
  }

  /**
   * Normalizes CJK strings:
   * 1. Unicode NFKC normalization (automatically converts half-width Katakana and dakuten to full-width)
   * 2. Trim whitespace
   */
  public static normalizeTerm(term: string): string {
    if (!term) return '';
    return term.normalize('NFKC').trim();
  }

  private getCacheKey(term: string, seriesId?: string | null): string {
    return `${seriesId ?? 'global'}:${term}`;
  }

  private setInLruCache(key: string, entry: LexiconEntry): void {
    if (this.lruCache.has(key)) {
      this.lruCache.delete(key);
    } else if (this.lruCache.size >= MAX_LRU_ENTRIES) {
      const oldestKey = this.lruCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.lruCache.delete(oldestKey);
      }
    }
    this.lruCache.set(key, entry);
  }

  /**
   * Fast point lookup of CJK term with optional series-scoped context.
   * Execution SLA 26: < 0.5 ms (< 500 µs).
   */
  public getEntry(rawTerm: string, seriesId?: string | null): LexiconEntry | null {
    const term = FuriganaLexiconService.normalizeTerm(rawTerm);
    if (!term) return null;

    // 1. Check in-memory LRU Cache (Series-specific first)
    if (seriesId) {
      const seriesKey = this.getCacheKey(term, seriesId);
      const cachedSeries = this.lruCache.get(seriesKey);
      if (cachedSeries) {
        this.hitCount++;
        // Promote key in LRU
        this.lruCache.delete(seriesKey);
        this.lruCache.set(seriesKey, cachedSeries);
        return cachedSeries;
      }
    }

    // Check global in cache
    const globalKey = this.getCacheKey(term, null);
    const cachedGlobal = this.lruCache.get(globalKey);
    if (cachedGlobal) {
      this.hitCount++;
      this.lruCache.delete(globalKey);
      this.lruCache.set(globalKey, cachedGlobal);
      return cachedGlobal;
    }

    // 2. Query SQLite with statement cache
    this.missCount++;
    if (seriesId) {
      const stmtSeries = this.stmtCache.get('selectSeriesSpecific');
      if (stmtSeries) {
        const row = stmtSeries.get(term, seriesId) as any;
        if (row) {
          const entry = this.formatRow(row);
          this.setInLruCache(this.getCacheKey(term, seriesId), entry);
          return entry;
        }
      }
    }

    // Query global in SQLite
    const stmtGlobal = this.stmtCache.get('selectGlobal');
    if (stmtGlobal) {
      const row = stmtGlobal.get(term) as any;
      if (row) {
        const entry = this.formatRow(row);
        this.setInLruCache(globalKey, entry);
        return entry;
      }
    }

    return null;
  }

  /**
   * Searches lexicon entries by substring in term, reading, or romaji.
   */
  public searchEntries(query: string, limit = 10): LexiconEntry[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const normalized = FuriganaLexiconService.normalizeTerm(trimmed);
    const pattern = `%${normalized}%`;
    const stmt = this.stmtCache.get('search');
    if (!stmt) return [];

    const rows = stmt.all(pattern, pattern, pattern, limit) as any[];
    return rows.map((r) => this.formatRow(r));
  }

  /**
   * Upserts a new or edited lexicon entry.
   */
  public upsertEntry(input: LexiconEntryInput): LexiconEntry {
    const term = FuriganaLexiconService.normalizeTerm(input.term);
    const reading = input.reading.trim();
    const romaji = input.romaji.trim().toLowerCase();
    const id = input.id ?? `lex_${crypto.randomUUID().slice(0, 12)}`;
    const seriesId = input.seriesId ?? null;
    const frequency = input.frequency ?? 1;

    const stmt = this.stmtCache.get('upsert');
    if (stmt) {
      stmt.run(
        id,
        term,
        reading,
        romaji,
        input.category,
        input.definitionEs,
        input.definitionEn ?? null,
        seriesId,
        frequency
      );
    }

    const entry: LexiconEntry = {
      id,
      term,
      reading,
      romaji,
      category: input.category,
      definitionEs: input.definitionEs,
      definitionEn: input.definitionEn,
      seriesId,
      frequency,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const cacheKey = this.getCacheKey(term, seriesId);
    this.setInLruCache(cacheKey, entry);

    return entry;
  }

  private formatRow(row: any): LexiconEntry {
    return {
      id: row.id,
      term: row.term,
      reading: row.reading,
      romaji: row.romaji,
      category: row.category as LexiconCategory,
      definitionEs: row.definition_es,
      definitionEn: row.definition_en ?? undefined,
      seriesId: row.series_id,
      frequency: row.frequency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Diagnostic statistics for cache efficiency and memory monitoring.
   */
  public getStats(): {
    cachedEntries: number;
    totalEntries: number;
    hitCount: number;
    missCount: number;
    hitRatio: number;
    estimatedMemoryBytes: number;
  } {
    let totalEntries = 0;
    const stmt = this.stmtCache.get('count');
    if (stmt) {
      const res = stmt.get() as { count: number } | undefined;
      totalEntries = res?.count ?? 0;
    }

    const totalQueries = this.hitCount + this.missCount;
    const hitRatio = totalQueries > 0 ? this.hitCount / totalQueries : 0;
    // Each cache entry is ~180 bytes
    const estimatedMemoryBytes = this.lruCache.size * 220;

    return {
      cachedEntries: this.lruCache.size,
      totalEntries,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRatio: Math.round(hitRatio * 10000) / 100,
      estimatedMemoryBytes,
    };
  }

  /**
   * Seeds iconic manga and manhwa vocabulary terms out of the box.
   */
  public seedDefaultEntries(): number {
    const defaults: LexiconEntryInput[] = [
      {
        term: '卍解',
        reading: 'ばんかい',
        romaji: 'bankai',
        category: 'SERIES_LORE',
        definitionEs: 'Liberación final y definitiva de la Zanpakutō en Bleach, alcanzada solo por capitanes.',
        definitionEn: 'Final and most powerful form of a Soul Reaper Zanpakuto in Bleach.',
      },
      {
        term: '覇王色の覇気',
        reading: 'はおうしょくのはき',
        romaji: 'haoushoku no haki',
        category: 'SERIES_LORE',
        definitionEs: 'Haki del Rey Supremo en One Piece, la cualidad innata de intimidar y dominar la voluntad ajena.',
        definitionEn: 'Conqueror\'s Haki in One Piece, rare innate willpower capable of overpowering others.',
      },
      {
        term: '螺旋丸',
        reading: 'らせんがん',
        romaji: 'rasengan',
        category: 'SERIES_LORE',
        definitionEs: 'Técnica ninjutsu de manipulación de forma de chakra rotatorio creada por el Cuarto Hokage en Naruto.',
        definitionEn: 'Spinning ball of concentrated chakra technique invented by the Fourth Hokage in Naruto.',
      },
      {
        term: '丹田',
        reading: 'たんでん / 단전',
        romaji: 'dantian / danjeon',
        category: 'SERIES_LORE',
        definitionEs: 'Centro de almacenamiento de Qi o energía vital en novelas y manhwas de cultivo Murim.',
        definitionEn: 'Energy center in lower abdomen where Qi or inner energy is stored in Murim manhwas.',
      },
      {
        term: '内功',
        reading: 'ないこう / 내공',
        romaji: 'naikou / naegong',
        category: 'SERIES_LORE',
        definitionEs: 'Energía interna o poder marcial acumulado mediante cultivo y meditación en artes marciales.',
        definitionEn: 'Internal martial arts energy cultivated through breath and meditation.',
      },
      {
        term: '先輩',
        reading: 'せんぱい',
        romaji: 'senpai',
        category: 'VOCAB',
        definitionEs: 'Compañero mayor o superior de grado en la escuela, dojo o ámbito laboral.',
        definitionEn: 'Senior member or colleague of higher standing in school, martial arts, or work.',
      },
      {
        term: 'ドドド',
        reading: 'どどど',
        romaji: 'dododo',
        category: 'SFX',
        definitionEs: 'Onomatopeya icónica de tensión, pasos pesados o presencia intimidante común en JoJo y manga de acción.',
        definitionEn: 'Iconic rumble or menacing presence sound effect commonly seen in JoJo and action manga.',
      },
      {
        term: '念',
        reading: 'ねん',
        romaji: 'nen',
        category: 'SERIES_LORE',
        definitionEs: 'Sistema de manipulación de aura vital de Hunter x Hunter dividido en 6 naturalezas.',
        definitionEn: 'Aura manipulation technique and power system in Hunter x Hunter.',
      },
    ];

    let seeded = 0;
    for (const d of defaults) {
      try {
        this.upsertEntry(d);
        seeded++;
      } catch {
        // Ignore duplicate seeding
      }
    }
    return seeded;
  }

  public clearLruCache(): void {
    this.lruCache.clear();
  }
}
