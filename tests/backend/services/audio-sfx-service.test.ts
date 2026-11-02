import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDatabase, runMigrations, DatabaseInstance } from '../../../src/backend/db/database.js';
import { AudioSFXService } from '../../../src/backend/services/audio-sfx-service.js';

describe('AudioSFXService Unit Tests (Sprint 49)', () => {
  let db: DatabaseInstance;
  let service: AudioSFXService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new AudioSFXService(db);

    // Seed dummy series and chapter
    db.prepare(`
      INSERT INTO series (id, slug, title_primary, type, status)
      VALUES ('series-jojo', 'jojo', 'JoJo', 'manga', 'ongoing')
    `).run();

    db.prepare(`
      INSERT INTO chapters (id, series_id, chapter_number, title, storage_path)
      VALUES ('ch-jojo-1', 'series-jojo', 1, 'Dio the Invader', '/storage/jojo/ch1')
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('adds and retrieves ambient background tracks with page range resolution', () => {
    // Pages 1-5: Rain
    service.addAudioTrack({
      chapterId: 'ch-jojo-1',
      startPage: 1,
      endPage: 5,
      trackKind: 'ambient',
      ambientPreset: 'rain',
      volumeLevel: 0.4,
    });

    // Pages 6-10: Tension
    service.addAudioTrack({
      chapterId: 'ch-jojo-1',
      startPage: 6,
      endPage: 10,
      trackKind: 'tension',
      ambientPreset: 'eerie',
      volumeLevel: 0.7,
    });

    const allTracks = service.getAudioTracksForChapter('ch-jojo-1');
    expect(allTracks).toHaveLength(2);

    const trackPage3 = service.getAudioTrackForPage('ch-jojo-1', 3);
    expect(trackPage3).not.toBeNull();
    expect(trackPage3?.ambientPreset).toBe('rain');

    const trackPage8 = service.getAudioTrackForPage('ch-jojo-1', 8);
    expect(trackPage8).not.toBeNull();
    expect(trackPage8?.ambientPreset).toBe('eerie');

    const trackPage15 = service.getAudioTrackForPage('ch-jojo-1', 15);
    expect(trackPage15).toBeNull();
  });

  it('clamps track and cue volume strictly between 0.0 and 1.0', () => {
    const track = service.addAudioTrack({
      chapterId: 'ch-jojo-1',
      volumeLevel: 1.5, // over 1.0
    });
    expect(track.volumeLevel).toBe(1.0);

    const cue = service.addSfxCue({
      chapterId: 'ch-jojo-1',
      pageNumber: 2,
      sfxId: 'sfx_don',
      onomatopoeiaText: 'ドン!!',
      volumeLevel: -0.5, // under 0.0
    });
    expect(cue.volumeLevel).toBe(0.0);
  });

  it('adds individual and batch SFX cues with procedural synth parameters', () => {
    const cue = service.addSfxCue({
      chapterId: 'ch-jojo-1',
      pageNumber: 1,
      cueIndex: 0,
      sfxId: 'sfx_doki',
      onomatopoeiaText: 'ドキドキ',
      triggerType: 'on_enter',
      synthParams: {
        waveType: 'sine',
        baseFrequencyHz: 80,
        attackMs: 10,
        decayMs: 150,
        gain: 0.7,
      },
    });

    expect(cue.id).toBeGreaterThan(0);
    expect(cue.onomatopoeiaText).toBe('ドキドキ');
    expect(cue.synthParams.baseFrequencyHz).toBe(80);

    // Batch insert
    const count = service.addSfxCuesBatch([
      {
        chapterId: 'ch-jojo-1',
        pageNumber: 4,
        cueIndex: 0,
        sfxId: 'sfx_gogogo',
        onomatopoeiaText: 'ゴゴゴ...',
        synthParams: { waveType: 'sawtooth', baseFrequencyHz: 55 },
      },
      {
        chapterId: 'ch-jojo-1',
        pageNumber: 4,
        cueIndex: 1,
        sfxId: 'sfx_don',
        onomatopoeiaText: 'ドン!!',
        synthParams: { waveType: 'sine', baseFrequencyHz: 120 },
      },
    ]);

    expect(count).toBe(2);

    const page4Cues = service.getSfxCuesForPage('ch-jojo-1', 4);
    expect(page4Cues).toHaveLength(2);
    expect(page4Cues[0].onomatopoeiaText).toBe('ゴゴゴ...');
    expect(page4Cues[1].onomatopoeiaText).toBe('ドン!!');
  });

  it('retrieves full chapter audio manifest grouping cues by page', () => {
    service.addAudioTrack({
      chapterId: 'ch-jojo-1',
      startPage: 1,
      ambientPreset: 'battle',
    });

    service.addSfxCue({
      chapterId: 'ch-jojo-1',
      pageNumber: 1,
      sfxId: 'sfx_swoosh',
      onomatopoeiaText: 'ザッ',
    });

    service.addSfxCue({
      chapterId: 'ch-jojo-1',
      pageNumber: 2,
      sfxId: 'sfx_don',
      onomatopoeiaText: 'ドン!!',
    });

    const manifest = service.getChapterAudioManifest('ch-jojo-1');
    expect(manifest.chapterId).toBe('ch-jojo-1');
    expect(manifest.tracks).toHaveLength(1);
    expect(manifest.totalCues).toBe(2);
    expect(manifest.cuesByPage[1]).toHaveLength(1);
    expect(manifest.cuesByPage[2]).toHaveLength(1);
  });

  it('handles corrupt JSON in synth_params_json gracefully with fallback', () => {
    db.prepare(`
      INSERT INTO chapter_sfx_cues (
        chapter_id, page_number, cue_index, sfx_id, onomatopoeia_text, synth_params_json
      ) VALUES ('ch-jojo-1', 9, 0, 'sfx_corrupt', 'ERROR!', '{INVALID_JSON}')
    `).run();

    const cues = service.getSfxCuesForPage('ch-jojo-1', 9);
    expect(cues).toHaveLength(1);
    expect(cues[0].synthParams).toEqual({});
  });

  it('deletes tracks and cues cleanly', () => {
    const track = service.addAudioTrack({ chapterId: 'ch-jojo-1' });
    const cue = service.addSfxCue({
      chapterId: 'ch-jojo-1',
      pageNumber: 3,
      sfxId: 'sfx_del',
      onomatopoeiaText: 'DEL',
    });

    expect(service.deleteAudioTrack(track.id)).toBe(true);
    expect(service.getAudioTracksForChapter('ch-jojo-1')).toHaveLength(0);

    expect(service.deleteSfxCue(cue.id)).toBe(true);
    expect(service.getSfxCuesForPage('ch-jojo-1', 3)).toHaveLength(0);
  });
});
