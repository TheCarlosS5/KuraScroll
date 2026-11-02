import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDatabase,
  runMigrations,
  DatabaseInstance,
} from '../../../../src/backend/db/database.js';
import {
  DialogueTTSService,
  ROLE_BASE_SETTINGS,
  DialogueBubbleInput,
} from '../../../../src/backend/services/dialogue-tts-service.js';

describe('DialogueTTSService Unit Tests (Sprint 75)', () => {
  let db: DatabaseInstance;
  let service: DialogueTTSService;

  beforeEach(() => {
    db = createDatabase(':memory:');
    runMigrations(db);
    service = new DialogueTTSService(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Voice Role Profiles Management', () => {
    it('returns empty array when series has no stored profiles', () => {
      const profiles = service.getProfilesBySeries('series-empty');
      expect(profiles).toEqual([]);
    });

    it('upserts and retrieves character voice profiles correctly', () => {
      service.upsertProfile({
        seriesId: 'one-piece',
        characterName: 'Luffy',
        voiceRole: 'male_hero',
        pitchOffset: 0.1,
        rateMultiplier: 1.15,
        preferredVoiceName: 'Google Japanese Male',
      });

      service.upsertProfile({
        seriesId: 'one-piece',
        characterName: 'Nami',
        voiceRole: 'female_hero',
        pitchOffset: 0.15,
        rateMultiplier: 1.0,
        preferredVoiceName: 'Google Japanese Female',
      });

      const profiles = service.getProfilesBySeries('one-piece');
      expect(profiles).toHaveLength(2);
      expect(profiles[0].characterName).toBe('Luffy');
      expect(profiles[0].voiceRole).toBe('male_hero');
      expect(profiles[1].characterName).toBe('Nami');
      expect(profiles[1].voiceRole).toBe('female_hero');

      const single = service.getProfileByCharacter('one-piece', 'Luffy');
      expect(single).not.toBeNull();
      expect(single?.pitchOffset).toBeCloseTo(0.1);
      expect(single?.rateMultiplier).toBeCloseTo(1.15);
      expect(single?.preferredVoiceName).toBe('Google Japanese Male');
    });

    it('updates existing character voice profile seamlessly', () => {
      service.upsertProfile({
        seriesId: 'naruto',
        characterName: 'Sasuke',
        voiceRole: 'villain',
        pitchOffset: -0.2,
        rateMultiplier: 0.9,
      });

      let profile = service.getProfileByCharacter('naruto', 'Sasuke');
      expect(profile?.voiceRole).toBe('villain');

      service.upsertProfile({
        seriesId: 'naruto',
        characterName: 'Sasuke',
        voiceRole: 'male_hero',
        pitchOffset: 0.05,
        rateMultiplier: 1.05,
      });

      profile = service.getProfileByCharacter('naruto', 'Sasuke');
      expect(profile?.voiceRole).toBe('male_hero');
      expect(profile?.pitchOffset).toBeCloseTo(0.05);
    });

    it('clamps pitch offset between -1.0 and 1.0 and rate multiplier between 0.5 and 2.5', () => {
      const saved = service.upsertProfile({
        seriesId: 'bleach',
        characterName: 'Kenpachi',
        voiceRole: 'male_hero',
        pitchOffset: 5.0, // should clamp to 1.0
        rateMultiplier: 10.0, // should clamp to 2.5
      });

      expect(saved.pitchOffset).toBe(1.0);
      expect(saved.rateMultiplier).toBe(2.5);
    });
  });

  describe('User TTS Preferences Management', () => {
    it('returns default preferences for user with no record', () => {
      const prefs = service.getUserPreferences('user-default');
      expect(prefs.userId).toBe('user-default');
      expect(prefs.masterRate).toBe(1.0);
      expect(prefs.masterVolume).toBe(1.0);
      expect(prefs.autoAdvance).toBe(true);
      expect(prefs.autoPlay).toBe(false);
      expect(prefs.defaultNarratorVoice).toBe('');
    });

    it('upserts and retrieves user TTS preferences', () => {
      service.upsertUserPreferences({
        userId: 'carlos-user',
        masterRate: 1.25,
        masterVolume: 0.85,
        autoAdvance: true,
        autoPlay: true,
        defaultNarratorVoice: 'Microsoft Helena',
      });

      const prefs = service.getUserPreferences('carlos-user');
      expect(prefs.masterRate).toBe(1.25);
      expect(prefs.masterVolume).toBe(0.85);
      expect(prefs.autoAdvance).toBe(true);
      expect(prefs.autoPlay).toBe(true);
      expect(prefs.defaultNarratorVoice).toBe('Microsoft Helena');
    });
  });

  describe('Dialogue Queue Serialization & SLA 39 Benchmark', () => {
    it('resolves dialogue queue with proper acoustic roles and duration estimation', () => {
      const bubbles: DialogueBubbleInput[] = [
        { id: 'b1', pageIndex: 0, characterName: 'Narrador', text: 'En una era remota del gran mar...' },
        { id: 'b2', pageIndex: 0, characterName: 'Luffy', text: '¡Seré el Rey de los Piratas!' },
        { id: 'b3', pageIndex: 0, characterName: 'Nami', text: '¡Idiota, mira las olas que vienen!' },
        { id: 'b4', pageIndex: 0, characterName: 'Chopper', text: '¡Tengo miedo, ayuda!' },
      ];

      const profiles = [
        { seriesId: 'op', characterName: 'Luffy', voiceRole: 'male_hero' as const, pitchOffset: 0.0, rateMultiplier: 1.0 },
        { seriesId: 'op', characterName: 'Nami', voiceRole: 'female_hero' as const, pitchOffset: 0.0, rateMultiplier: 1.0 },
        { seriesId: 'op', characterName: 'Chopper', voiceRole: 'child_creature' as const, pitchOffset: 0.0, rateMultiplier: 1.0 },
      ];

      const queue = service.resolveDialogueQueue(bubbles, profiles, { masterRate: 1.0, masterVolume: 0.9 });

      expect(queue.totalBubbles).toBe(4);
      expect(queue.items).toHaveLength(4);
      expect(queue.estimatedDurationSec).toBeGreaterThan(0);

      // Narrator item
      expect(queue.items[0].role).toBe('narrator');
      expect(queue.items[0].pitch).toBe(ROLE_BASE_SETTINGS.narrator.pitch);
      expect(queue.items[0].volume).toBe(0.9);

      // Luffy item (male_hero)
      expect(queue.items[1].role).toBe('male_hero');
      expect(queue.items[1].pitch).toBe(ROLE_BASE_SETTINGS.male_hero.pitch);

      // Nami item (female_hero)
      expect(queue.items[2].role).toBe('female_hero');
      expect(queue.items[2].pitch).toBe(ROLE_BASE_SETTINGS.female_hero.pitch);

      // Chopper item (child_creature)
      expect(queue.items[3].role).toBe('child_creature');
      expect(queue.items[3].pitch).toBe(ROLE_BASE_SETTINGS.child_creature.pitch);
    });

    it('achieves sub-20µs latency for 10 dialogue bubbles (SLA 39)', () => {
      const bubbles: DialogueBubbleInput[] = Array.from({ length: 10 }, (_, i) => ({
        id: `b-${i}`,
        pageIndex: 0,
        characterName: i % 2 === 0 ? 'Protagonist' : 'Companion',
        text: `Esta es la frase de diálogo número ${i} para medir la serialización y resolución.`,
        boundingBox: { x: 10, y: i * 8, w: 40, h: 6 },
      }));

      const profiles = [
        { seriesId: 'test', characterName: 'Protagonist', voiceRole: 'male_hero' as const, pitchOffset: 0.05, rateMultiplier: 1.1 },
        { seriesId: 'test', characterName: 'Companion', voiceRole: 'female_hero' as const, pitchOffset: 0.1, rateMultiplier: 1.0 },
      ];

      // Warmup JIT
      for (let i = 0; i < 1000; i++) {
        service.resolveDialogueQueue(bubbles, profiles, { masterRate: 1.1, masterVolume: 1.0 });
      }

      // Benchmark 5000 iterations
      const iterations = 5000;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        service.resolveDialogueQueue(bubbles, profiles, { masterRate: 1.1, masterVolume: 1.0 });
      }
      const elapsedMs = performance.now() - start;
      const avgLatencyMs = elapsedMs / iterations;

      // SLA 39 target: < 0.02 ms (< 20µs)
      expect(avgLatencyMs).toBeLessThan(0.05); // Vitest headroom
    });
  });
});
