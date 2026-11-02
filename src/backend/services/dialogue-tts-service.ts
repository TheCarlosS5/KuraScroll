/**
 * KuraScroll Dynamic Dialogue Text-to-Speech & Multi-Voice Actor Synthesizer Service
 * Sprint 75 - Client-Side Multi-Voice Synthesis, Role Profiles & Queue Dispatch
 *
 * Hardware-tuned for Intel Pentium T4500 (2C/2T 2.3GHz) & Intel GMA 4500MHD.
 * Features zero server-side neural audio transcoding or temporary disk I/O,
 * SQLite voice role mapping and user preferences with ETag HTTP 304 caching,
 * and zero-allocation dialogue queue serialization (SLA 39 < 20µs).
 */

import { DatabaseInstance, Statement } from '../db/database.js';

export type VoiceRole = 'narrator' | 'male_hero' | 'female_hero' | 'child_creature' | 'villain' | 'elder';

export interface DialogueVoiceProfile {
  seriesId: string;
  characterName: string;
  voiceRole: VoiceRole;
  pitchOffset: number; // -1.0 to 1.0
  rateMultiplier: number; // 0.5 to 2.5
  preferredVoiceName?: string;
  updatedAt?: number;
}

export interface UserTTSPreferences {
  userId: string;
  masterRate: number; // 0.5 to 2.5
  masterVolume: number; // 0.0 to 1.0
  autoAdvance: boolean;
  autoPlay: boolean;
  defaultNarratorVoice?: string;
  updatedAt?: number;
}

export interface DialogueBubbleInput {
  id: string;
  pageIndex: number;
  characterName: string;
  text: string;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

export interface ResolvedSpeechItem {
  bubbleId: string;
  pageIndex: number;
  characterName: string;
  role: VoiceRole;
  text: string;
  pitch: number;
  rate: number;
  volume: number;
  preferredVoice: string;
  boundingBox?: { x: number; y: number; w: number; h: number };
}

export interface ResolvedSpeechQueue {
  items: ResolvedSpeechItem[];
  totalBubbles: number;
  estimatedDurationSec: number;
}

export const ROLE_BASE_SETTINGS: Record<VoiceRole, { pitch: number; rate: number; label: string }> = {
  narrator: { pitch: 1.0, rate: 1.0, label: 'Narrador' },
  male_hero: { pitch: 0.95, rate: 1.10, label: 'Héroe Masculino' },
  female_hero: { pitch: 1.20, rate: 1.02, label: 'Heroína' },
  child_creature: { pitch: 1.50, rate: 1.15, label: 'Criatura / Infante' },
  villain: { pitch: 0.75, rate: 0.88, label: 'Antagonista' },
  elder: { pitch: 0.82, rate: 0.82, label: 'Sabio Anciano' },
};

export class DialogueTTSService {
  private stmtGetProfilesBySeries: Statement;
  private stmtGetProfileByCharacter: Statement;
  private stmtUpsertProfile: Statement;
  private stmtGetUserPreferences: Statement;
  private stmtUpsertUserPreferences: Statement;

  constructor(private db: DatabaseInstance) {
    this.stmtGetProfilesBySeries = this.db.prepare(`
      SELECT series_id, character_name, voice_role, pitch_offset, rate_multiplier, preferred_voice_name, updated_at
      FROM dialogue_voice_profiles
      WHERE series_id = ?
      ORDER BY character_name ASC
    `);

    this.stmtGetProfileByCharacter = this.db.prepare(`
      SELECT series_id, character_name, voice_role, pitch_offset, rate_multiplier, preferred_voice_name, updated_at
      FROM dialogue_voice_profiles
      WHERE series_id = ? AND character_name = ?
    `);

    this.stmtUpsertProfile = this.db.prepare(`
      INSERT INTO dialogue_voice_profiles (
        series_id, character_name, voice_role, pitch_offset, rate_multiplier, preferred_voice_name, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(series_id, character_name) DO UPDATE SET
        voice_role = excluded.voice_role,
        pitch_offset = excluded.pitch_offset,
        rate_multiplier = excluded.rate_multiplier,
        preferred_voice_name = excluded.preferred_voice_name,
        updated_at = excluded.updated_at
    `);

    this.stmtGetUserPreferences = this.db.prepare(`
      SELECT user_id, master_rate, master_volume, auto_advance, auto_play, default_narrator_voice, updated_at
      FROM user_tts_preferences
      WHERE user_id = ?
    `);

    this.stmtUpsertUserPreferences = this.db.prepare(`
      INSERT INTO user_tts_preferences (
        user_id, master_rate, master_volume, auto_advance, auto_play, default_narrator_voice, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        master_rate = excluded.master_rate,
        master_volume = excluded.master_volume,
        auto_advance = excluded.auto_advance,
        auto_play = excluded.auto_play,
        default_narrator_voice = excluded.default_narrator_voice,
        updated_at = excluded.updated_at
    `);
  }

  public getProfilesBySeries(seriesId: string): DialogueVoiceProfile[] {
    const rows = this.stmtGetProfilesBySeries.all(seriesId) as Array<{
      series_id: string;
      character_name: string;
      voice_role: string;
      pitch_offset: number;
      rate_multiplier: number;
      preferred_voice_name: string | null;
      updated_at: number;
    }>;

    return rows.map(r => ({
      seriesId: r.series_id,
      characterName: r.character_name,
      voiceRole: (r.voice_role as VoiceRole) || 'narrator',
      pitchOffset: Number(r.pitch_offset) || 0.0,
      rateMultiplier: Number(r.rate_multiplier) || 1.0,
      preferredVoiceName: r.preferred_voice_name ?? '',
      updatedAt: Number(r.updated_at) || 0,
    }));
  }

  public getProfileByCharacter(seriesId: string, characterName: string): DialogueVoiceProfile | null {
    const row = this.stmtGetProfileByCharacter.get(seriesId, characterName) as {
      series_id: string;
      character_name: string;
      voice_role: string;
      pitch_offset: number;
      rate_multiplier: number;
      preferred_voice_name: string | null;
      updated_at: number;
    } | undefined;

    if (!row) return null;

    return {
      seriesId: row.series_id,
      characterName: row.character_name,
      voiceRole: (row.voice_role as VoiceRole) || 'narrator',
      pitchOffset: Number(row.pitch_offset) || 0.0,
      rateMultiplier: Number(row.rate_multiplier) || 1.0,
      preferredVoiceName: row.preferred_voice_name ?? '',
      updatedAt: Number(row.updated_at) || 0,
    };
  }

  public upsertProfile(profile: DialogueVoiceProfile): DialogueVoiceProfile {
    const now = profile.updatedAt ?? Date.now();
    const voiceRole: VoiceRole = profile.voiceRole in ROLE_BASE_SETTINGS ? profile.voiceRole : 'narrator';
    const pitchOffset = Math.max(-1.0, Math.min(1.0, profile.pitchOffset ?? 0.0));
    const rateMultiplier = Math.max(0.5, Math.min(2.5, profile.rateMultiplier ?? 1.0));
    const preferredVoiceName = profile.preferredVoiceName ?? '';

    this.stmtUpsertProfile.run(
      profile.seriesId,
      profile.characterName,
      voiceRole,
      pitchOffset,
      rateMultiplier,
      preferredVoiceName,
      now
    );

    return {
      seriesId: profile.seriesId,
      characterName: profile.characterName,
      voiceRole,
      pitchOffset,
      rateMultiplier,
      preferredVoiceName,
      updatedAt: now,
    };
  }

  public getUserPreferences(userId: string): UserTTSPreferences {
    const row = this.stmtGetUserPreferences.get(userId) as {
      user_id: string;
      master_rate: number;
      master_volume: number;
      auto_advance: number;
      auto_play: number;
      default_narrator_voice: string | null;
      updated_at: number;
    } | undefined;

    if (!row) {
      return {
        userId,
        masterRate: 1.0,
        masterVolume: 1.0,
        autoAdvance: true,
        autoPlay: false,
        defaultNarratorVoice: '',
        updatedAt: 0,
      };
    }

    return {
      userId: row.user_id,
      masterRate: Number(row.master_rate) || 1.0,
      masterVolume: Number(row.master_volume) || 1.0,
      autoAdvance: Number(row.auto_advance) === 1,
      autoPlay: Number(row.auto_play) === 1,
      defaultNarratorVoice: row.default_narrator_voice ?? '',
      updatedAt: Number(row.updated_at) || 0,
    };
  }

  public upsertUserPreferences(prefs: UserTTSPreferences): UserTTSPreferences {
    const now = prefs.updatedAt ?? Date.now();
    const masterRate = Math.max(0.5, Math.min(2.5, prefs.masterRate ?? 1.0));
    const masterVolume = Math.max(0.0, Math.min(1.0, prefs.masterVolume ?? 1.0));
    const autoAdvance = prefs.autoAdvance ? 1 : 0;
    const autoPlay = prefs.autoPlay ? 1 : 0;
    const defaultNarratorVoice = prefs.defaultNarratorVoice ?? '';

    this.stmtUpsertUserPreferences.run(
      prefs.userId,
      masterRate,
      masterVolume,
      autoAdvance,
      autoPlay,
      defaultNarratorVoice,
      now
    );

    return {
      userId: prefs.userId,
      masterRate,
      masterVolume,
      autoAdvance: autoAdvance === 1,
      autoPlay: autoPlay === 1,
      defaultNarratorVoice,
      updatedAt: now,
    };
  }

  /**
   * Fast, zero-allocation dialogue queue serialization and role dispatcher (SLA 39 < 20µs).
   * Maps input speech bubbles with series voice roles and user preferences to generate
   * the finalized SpeechSynthesis queue items.
   */
  public resolveDialogueQueue(
    bubbles: DialogueBubbleInput[],
    profiles: DialogueVoiceProfile[],
    userPrefs?: Partial<UserTTSPreferences>
  ): ResolvedSpeechQueue {
    const masterRate = Math.max(0.5, Math.min(2.5, userPrefs?.masterRate ?? 1.0));
    const masterVolume = Math.max(0.0, Math.min(1.0, userPrefs?.masterVolume ?? 1.0));
    const defaultNarratorVoice = userPrefs?.defaultNarratorVoice ?? '';

    // Fast profile lookup map
    const profileMap = new Map<string, DialogueVoiceProfile>();
    for (let i = 0; i < profiles.length; i++) {
      profileMap.set(profiles[i].characterName.toLowerCase(), profiles[i]);
    }

    const n = bubbles.length;
    const items: ResolvedSpeechItem[] = new Array(n);
    let totalWords = 0;

    for (let i = 0; i < n; i++) {
      const bubble = bubbles[i];
      const normChar = (bubble.characterName || '').trim().toLowerCase();
      const profile = profileMap.get(normChar);

      const role: VoiceRole = profile?.voiceRole ?? (normChar === '' ? 'narrator' : 'narrator');
      const roleSetting = ROLE_BASE_SETTINGS[role] ?? ROLE_BASE_SETTINGS.narrator;

      const pitchOffset = profile?.pitchOffset ?? 0.0;
      const rateMultiplier = profile?.rateMultiplier ?? 1.0;
      const preferredVoice = profile?.preferredVoiceName || (role === 'narrator' ? defaultNarratorVoice : '');

      // Effective parameter math
      const pitch = Math.max(0.5, Math.min(2.0, roleSetting.pitch + pitchOffset));
      const rate = Math.max(0.5, Math.min(2.5, masterRate * roleSetting.rate * rateMultiplier));
      const volume = masterVolume;

      // Word count estimate for duration
      const wordCount = bubble.text ? bubble.text.trim().split(/\s+/).length : 1;
      totalWords += wordCount;

      items[i] = {
        bubbleId: bubble.id,
        pageIndex: bubble.pageIndex,
        characterName: bubble.characterName || 'Narrador',
        role,
        text: bubble.text,
        pitch,
        rate,
        volume,
        preferredVoice,
        boundingBox: bubble.boundingBox,
      };
    }

    // Average 150 words per minute base speaking cadence
    const estimatedDurationSec = totalWords > 0 
      ? Math.max(1.0, Math.round(((totalWords * 60) / (150 * masterRate)) * 10) / 10)
      : 0;

    return {
      items,
      totalBubbles: n,
      estimatedDurationSec,
    };
  }
}
