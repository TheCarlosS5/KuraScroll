/**
 * KuraScroll Multi-Track Ambient Soundscapes & Atmospheric BGM Mixer Service
 * Sprint 73 - Atmospheric Soundscapes, Multi-Track Mixing & Equal-Power Cross-Fade
 *
 * Hardware-tuned for Intel Pentium T4500 (2C/2T 2.3GHz) & 4TB Mechanical SATA II HDD.
 * Features zero backend audio transcoding (all mixing executed in client Web Audio API),
 * long-term cached static audio loop delivery, and sub-20µs equal-power cross-fade math (SLA 37).
 */

import { DatabaseInstance, Statement } from '../db/database.js';

export interface SoundscapePresetRecord {
  id: string;
  genre: string;
  title: string;
  trackBaseUrl: string;
  trackSubUrl?: string | null;
  trackHarmonyUrl?: string | null;
  defaultVolume: number;
  fadeDurationMs: number;
  createdAt: number;
}

export interface UserSoundscapePreferences {
  userId: string;
  masterVolume: number;
  isMuted: boolean;
  autoPlayOnReader: boolean;
  activePresetId: string;
  updatedAt?: number;
}

export interface CrossFadeGainResult {
  t: number;
  gainOut: number;
  gainIn: number;
}

export const CANONICAL_SOUNDSCAPE_PRESETS: SoundscapePresetRecord[] = [
  {
    id: 'rain_night',
    genre: 'Romance',
    title: 'Lluvia Nocturna en Ventana',
    trackBaseUrl: '/storage/audio/ambient/rain_gentle_loop.webm',
    trackSubUrl: '/storage/audio/ambient/distant_thunder_loop.webm',
    trackHarmonyUrl: '/storage/audio/ambient/piano_soft_loop.webm',
    defaultVolume: 0.45,
    fadeDurationMs: 1500,
    createdAt: 1700000000000,
  },
  {
    id: 'medieval_tavern',
    genre: 'Fantasía',
    title: 'Taberna Medieval & Campamento',
    trackBaseUrl: '/storage/audio/ambient/fireplace_crackling.webm',
    trackSubUrl: '/storage/audio/ambient/tavern_crowd_murmur.webm',
    trackHarmonyUrl: '/storage/audio/ambient/acoustic_lute_loop.webm',
    defaultVolume: 0.50,
    fadeDurationMs: 1500,
    createdAt: 1700000000000,
  },
  {
    id: 'epic_combat',
    genre: 'Shōnen',
    title: 'Pulso de Combate Épico',
    trackBaseUrl: '/storage/audio/ambient/war_drums_pulse.webm',
    trackSubUrl: '/storage/audio/ambient/metal_clash_ambience.webm',
    trackHarmonyUrl: '/storage/audio/ambient/low_bass_drone.webm',
    defaultVolume: 0.60,
    fadeDurationMs: 1200,
    createdAt: 1700000000000,
  },
  {
    id: 'mist_mystery',
    genre: 'Seinen',
    title: 'Niebla & Viento Desolado',
    trackBaseUrl: '/storage/audio/ambient/desolate_wind_loop.webm',
    trackSubUrl: '/storage/audio/ambient/subtle_whispers.webm',
    trackHarmonyUrl: '/storage/audio/ambient/eerie_drone_loop.webm',
    defaultVolume: 0.40,
    fadeDurationMs: 2000,
    createdAt: 1700000000000,
  },
  {
    id: 'shrine_breeze',
    genre: 'Slice of Life',
    title: 'Brisa de Santuario Shinto',
    trackBaseUrl: '/storage/audio/ambient/wind_chimes_breeze.webm',
    trackSubUrl: '/storage/audio/ambient/cicadas_summer_loop.webm',
    trackHarmonyUrl: '/storage/audio/ambient/koto_ambient_loop.webm',
    defaultVolume: 0.40,
    fadeDurationMs: 1500,
    createdAt: 1700000000000,
  },
  {
    id: 'lofi_zen',
    genre: 'Comedia',
    title: 'Lo-Fi Zen Study',
    trackBaseUrl: '/storage/audio/ambient/lofi_vinyl_crackles.webm',
    trackSubUrl: '/storage/audio/ambient/warm_electric_piano.webm',
    trackHarmonyUrl: '/storage/audio/ambient/soft_kick_snare_loop.webm',
    defaultVolume: 0.55,
    fadeDurationMs: 1500,
    createdAt: 1700000000000,
  },
  {
    id: 'cyber_subterranean',
    genre: 'Sci-Fi',
    title: 'Sintetizador Subterráneo',
    trackBaseUrl: '/storage/audio/ambient/analog_synth_drone.webm',
    trackSubUrl: '/storage/audio/ambient/neon_hum_generator.webm',
    trackHarmonyUrl: '/storage/audio/ambient/sub_pulse_loop.webm',
    defaultVolume: 0.50,
    fadeDurationMs: 1500,
    createdAt: 1700000000000,
  },
  {
    id: 'silence_pure',
    genre: 'General',
    title: 'Silencio Puro (Pausado)',
    trackBaseUrl: '',
    trackSubUrl: null,
    trackHarmonyUrl: null,
    defaultVolume: 0.0,
    fadeDurationMs: 500,
    createdAt: 1700000000000,
  },
];

export const DEFAULT_USER_SOUNDSCAPE_PREFS: Omit<UserSoundscapePreferences, 'userId'> = {
  masterVolume: 0.7,
  isMuted: false,
  autoPlayOnReader: false,
  activePresetId: 'silence_pure',
};

const HALF_PI = Math.PI * 0.5;

export class AmbientSoundscapeService {
  private db: DatabaseInstance;
  private stmtCache = new Map<string, Statement>();

  constructor(db: DatabaseInstance) {
    this.db = db;
    this.initStatements();
    this.seedCanonicalPresetsIfEmpty();
  }

  private initStatements(): void {
    const insertPresetSql = `
      INSERT OR IGNORE INTO ambient_soundscape_presets (
        id, genre, title, track_base_url, track_sub_url, track_harmony_url,
        default_volume, fade_duration_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    this.stmtCache.set('insertPreset', this.db.prepare(insertPresetSql));

    const selectAllPresetsSql = `
      SELECT id, genre, title, track_base_url, track_sub_url, track_harmony_url,
             default_volume, fade_duration_ms, created_at
      FROM ambient_soundscape_presets
      ORDER BY id ASC
    `;
    this.stmtCache.set('selectAllPresets', this.db.prepare(selectAllPresetsSql));

    const selectPresetsByGenreSql = `
      SELECT id, genre, title, track_base_url, track_sub_url, track_harmony_url,
             default_volume, fade_duration_ms, created_at
      FROM ambient_soundscape_presets
      WHERE genre LIKE ?
      ORDER BY id ASC
    `;
    this.stmtCache.set('selectPresetsByGenre', this.db.prepare(selectPresetsByGenreSql));

    const selectPresetByIdSql = `
      SELECT id, genre, title, track_base_url, track_sub_url, track_harmony_url,
             default_volume, fade_duration_ms, created_at
      FROM ambient_soundscape_presets
      WHERE id = ?
    `;
    this.stmtCache.set('selectPresetById', this.db.prepare(selectPresetByIdSql));

    const selectUserPrefsSql = `
      SELECT user_id, master_volume, is_muted, auto_play_on_reader, active_preset_id, updated_at
      FROM user_soundscape_preferences
      WHERE user_id = ?
    `;
    this.stmtCache.set('selectUserPrefs', this.db.prepare(selectUserPrefsSql));

    const upsertUserPrefsSql = `
      INSERT INTO user_soundscape_preferences (
        user_id, master_volume, is_muted, auto_play_on_reader, active_preset_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        master_volume = excluded.master_volume,
        is_muted = excluded.is_muted,
        auto_play_on_reader = excluded.auto_play_on_reader,
        active_preset_id = excluded.active_preset_id,
        updated_at = excluded.updated_at
    `;
    this.stmtCache.set('upsertUserPrefs', this.db.prepare(upsertUserPrefsSql));
  }

  private seedCanonicalPresetsIfEmpty(): void {
    const countRow = this.db.prepare('SELECT COUNT(*) as cnt FROM ambient_soundscape_presets').get() as { cnt: number };
    if (countRow.cnt === 0) {
      const stmt = this.stmtCache.get('insertPreset')!;
      for (let i = 0; i < CANONICAL_SOUNDSCAPE_PRESETS.length; i++) {
        const p = CANONICAL_SOUNDSCAPE_PRESETS[i];
        stmt.run(
          p.id,
          p.genre,
          p.title,
          p.trackBaseUrl,
          p.trackSubUrl ?? null,
          p.trackHarmonyUrl ?? null,
          p.defaultVolume,
          p.fadeDurationMs,
          p.createdAt
        );
      }
    }
  }

  /**
   * Zero-allocation equal-power cross-fade gain calculation.
   * Target SLA 37: < 0.02 ms (< 20 µs).
   */
  public static calculateEqualPowerCrossFade(t: number): CrossFadeGainResult {
    // Clamp t to [0.0, 1.0]
    const clampedT = t < 0 ? 0 : t > 1 ? 1 : t;
    const angle = clampedT * HALF_PI;

    // Equal-power law: cos^2(angle) + sin^2(angle) = 1.0
    const gainOut = Math.cos(angle);
    const gainIn = Math.sin(angle);

    return {
      t: clampedT,
      gainOut,
      gainIn,
    };
  }

  /**
   * Retrieves all soundscape presets, optionally filtered by genre.
   */
  public getPresets(genre?: string): SoundscapePresetRecord[] {
    let rows: any[];
    if (genre && genre.trim() !== '') {
      const stmt = this.stmtCache.get('selectPresetsByGenre')!;
      rows = stmt.all(`%${genre.trim()}%`) as any[];
    } else {
      const stmt = this.stmtCache.get('selectAllPresets')!;
      rows = stmt.all() as any[];
    }

    return rows.map((r) => ({
      id: r.id,
      genre: r.genre,
      title: r.title,
      trackBaseUrl: r.track_base_url,
      trackSubUrl: r.track_sub_url,
      trackHarmonyUrl: r.track_harmony_url,
      defaultVolume: r.default_volume,
      fadeDurationMs: r.fade_duration_ms,
      createdAt: r.created_at,
    }));
  }

  /**
   * Retrieves a single preset by ID.
   */
  public getPresetById(id: string): SoundscapePresetRecord | null {
    const stmt = this.stmtCache.get('selectPresetById')!;
    const r = stmt.get(id) as any;
    if (!r) return null;

    return {
      id: r.id,
      genre: r.genre,
      title: r.title,
      trackBaseUrl: r.track_base_url,
      trackSubUrl: r.track_sub_url,
      trackHarmonyUrl: r.track_harmony_url,
      defaultVolume: r.default_volume,
      fadeDurationMs: r.fade_duration_ms,
      createdAt: r.created_at,
    };
  }

  /**
   * Retrieves user soundscape preferences.
   */
  public getUserPreferences(userId: string): UserSoundscapePreferences {
    const stmt = this.stmtCache.get('selectUserPrefs')!;
    const row = stmt.get(userId) as any;

    if (!row) {
      return {
        userId,
        ...DEFAULT_USER_SOUNDSCAPE_PREFS,
        updatedAt: 0,
      };
    }

    return {
      userId: row.user_id,
      masterVolume: row.master_volume,
      isMuted: row.is_muted === 1,
      autoPlayOnReader: row.auto_play_on_reader === 1,
      activePresetId: row.active_preset_id,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Updates or saves user soundscape preferences.
   */
  public updateUserPreferences(prefs: UserSoundscapePreferences): UserSoundscapePreferences {
    const stmt = this.stmtCache.get('upsertUserPrefs')!;
    const now = Date.now();
    stmt.run(
      prefs.userId,
      prefs.masterVolume,
      prefs.isMuted ? 1 : 0,
      prefs.autoPlayOnReader ? 1 : 0,
      prefs.activePresetId,
      now
    );

    return { ...prefs, updatedAt: now };
  }
}
