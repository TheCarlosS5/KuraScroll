import { DatabaseInstance, Statement } from '../db/database.js';

export interface SynthParams {
  waveType?: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
  baseFrequencyHz?: number;
  frequencyDropToHz?: number;
  attackMs?: number;
  decayMs?: number;
  gain?: number;
  filterCutoffHz?: number;
}

export interface AudioTrackInput {
  chapterId: string;
  startPage?: number;
  endPage?: number | null;
  trackKind?: 'ambient' | 'battle' | 'tension' | 'silence';
  ambientPreset?: 'rain' | 'storm' | 'fire' | 'tavern' | 'wind' | 'eerie' | 'battle' | 'silence';
  assetUrl?: string | null;
  volumeLevel?: number;
  loopEnabled?: boolean;
}

export interface AudioTrackRecord {
  id: number;
  chapterId: string;
  startPage: number;
  endPage: number | null;
  trackKind: 'ambient' | 'battle' | 'tension' | 'silence';
  ambientPreset: 'rain' | 'storm' | 'fire' | 'tavern' | 'wind' | 'eerie' | 'battle' | 'silence';
  assetUrl: string | null;
  volumeLevel: number;
  loopEnabled: boolean;
  createdAt: string;
}

export interface SfxCueInput {
  chapterId: string;
  pageNumber: number;
  cueIndex?: number;
  sfxId: string;
  onomatopoeiaText: string;
  triggerType?: 'on_enter' | 'on_scroll_pct' | 'on_tap';
  triggerOffsetPct?: number;
  synthParams?: SynthParams;
  volumeLevel?: number;
}

export interface SfxCueRecord {
  id: number;
  chapterId: string;
  pageNumber: number;
  cueIndex: number;
  sfxId: string;
  onomatopoeiaText: string;
  triggerType: 'on_enter' | 'on_scroll_pct' | 'on_tap';
  triggerOffsetPct: number;
  synthParams: SynthParams;
  volumeLevel: number;
  createdAt: string;
}

export interface ChapterAudioManifest {
  chapterId: string;
  tracks: AudioTrackRecord[];
  cuesByPage: Record<number, SfxCueRecord[]>;
  totalCues: number;
}

export class AudioSFXService {
  private stmtInsertTrack: Statement;
  private stmtGetTracksByChapter: Statement;
  private stmtGetTrackForPage: Statement;
  private stmtDeleteTrack: Statement;

  private stmtInsertCue: Statement;
  private stmtGetCuesByPage: Statement;
  private stmtGetCuesByChapter: Statement;
  private stmtDeleteCue: Statement;

  constructor(private readonly db: DatabaseInstance) {
    this.stmtInsertTrack = this.db.prepare(`
      INSERT INTO chapter_audio_tracks (
        chapter_id, start_page, end_page, track_kind, ambient_preset,
        asset_url, volume_level, loop_enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.stmtGetTracksByChapter = this.db.prepare(`
      SELECT 
        id, chapter_id AS chapterId, start_page AS startPage, end_page AS endPage,
        track_kind AS trackKind, ambient_preset AS ambientPreset, asset_url AS assetUrl,
        volume_level AS volumeLevel, loop_enabled AS loopEnabled, created_at AS createdAt
      FROM chapter_audio_tracks
      WHERE chapter_id = ?
      ORDER BY start_page ASC
    `);

    this.stmtGetTrackForPage = this.db.prepare(`
      SELECT 
        id, chapter_id AS chapterId, start_page AS startPage, end_page AS endPage,
        track_kind AS trackKind, ambient_preset AS ambientPreset, asset_url AS assetUrl,
        volume_level AS volumeLevel, loop_enabled AS loopEnabled, created_at AS createdAt
      FROM chapter_audio_tracks
      WHERE chapter_id = ?
        AND start_page <= ?
        AND (end_page IS NULL OR end_page >= ?)
      ORDER BY start_page DESC
      LIMIT 1
    `);

    this.stmtDeleteTrack = this.db.prepare(`
      DELETE FROM chapter_audio_tracks WHERE id = ?
    `);

    this.stmtInsertCue = this.db.prepare(`
      INSERT INTO chapter_sfx_cues (
        chapter_id, page_number, cue_index, sfx_id, onomatopoeia_text,
        trigger_type, trigger_offset_pct, synth_params_json, volume_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(chapter_id, page_number, cue_index) DO UPDATE SET
        sfx_id = excluded.sfx_id,
        onomatopoeia_text = excluded.onomatopoeia_text,
        trigger_type = excluded.trigger_type,
        trigger_offset_pct = excluded.trigger_offset_pct,
        synth_params_json = excluded.synth_params_json,
        volume_level = excluded.volume_level
    `);

    this.stmtGetCuesByPage = this.db.prepare(`
      SELECT 
        id, chapter_id AS chapterId, page_number AS pageNumber, cue_index AS cueIndex,
        sfx_id AS sfxId, onomatopoeia_text AS onomatopoeiaText, trigger_type AS triggerType,
        trigger_offset_pct AS triggerOffsetPct, synth_params_json AS synthParamsJson,
        volume_level AS volumeLevel, created_at AS createdAt
      FROM chapter_sfx_cues
      WHERE chapter_id = ? AND page_number = ?
      ORDER BY cue_index ASC
    `);

    this.stmtGetCuesByChapter = this.db.prepare(`
      SELECT 
        id, chapter_id AS chapterId, page_number AS pageNumber, cue_index AS cueIndex,
        sfx_id AS sfxId, onomatopoeia_text AS onomatopoeiaText, trigger_type AS triggerType,
        trigger_offset_pct AS triggerOffsetPct, synth_params_json AS synthParamsJson,
        volume_level AS volumeLevel, created_at AS createdAt
      FROM chapter_sfx_cues
      WHERE chapter_id = ?
      ORDER BY page_number ASC, cue_index ASC
    `);

    this.stmtDeleteCue = this.db.prepare(`
      DELETE FROM chapter_sfx_cues WHERE id = ?
    `);
  }

  /**
   * Adds an ambient background track for a chapter or page range.
   */
  public addAudioTrack(track: AudioTrackInput): AudioTrackRecord {
    if (!track.chapterId) {
      throw new Error('chapterId is required');
    }
    const startPage = track.startPage ?? 1;
    const endPage = track.endPage ?? null;
    const trackKind = track.trackKind ?? 'ambient';
    const ambientPreset = track.ambientPreset ?? 'rain';
    const volumeLevel = Math.max(0.0, Math.min(1.0, track.volumeLevel ?? 0.5));
    const loopEnabled = track.loopEnabled !== false ? 1 : 0;

    const result = this.stmtInsertTrack.run(
      track.chapterId,
      startPage,
      endPage,
      trackKind,
      ambientPreset,
      track.assetUrl ?? null,
      volumeLevel,
      loopEnabled
    );

    return {
      id: Number(result.lastInsertRowid),
      chapterId: track.chapterId,
      startPage,
      endPage,
      trackKind,
      ambientPreset,
      assetUrl: track.assetUrl ?? null,
      volumeLevel,
      loopEnabled: loopEnabled === 1,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves all ambient audio tracks configured for a chapter.
   */
  public getAudioTracksForChapter(chapterId: string): AudioTrackRecord[] {
    const rows = this.stmtGetTracksByChapter.all(chapterId) as any[];
    return rows.map((r) => this.hydrateTrackRow(r));
  }

  /**
   * Retrieves the active ambient track for a specific page number.
   */
  public getAudioTrackForPage(chapterId: string, pageNumber: number): AudioTrackRecord | null {
    const row = this.stmtGetTrackForPage.get(chapterId, pageNumber, pageNumber) as any;
    return row ? this.hydrateTrackRow(row) : null;
  }

  /**
   * Adds or updates a dynamic SFX cue for a page.
   */
  public addSfxCue(cue: SfxCueInput): SfxCueRecord {
    if (!cue.chapterId || typeof cue.pageNumber !== 'number' || !cue.sfxId || !cue.onomatopoeiaText) {
      throw new Error('Invalid SFX cue parameters');
    }

    const cueIndex = cue.cueIndex ?? 0;
    const triggerType = cue.triggerType ?? 'on_enter';
    const triggerOffsetPct = Math.max(0.0, Math.min(100.0, cue.triggerOffsetPct ?? 0.0));
    const volumeLevel = Math.max(0.0, Math.min(1.0, cue.volumeLevel ?? 0.8));
    const synthParamsJson = JSON.stringify(cue.synthParams ?? {});

    const result = this.stmtInsertCue.run(
      cue.chapterId,
      cue.pageNumber,
      cueIndex,
      cue.sfxId,
      cue.onomatopoeiaText,
      triggerType,
      triggerOffsetPct,
      synthParamsJson,
      volumeLevel
    );

    return {
      id: Number(result.lastInsertRowid),
      chapterId: cue.chapterId,
      pageNumber: cue.pageNumber,
      cueIndex,
      sfxId: cue.sfxId,
      onomatopoeiaText: cue.onomatopoeiaText,
      triggerType,
      triggerOffsetPct,
      synthParams: cue.synthParams ?? {},
      volumeLevel,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Batch imports SFX cues for high-throughput ingestion.
   */
  public addSfxCuesBatch(cues: SfxCueInput[]): number {
    let count = 0;
    for (const cue of cues) {
      this.addSfxCue(cue);
      count++;
    }
    return count;
  }

  /**
   * Retrieves all SFX cues associated with a single page.
   */
  public getSfxCuesForPage(chapterId: string, pageNumber: number): SfxCueRecord[] {
    const rows = this.stmtGetCuesByPage.all(chapterId, pageNumber) as any[];
    return rows.map((r) => this.hydrateCueRow(r));
  }

  /**
   * Retrieves the full audio manifest (ambient tracks + SFX cues) for a chapter.
   */
  public getChapterAudioManifest(chapterId: string): ChapterAudioManifest {
    const tracks = this.getAudioTracksForChapter(chapterId);
    const cueRows = this.stmtGetCuesByChapter.all(chapterId) as any[];

    const cuesByPage: Record<number, SfxCueRecord[]> = {};
    for (const r of cueRows) {
      const cue = this.hydrateCueRow(r);
      if (!cuesByPage[cue.pageNumber]) {
        cuesByPage[cue.pageNumber] = [];
      }
      cuesByPage[cue.pageNumber].push(cue);
    }

    return {
      chapterId,
      tracks,
      cuesByPage,
      totalCues: cueRows.length,
    };
  }

  /**
   * Deletes an audio track by id.
   */
  public deleteAudioTrack(id: number): boolean {
    const res = this.stmtDeleteTrack.run(id);
    return Number(res.changes) > 0;
  }

  /**
   * Deletes an SFX cue by id.
   */
  public deleteSfxCue(id: number): boolean {
    const res = this.stmtDeleteCue.run(id);
    return Number(res.changes) > 0;
  }

  private hydrateTrackRow(r: any): AudioTrackRecord {
    return {
      id: Number(r.id),
      chapterId: String(r.chapterId),
      startPage: Number(r.startPage),
      endPage: r.endPage !== null ? Number(r.endPage) : null,
      trackKind: r.trackKind,
      ambientPreset: r.ambientPreset,
      assetUrl: r.assetUrl ? String(r.assetUrl) : null,
      volumeLevel: Number(r.volumeLevel),
      loopEnabled: Number(r.loopEnabled) === 1,
      createdAt: String(r.createdAt),
    };
  }

  private hydrateCueRow(r: any): SfxCueRecord {
    let synthParams: SynthParams = {};
    try {
      if (r.synthParamsJson) {
        synthParams = JSON.parse(r.synthParamsJson);
      }
    } catch {
      synthParams = {};
    }

    return {
      id: Number(r.id),
      chapterId: String(r.chapterId),
      pageNumber: Number(r.pageNumber),
      cueIndex: Number(r.cueIndex),
      sfxId: String(r.sfxId),
      onomatopoeiaText: String(r.onomatopoeiaText),
      triggerType: r.triggerType,
      triggerOffsetPct: Number(r.triggerOffsetPct),
      synthParams,
      volumeLevel: Number(r.volumeLevel),
      createdAt: String(r.createdAt),
    };
  }
}
